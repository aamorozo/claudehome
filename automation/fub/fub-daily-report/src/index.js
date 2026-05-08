import { FUBClient } from './fub.js';
import { buildDailyReport, postToSlack } from './slack.js';

// Stage → section mapping
// Update stage names here if FUB stage names change (must be exact, case-sensitive)
const NEW_BUSINESS_STAGES = [
  'Hot Lead-Responded',
  'Referrals To Convert',
];

const MONEY_LIST_STAGES = [
  'Application',
  'Appointments',
  'No Show Appt',
  'Application-Lending Pad',
  'Pending Submission',
];

// Concurrency cap for per-lead event lookups (avoids 429 bursts)
const EVENT_CONCURRENCY = 5;

export default {
  // Cron trigger: 8:30am PDT Mon-Fri (wrangler.toml)
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  // Manual trigger: GET /?run=true
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.searchParams.get('run') === 'true') {
      ctx.waitUntil(run(env));
      return new Response('Report triggered\n', { status: 202 });
    }
    return new Response('FUB Daily Report Worker — add ?run=true to trigger manually\n');
  },
};

async function run(env) {
  const fub = new FUBClient(env.FUB_API_KEY);
  const staleDays = parseInt(env.STALE_DAYS || '5', 10);
  const lookbackDays = parseInt(env.LOOKBACK_DAYS || '10', 10);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  // Fetch all stages in parallel
  const [newBusiness, moneyList] = await Promise.all([
    fetchStages(fub, NEW_BUSINESS_STAGES, cutoffDate),
    fetchStages(fub, MONEY_LIST_STAGES, cutoffDate),
  ]);

  // Enrich each lead with last outbound date (rate-limited concurrency)
  await enrichLastOutbound(fub, [...newBusiness, ...moneyList], staleDays);

  const report = buildDailyReport({
    newBusiness,
    moneyList,
    staleDays,
    reportDate: new Date(),
  });

  await postToSlack(env.SLACK_WEBHOOK_URL, report);
  console.log(`Report posted: ${newBusiness.length} new business, ${moneyList.length} money list`);
}

async function fetchStages(fub, stages, cutoffDate) {
  const results = await Promise.all(
    stages.map(stage => fub.getPeopleByStage(stage, cutoffDate))
  );
  return results.flat();
}

async function enrichLastOutbound(fub, leads, staleDays) {
  const staleMs = staleDays * 86_400_000;

  for (let i = 0; i < leads.length; i += EVENT_CONCURRENCY) {
    const batch = leads.slice(i, i + EVENT_CONCURRENCY);
    await Promise.all(
      batch.map(async lead => {
        try {
          lead._lastOutbound = await fub.getLastOutboundDate(lead.id);
        } catch {
          lead._lastOutbound = null;
        }
        lead._isStale = !lead._lastOutbound
          || (Date.now() - lead._lastOutbound.getTime()) > staleMs;
      })
    );
  }
}
