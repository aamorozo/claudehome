/**
 * fub-daily-report — Cloudflare Worker
 * Posts FUB lead hit-lists to #fub-dashboard, Mon–Fri 8:30am Pacific.
 * Covers: New Business + Money List stages, updated within last 10 days.
 * Flags 🚨 on leads with no outbound contact in >5 days.
 */

const FUB_BASE = 'https://api.followupboss.com/v1';
const TARGET_STAGES = ['New Business', 'Money List'];
const UPDATED_DAYS = 10;
const STALE_DAYS = 5;
const OUTBOUND_TYPES = ['Call', 'Email', 'Text', 'Sms'];

export default {
  async scheduled(_event, env, _ctx) {
    await runDailyReport(env);
  },

  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger') {
      try {
        await runDailyReport(env);
        return new Response('Report sent.', { status: 200 });
      } catch (err) {
        return new Response(`Error: ${err.message}`, { status: 500 });
      }
    }
    return new Response('FUB Daily Report Worker — POST /trigger to run manually.', { status: 200 });
  },
};

async function runDailyReport(env) {
  const auth = buildAuth(env.FUB_API_KEY);
  const cutoff = daysAgo(UPDATED_DAYS);

  const sections = await Promise.all(
    TARGET_STAGES.map((stage) => buildSection(auth, stage, cutoff, env))
  );

  const totalLeads = sections.reduce((n, s) => n + s.leads.length, 0);
  if (totalLeads === 0) {
    await postToSlack(env.SLACK_WEBHOOK_URL, buildEmptyMessage());
    return;
  }

  await postToSlack(env.SLACK_WEBHOOK_URL, buildSlackMessage(sections));
}

async function buildSection(auth, stage, cutoff, env) {
  const people = await fetchAllLeadsInStage(auth, stage, cutoff);
  const enriched = await Promise.all(
    people.map((p) => enrichLead(auth, p))
  );
  enriched.sort((a, b) => (a.isStale === b.isStale ? 0 : a.isStale ? -1 : 1));
  return { stage, leads: enriched };
}

// --- FUB API helpers ---

function buildAuth(apiKey) {
  return 'Basic ' + btoa(apiKey + ':');
}

async function fubGet(auth, path) {
  const resp = await fetch(`${FUB_BASE}${path}`, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '5', 10);
    await sleep((retryAfter + 2) * 1000);
    return fubGet(auth, path);
  }
  if (!resp.ok) throw new Error(`FUB ${resp.status} on ${path}`);
  return resp.json();
}

async function fetchAllLeadsInStage(auth, stage, updatedSince) {
  const leads = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      stage,
      updatedSince,
      limit: String(limit),
      offset: String(offset),
    });
    const data = await fubGet(auth, `/people?${params}`);
    const batch = data.people ?? [];
    leads.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return leads.filter((p) => p.assignedUserId);
}

async function enrichLead(auth, person) {
  const lastOutbound = await getLastOutboundDate(auth, person.id);
  const daysSinceContact = lastOutbound
    ? daysBetween(new Date(lastOutbound), new Date())
    : null;
  const isStale = daysSinceContact === null || daysSinceContact > STALE_DAYS;

  return {
    id: person.id,
    name: person.name || `Lead #${person.id}`,
    phone: primaryPhone(person.phones),
    stage: person.stage,
    assignedTo: person.assignedTo || 'Unassigned',
    lastActivity: person.lastActivityAt ? formatDate(person.lastActivityAt) : 'Never',
    lastOutbound: lastOutbound ? formatDate(lastOutbound) : 'Never',
    daysSinceContact,
    isStale,
    fubUrl: `https://app.followupboss.com/2/people/${person.id}`,
  };
}

async function getLastOutboundDate(auth, personId) {
  try {
    const params = new URLSearchParams({
      personId: String(personId),
      limit: '25',
      sort: '-created',
    });
    const data = await fubGet(auth, `/events?${params}`);
    const events = data.events ?? [];
    const outbound = events.find(
      (e) => OUTBOUND_TYPES.includes(e.type) && !e.isIncoming
    );
    return outbound ? outbound.createdAt : null;
  } catch {
    return null;
  }
}

// --- Slack message builder ---

function buildSlackMessage(sections) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 FUB Hit-List — ${today}`, emoji: true },
    },
    { type: 'divider' },
  ];

  for (const { stage, leads } of sections) {
    if (leads.length === 0) continue;

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${stageEmoji(stage)} ${stage.toUpperCase()}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}` },
    });

    for (const lead of leads) {
      const flag = lead.isStale ? '🚨 ' : '';
      const staleLine = lead.daysSinceContact !== null
        ? `Last outbound: ${lead.daysSinceContact}d ago`
        : 'No outbound on record';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `${flag}*<${lead.fubUrl}|${lead.name}>*`,
            `${lead.phone}  •  ${lead.assignedTo}`,
            `${staleLine}  •  Last activity: ${lead.lastActivity}`,
          ].join('\n'),
        },
      });
    }

    blocks.push({ type: 'divider' });
  }

  const totalStale = sections.reduce((n, s) => n + s.leads.filter((l) => l.isStale).length, 0);
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Last 10 days • ${totalStale > 0 ? `🚨 ${totalStale} stale (>5d no outbound)` : '✅ No stale leads'} • WCL NMLS #1491497`,
      },
    ],
  });

  return { blocks };
}

function buildEmptyMessage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
  return {
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `✅ *FUB Hit-List — ${today}*\nNo leads in New Business or Money List updated in the last 10 days.` },
      },
    ],
  };
}

async function postToSlack(webhookUrl, payload) {
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Slack webhook failed: ${resp.status}`);
}

// --- Utilities ---

function stageEmoji(stage) {
  const map = { 'New Business': '🆕', 'Money List': '💰' };
  return map[stage] || '📌';
}

function primaryPhone(phones) {
  if (!phones || phones.length === 0) return 'No phone';
  return phones[0].value || 'No phone';
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles',
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
