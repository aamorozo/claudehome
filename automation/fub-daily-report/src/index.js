/**
 * fub-daily-report — Cloudflare Worker
 * Posts a sectioned FUB hit-list to #fub-dashboard every weekday at 8:30am PT.
 * Sections: New Business | Money List (configurable via env vars)
 * Flags: 🚨 = no outbound contact in >5 days
 */

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },

  // GET /run for manual trigger / health check
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/run') {
      await runDailyReport(env);
      return new Response('Report sent.', { status: 200 });
    }
    return new Response('fub-daily-report worker — GET /run to trigger', { status: 200 });
  },
};

// ─── Config ───────────────────────────────────────────────────────────────────

const FUB_BASE = 'https://api.followupboss.com/v1';
const STALE_DAYS = 5;           // 🚨 flag threshold (days since last outbound)
const UPDATED_WITHIN_DAYS = 10; // only show leads updated in this window

const SECTIONS = [
  { label: 'NEW BUSINESS', emoji: '🆕', stageKey: 'STAGE_NEW_BUSINESS', defaultStage: 'New Business' },
  { label: 'MONEY LIST',   emoji: '💰', stageKey: 'STAGE_MONEY_LIST',   defaultStage: 'Money List'   },
];

// FUB event types that count as outbound contact
const OUTBOUND_TYPES = new Set(['Call', 'Email', 'Text', 'SMS']);

// ─── FUB API helpers ──────────────────────────────────────────────────────────

async function fubGet(path, env) {
  const auth = btoa(`${env.FUB_API_KEY}:`);
  const res = await fetch(`${FUB_BASE}${path}`, {
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '30', 10);
    await sleep((retryAfter + 2) * 1000);
    return fubGet(path, env); // single retry
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FUB ${res.status} ${path}: ${body}`);
  }
  return res.json();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Lead fetching ────────────────────────────────────────────────────────────

async function getLeadsByStage(stageName, env) {
  const params = new URLSearchParams({
    stage: stageName,
    updatedSince: daysAgo(UPDATED_WITHIN_DAYS),
    limit: '100',
    sort: '-updated',
  });
  const data = await fubGet(`/people?${params}`, env);
  return data.people || [];
}

// Returns ISO date of last outbound event, or null
async function getLastOutbound(personId, env) {
  const params = new URLSearchParams({ personId: String(personId), limit: '25', sort: '-created' });
  const data = await fubGet(`/events?${params}`, env);
  const event = (data.events || []).find(e => OUTBOUND_TYPES.has(e.type));
  return event?.createdAt ?? null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatLeadRow(lead, lastOutbound) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || `ID ${lead.id}`;
  const agent = lead.assignedTo?.name || 'Unassigned';
  const stale = daysSince(lastOutbound) > STALE_DAYS;
  const contactStr = lastOutbound ? `last outbound ${daysSince(lastOutbound)}d ago` : 'no outbound on record';
  const flag = stale ? '🚨 ' : '';
  return { text: `${flag}*${name}* — ${agent} — ${contactStr}`, stale };
}

async function buildSection(section, env) {
  const stageName = env[section.stageKey] || section.defaultStage;
  let leads;
  try {
    leads = await getLeadsByStage(stageName, env);
  } catch (err) {
    return { header: `${section.emoji} *${section.label}* — fetch error: ${err.message}`, lines: '' };
  }

  if (!leads.length) {
    return {
      header: `${section.emoji} *${section.label}* — no leads updated in last ${UPDATED_WITHIN_DAYS}d`,
      lines: '',
    };
  }

  const rows = [];
  for (const lead of leads.slice(0, 25)) { // cap at 25 per section
    const lastOutbound = await getLastOutbound(lead.id, env);
    rows.push(formatLeadRow(lead, lastOutbound));
  }

  const staleCount = rows.filter(r => r.stale).length;
  const header = `${section.emoji} *${section.label}* (${leads.length} leads${staleCount ? `, ${staleCount} 🚨` : ''})`;
  const lines = rows.map(r => `• ${r.text}`).join('\n');
  return { header, lines };
}

// ─── Slack ────────────────────────────────────────────────────────────────────

async function postToSlack(blocks, env) {
  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack ${res.status}: ${text}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runDailyReport(env) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `📋 FUB Hit-List — ${today}`, emoji: true } },
    { type: 'divider' },
  ];

  for (const section of SECTIONS) {
    const { header, lines } = await buildSection(section, env);
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: header } });
    if (lines) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines } });
    }
    blocks.push({ type: 'divider' });
  }

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `🚨 = no outbound in >${STALE_DAYS}d · Updated within ${UPDATED_WITHIN_DAYS}d · fub-daily-report`,
    }],
  });

  await postToSlack(blocks, env);
}
