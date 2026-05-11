/**
 * fub-daily-report — Cloudflare Worker
 * Cron: Mon-Fri 8:30am PDT (15:30 UTC during DST)
 * Posts FUB hit-list to #fub-dashboard: New Business + Money List stages
 * Leads must be assigned and updated within last 10 days
 * Flags leads with no outbound in >5 days with 🚨
 *
 * Secrets required (set via `wrangler secret put`):
 *   FUB_API_KEY           — FUB API key (no password, colon appended automatically)
 *   SLACK_WEBHOOK_URL     — Incoming webhook URL for #fub-dashboard
 *   MANUAL_TRIGGER_SECRET — Bearer token for POST /trigger
 */

const FUB_BASE = 'https://api.followupboss.com/v1';
const TARGET_STAGES = ['New Business', 'Money List'];
const ACTIVE_WINDOW_DAYS = 10;
const STALE_OUTBOUND_DAYS = 5;

// ─── FUB API helpers ──────────────────────────────────────────────────────────

async function fubGet(path, apiKey) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}` },
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    await new Promise(r => setTimeout(r, (retryAfter + 2) * 1000));
    return fubGet(path, apiKey);
  }
  if (!res.ok) throw new Error(`FUB ${res.status} on ${path}`);
  return res.json();
}

async function getPeopleByStage(stage, apiKey) {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000).toISOString();
  const results = [];
  let offset = 0;

  while (offset <= 500) {
    const data = await fubGet(
      `/people?stage=${encodeURIComponent(stage)}&limit=100&offset=${offset}&sort=-updated`,
      apiKey
    );
    const people = (data.people || []).filter(
      p => p.assignedUserId && p.updatedAt >= cutoff
    );
    results.push(...people);

    const page = data.people || [];
    if (page.length < 100) break;
    if (page.length > 0 && page[page.length - 1].updatedAt < cutoff) break;
    offset += 100;
  }

  return results;
}

async function getLastOutboundDate(personId, apiKey) {
  const data = await fubGet(`/events?personId=${personId}&limit=25`, apiKey);
  const outboundTypes = new Set(['Call', 'Email', 'Text', 'Note']);
  const event = (data.events || []).find(e => outboundTypes.has(e.type));
  return event?.createdAt ?? null;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function fmtPhone(raw) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

// ─── Report builder ───────────────────────────────────────────────────────────

async function buildSections(apiKey) {
  const sections = {};

  for (const stage of TARGET_STAGES) {
    const people = await getPeopleByStage(stage, apiKey);
    const leads = [];

    for (const p of people) {
      const lastOutbound = await getLastOutboundDate(p.id, apiKey);
      const days = daysSince(lastOutbound);
      leads.push({
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown',
        contact: fmtPhone(p.phones?.[0]?.value) || p.emails?.[0]?.value || null,
        assignedTo: p.assignedTo || 'Unassigned',
        source: p.source || null,
        lastOutbound,
        daysSinceOutbound: days,
        isStale: days > STALE_OUTBOUND_DAYS,
      });
    }

    leads.sort((a, b) => {
      if (a.isStale !== b.isStale) return b.isStale ? 1 : -1;
      return b.daysSinceOutbound - a.daysSinceOutbound;
    });

    sections[stage] = leads;
  }

  return sections;
}

// ─── Slack Block Kit formatter ────────────────────────────────────────────────

function buildBlocks(sections, reportDate) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Daily Hit-List — ${reportDate}`, emoji: true },
    },
    { type: 'divider' },
  ];

  for (const [stage, leads] of Object.entries(sections)) {
    const staleCount = leads.filter(l => l.isStale).length;
    const headerText = staleCount > 0
      ? `*${stage}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''} | 🚨 ${staleCount} stale`
      : `*${stage}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}`;

    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: headerText } });

    if (leads.length === 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '_No assigned leads updated in the last 10 days._' },
      });
    } else {
      for (const lead of leads) {
        const flag = lead.isStale ? '🚨 ' : '';
        const contactStr = lead.contact || '_no contact_';
        const outboundStr = lead.lastOutbound
          ? `Last outbound: *${lead.daysSinceOutbound}d ago*`
          : `Last outbound: *none on record*`;
        const sourceStr = lead.source ? ` | ${lead.source}` : '';

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${flag}*${lead.name}* — ${contactStr}\n${outboundStr} | ${lead.assignedTo}${sourceStr}`,
          },
        });
      }
    }

    blocks.push({ type: 'divider' });
  }

  const totalLeads = Object.values(sections).reduce((n, arr) => n + arr.length, 0);
  const totalStale = Object.values(sections).reduce((n, arr) => n + arr.filter(l => l.isStale).length, 0);

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `${totalLeads} total | 🚨 ${totalStale} need outbound | Active window: last ${ACTIVE_WINDOW_DAYS} days | Stale threshold: >${STALE_OUTBOUND_DAYS} days`,
    }],
  });

  return blocks;
}

async function postSlack(webhookUrl, blocks) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
}

// ─── Entry points ─────────────────────────────────────────────────────────────

async function runReport(env) {
  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles',
  });

  const sections = await buildSections(env.FUB_API_KEY);
  const blocks = buildBlocks(sections, reportDate);
  await postSlack(env.SLACK_WEBHOOK_URL, blocks);
  console.log(`Report posted: ${reportDate}`);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runReport(env).catch(async err => {
        console.error('Report failed:', err.message);
        await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `🚨 fub-daily-report failed: ${err.message}` }),
        }).catch(() => {});
      })
    );
  },

  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const auth = request.headers.get('Authorization');
    if (!env.MANUAL_TRIGGER_SECRET || auth !== `Bearer ${env.MANUAL_TRIGGER_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    ctx.waitUntil(runReport(env));
    return new Response('Report triggered', { status: 200 });
  },
};
