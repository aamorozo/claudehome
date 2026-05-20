/**
 * fub-daily-report — Cloudflare Worker
 *
 * Cron: 8:30am Pacific Mon-Fri
 * Posts sectioned hit-list (New Business + Money List) to Slack #fub-dashboard.
 * Filtered to assigned leads updated within the last 10 days.
 * Flags leads with no outbound activity in >5 days with 🚨.
 *
 * Required secrets (set via `wrangler secret put`):
 *   FUB_API_KEY         — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL   — Incoming Webhook URL for #fub-dashboard
 */

const FUB_BASE = 'https://api.followupboss.com/v1';

// Edit these to match your exact FUB stage names (case-sensitive)
const NEW_BUSINESS_STAGES = [
  'New',
  'Attempted Contact',
  'Active',
  'Long Term Nurture',
  'Referrals To Convert',
];

const MONEY_LIST_STAGES = [
  'Hot Lead-Responded',
  'Application',
  'Appointments',
  'No Show Appt',
  'Application-Lending Pad',
  'Pending Submission',
];

const DAYS_LOOKBACK = 10;   // only leads updated within this many days
const STALE_DAYS    = 5;    // flag leads with no outbound contact beyond this
const MAX_PER_SECTION = 25; // cap rows per section to keep Slack readable

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },

  // Manual trigger: POST /trigger  (useful for testing)
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === '/trigger') {
      ctx.waitUntil(runDailyReport(env));
      return new Response('Report triggered', { status: 202 });
    }
    return new Response('FUB Daily Report Worker — healthy', { status: 200 });
  },
};

// ---------------------------------------------------------------------------

async function runDailyReport(env) {
  const auth    = btoa(`${env.FUB_API_KEY}:`);
  const headers = { Authorization: `Basic ${auth}` };

  const since     = daysAgo(DAYS_LOOKBACK);
  const staleDate = daysAgo(STALE_DAYS);

  const [newBiz, moneyList] = await Promise.all([
    fetchLeadsByStages(headers, NEW_BUSINESS_STAGES, since),
    fetchLeadsByStages(headers, MONEY_LIST_STAGES, since),
  ]);

  const payload = buildSlackPayload(newBiz, moneyList, staleDate);
  await postToSlack(env.SLACK_WEBHOOK_URL, payload);
}

async function fetchLeadsByStages(headers, stages, since) {
  const results = [];

  await Promise.all(
    stages.map(async (stage) => {
      const leads = await paginatePeople(headers, stage, since);
      results.push(...leads.map((p) => ({ ...p, _stage: stage })));
    })
  );

  return results;
}

async function paginatePeople(headers, stage, since) {
  const people = [];
  const limit  = 100;
  let offset   = 0;

  while (true) {
    const url = `${FUB_BASE}/people?stage=${encodeURIComponent(stage)}&updatedSince=${since}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers });

    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '10', 10);
      await sleep((wait + 2) * 1000);
      continue;
    }
    if (!res.ok) break;

    const data  = await res.json();
    const batch = (data.people || []).filter((p) => p.assignedUserId || p.assignedTo);
    people.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return people;
}

// ---------------------------------------------------------------------------

function buildSlackPayload(newBiz, moneyList, staleDate) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `FUB Hit List — ${today}` } },
    { type: 'divider' },
    ...sectionBlocks('MONEY LIST', moneyList, staleDate),
    { type: 'divider' },
    ...sectionBlocks('NEW BUSINESS', newBiz, staleDate),
    { type: 'divider' },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `_Assigned leads · updated last ${DAYS_LOOKBACK}d · 🚨 no outbound >${STALE_DAYS}d · 8:30am PT_`,
      }],
    },
  ];

  return { blocks };
}

function sectionBlocks(title, leads, staleDate) {
  const sorted = sortByLastActivity(leads).slice(0, MAX_PER_SECTION);
  const stale  = leads.filter((l) => isStale(l, staleDate)).length;
  const header = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${title}* — ${leads.length} leads${stale > 0 ? `  🚨 ${stale} stale` : ''}`,
    },
  };

  if (leads.length === 0) {
    return [header, { type: 'section', text: { type: 'mrkdwn', text: '_No active leads_' } }];
  }

  return [header, ...sorted.map((l) => leadBlock(l, staleDate))];
}

function leadBlock(lead, staleDate) {
  const name       = formatName(lead);
  const stage      = lead._stage;
  const assignee   = lead.assignedTo?.name || 'Unassigned';
  const lastAct    = lead.lastActivityAt ? new Date(lead.lastActivityAt) : null;
  const daysStr    = lastAct ? `${daysSince(lastAct)}d ago` : 'no activity';
  const staleFlag  = isStale(lead, staleDate) ? '🚨 ' : '';

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${staleFlag}*${name}* · ${stage}\n_${assignee} · last activity: ${daysStr}_`,
    },
  };
}

// ---------------------------------------------------------------------------

function formatName(lead) {
  const full = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  if (full) return full;
  return lead.emails?.[0]?.value || lead.phones?.[0]?.value || `Lead #${lead.id}`;
}

function isStale(lead, staleDate) {
  if (!lead.lastActivityAt) return true;
  return new Date(lead.lastActivityAt) < staleDate;
}

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function sortByLastActivity(leads) {
  return [...leads].sort((a, b) => {
    const aMs = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bMs = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return aMs - bMs; // oldest first = most urgent at top
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack post failed: ${res.status} ${await res.text()}`);
}
