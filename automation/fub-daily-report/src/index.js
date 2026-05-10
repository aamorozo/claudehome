/**
 * fub-daily-report — Cloudflare Worker
 * Cron: Mon-Fri 8:30am Pacific (15:30 UTC / PDT)
 * Posts FUB hit-list to #fub-dashboard in Slack
 *
 * Secrets (set via wrangler secret put):
 *   FUB_API_KEY         — FUB API key (plain key, no encoding needed)
 *   SLACK_WEBHOOK_URL   — Incoming Webhook for #fub-dashboard
 *
 * Optional env vars in wrangler.toml [vars]:
 *   ARRAN_USER_ID       — FUB assignedUserId for Arran
 *   KERI_USER_ID        — FUB assignedUserId for Keri
 */

const FUB_BASE = 'https://api.followupboss.com/v1';

const STAGES = {
  NEW_BUSINESS: [
    'New',
    'Attempted Contact',
    'New Business',
    'Referrals To Convert',
  ],
  MONEY_LIST: [
    'Hot Lead-Responded',
    'Application',
    'Appointments',
    'No Show Appt',
    'Application-Lending Pad',
    'Pending Submission',
  ],
};

const DAYS_SINCE_UPDATE = 10;
const STALE_OUTBOUND_DAYS = 5;
const OUTBOUND_EVENT_TYPES = new Set(['Call', 'Text', 'Email']);

export default {
  async scheduled(_event, env) {
    await runReport(env);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    // Manual trigger endpoint for testing
    if (url.pathname === '/run' && request.method === 'POST') {
      try {
        await runReport(env);
        return json({ ok: true, message: 'Report posted to #fub-dashboard' });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    }
    return new Response('fub-daily-report worker — POST /run to trigger manually', {
      status: 200,
    });
  },
};

// ─── Core orchestration ──────────────────────────────────────────────────────

async function runReport(env) {
  const [newBusiness, moneyList] = await Promise.all([
    fetchLeadsByStages(STAGES.NEW_BUSINESS, env),
    fetchLeadsByStages(STAGES.MONEY_LIST, env),
  ]);

  const [newBusinessFlagged, moneyListFlagged] = await Promise.all([
    addStaleFlags(newBusiness, env),
    addStaleFlags(moneyList, env),
  ]);

  const message = buildSlackMessage(newBusinessFlagged, moneyListFlagged, env);
  await postToSlack(env.SLACK_WEBHOOK_URL, message);
}

// ─── FUB API helpers ─────────────────────────────────────────────────────────

async function fubGet(path, env, attempt = 0) {
  const auth = btoa(`${env.FUB_API_KEY}:`);
  const res = await fetch(`${FUB_BASE}${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 429 && attempt < 3) {
    const wait = parseInt(res.headers.get('Retry-After') || '5', 10) + 2;
    await sleep(wait * 1000);
    return fubGet(path, env, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`FUB ${res.status}: ${path}`);
  }

  return res.json();
}

async function fetchLeadsByStages(stages, env) {
  const cutoff = daysAgo(DAYS_SINCE_UPDATE);
  const results = [];

  for (const stage of stages) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await fubGet(
        `/people?stage=${enc(stage)}&sort=updated&limit=100&offset=${offset}`,
        env
      );

      const people = data.people || [];

      for (const person of people) {
        if (new Date(person.updated) < cutoff) {
          hasMore = false;
          break;
        }
        results.push({ ...person, _stage: stage });
      }

      if (people.length < 100) hasMore = false;
      offset += people.length;
    }
  }

  return results;
}

async function getLastOutboundDate(personId, env) {
  try {
    const data = await fubGet(
      `/events?personId=${personId}&sort=-created&limit=50`,
      env
    );
    for (const event of data.events || []) {
      if (OUTBOUND_EVENT_TYPES.has(event.type)) {
        return new Date(event.created);
      }
    }
  } catch {
    // Non-critical — stale check skipped if events fail
  }
  return null;
}

async function addStaleFlags(leads, env) {
  const staleThreshold = daysAgo(STALE_OUTBOUND_DAYS);
  const results = [];

  // Batches of 5 to stay within FUB rate limits
  for (let i = 0; i < leads.length; i += 5) {
    const batch = leads.slice(i, i + 5);
    const checked = await Promise.all(
      batch.map(async lead => {
        const lastOutbound = await getLastOutboundDate(lead.id, env);
        const isStale = !lastOutbound || lastOutbound < staleThreshold;
        return { ...lead, _lastOutbound: lastOutbound, _isStale: isStale };
      })
    );
    results.push(...checked);
  }

  return results;
}

// ─── Slack message builder ───────────────────────────────────────────────────

function buildSlackMessage(newBusiness, moneyList, env) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const totalStale = [...newBusiness, ...moneyList].filter(l => l._isStale).length;
  const totalLeads = newBusiness.length + moneyList.length;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Hit-List — ${today}` },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${totalLeads} leads updated in last ${DAYS_SINCE_UPDATE} days${totalStale ? `  •  🚨 ${totalStale} stale (no outbound ${STALE_OUTBOUND_DAYS}+ days)` : ''}`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: buildSection('🟢 New Business', newBusiness, env),
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: buildSection('💰 Money List', moneyList, env),
      },
    },
  ];

  return { blocks };
}

function buildSection(label, leads, env) {
  const header = `*${label}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
  if (!leads.length) return `${header}\n_Nothing to action today._`;

  const lines = leads.map(lead => formatLead(lead, env));
  return `${header}\n${lines.join('\n')}`;
}

function formatLead(lead, env) {
  const name = lead.name || 'Unknown';
  const phone = lead.phones?.[0]?.value || lead.emails?.[0]?.value || '—';
  const daysUpdated = daysSince(lead.updated);
  const staleFlag = lead._isStale ? ' 🚨' : '';
  const assignee = resolveAssignee(lead.assignedUserId, env);

  const lastOut = lead._lastOutbound
    ? `last outbound ${daysSince(lead._lastOutbound)}d ago`
    : 'no outbound on record';

  return `• *${name}*${staleFlag}  |  ${lead._stage}  |  ${phone}  |  ${assignee}  |  updated ${daysUpdated}d  |  ${lastOut}`;
}

function resolveAssignee(userId, env) {
  if (!userId) return 'Unassigned';
  if (env.ARRAN_USER_ID && String(userId) === String(env.ARRAN_USER_ID)) return 'Arran';
  if (env.KERI_USER_ID && String(userId) === String(env.KERI_USER_ID)) return 'Keri';
  return `Agent ${userId}`;
}

// ─── Slack poster ────────────────────────────────────────────────────────────

async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook ${res.status}: ${body}`);
  }
}

// ─── Utils ───────────────────────────────────────────────────────────────────

const enc = s => encodeURIComponent(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysSince = date => Math.floor((Date.now() - new Date(date)) / 86_400_000);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
