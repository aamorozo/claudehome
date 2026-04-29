const FUB_BASE = 'https://api.followupboss.com/v1';

const MONEY_LIST_STAGES = [
  'Application',
  'Application-Lending Pad',
  'Pending Submission',
  'Appointments',
  'No Show Appt',
];

const NEW_BUSINESS_STAGES = [
  'New',
  'Hot Lead-Responded',
  'Referrals To Convert',
];

const STALE_DAYS = 5;
const LOOKBACK_DAYS = 10;

async function fubGet(path, apiKey) {
  const auth = btoa(`${apiKey}:`);
  const resp = await fetch(`${FUB_BASE}${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!resp.ok) throw new Error(`FUB ${resp.status} on ${path}`);
  return resp.json();
}

async function getLeadsByStages(stages, apiKey) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000)
    .toISOString()
    .split('T')[0];
  const leads = [];

  for (const stage of stages) {
    let offset = 0;
    while (true) {
      const data = await fubGet(
        `/people?stage=${encodeURIComponent(stage)}&updatedSince=${since}&isAssigned=true&limit=100&offset=${offset}`,
        apiKey
      );
      if (!data.people?.length) break;
      leads.push(...data.people);
      if (data.people.length < 100) break;
      offset += 100;
    }
  }

  // Deduplicate by id (person may match multiple stage queries)
  const seen = new Set();
  return leads.filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatLead(lead) {
  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
  const stage = lead.stage || '—';
  const agent = lead.assignedTo || 'Unassigned';
  // lastCommunicationAt is most accurate; fall back to lastActivityAt then updatedAt
  const lastContact = lead.lastCommunicationAt || lead.lastActivityAt || lead.updatedAt;
  const days = daysSince(lastContact);
  const flag = days > STALE_DAYS ? ' 🚨' : '';
  return `• *${name}* — ${stage} — ${days}d since contact — ${agent}${flag}`;
}

function buildSlackPayload(moneyLeads, newBizLeads) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const staleCount = [...moneyLeads, ...newBizLeads].filter((l) => {
    const lastContact = l.lastCommunicationAt || l.lastActivityAt || l.updatedAt;
    return daysSince(lastContact) > STALE_DAYS;
  }).length;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Daily Hit-List — ${today}` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*MONEY LIST* (${moneyLeads.length})\n` +
          (moneyLeads.length
            ? moneyLeads.map(formatLead).join('\n')
            : '_No active pipeline leads in last 10 days_'),
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*NEW BUSINESS* (${newBizLeads.length})\n` +
          (newBizLeads.length
            ? newBizLeads.map(formatLead).join('\n')
            : '_No new business leads in last 10 days_'),
      },
    },
  ];

  if (staleCount > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🚨 *${staleCount} lead${staleCount !== 1 ? 's' : ''} need immediate outreach* (>5 days since last contact)`,
        },
      ],
    });
  }

  return { blocks };
}

async function runReport(env) {
  const [moneyLeads, newBizLeads] = await Promise.all([
    getLeadsByStages(MONEY_LIST_STAGES, env.FUB_API_KEY),
    getLeadsByStages(NEW_BUSINESS_STAGES, env.FUB_API_KEY),
  ]);

  const payload = buildSlackPayload(moneyLeads, newBizLeads);

  const resp = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) throw new Error(`Slack webhook failed: ${resp.status}`);
  return { moneyLeads: moneyLeads.length, newBizLeads: newBizLeads.length };
}

export default {
  // Cron: 8:30am Pacific = 15:30 UTC Mon-Fri
  async scheduled(_event, env, _ctx) {
    await runReport(env);
  },

  // Manual trigger: GET /run (protected by token)
  async fetch(request, env, _ctx) {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    if (url.pathname !== '/run') return new Response('Not Found', { status: 404 });

    const token = url.searchParams.get('token');
    if (!token || token !== env.RUN_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const result = await runReport(env);
      return new Response(
        JSON.stringify({ ok: true, ...result }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
