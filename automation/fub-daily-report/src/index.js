// fub-daily-report — Cloudflare Worker
// Cron: 8:30am PDT Mon-Fri (30 15 * * 1-5 UTC)
// Posts New Business + Money List hit-list to #fub-dashboard

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runReport(env).catch(err => console.error('fub-daily-report failed:', err.message))
    );
  },
};

const FUB_BASE = 'https://api.followupboss.com/v1';

const STAGES = ['New Business', 'Money List'];
const STAGE_ICONS = { 'New Business': '🔵', 'Money List': '💰' };
const LOOKBACK_DAYS = 10;
const STALE_DAYS = 5;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runReport(env) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);

  const sections = [];
  for (const stage of STAGES) {
    const leads = await fetchLeads(env.FUB_API_KEY, stage, cutoff);
    sections.push(buildSection(stage, leads, now));
  }

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  await postToSlack(env.SLACK_WEBHOOK_URL, buildMessage(dateStr, sections));
}

// ─── FUB API ──────────────────────────────────────────────────────────────────

async function fetchLeads(apiKey, stage, cutoff) {
  const auth = btoa(`${apiKey}:`);
  const leads = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      stage,
      sort: '-updated',
      limit: '100',
      offset: String(offset),
    });

    const res = await fetch(`${FUB_BASE}/people?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    // Respect rate limit (R002)
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get('Retry-After') || '30') + 2) * 1000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) throw new Error(`FUB ${res.status} fetching stage "${stage}"`);

    const { people = [] } = await res.json();

    for (const person of people) {
      // Results are sorted newest-first; stop as soon as we pass the cutoff
      if (new Date(person.updated) < cutoff) return leads;
      leads.push(person);
    }

    if (people.length < 100) break;
    offset += 100;
  }

  return leads;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function buildSection(stage, leads, now) {
  const staleMs = STALE_DAYS * 86_400_000;

  const rows = leads.map(p => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
    const source = p.source || '—';
    const assignee = p.assignedTo || 'Unassigned';
    const updatedAt = new Date(p.updated);
    const daysAgo = Math.floor((now - updatedAt) / 86_400_000);
    const url = `https://app.followupboss.com/2/people/${p.id}`;
    const stale = now - updatedAt > staleMs ? ` 🚨 *stale ${daysAgo}d*` : ' ✓';
    const when = daysAgo === 0 ? 'today' : `${daysAgo}d ago`;

    return `• <${url}|${name}> — ${source} · ${assignee} · updated: ${when}${stale}`;
  });

  return { stage, icon: STAGE_ICONS[stage] || '•', count: leads.length, rows };
}

function buildMessage(dateStr, sections) {
  const total = sections.reduce((n, s) => n + s.count, 0);
  const lines = [
    `📋 *FUB Daily Hit-List* — ${dateStr}`,
    `_New Business + Money List · ${total} lead${total !== 1 ? 's' : ''} updated in the last ${LOOKBACK_DAYS} days_`,
    '',
  ];

  for (const { stage, icon, count, rows } of sections) {
    lines.push(`*${icon} ${stage.toUpperCase()}* · ${count} lead${count !== 1 ? 's' : ''}`);
    if (rows.length === 0) {
      lines.push('_No leads updated in the last 10 days_');
    } else {
      lines.push(...rows);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// ─── Slack ────────────────────────────────────────────────────────────────────

async function postToSlack(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mrkdwn: true }),
  });

  if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
}
