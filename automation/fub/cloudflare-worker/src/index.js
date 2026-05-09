/**
 * fub-daily-report — Cloudflare Worker
 * Runs 8:30am Pacific, Mon-Fri via Cron Trigger
 * Posts New Business + Money List hit-list sections to #fub-dashboard
 */

const STAGES = {
  NEW_BUSINESS: ["New", "Attempt to Contact", "Active"],
  MONEY_LIST: [
    "Hot Lead-Responded",
    "Application",
    "Appointments",
    "No Show Appt",
    "Application-Lending Pad",
    "Pending Submission",
    "Referrals To Convert",
  ],
};

// Arran and Keri user IDs — update if they change in FUB
const AGENTS = {
  arran: { name: "Arran", id: null },  // populated at runtime from /users
  keri:  { name: "Keri",  id: null },
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },
};

async function runDailyReport(env) {
  const fub = new FUBClient(env.FUB_API_KEY, env.FUB_BASE_URL);

  const lookbackDays = parseInt(env.LOOKBACK_DAYS ?? "10");
  const staleThreshold = parseInt(env.STALE_THRESHOLD_DAYS ?? "5");
  const since = daysAgo(lookbackDays);
  const staleDate = daysAgo(staleThreshold);

  // Resolve agent IDs once
  await resolveAgentIds(fub, env);

  const [newBusinessLeads, moneyListLeads] = await Promise.all([
    fetchLeadsByStages(fub, STAGES.NEW_BUSINESS, since),
    fetchLeadsByStages(fub, STAGES.MONEY_LIST, since),
  ]);

  const newBusinessSection = buildSection("New Business", newBusinessLeads, staleDate);
  const moneyListSection = buildSection("Money List", moneyListLeads, staleDate);

  const report = buildSlackPayload(newBusinessSection, moneyListSection, lookbackDays);
  await postToSlack(env.SLACK_WEBHOOK_URL, report);
}

// ── FUB API ──────────────────────────────────────────────────────────────────

class FUBClient {
  constructor(apiKey, baseUrl) {
    this.baseUrl = baseUrl ?? "https://api.followupboss.com/v1";
    this.auth = "Basic " + btoa(apiKey + ":");
  }

  async get(path, params = {}) {
    const url = new URL(this.baseUrl + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: this.auth, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`FUB ${res.status} on ${path}`);
    return res.json();
  }

  async getPaged(path, params = {}, limit = 100) {
    const results = [];
    let offset = 0;
    while (true) {
      const data = await this.get(path, { ...params, limit, offset });
      const items = data.people ?? data.deals ?? data.users ?? [];
      results.push(...items);
      if (items.length < limit) break;
      offset += limit;
    }
    return results;
  }
}

async function resolveAgentIds(fub, env) {
  const data = await fub.get("/users");
  const users = data.users ?? [];
  for (const u of users) {
    const name = (u.name ?? "").toLowerCase();
    if (name.includes("arran")) AGENTS.arran.id = u.id;
    if (name.includes("keri"))  AGENTS.keri.id  = u.id;
  }
}

async function fetchLeadsByStages(fub, stages, since) {
  const allLeads = [];
  for (const stage of stages) {
    const leads = await fub.getPaged("/people", {
      stage,
      updatedAfter: since.toISOString(),
      sort: "lastActivityAt",
    });
    allLeads.push(...leads.map(l => ({ ...l, _queriedStage: stage })));
  }
  // Dedup by id (lead may appear in multiple stage queries if FUB returns it)
  const seen = new Set();
  return allLeads.filter(l => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

// ── Report Building ──────────────────────────────────────────────────────────

function buildSection(title, leads, staleDate) {
  if (!leads.length) {
    return { title, rows: [], count: 0 };
  }

  const rows = leads.map(lead => {
    const lastOut = lead.lastActivityAt ? new Date(lead.lastActivityAt) : null;
    const isStale = lastOut ? lastOut < staleDate : true;
    const agent = resolveAgentName(lead.assignedTo);
    const daysSince = lastOut ? Math.floor((Date.now() - lastOut) / 86400000) : null;

    return {
      id: lead.id,
      name: lead.name ?? "Unknown",
      stage: lead.stage ?? lead._queriedStage ?? "—",
      agent,
      phone: (lead.phones ?? [])[0]?.value ?? "—",
      daysSince,
      isStale,
      lastOut,
    };
  });

  // Stale leads first, then by days since contact desc
  rows.sort((a, b) => {
    if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
    return (b.daysSince ?? 999) - (a.daysSince ?? 999);
  });

  return { title, rows, count: rows.length };
}

function resolveAgentName(assignedTo) {
  if (!assignedTo) return "Unassigned";
  const id = typeof assignedTo === "object" ? assignedTo.id : assignedTo;
  if (id === AGENTS.arran.id) return "Arran";
  if (id === AGENTS.keri.id) return "Keri";
  return assignedTo?.name ?? `User ${id}`;
}

function buildSlackPayload(newBiz, moneyList, lookbackDays) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `FUB Daily Hit-List — ${today}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `Leads updated in last ${lookbackDays} days. 🚨 = no outbound in 5+ days.`,
      }],
    },
    { type: "divider" },
    ...sectionBlocks(newBiz),
    { type: "divider" },
    ...sectionBlocks(moneyList),
    { type: "divider" },
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `_Total: ${newBiz.count + moneyList.count} leads | ${newBiz.count} New Business · ${moneyList.count} Money List_`,
      }],
    },
  ];

  return { blocks };
}

function sectionBlocks(section) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${section.title}* — ${section.count} leads`,
      },
    },
  ];

  if (!section.rows.length) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "_No leads in this section._" },
    });
    return blocks;
  }

  // Group into batches of 10 for Slack's block limits
  const batches = chunk(section.rows, 10);
  for (const batch of batches) {
    const lines = batch.map(row => {
      const stale = row.isStale ? "🚨 " : "";
      const days = row.daysSince !== null ? `${row.daysSince}d` : "new";
      const fubUrl = `https://app.followupboss.com/2/people/${row.id}`;
      return `${stale}<${fubUrl}|${row.name}> · ${row.stage} · ${row.agent} · last: ${days}`;
    });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    });
  }

  return blocks;
}

// ── Slack ────────────────────────────────────────────────────────────────────

async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack post failed ${res.status}: ${text}`);
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
