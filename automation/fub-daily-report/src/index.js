import { FUBClient } from './fub.js';
import { buildHitListBlocks, postToSlack } from './slack.js';

const MS_PER_DAY = 86_400_000;

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

async function runReport(env) {
  const fub = new FUBClient(env.FUB_API_KEY);
  const stages = (env.STAGES || 'New Business,Money List').split(',').map((s) => s.trim());
  const lookbackDays = parseInt(env.LOOKBACK_DAYS || '10', 10);
  const staleDays = parseInt(env.STALE_DAYS || '5', 10);

  const since = new Date(Date.now() - lookbackDays * MS_PER_DAY).toISOString().slice(0, 10);

  const sections = [];
  for (const stage of stages) {
    const people = await fub.getPeopleByStage(stage, since);

    const leads = people.map((p) => {
      const days = daysAgo(p.lastActivityAt);
      return {
        name: p.name,
        phone: p.phones?.[0]?.value ?? null,
        assignedTo: typeof p.assignedTo === 'object' ? p.assignedTo?.name : p.assignedTo,
        daysSinceActivity: days,
        // Flag if last activity exceeds stale threshold — proxy for no recent outbound
        isStale: days !== null && days > staleDays,
      };
    });

    sections.push({ stageName: stage, leads });
  }

  const blocks = buildHitListBlocks(sections, todayLabel());
  await postToSlack(env.SLACK_WEBHOOK_URL, blocks);

  return {
    ok: true,
    date: todayLabel(),
    sections: sections.map((s) => ({ stage: s.stageName, count: s.leads.length })),
  };
}

export default {
  // Cron trigger: 8:30am PDT (UTC-7) Mon-Fri → "30 15 * * 1-5"
  // NOTE: Clocks shift Nov-Mar to PST (UTC-8) — update cron to "30 16 * * 1-5" in winter
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runReport(env).catch((err) => console.error('[fub-daily-report] Failed:', err.message)),
    );
  },

  // Manual HTTP trigger for testing: POST /run or GET /run?secret=...
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/run') {
      // Basic secret check to prevent accidental public triggers
      const secret = url.searchParams.get('secret') || request.headers.get('x-trigger-secret');
      if (env.TRIGGER_SECRET && secret !== env.TRIGGER_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const result = await runReport(env);
        return Response.json(result);
      } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }
    return new Response(
      'fub-daily-report\n\nEndpoints:\n  POST/GET /run?secret=TRIGGER_SECRET — manual trigger\n\nCron: 8:30am PT Mon-Fri',
      { headers: { 'Content-Type': 'text/plain' } },
    );
  },
};
