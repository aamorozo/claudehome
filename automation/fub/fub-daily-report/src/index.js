// FUB Daily Hit-List Report — Cloudflare Worker
// Cron: Mon-Fri 8:30am Pacific → posts sectioned lead list to #fub-dashboard

const FUB_BASE = 'https://api.followupboss.com/v1';
const RECENT_DAYS = 10;
const STALE_DAYS = 5;

const STAGE_GROUPS = {
  newBusiness: ['New Business'],
  moneyList: [
    'Hot Lead-Responded',
    'Application',
    'Appointments',
    'No Show Appt',
    'Application-Lending Pad',
    'Pending Submission',
    'Referrals To Convert',
  ],
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },
};

async function runDailyReport(env) {
  const auth = 'Basic ' + btoa(env.FUB_API_KEY + ':');
  const now = new Date();
  const sinceDate = new Date(now - RECENT_DAYS * 864e5).toISOString().split('T')[0];

  const [newBizLeads, moneyListLeads] = await Promise.all([
    fetchLeadsByStages(auth, STAGE_GROUPS.newBusiness, sinceDate),
    fetchLeadsByStages(auth, STAGE_GROUPS.moneyList, sinceDate),
  ]);

  const payload = buildSlackMessage(newBizLeads, moneyListLeads, now);
  await postToSlack(env.SLACK_WEBHOOK_URL, payload);
}

async function fetchLeadsByStages(auth, stages, sinceDate) {
  const leads = [];

  for (const stage of stages) {
    let offset = 0;
    while (true) {
      const url =
        `${FUB_BASE}/people?stage=${encodeURIComponent(stage)}` +
        `&updatedSince=${sinceDate}&limit=100&offset=${offset}&sort=-updated`;

      const res = await fetch(url, {
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        console.error(`FUB ${stage} error: ${res.status}`);
        break;
      }

      const { people = [] } = await res.json();
      people
        .filter((p) => p.assignedTo)
        .forEach((p) => leads.push({ ...p, _stage: stage }));

      if (people.length < 100) break;
      offset += 100;
    }
  }

  return leads;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 864e5);
}

function formatRow(lead) {
  const name = lead.name || 'Unknown';
  const agent = lead.assignedTo?.name || lead.assignedTo || 'Unassigned';
  const updatedDays = daysSince(lead.updated);
  const outboundDays = daysSince(lead.lastActivityAt);
  const stale = outboundDays !== null && outboundDays > STALE_DAYS;
  const staleFlag = stale ? ' :rotating_light:' : '';
  const updatedStr = updatedDays !== null ? `${updatedDays}d ago` : 'unknown';
  return `• *${name}*${staleFlag} — ${lead._stage} | ${agent} | updated ${updatedStr}`;
}

function countStale(leads) {
  return leads.filter((l) => {
    const d = daysSince(l.lastActivityAt);
    return d !== null && d > STALE_DAYS;
  }).length;
}

function buildSlackMessage(newBiz, moneyList, now) {
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const staleTotal = countStale([...newBiz, ...moneyList]);
  const blocks = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `FUB Daily Hit-List — ${dateStr}` },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        `*NEW BUSINESS* (${newBiz.length} active, last ${RECENT_DAYS} days)\n` +
        (newBiz.length ? newBiz.map(formatRow).join('\n') : '_No active new business leads._'),
    },
  });

  blocks.push({ type: 'divider' });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        `*MONEY LIST* (${moneyList.length} active, last ${RECENT_DAYS} days)\n` +
        (moneyList.length ? moneyList.map(formatRow).join('\n') : '_No active money list leads._'),
    },
  });

  if (staleTotal > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:rotating_light: *${staleTotal} lead${staleTotal > 1 ? 's' : ''} stale >5 days since last outbound* — needs outreach today.`,
      },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `_fub-daily-report | ${now.toISOString()}_` }],
  });

  return { blocks };
}

async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}
