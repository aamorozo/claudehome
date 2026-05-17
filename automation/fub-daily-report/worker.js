/**
 * fub-daily-report — Cloudflare Worker
 * Runs Mon–Fri at 8:30am Pacific via cron trigger.
 * Queries FUB for New Business + Money List leads updated in last 10 days,
 * flags stale leads (>5 days since last outbound), posts to #fub-dashboard.
 *
 * Required secrets (set via wrangler secret put):
 *   FUB_API_KEY        — FUB API key (will be base64-encoded as Basic auth)
 *   SLACK_WEBHOOK_URL  — Incoming webhook for #fub-dashboard
 */

const FUB_BASE = "https://api.followupboss.com/v1";
const STAGES = ["New Business", "Money List"];
const LOOKBACK_DAYS = 10;
const STALE_DAYS = 5;

// Outbound event types that reset the stale clock
const OUTBOUND_TYPES = ["Call", "Email", "Text", "SMS"];

export default {
  async scheduled(event, env, ctx) {
    // Cloudflare cron fires at 15:30 UTC (8:30am PDT) and 16:30 UTC (8:30am PST).
    // Both cron entries are in wrangler.toml; the one that doesn't match Pacific
    // 8:30am is a no-op because we check the hour here.
    const now = new Date();
    const pacificHour = getPacificHour(now);
    if (pacificHour !== 8) return; // Only run at 8am Pacific hour

    ctx.waitUntil(runReport(env));
  },

  // Allow manual HTTP trigger for testing: GET /trigger
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger") {
      const result = await runReport(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("fub-daily-report worker. GET /trigger to run manually.", { status: 200 });
  },
};

// ---------------------------------------------------------------------------

async function runReport(env) {
  const auth = "Basic " + btoa(env.FUB_API_KEY + ":");
  const cutoff = daysAgo(LOOKBACK_DAYS);

  const sections = {};
  for (const stage of STAGES) {
    const leads = await fetchLeadsForStage(stage, cutoff, auth);
    const enriched = await Promise.all(
      leads.map((lead) => enrichLead(lead, auth))
    );
    sections[stage] = enriched.sort((a, b) => a.daysSinceOutbound - b.daysSinceOutbound);
  }

  const blocks = buildSlackBlocks(sections);
  await postToSlack(env.SLACK_WEBHOOK_URL, blocks);

  return { status: "ok", counts: Object.fromEntries(STAGES.map((s) => [s, sections[s].length])) };
}

// ---------------------------------------------------------------------------
// FUB data fetching

async function fetchLeadsForStage(stage, updatedSince, auth) {
  const leads = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      stage,
      updatedSince,
      limit: String(limit),
      offset: String(offset),
      sort: "updated",
      direction: "desc",
    });

    const res = await fubGet(`/people?${params}`, auth);
    const people = res.people ?? [];
    leads.push(...people);

    if (people.length < limit) break;
    offset += limit;
  }

  return leads;
}

async function enrichLead(lead, auth) {
  // Fetch recent events to find last outbound contact
  const eventsRes = await fubGet(
    `/events?personId=${lead.id}&limit=50&sort=created&direction=desc`,
    auth
  );
  const events = eventsRes.events ?? [];

  const lastOutbound = events.find((e) => OUTBOUND_TYPES.includes(e.type));
  const daysSinceOutbound = lastOutbound
    ? daysBetween(new Date(lastOutbound.created), new Date())
    : Infinity;

  return {
    id: lead.id,
    name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Unknown",
    phone: lead.phones?.[0]?.value ?? "",
    stage: lead.stage ?? "",
    assignedTo: lead.assignedTo ?? "Unassigned",
    updatedAt: lead.updated,
    lastOutboundType: lastOutbound?.type ?? null,
    lastOutboundDate: lastOutbound?.created ?? null,
    daysSinceOutbound,
    isStale: daysSinceOutbound > STALE_DAYS,
    fubUrl: `https://app.followupboss.com/2/people/detail/${lead.id}`,
  };
}

// ---------------------------------------------------------------------------
// Slack formatting

function buildSlackBlocks(sections) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "America/Los_Angeles",
  });

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `FUB Hit-List — ${today}` },
    },
    { type: "divider" },
  ];

  for (const stage of STAGES) {
    const leads = sections[stage] ?? [];
    const staleCount = leads.filter((l) => l.isStale).length;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${stage}* — ${leads.length} lead${leads.length !== 1 ? "s" : ""}${staleCount > 0 ? `  🚨 ${staleCount} stale` : ""}`,
      },
    });

    if (leads.length === 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No leads in this stage._" },
      });
    } else {
      for (const lead of leads) {
        const staleFlag = lead.isStale ? " 🚨" : "";
        const lastContact = lead.lastOutboundDate
          ? `${lead.lastOutboundType} ${lead.daysSinceOutbound}d ago`
          : "No outbound on record";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*<${lead.fubUrl}|${lead.name}>*${staleFlag}\n${lead.phone}  ·  ${lead.assignedTo}  ·  Last: ${lastContact}`,
          },
        });
      }
    }

    blocks.push({ type: "divider" });
  }

  // Footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `🚨 = no outbound in >${STALE_DAYS} days  ·  Showing leads updated in last ${LOOKBACK_DAYS} days  ·  West Capital Lending`,
      },
    ],
  });

  return blocks;
}

async function postToSlack(webhookUrl, blocks) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    throw new Error(`Slack post failed: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Utilities

async function fubGet(path, auth) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    await sleep((retryAfter + 2) * 1000);
    return fubGet(path, auth); // one retry per R002
  }

  if (!res.ok) {
    throw new Error(`FUB API error ${res.status} on ${path}: ${await res.text()}`);
  }

  return res.json();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function getPacificHour(date) {
  return parseInt(
    date.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }),
    10
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
