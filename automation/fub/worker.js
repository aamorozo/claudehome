/**
 * fub-daily-report — Cloudflare Worker
 * Runs Mon-Fri at 8:30am Pacific via Cron Trigger
 * Posts sectioned hit-list to Slack #fub-dashboard
 */

import { STAGE_GROUPS, ARRAN_USER_ID, KERI_USER_ID, STALE_DAYS, LOOKBACK_DAYS } from './config.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },

  // Manual trigger for testing: GET /run
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/run') {
      await runDailyReport(env);
      return new Response('Report sent.', { status: 200 });
    }
    return new Response('FUB Daily Report Worker', { status: 200 });
  },
};

async function runDailyReport(env) {
  const leads = await fetchLeads(env);
  if (!leads.length) {
    await postToSlack(env, [{ type: 'section', text: { type: 'mrkdwn', text: '_No active leads to report today._' } }]);
    return;
  }

  const blocks = buildReport(leads);
  await postToSlack(env, blocks);
}

async function fetchLeads(env) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const since = cutoff.toISOString().split('T')[0];

  const stages = [...STAGE_GROUPS['New Business'], ...STAGE_GROUPS['Money List']];
  const results = [];

  for (const stage of stages) {
    let page = 1;
    while (true) {
      const url = new URL('https://api.followupboss.com/v1/people');
      url.searchParams.set('stage', stage);
      url.searchParams.set('updatedSince', since);
      url.searchParams.set('limit', '100');
      url.searchParams.set('offset', String((page - 1) * 100));

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${btoa(env.FUB_API_KEY + ':')}`,
          'X-System': 'fub-daily-report',
          'X-System-Key': env.FUB_SYSTEM_KEY || '',
        },
      });

      if (!res.ok) break;
      const data = await res.json();
      const people = data.people || [];
      results.push(...people.map((p) => ({ ...p, _stage: stage })));

      if (people.length < 100) break;
      page++;
    }
  }

  // Filter to Arran + Keri only
  return results.filter((p) => {
    const id = p.assignedUserId?.toString();
    return id === ARRAN_USER_ID || id === KERI_USER_ID;
  });
}

function buildReport(leads) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Hit-List — ${today}`, emoji: true },
    },
    { type: 'divider' },
  ];

  for (const [groupName, stages] of Object.entries(STAGE_GROUPS)) {
    const groupLeads = leads.filter((l) => stages.includes(l._stage));
    if (!groupLeads.length) continue;

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${groupName}* (${groupLeads.length})` },
    });

    for (const lead of groupLeads) {
      const line = formatLead(lead);
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: line } });
    }

    blocks.push({ type: 'divider' });
  }

  return blocks;
}

function formatLead(lead) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
  const phone = lead.phones?.[0]?.value || '';
  const stage = lead._stage;
  const assigned = lead.assignedUserId?.toString() === ARRAN_USER_ID ? 'Arran' : 'Keri';
  const lastOutbound = lead.lastCommunicatedAt ? new Date(lead.lastCommunicatedAt) : null;
  const daysSinceContact = lastOutbound ? Math.floor((Date.now() - lastOutbound.getTime()) / 86400000) : null;
  const staleFlag = daysSinceContact === null || daysSinceContact > STALE_DAYS ? ' :rotating_light:' : '';
  const contactInfo = daysSinceContact !== null ? `${daysSinceContact}d ago` : 'never';
  const fubUrl = `https://app.followupboss.com/2/people/${lead.id}`;

  return `${staleFlag}<${fubUrl}|${name}> — ${stage} | ${assigned} | Last contact: ${contactInfo}${phone ? ` | ${phone}` : ''}`;
}

async function postToSlack(env, blocks) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: env.SLACK_CHANNEL || '#fub-dashboard',
      blocks,
      text: 'FUB Daily Hit-List',
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
}
