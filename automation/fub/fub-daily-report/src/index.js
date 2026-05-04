/**
 * fub-daily-report — Cloudflare Worker
 * Runs 8:30am Pacific Mon-Fri via cron trigger
 * Posts sectioned hit-list to #fub-dashboard (New Business + Money List)
 * Filters to assigned leads updated within last 10 days
 * Flags stale leads >5 days since last outbound contact with 🚨
 *
 * Required secrets (set via wrangler secret put):
 *   FUB_API_KEY       — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL — Incoming webhook for #fub-dashboard
 *
 * Optional vars (set in wrangler.toml [vars]):
 *   ARRAN_USER_ID     — FUB assignedUserId for Arran
 *   KERI_USER_ID      — FUB assignedUserId for Keri
 */

import { STAGES, AGENT_MAP } from './config.js';

const FUB_BASE = 'https://api.followupboss.com/v1';
const UPDATED_WITHIN_DAYS = 10;
const STALE_DAYS = 5;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  async fetch(request, env, ctx) {
    // Manual trigger for testing: GET /trigger
    if (new URL(request.url).pathname === '/trigger') {
      ctx.waitUntil(runReport(env));
      return new Response('FUB report triggered', { status: 200 });
    }
    return new Response('fub-daily-report worker', { status: 200 });
  },
};

async function runReport(env) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - UPDATED_WITHIN_DAYS);

    const [newBiz, moneyList] = await Promise.all([
      fetchStages(env.FUB_API_KEY, STAGES.NEW_BUSINESS, cutoff),
      fetchStages(env.FUB_API_KEY, STAGES.MONEY_LIST, cutoff),
    ]);

    const message = buildMessage(newBiz, moneyList, env);
    await postSlack(env.SLACK_WEBHOOK_URL, message);
  } catch (err) {
    console.error('fub-daily-report error:', err);
    await postSlack(env.SLACK_WEBHOOK_URL, {
      text: `🚨 *FUB Daily Report failed* — ${err.message}`,
    }).catch(() => {});
  }
}

async function fetchStages(apiKey, stages, cutoff) {
  const auth = btoa(apiKey + ':');
  const leads = [];

  for (const stage of stages) {
    let offset = 0;
    let keepPaging = true;

    while (keepPaging) {
      const params = new URLSearchParams({
        stage,
        limit: '100',
        offset: String(offset),
        sort: 'updated',
        direction: 'desc',
      });

      const res = await fetch(`${FUB_BASE}/people?${params}`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) {
        console.error(`FUB API ${res.status} for stage "${stage}"`);
        break;
      }

      const { people = [] } = await res.json();

      for (const p of people) {
        if (new Date(p.updated) < cutoff) {
          keepPaging = false;
          break;
        }
        leads.push({ ...p, _stage: stage });
      }

      if (people.length < 100) keepPaging = false;
      offset += 100;
    }
  }

  return leads;
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function agentName(person, env) {
  const id = person.assignedUserId;
  if (!id) return 'Unassigned';
  if (env.ARRAN_USER_ID && String(id) === String(env.ARRAN_USER_ID)) return 'Arran';
  if (env.KERI_USER_ID && String(id) === String(env.KERI_USER_ID)) return 'Keri';
  return AGENT_MAP[id] || `User ${id}`;
}

function formatLead(p, env) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || '(No Name)';
  const phone = p.phones?.[0]?.value || 'No phone';
  const agent = agentName(p, env);
  const updatedAgo = daysSince(p.updated);
  const staleAgo = daysSince(p.lastCommunicatedAt || p.lastActivityDate);
  const staleFlag = staleAgo > STALE_DAYS ? ` 🚨 ${staleAgo}d no outbound` : '';

  return `• *${name}* | ${p._stage} | ${phone} | ${agent} | upd ${updatedAgo}d ago${staleFlag}`;
}

function section(title, subtitle, leads, env) {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${title}* (${leads.length})\n_${subtitle}_` },
    },
  ];

  if (leads.length === 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_None_' } });
    return blocks;
  }

  // Slack block text capped at 3000 chars; chunk at 10 leads per block
  for (let i = 0; i < leads.length; i += 10) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: leads.slice(i, i + 10).map(p => formatLead(p, env)).join('\n'),
      },
    });
  }

  return blocks;
}

function buildMessage(newBiz, moneyList, env) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const allLeads = [...newBiz, ...moneyList];
  const staleCount = allLeads.filter(
    p => daysSince(p.lastCommunicatedAt || p.lastActivityDate) > STALE_DAYS
  ).length;

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📋 FUB Hit-List — ${today}` },
      },
      ...section(
        '🆕 NEW BUSINESS',
        STAGES.NEW_BUSINESS.join(', '),
        newBiz,
        env
      ),
      { type: 'divider' },
      ...section(
        '💰 MONEY LIST',
        STAGES.MONEY_LIST.join(', '),
        moneyList,
        env
      ),
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${allLeads.length} total leads | 🚨 ${staleCount} stale (>${STALE_DAYS}d no outbound) | updated within ${UPDATED_WITHIN_DAYS}d`,
          },
        ],
      },
    ],
  };
}

async function postSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
}
