/**
 * fub-daily-report — Cloudflare Worker
 * Runs 8:30am Pacific Mon-Fri
 * Posts FUB hit-list to #fub-dashboard on Slack
 * Stages: New Business + Money List pipeline
 * Flags leads with no outbound contact in >5 days with 🚨
 */

const FUB_BASE = "https://api.followupboss.com/v1";
const STALE_DAYS = 5;
const LOOKBACK_DAYS = 10;

// Stages included in the daily report
const REPORT_STAGES = {
  "New Business": [
    "New",
    "Attempted Contact",
    "Active Buyer",
    "Active Seller",
  ],
  "Money List": [
    "Hot Lead-Responded",
    "Application",
    "Appointments",
    "No Show Appt",
    "Application-Lending Pad",
    "Pending Submission",
    "Referrals To Convert",
  ],
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },

  // Allow manual trigger via HTTP GET for testing
  async fetch(request, env, ctx) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    ctx.waitUntil(runDailyReport(env));
    return new Response("FUB daily report triggered", { status: 200 });
  },
};

async function runDailyReport(env) {
  const cutoffDate = daysAgo(LOOKBACK_DAYS);
  const staleDate = daysAgo(STALE_DAYS);

  const assignedUserIds = [env.ARRAN_USER_ID, env.KERI_USER_ID].filter(Boolean);

  const allLeads = await fetchLeads(env, cutoffDate, assignedUserIds);

  // Group leads by report section
  const sections = {};
  for (const [sectionName, stages] of Object.entries(REPORT_STAGES)) {
    sections[sectionName] = allLeads.filter((lead) =>
      stages.includes(lead.stage)
    );
  }

  const blocks = buildSlackBlocks(sections, staleDate);
  await postToSlack(env, blocks);
}

async function fetchLeads(env, cutoffDate, assignedUserIds) {
  const auth = btoa(`${env.FUB_API_KEY}:x`);
  const allLeads = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      sort: "lastActivityDate",
      order: "desc",
    });

    const res = await fetch(`${FUB_BASE}/people?${params}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`FUB API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const people = data.people ?? [];

    if (people.length === 0) break;

    for (const person of people) {
      // Stop fetching if records are older than lookback window
      if (person.updated && person.updated < cutoffDate) {
        return allLeads;
      }

      // Filter: must be assigned to Arran or Keri
      if (
        assignedUserIds.length > 0 &&
        !assignedUserIds.includes(String(person.assignedUserId))
      ) {
        continue;
      }

      // Filter: must be in a reportable stage
      const allStages = Object.values(REPORT_STAGES).flat();
      if (!allStages.includes(person.stage)) continue;

      allLeads.push(normalizeLead(person));
    }

    if (people.length < limit) break;
    offset += limit;
  }

  return allLeads;
}

function normalizeLead(person) {
  const lastOutbound = person.lastOutboundAt ?? person.lastActivityDate ?? null;
  return {
    id: person.id,
    name: `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || "Unknown",
    stage: person.stage ?? "Unknown",
    assignedUserId: String(person.assignedUserId ?? ""),
    phone: extractPhone(person.phones),
    lastOutbound,
    updated: person.updated,
    profileUrl: `https://app.followupboss.com/2/people/${person.id}`,
  };
}

function extractPhone(phones) {
  if (!phones || phones.length === 0) return null;
  const mobile = phones.find((p) => p.type === "Mobile");
  return (mobile ?? phones[0]).value ?? null;
}

function buildSlackBlocks(sections, staleDate) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📋 FUB Daily Hit-List — ${today}`,
        emoji: true,
      },
    },
    { type: "divider" },
  ];

  let hasAnyLeads = false;

  for (const [sectionName, leads] of Object.entries(sections)) {
    if (leads.length === 0) continue;
    hasAnyLeads = true;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${sectionName.toUpperCase()} (${leads.length})*`,
      },
    });

    // Sort: stale leads first, then by last outbound desc
    const sorted = [...leads].sort((a, b) => {
      const aStale = isStale(a.lastOutbound, staleDate);
      const bStale = isStale(b.lastOutbound, staleDate);
      if (aStale !== bStale) return aStale ? -1 : 1;
      return (b.lastOutbound ?? "").localeCompare(a.lastOutbound ?? "");
    });

    for (const lead of sorted) {
      blocks.push(buildLeadBlock(lead, staleDate));
    }

    blocks.push({ type: "divider" });
  }

  if (!hasAnyLeads) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No active leads in pipeline today._",
      },
    });
  }

  return blocks;
}

function buildLeadBlock(lead, staleDate) {
  const staleFlag = isStale(lead.lastOutbound, staleDate) ? " 🚨" : "";
  const lastContactText = lead.lastOutbound
    ? `Last outbound: ${formatDate(lead.lastOutbound)}`
    : "Last outbound: _never_";

  const phoneText = lead.phone ? ` · ${lead.phone}` : "";

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${lead.profileUrl}|${lead.name}>*${staleFlag}\n_${lead.stage}_${phoneText}\n${lastContactText}`,
    },
  };
}

function isStale(lastOutbound, staleDate) {
  if (!lastOutbound) return true; // never contacted = stale
  return lastOutbound < staleDate;
}

function formatDate(isoString) {
  if (!isoString) return "unknown";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

async function postToSlack(env, blocks) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: env.SLACK_CHANNEL ?? "#fub-dashboard",
      blocks,
      text: "FUB Daily Hit-List",
      unfurl_links: false,
    }),
  });

  const result = await res.json();
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }
}
