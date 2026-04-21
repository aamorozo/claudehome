// FUB Daily Hit-List — Cloudflare Worker
// Cron: Mon-Fri 8:30am Pacific. Posts to Slack #fub-dashboard.

const FUB_BASE = 'https://api.followupboss.com/v1';
const ACTIVE_DAYS = 10;
const STALE_DAYS = 5;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  async fetch(request, env, ctx) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('trigger') === 'true') {
      ctx.waitUntil(runReport(env));
      return new Response('Report triggered', { status: 200 });
    }
    return new Response('FUB Daily Report — use ?trigger=true to run manually', { status: 200 });
  },
};

async function runReport(env) {
  const auth = btoa(`${env.FUB_API_KEY}:`);
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const newBizStages = parseStages(env.NEW_BUSINESS_STAGES, ['New', 'Attempted Contact']);
  const moneyListStages = parseStages(env.MONEY_LIST_STAGES, ['Hot Lead-Responded', 'Nurture', 'Follow Up']);

  const since = daysAgo(ACTIVE_DAYS);
  const staleBefore = daysAgo(STALE_DAYS);

  const [newBiz, moneyList] = await Promise.all([
    fetchLeadsForStages(headers, newBizStages, since),
    fetchLeadsForStages(headers, moneyListStages, since),
  ]);

  const annotate = lead => ({
    ...lead,
    isStale: !lead.lastCommunicatedAt || new Date(lead.lastCommunicatedAt) < staleBefore,
  });

  const blocks = buildSlackBlocks(newBiz.map(annotate), moneyList.map(annotate));
  await postToSlack(env.SLACK_WEBHOOK_URL, { blocks });
}

async function fetchLeadsForStages(headers, stages, since) {
  const results = await Promise.all(stages.map(stage => fetchByStage(headers, stage, since)));
  const merged = results.flat();
  // deduplicate by id
  return [...new Map(merged.map(l => [l.id, l])).values()];
}

async function fetchByStage(headers, stage, since) {
  const leads = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({ stage, limit, offset, sort: '-updated' });
    const data = await fubGet(`/people?${params}`, headers);
    const people = data.people ?? [];

    for (const p of people) {
      if (new Date(p.updated) >= since) leads.push(p);
    }

    const exhausted = people.length < limit;
    const olderThanCutoff = people.length > 0 && new Date(people.at(-1).updated) < since;
    if (exhausted || olderThanCutoff) break;
    offset += limit;
  }

  return leads;
}

async function fubGet(path, headers, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${FUB_BASE}${path}`, { headers });
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get('Retry-After') ?? '5', 10) + 2) * 1000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`FUB ${res.status} on ${path}`);
    return res.json();
  }
  throw new Error(`FUB request failed after ${retries} retries: ${path}`);
}

function buildSlackBlocks(newBiz, moneyList) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `FUB Daily Hit-List — ${today}` } },
    { type: 'divider' },
  ];

  appendSection(blocks, 'NEW BUSINESS', newBiz);
  appendSection(blocks, 'MONEY LIST', moneyList);

  if (newBiz.length === 0 && moneyList.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No active leads updated in the last 10 days._' },
    });
  }

  const staleCount = [...newBiz, ...moneyList].filter(l => l.isStale).length;
  const total = newBiz.length + moneyList.length;
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: [
        staleCount > 0 ? `🚨 ${staleCount} stale (>5 days no outbound)` : null,
        `${total} lead${total !== 1 ? 's' : ''} total`,
      ].filter(Boolean).join('  ·  '),
    }],
  });

  return blocks;
}

function appendSection(blocks, label, leads) {
  if (leads.length === 0) return;
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*${label}* (${leads.length})` },
  });
  for (const lead of leads) blocks.push(leadBlock(lead));
  blocks.push({ type: 'divider' });
}

function leadBlock(lead) {
  const flag = lead.isStale ? '🚨 ' : '';
  const name = lead.name || `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unknown';
  const phone = lead.phones?.[0]?.value ?? '';
  const stage = lead.stage ?? '';
  const assigned = lead.assignedTo ?? '';
  const lastContact = lead.lastCommunicatedAt
    ? `Last contact ${daysSince(lead.lastCommunicatedAt)}d ago`
    : 'No contact logged';

  const line1 = [flag + `*${name}*`, phone, stage, assigned].filter(Boolean).join(' · ');
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: `${line1}\n_${lastContact}_` },
  };
}

async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
}

function parseStages(envVal, defaults) {
  return envVal ? envVal.split(',').map(s => s.trim()).filter(Boolean) : defaults;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
