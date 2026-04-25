/**
 * fub-daily-report — Cloudflare Worker
 * Cron: Mon-Fri 8:30am Pacific (16:30 UTC / 15:30 UTC during PDT)
 * Posts sectioned FUB hit-list to Slack #fub-dashboard
 */

const FUB_BASE = 'https://api.followupboss.com/v1';

// Stages that appear in the daily report, grouped by section
const SECTIONS = {
  'New Business': [
    'New',
    'Attempted Contact',
    'Active Buyer',
    'Active Seller',
    'New Business',
  ],
  'Money List': [
    'Hot Lead',
    'Hot Lead-Responded',
    'Referral',
    'Past Client',
  ],
};

// Days since last update to include a lead
const UPDATED_WITHIN_DAYS = 10;

// Flag leads with no outbound contact in this many days
const STALE_THRESHOLD_DAYS = 5;

// Arran and Keri assignedUserIds — set via Cloudflare secrets or env
// FUB_USER_IDS is a comma-separated list, e.g. "12345,67890"

export default {
  async scheduled(event, env, ctx) {
    await runReport(env);
  },

  // Allow manual trigger via HTTP GET for testing
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/run') {
      await runReport(env);
      return new Response('Report sent.', { status: 200 });
    }
    return new Response('FUB Daily Report Worker', { status: 200 });
  },
};

async function runReport(env) {
  const userIds = (env.FUB_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  const cutoff = daysAgo(UPDATED_WITHIN_DAYS);

  const sectionBlocks = [];

  for (const [sectionName, stages] of Object.entries(SECTIONS)) {
    const leads = await fetchLeads(env, stages, userIds, cutoff);
    if (leads.length === 0) continue;

    sectionBlocks.push(...buildSection(sectionName, leads));
  }

  if (sectionBlocks.length === 0) {
    await postSlack(env, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*FUB Daily Report* — No active leads to surface today.' },
      },
    ]);
    return;
  }

  const header = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Hit-List — ${todayLabel()}`, emoji: true },
    },
    { type: 'divider' },
  ];

  await postSlack(env, [...header, ...sectionBlocks]);
}

async function fetchLeads(env, stages, userIds, updatedAfter) {
  const auth = btoa(`${env.FUB_API_KEY}:`);
  const leads = [];

  for (const userId of userIds.length ? userIds : [null]) {
    let offset = 0;
    const limit = 100;

    while (true) {
      const params = new URLSearchParams({
        stage: stages.join(','),
        limit: String(limit),
        offset: String(offset),
        sort: 'updated',
        direction: 'desc',
      });

      if (userId) params.set('assignedUserId', userId);

      const resp = await fetch(`${FUB_BASE}/people?${params}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });

      if (!resp.ok) {
        console.error(`FUB API error ${resp.status}: ${await resp.text()}`);
        break;
      }

      const data = await resp.json();
      const people = data.people || [];

      for (const p of people) {
        // Stop paging once we pass the cutoff window
        if (p.updated && new Date(p.updated) < updatedAfter) break;
        leads.push(p);
      }

      if (people.length < limit) break;
      // If the last record is beyond the cutoff, stop
      if (people.length > 0 && new Date(people[people.length - 1].updated) < updatedAfter) break;

      offset += limit;
    }
  }

  // Deduplicate by person id (in case a lead is assigned to multiple tracked users)
  const seen = new Set();
  return leads.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function buildSection(sectionName, leads) {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${sectionName}* — ${leads.length} lead${leads.length !== 1 ? 's' : ''}` },
    },
  ];

  for (const lead of leads) {
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
    const phone = primaryPhone(lead);
    const stage = lead.stage || 'Unknown stage';
    const assigned = lead.assignedTo || 'Unassigned';
    const stale = isStale(lead);
    const flag = stale ? ' 🚨' : '';
    const lastContact = lastContactedLabel(lead);
    const source = lead.source ? ` · ${lead.source}` : '';
    const fubLink = `https://app.followupboss.com/2/people/${lead.id}`;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${fubLink}|${name}>*${flag}\n${stage} · ${assigned}${source}\n${phone}${lastContact}`,
      },
    });
  }

  blocks.push({ type: 'divider' });
  return blocks;
}

function primaryPhone(lead) {
  if (!lead.phones || lead.phones.length === 0) return 'No phone';
  return lead.phones[0].value || 'No phone';
}

function isStale(lead) {
  const dateStr = lead.lastContactedAt || lead.contacted || lead.lastOutboundAt;
  if (!dateStr) return true; // Never contacted = stale
  return new Date(dateStr) < daysAgo(STALE_THRESHOLD_DAYS);
}

function lastContactedLabel(lead) {
  const dateStr = lead.lastContactedAt || lead.contacted || lead.lastOutboundAt;
  if (!dateStr) return '\nLast contact: never';
  const d = new Date(dateStr);
  const daysDiff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return `\nLast contact: ${daysDiff}d ago`;
}

async function postSlack(env, blocks) {
  const resp = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!resp.ok) {
    console.error(`Slack post failed ${resp.status}: ${await resp.text()}`);
  }
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles',
  });
}
