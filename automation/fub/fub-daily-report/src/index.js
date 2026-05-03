/**
 * fub-daily-report — Cloudflare Worker
 * Cron: Mon-Fri 8:30am PT (15:30 UTC)
 * Posts sectioned lead hit-list to Slack #fub-dashboard
 *
 * Required env vars (Cloudflare Secrets):
 *   FUB_API_KEY        — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL  — Incoming webhook for #fub-dashboard
 *
 * Optional env vars:
 *   ARRAN_USER_ID      — FUB assignedUserId for Arran
 *   KERI_USER_ID       — FUB assignedUserId for Keri
 */

const FUB_BASE = 'https://api.followupboss.com/v1';

// Stages included in the daily hit-list
const REPORT_STAGES = ['New Business', 'Money List'];

// Only surface leads updated within this window
const DAYS_ACTIVE = 10;

// Flag leads with no outbound contact beyond this threshold
const DAYS_STALE = 5;

// FUB event types that count as outbound contact
const OUTBOUND_TYPES = ['call', 'text', 'email'];

// Slack block character limit per section
const SLACK_BLOCK_CHAR_LIMIT = 2800;

// ── FUB API helpers ───────────────────────────────────────────────────────────

function fubHeaders(apiKey) {
  return {
    Authorization: 'Basic ' + btoa(apiKey + ':'),
    Accept: 'application/json',
  };
}

async function fubGet(apiKey, path) {
  const resp = await fetch(`${FUB_BASE}${path}`, { headers: fubHeaders(apiKey) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FUB API ${resp.status} at ${path}: ${text}`);
  }
  return resp.json();
}

/**
 * Fetch all people in target stages updated within DAYS_ACTIVE.
 * Returns array of person objects with an injected _stage field.
 */
async function fetchActiveLeads(apiKey) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_ACTIVE);

  const leads = [];

  for (const stage of REPORT_STAGES) {
    let offset = 0;
    const limit = 100;

    while (true) {
      const qs = new URLSearchParams({
        stage,
        sort: '-updated',
        limit: String(limit),
        offset: String(offset),
      });

      const data = await fubGet(apiKey, `/people?${qs}`);
      const people = data.people || [];

      for (const p of people) {
        if (new Date(p.updated) < cutoff) {
          // Results are sorted newest-first; once we fall behind cutoff we can stop
          goto_next_stage: break;
        }
        leads.push({ ...p, _stage: stage });
      }

      if (people.length < limit) break;
      offset += limit;

      // Label used above — JS doesn't support labeled break inside for-of inside while
      // so we check again here:
      if (people.length > 0 && new Date(people[people.length - 1].updated) < cutoff) break;
    }
  }

  return leads;
}

/**
 * Fetch recent events for a set of person IDs and return a map of
 * personId -> Date of most recent outbound contact.
 * Uses a single date-ranged query rather than per-person calls.
 */
async function fetchOutboundMap(apiKey, personIds) {
  if (!personIds.length) return {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60); // look back 60 days for outbound history
  const since = cutoff.toISOString();

  const idSet = new Set(personIds.map(String));
  const outboundMap = {}; // personId -> Date

  let offset = 0;
  const limit = 200;

  while (true) {
    const qs = new URLSearchParams({
      'created[gte]': since,
      sort: '-created',
      limit: String(limit),
      offset: String(offset),
    });

    const data = await fubGet(apiKey, `/events?${qs}`);
    const events = data.events || [];

    for (const ev of events) {
      const pid = String(ev.personId);
      if (!idSet.has(pid)) continue;
      if (outboundMap[pid]) continue; // already have most-recent for this person

      const type = (ev.type || '').toLowerCase();
      const isOutbound =
        (type.includes('call') && !type.includes('incoming')) ||
        (type.includes('text') && !type.includes('incoming')) ||
        (type.includes('email') && !type.includes('incoming'));

      if (isOutbound) {
        outboundMap[pid] = new Date(ev.created);
      }
    }

    if (events.length < limit) break;
    offset += limit;
  }

  return outboundMap;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtDate(date) {
  if (!date) return 'Never';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtPhone(raw) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function isStale(lastOutbound) {
  if (!lastOutbound) return true;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - DAYS_STALE);
  return lastOutbound < threshold;
}

function primaryPhone(lead) {
  const phones = lead.phones || [];
  const primary = phones.find(p => p.isPrimary) || phones[0];
  return primary ? fmtPhone(primary.value) : null;
}

function assigneeName(lead) {
  return lead.assignedTo || 'Unassigned';
}

// ── Slack payload builder ─────────────────────────────────────────────────────

const STAGE_EMOJI = {
  'New Business': '🔵',
  'Money List': '💰',
};

function buildSlackBlocks(groupedLeads, outboundMap, today) {
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Daily Hit-List — ${dateStr}`, emoji: true },
    },
  ];

  let totalLeads = 0;
  let staleCount = 0;

  for (const stage of REPORT_STAGES) {
    const leads = groupedLeads[stage] || [];
    if (!leads.length) continue;

    totalLeads += leads.length;

    const emoji = STAGE_EMOJI[stage] || '📋';
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${emoji} ${stage.toUpperCase()}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}` },
    });

    // Build line items, chunk into blocks under the character limit
    const lines = [];
    for (const lead of leads) {
      const name =
        [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
      const phone = primaryPhone(lead) || 'No phone';
      const assigned = assigneeName(lead);
      const updated = fmtDate(new Date(lead.updated));
      const lastOut = outboundMap[String(lead.id)] || null;
      const stale = isStale(lastOut);
      if (stale) staleCount++;

      const flag = stale ? '🚨' : '✅';
      const lastOutStr = fmtDate(lastOut);

      lines.push(
        `• *${name}* | ${phone} | ${assigned} | Updated: ${updated} | Last outbound: ${lastOutStr} ${flag}`
      );
    }

    // Chunk lines so no single block exceeds Slack's limit
    let chunk = '';
    for (const line of lines) {
      if ((chunk + '\n' + line).length > SLACK_BLOCK_CHAR_LIMIT) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk.trim() } });
        chunk = line;
      } else {
        chunk = chunk ? chunk + '\n' + line : line;
      }
    }
    if (chunk) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk.trim() } });
    }

    blocks.push({ type: 'divider' });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${totalLeads} leads updated in last ${DAYS_ACTIVE} days | 🚨 ${staleCount} need outbound (>${DAYS_STALE} days) | ✅ ${totalLeads - staleCount} on track`,
      },
    ],
  });

  return blocks;
}

// ── Core report runner ────────────────────────────────────────────────────────

async function runReport(env) {
  const apiKey = env.FUB_API_KEY;
  if (!apiKey) throw new Error('FUB_API_KEY not set');

  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL not set');

  // 1. Fetch active leads across target stages
  const leads = await fetchActiveLeads(apiKey);

  // 2. Fetch outbound event history in bulk
  const personIds = leads.map(l => l.id);
  const outboundMap = await fetchOutboundMap(apiKey, personIds);

  // 3. Group leads by stage
  const grouped = {};
  for (const stage of REPORT_STAGES) {
    grouped[stage] = leads.filter(l => l._stage === stage);
  }

  // 4. Build Slack payload
  const blocks = buildSlackBlocks(grouped, outboundMap, new Date());

  // 5. Post to Slack
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Slack webhook failed ${resp.status}: ${body}`);
  }

  console.log(`FUB report posted: ${leads.length} leads across ${REPORT_STAGES.length} stages`);
}

// ── Worker entry points ───────────────────────────────────────────────────────

export default {
  // Cron trigger: Mon-Fri 8:30am PT (see wrangler.toml)
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  // HTTP trigger for manual testing: POST /trigger
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/trigger') {
      ctx.waitUntil(runReport(env));
      return new Response(JSON.stringify({ ok: true, message: 'Report queued' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, service: 'fub-daily-report', stages: REPORT_STAGES }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
