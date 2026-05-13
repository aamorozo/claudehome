const FUB_BASE = 'https://api.followupboss.com/v1';
const ACTIVE_DAYS = 10;
const STALE_DAYS = 5;

// Update stage names to exact values from FUB Admin > Pipeline (case-sensitive)
const SECTIONS = [
  {
    label: 'NEW BUSINESS',
    stages: ['New Business'],
  },
  {
    label: 'MONEY LIST',
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

function fubHeaders(apiKey) {
  return {
    Authorization: 'Basic ' + btoa(apiKey + ':'),
    'Content-Type': 'application/json',
  };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

async function fubGet(path, env) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    headers: fubHeaders(env.FUB_API_KEY),
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10);
    await new Promise(r => setTimeout(r, (retryAfter + 2) * 1000));
    return fubGet(path, env);
  }
  if (!res.ok) throw new Error(`FUB ${res.status} on ${path}`);
  return res.json();
}

async function fetchLeadsForStage(stage, env) {
  const since = daysAgo(ACTIVE_DAYS);
  const leads = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      stage,
      updatedSince: since,
      limit: '100',
      offset: String(offset),
    });
    const data = await fubGet(`/people?${params}`, env);
    const page = data.people || [];
    leads.push(...page);
    if (page.length < 100) break;
    offset += 100;
  }
  return leads;
}

// Returns ISO string of most recent outbound contact, or null
async function getLastOutbound(personId, agentUserIds, env) {
  const data = await fubGet(`/events?personId=${personId}&limit=50`, env);
  const events = data.events || [];
  const agentSet = new Set(agentUserIds);
  const outbound = events.find(
    e =>
      ['Call', 'Text', 'Email', 'SMS', 'Note'].includes(e.type) &&
      agentSet.has(String(e.userId ?? e.createdByUserId))
  );
  return outbound ? outbound.createdAt : null;
}

function formatLead(lead, lastOutboundAt, agentMap) {
  const name = lead.name || 'Unknown';
  const agent = agentMap[String(lead.assignedUserId)] || 'Unassigned';
  const phone = lead.phones?.[0]?.value || '';
  const d = daysSince(lastOutboundAt);
  const stale = d > STALE_DAYS;
  const flag = stale ? '🚨 ' : '';
  const contactStr = isFinite(d) ? `last outbound ${d}d ago` : 'no outbound on record';
  const phoneStr = phone ? ` | ${phone}` : '';
  return `${flag}*${name}* (${agent}${phoneStr}) — ${contactStr}`;
}

async function buildSection(section, agentMap, agentUserIds, env) {
  const allLeads = [];
  for (const stage of section.stages) {
    try {
      const leads = await fetchLeadsForStage(stage, env);
      allLeads.push(...leads);
    } catch (err) {
      console.error(`fetchLeadsForStage failed for "${stage}":`, err.message);
    }
  }
  if (allLeads.length === 0) return null;

  const lines = await Promise.all(
    allLeads.map(async lead => {
      const lastOutbound = await getLastOutbound(lead.id, agentUserIds, env);
      return formatLead(lead, lastOutbound, agentMap);
    })
  );

  const staleCount = lines.filter(l => l.startsWith('🚨')).length;
  const header = `*— ${section.label} (${allLeads.length}${staleCount ? ` | 🚨 ${staleCount} stale` : ''}) —*`;
  return `${header}\n${lines.join('\n')}`;
}

async function runDailyReport(env) {
  // AGENT_MAP env var: JSON object mapping FUB userId → display name
  // e.g. '{"12345":"Arran","67890":"Keri"}'
  const agentMap = JSON.parse(env.AGENT_MAP || '{}');
  const agentUserIds = Object.keys(agentMap);

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  const sectionBlocks = [];
  for (const section of SECTIONS) {
    const block = await buildSection(section, agentMap, agentUserIds, env);
    if (block) sectionBlocks.push(block);
  }

  const body =
    sectionBlocks.length > 0
      ? sectionBlocks.join('\n\n')
      : '_No active leads updated in the last 10 days._';

  const message = `:calendar: *FUB Daily Hit-List — ${date}*\n\n${body}\n\n_Leads updated in last ${ACTIVE_DAYS}d | 🚨 = no outbound in ${STALE_DAYS}+ days_`;

  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

export default {
  // Cron trigger: 8:30am Pacific
  // PDT (Mar–Nov): 30 15 * * 1-5
  // PST (Nov–Mar): 30 16 * * 1-5
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },

  // Manual trigger: GET /trigger
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/trigger') {
      ctx.waitUntil(runDailyReport(env));
      return new Response('FUB daily report triggered', { status: 200 });
    }
    return new Response('fub-daily-report worker', { status: 200 });
  },
};
