/**
 * fub-daily-report — Cloudflare Worker
 * Runs Mon-Fri at 8:30am Pacific. Queries FUB for leads in configured stages,
 * filters to assigned + updated within 10 days, posts sectioned hit-list to Slack.
 *
 * Required secrets (wrangler secret put):
 *   FUB_API_KEY       — FUB API key (not base64 encoded, worker handles encoding)
 *   SLACK_WEBHOOK_URL — Incoming Webhook URL for #fub-dashboard
 */

const FUB_BASE = 'https://api.followupboss.com/v1';

// Stages to surface in the daily report
const REPORT_STAGES = ['New Business', 'Money List'];

// Stale threshold: leads with no activity beyond this many days get 🚨
const STALE_DAYS = 5;

// Only include leads updated within this window
const WINDOW_DAYS = 10;

// Max leads displayed per stage before truncating (Slack 3000-char limit per block)
const MAX_PER_STAGE = 30;

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  // Manual trigger for testing: GET /trigger
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/trigger') {
      await runReport(env);
      return new Response('Report sent.', { status: 200 });
    }
    return new Response('fub-daily-report worker', { status: 200 });
  },
};

async function runReport(env) {
  const authHeader = buildAuthHeader(env.FUB_API_KEY);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Hit-List — ${dateStr}`, emoji: true },
    },
    { type: 'divider' },
  ];

  let totalLeads = 0;
  let staleCount = 0;

  for (const stage of REPORT_STAGES) {
    let leads;
    try {
      leads = await fetchAssignedLeads(stage, authHeader);
    } catch (err) {
      blocks.push(errorSection(stage, err.message));
      continue;
    }

    totalLeads += leads.length;
    staleCount += leads.filter((l) => daysSince(l.lastActivityAt || l.updatedAt) > STALE_DAYS).length;

    const sectionBlocks = buildStageBlocks(stage, leads);
    blocks.push(...sectionBlocks);
  }

  // Summary footer
  const staleNote = staleCount > 0 ? ` | 🚨 ${staleCount} stale >5d` : '';
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${totalLeads} leads across ${REPORT_STAGES.length} stages${staleNote} | assigned + updated in last ${WINDOW_DAYS} days`,
      },
    ],
  });

  await postToSlack(env.SLACK_WEBHOOK_URL, blocks);
}

async function fetchAssignedLeads(stage, authHeader) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

  const leads = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = new URLSearchParams({
      stage,
      sort: 'lastActivityAt',
      limit: '100',
      offset: String(offset),
    });

    const res = await fetch(`${FUB_BASE}/people?${params}`, {
      headers: { Authorization: authHeader },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      await sleep((retryAfter + 2) * 1000);
      continue; // retry same offset
    }

    if (!res.ok) {
      throw new Error(`FUB API ${res.status} for stage "${stage}"`);
    }

    const data = await res.json();
    const page = data.people || [];

    for (const p of page) {
      if (!p.assignedUserId) continue;
      const lastUpdated = new Date(p.updatedAt || p.lastActivityAt || p.created);
      if (lastUpdated < cutoff) continue;
      leads.push(p);
    }

    if (page.length < 100) break;
    offset += 100;
  }

  // Sort: stale leads first so they appear at the top
  leads.sort((a, b) => {
    const dA = daysSince(a.lastActivityAt || a.updatedAt);
    const dB = daysSince(b.lastActivityAt || b.updatedAt);
    return dB - dA; // descending — oldest first
  });

  return leads;
}

function buildStageBlocks(stage, leads) {
  const emoji = stage === 'Money List' ? '💰' : '🏗️';

  if (!leads.length) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${stage.toUpperCase()}*\n_No assigned leads updated in the last ${WINDOW_DAYS} days._`,
        },
      },
    ];
  }

  const displayed = leads.slice(0, MAX_PER_STAGE);
  const overflow = leads.length - displayed.length;

  const lines = displayed.map((lead) => formatLeadLine(lead));

  const header = `${emoji} *${stage.toUpperCase()}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
  let body = lines.join('\n');
  if (overflow > 0) {
    body += `\n_...and ${overflow} more (filtered to top ${MAX_PER_STAGE} by staleness)_`;
  }

  // Slack section text max 3000 chars — split if needed
  const chunks = splitText(`${header}\n${body}`, 2900);
  return chunks.map((chunk) => ({
    type: 'section',
    text: { type: 'mrkdwn', text: chunk },
  }));
}

function formatLeadLine(lead) {
  const days = daysSince(lead.lastActivityAt || lead.updatedAt);
  const stale = days > STALE_DAYS ? '🚨 ' : '';
  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
  const phone = lead.phones?.[0]?.value
    ? formatPhone(lead.phones[0].value)
    : '_no phone_';
  const daysLabel = days === 0 ? 'today' : `${days}d ago`;
  return `${stale}*${name}* | ${phone} | last activity: ${daysLabel}`;
}

function errorSection(stage, message) {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `⚠️ *${stage}* — failed to fetch: \`${message}\``,
    },
  };
}

async function postToSlack(webhookUrl, blocks) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    console.error(`Slack webhook failed: ${res.status}`);
  }
}

// --- Utilities ---

function buildAuthHeader(apiKey) {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - then) / 86_400_000);
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function splitText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const cut = remaining.lastIndexOf('\n', maxLen);
    const splitAt = cut > 0 ? cut : maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt + 1);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
