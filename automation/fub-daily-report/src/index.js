/**
 * fub-daily-report — Cloudflare Worker
 * Cron: 8:30am Pacific Mon-Fri (30 15 * * 1-5 UTC during PDT)
 *
 * Env vars (set as Cloudflare secrets):
 *   FUB_API_KEY        — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL  — Incoming webhook for #fub-dashboard
 *   ASSIGNED_USER_IDS  — Comma-separated FUB user IDs to filter (Arran,Keri)
 */

const FUB_BASE = 'https://api.followupboss.com/v1';
const STALE_DAYS = 5;
const LOOKBACK_DAYS = 10;

// Outbound event types that reset the stale clock
const OUTBOUND_TYPES = ['call', 'text sent', 'sms', 'email sent'];

const SECTIONS = [
  {
    key: 'new-biz',
    header: ':star: *NEW BUSINESS*',
    stages: ['New Business'],
  },
  {
    key: 'money-list',
    header: ':moneybag: *MONEY LIST*',
    stages: [
      'Hot Lead-Responded',
      'Application',
      'Appointments',
      'No Show Appt',
      'Application-Lending Pad',
      'Pending Submission',
      'Referrals To Convert',
    ],
  },
];

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  // Manual trigger for testing: GET /run
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/run') {
      ctx.waitUntil(runReport(env));
      return new Response('Report triggered\n', { status: 202 });
    }
    return new Response('fub-daily-report worker\n', { status: 200 });
  },
};

// ---------------------------------------------------------------------------

async function runReport(env) {
  const auth = buildAuth(env.FUB_API_KEY);
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const userIds = parseUserIds(env.ASSIGNED_USER_IDS);

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Hit List — ${today}`, emoji: true },
    },
    { type: 'divider' },
  ];

  for (const section of SECTIONS) {
    const raw = await fetchLeadsForStages(auth, section.stages, cutoff, userIds);
    const leads = await Promise.all(raw.map(l => enrichLead(auth, l)));

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${section.header}  _(${leads.length})_` },
    });

    if (leads.length === 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '_Nothing here — pipeline clear._' },
      });
    } else {
      for (const lead of leads) {
        blocks.push(buildLeadBlock(lead));
      }
    }

    blocks.push({ type: 'divider' });
  }

  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook failed ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// FUB data fetching

async function fetchLeadsForStages(auth, stages, cutoff, userIds) {
  const results = [];

  for (const stage of stages) {
    let offset = 0;

    outer: while (true) {
      const params = new URLSearchParams({
        stage,
        limit: '100',
        offset: String(offset),
        sort: 'updated',
        sortDirection: 'desc',
      });

      const data = await fubFetch(auth, `/people?${params}`);
      const people = data.people ?? [];

      for (const person of people) {
        // Sorted newest first — once we pass the cutoff we're done with this stage
        if (person.updated < cutoff) break outer;
        if (userIds.length > 0 && !userIds.includes(String(person.assignedUserId))) continue;
        results.push({ ...person, _stage: stage });
      }

      if (people.length < 100) break;
      offset += 100;
    }
  }

  return results;
}

async function enrichLead(auth, lead) {
  // Fetch the 25 most recent events and find the last outbound contact
  const data = await fubFetch(
    auth,
    `/events?personId=${lead.id}&limit=25&sort=created&sortDirection=desc`
  );

  const lastOutbound = (data.events ?? []).find(e =>
    OUTBOUND_TYPES.some(t => (e.type ?? '').toLowerCase().includes(t))
  );

  const daysSinceOutbound = lastOutbound
    ? Math.floor((Date.now() - new Date(lastOutbound.created).getTime()) / 86_400_000)
    : null;

  return { ...lead, lastOutbound, daysSinceOutbound };
}

// ---------------------------------------------------------------------------
// Slack block builder

function buildLeadBlock(lead) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
  const phone = lead.phones?.[0]?.value ?? 'No phone';
  const source = lead.source ?? 'Unknown source';
  const stage = lead._stage;

  const isStale = lead.daysSinceOutbound !== null && lead.daysSinceOutbound >= STALE_DAYS;
  const staleBadge = isStale ? ` :rotating_light: *${lead.daysSinceOutbound}d stale*` : '';

  const contactLine =
    lead.daysSinceOutbound !== null
      ? `Last outbound: ${lead.daysSinceOutbound}d ago`
      : 'No outbound logged';

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${name}*${staleBadge}\n${stage} | ${source} | ${phone}\n${contactLine}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers

function buildAuth(apiKey) {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

function parseUserIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function fubFetch(auth, path) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FUB ${res.status} ${path}: ${body}`);
  }
  return res.json();
}
