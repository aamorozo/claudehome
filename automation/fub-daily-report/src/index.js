/**
 * fub-daily-report — Cloudflare Worker
 * Runs 8:30am Pacific Mon-Fri via cron trigger.
 * Posts a sectioned hit-list to Slack #fub-dashboard:
 *   Section 1 — New Business (entry-stage leads)
 *   Section 2 — Money List (hot/active pipeline leads)
 * Filters: assigned leads updated within last 10 days.
 * Flags leads with no activity in last 5 days with 🚨.
 *
 * Env secrets (set in Cloudflare dashboard or wrangler secret put):
 *   FUB_API_KEY         — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL   — Slack Incoming Webhook for #fub-dashboard
 */

const FUB_BASE = "https://api.followupboss.com/v1";

// Stage config — exact names must match FUB stage list
const SECTIONS = [
  {
    title: "New Business",
    emoji: "🆕",
    stages: ["New Business"],
  },
  {
    title: "Money List",
    emoji: "💰",
    stages: [
      "Hot Lead-Responded",
      "Application",
      "Appointments",
      "No Show Appt",
      "Application-Lending Pad",
      "Pending Submission",
      "Referrals To Convert",
    ],
  },
];

const LOOKBACK_DAYS = 10;   // only show leads updated within this window
const STALE_DAYS = 5;       // flag leads with no activity beyond this

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  // Manual trigger via HTTP GET /run (useful for testing)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      ctx.waitUntil(runReport(env));
      return new Response("Report triggered", { status: 202 });
    }
    return new Response("fub-daily-report worker", { status: 200 });
  },
};

async function runReport(env) {
  const fubAuth = buildAuth(env.FUB_API_KEY);
  const now = new Date();
  const cutoff = daysAgo(now, LOOKBACK_DAYS);
  const staleThreshold = daysAgo(now, STALE_DAYS);

  const sectionBlocks = [];

  for (const section of SECTIONS) {
    const leads = await fetchLeadsForSection(section.stages, cutoff, fubAuth);
    if (leads.length === 0) continue;

    sectionBlocks.push(headerBlock(`${section.emoji} ${section.title} (${leads.length})`));
    sectionBlocks.push({ type: "divider" });

    for (const lead of leads) {
      const stale = new Date(lead.lastActivityAt || lead.created) < staleThreshold;
      sectionBlocks.push(leadBlock(lead, stale));
    }

    sectionBlocks.push({ type: "divider" });
  }

  if (sectionBlocks.length === 0) {
    await postToSlack(env.SLACK_WEBHOOK_URL, [
      headerBlock("📋 FUB Daily Hit-List"),
      { type: "section", text: { type: "mrkdwn", text: "No active leads to report today." } },
    ]);
    return;
  }

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "America/Los_Angeles",
  });

  await postToSlack(env.SLACK_WEBHOOK_URL, [
    headerBlock(`📋 FUB Daily Hit-List — ${dateStr}`),
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `Assigned leads updated in last ${LOOKBACK_DAYS} days  •  🚨 = no activity ${STALE_DAYS}+ days`,
      }],
    },
    { type: "divider" },
    ...sectionBlocks,
  ]);
}

async function fetchLeadsForSection(stages, cutoff, auth) {
  const updatedSince = cutoff.toISOString().slice(0, 19);
  const allLeads = [];

  for (const stage of stages) {
    const leads = await fetchPaginatedLeads(stage, updatedSince, auth);
    allLeads.push(...leads);
  }

  // Deduplicate by id (a person can only appear once even if matched multiple stages)
  const seen = new Set();
  return allLeads.filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

async function fetchPaginatedLeads(stage, updatedSince, auth) {
  const results = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      stage,
      updatedSince,
      isAssigned: "true",
      limit: String(limit),
      offset: String(offset),
      sort: "lastActivityAt",
      order: "desc",
    });

    const res = await fubFetch(`${FUB_BASE}/people?${params}`, auth);
    if (!res.ok) {
      console.error(`FUB API error for stage "${stage}": ${res.status}`);
      break;
    }

    const data = await res.json();
    const people = data.people ?? [];
    results.push(...people);

    if (people.length < limit) break;
    offset += limit;
  }

  return results;
}

async function fubFetch(url, auth, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Authorization: auth } });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
      await sleep((retryAfter + 2) * 1000);
      continue;
    }

    return res;
  }

  throw new Error(`FUB request failed after ${retries} retries: ${url}`);
}

function buildAuth(apiKey) {
  const encoded = btoa(`${apiKey}:`);
  return `Basic ${encoded}`;
}

function daysAgo(from, days) {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Slack block builders ---

function headerBlock(text) {
  return {
    type: "header",
    text: { type: "plain_text", text, emoji: true },
  };
}

function leadBlock(lead, stale) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const assignee = lead.assignedTo ?? "Unassigned";
  const stage = lead.stage ?? "—";
  const phone = lead.phones?.[0]?.value ?? "";
  const lastActivity = lead.lastActivityAt
    ? new Date(lead.lastActivityAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No activity";

  const staleFlag = stale ? " 🚨" : "";
  const fubUrl = `https://app.followupboss.com/2/people/${lead.id}`;

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${fubUrl}|${name}>*${staleFlag}\n${stage}  •  ${assignee}  •  Last: ${lastActivity}${phone ? `  •  ${phone}` : ""}`,
    },
  };
}

async function postToSlack(webhookUrl, blocks) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack webhook failed: ${res.status} — ${text}`);
  }
}
