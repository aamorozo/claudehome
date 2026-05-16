// fub-daily-report — Cloudflare Worker
// Cron: Mon–Fri 8:30am Pacific (30 15 * * 1-5 UTC, PDT-aligned)
//
// Secrets (wrangler secret put <NAME>):
//   FUB_API_KEY       — Follow Up Boss API key (no colon suffix needed here)
//   SLACK_WEBHOOK_URL — Incoming webhook URL for #fub-dashboard
//   ARRAN_USER_ID     — FUB numeric userId for Arran
//   KERI_USER_ID      — FUB numeric userId for Keri

const FUB_BASE = 'https://api.followupboss.com/v1';
const LOOKBACK_DAYS = 10;
const STALE_DAYS = 5;
const MAX_PER_SECTION = 20; // cap displayed leads per section

const NEW_BUSINESS_STAGES = [
  'New',
  'New Lead',
  'Attempted Contact',
  'Active',
  'Warm',
];

const MONEY_LIST_STAGES = [
  'Hot Lead-Responded',
  'Application',
  'Appointments',
  'No Show Appt',
  'Application-Lending Pad',
  'Pending Submission',
  'Referrals To Convert',
];

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/run' && request.method === 'GET') {
      ctx.waitUntil(runReport(env));
      return new Response('Report triggered', { status: 200 });
    }
    return new Response('fub-daily-report', { status: 200 });
  },
};

async function runReport(env) {
  try {
    const [newBiz, moneyList] = await Promise.all([
      fetchLeads(NEW_BUSINESS_STAGES, env),
      fetchLeads(MONEY_LIST_STAGES, env),
    ]);
    const message = buildMessage(newBiz, moneyList);
    await postToSlack(message, env);
  } catch (err) {
    await postToSlack(errorMessage(err), env).catch(() => {});
    throw err;
  }
}

// Fetch all leads in the given stages, filtered to Arran/Keri + lookback window
async function fetchLeads(stages, env) {
  const cutoff = Date.now() - LOOKBACK_DAYS * 864e5;
  const auth = `Basic ${btoa(`${env.FUB_API_KEY}:`)}`;
  const assignedIds = new Set(
    [env.ARRAN_USER_ID, env.KERI_USER_ID].filter(Boolean).map(String)
  );

  const perStage = await Promise.all(
    stages.map((stage) => fetchStage(stage, auth, cutoff, assignedIds))
  );

  // Flatten + deduplicate by lead id (a lead can only be in one stage at a time)
  const seen = new Set();
  const leads = [];
  for (const group of perStage) {
    for (const p of group) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        leads.push(p);
      }
    }
  }

  return leads.sort((a, b) => (b._lastActivity || 0) - (a._lastActivity || 0));
}

async function fetchStage(stage, auth, cutoff, assignedIds) {
  const leads = [];
  let offset = 0;

  while (true) {
    const url = `${FUB_BASE}/people?stage=${encodeURIComponent(stage)}&limit=100&offset=${offset}&sort=-updated`;
    const res = await fetch(url, { headers: { Authorization: auth } });

    // R011: 401 = bad key; surface clearly rather than silently returning []
    if (res.status === 401) throw new Error('FUB 401 — check API key encoding');
    if (!res.ok) break;

    const data = await res.json();
    const people = data.people || [];

    let hitCutoff = false;
    for (const p of people) {
      const updatedMs = new Date(p.updated || p.created).getTime();
      if (updatedMs < cutoff) { hitCutoff = true; break; }

      const uid = String(p.assignedUserId || p.assignedTo?.id || '');
      if (assignedIds.size > 0 && !assignedIds.has(uid)) continue;

      const lastActivityMs = p.lastActivityAt
        ? new Date(p.lastActivityAt).getTime()
        : new Date(p.created).getTime();

      leads.push({ ...p, _stage: stage, _lastActivity: lastActivityMs });
    }

    if (hitCutoff || people.length < 100) break;
    offset += 100;
  }

  return leads;
}

function buildMessage(newBiz, moneyList) {
  const now = Date.now();
  const staleCutoff = STALE_DAYS * 864e5;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const formatLead = (p) => {
    const daysAgo = Math.floor((now - p._lastActivity) / 864e5);
    const stale = now - p._lastActivity > staleCutoff;
    const phone = p.phones?.[0]?.value || '';
    const firstName = p.assignedTo?.firstName || p.assignedTo?.name?.split(' ')[0] || '?';
    return `${stale ? '🚨 ' : ''} *${p.name || 'Unknown'}*  ${p._stage}  ${phone ? `📞 ${phone}  ` : ''}${firstName}  last: ${daysAgo}d`;
  };

  const sectionBlocks = (emoji, title, leads) => {
    const displayed = leads.slice(0, MAX_PER_SECTION);
    const overflow = leads.length - displayed.length;
    const header = `${emoji} *${title}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}`;

    if (leads.length === 0) {
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: `${header}\n_No leads in the last ${LOOKBACK_DAYS} days_` },
      }];
    }

    const lines = displayed.map(formatLead);
    if (overflow > 0) lines.push(`_…and ${overflow} more_`);

    // Split into chunks to stay under Slack's 3000-char field limit
    const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: header } }];
    const CHUNK = 10;
    for (let i = 0; i < lines.length; i += CHUNK) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: lines.slice(i, i + CHUNK).join('\n') },
      });
    }
    return blocks;
  };

  const total = newBiz.length + moneyList.length;
  const staleCount = [...newBiz, ...moneyList].filter(
    (p) => now - p._lastActivity > staleCutoff
  ).length;

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📊 FUB Hit-List — ${today}` },
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `${total} lead${total !== 1 ? 's' : ''} · Arran & Keri · updated in last ${LOOKBACK_DAYS}d${staleCount > 0 ? ` · 🚨 ${staleCount} stale >${STALE_DAYS}d` : ''}`,
        }],
      },
      { type: 'divider' },
      ...sectionBlocks('🆕', 'NEW BUSINESS', newBiz),
      { type: 'divider' },
      ...sectionBlocks('💰', 'MONEY LIST', moneyList),
    ],
  };
}

function errorMessage(err) {
  return {
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔴 *fub-daily-report failed*\n\`${err.message}\``,
      },
    }],
  };
}

async function postToSlack(payload, env) {
  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}`);
}
