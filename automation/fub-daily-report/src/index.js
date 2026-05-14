/**
 * FUB Daily Hit-List Report — Cloudflare Worker
 * Cron: Mon-Fri 8:30am PT
 * Posts New Business + Money List sections to #fub-dashboard
 */

const FUB_BASE = "https://api.followupboss.com/v1";

// Stages targeted by each report section
const SECTIONS = {
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

const STALE_DAYS = 5;
const LOOKBACK_DAYS = 10;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },

  // Allow manual trigger via GET for testing
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/run") {
      await runReport(env);
      return new Response("Report sent.", { status: 200 });
    }
    return new Response("FUB Daily Report Worker", { status: 200 });
  },
};

async function runReport(env) {
  const fubAuth = "Basic " + btoa(env.FUB_API_KEY + ":");
  const cutoff = daysAgo(LOOKBACK_DAYS);

  const sections = [];

  for (const [sectionName, stages] of Object.entries(SECTIONS)) {
    const leads = await fetchLeadsForStages(fubAuth, stages, cutoff, env);
    sections.push({ name: sectionName, leads });
  }

  const blocks = buildSlackBlocks(sections);
  await postToSlack(env.SLACK_WEBHOOK_URL, blocks);
}

async function fetchLeadsForStages(auth, stages, cutoff, env) {
  const allLeads = [];

  for (const stage of stages) {
    let offset = 0;
    const limit = 100;

    while (true) {
      const params = new URLSearchParams({
        stage,
        sort: "-updated",
        limit: String(limit),
        offset: String(offset),
      });

      const res = await fetch(`${FUB_BASE}/people?${params}`, {
        headers: { Authorization: auth },
      });

      if (!res.ok) break;

      const data = await res.json();
      const people = data.people ?? [];

      for (const p of people) {
        // Only assigned leads updated within lookback window
        if (!p.assignedTo) continue;
        const updated = new Date(p.updated);
        if (updated < cutoff) break; // sorted by updated desc, stop early
        allLeads.push({ ...p, _stage: stage });
      }

      if (people.length < limit) break;
      offset += limit;
    }
  }

  // Deduplicate by id (lead may match multiple stages)
  const seen = new Set();
  return allLeads.filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

function buildSlackBlocks(sections) {
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
        text: `FUB Hit-List — ${today}`,
      },
    },
    { type: "divider" },
  ];

  for (const section of sections) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${section.name}* — ${section.leads.length} lead${section.leads.length !== 1 ? "s" : ""}`,
      },
    });

    if (section.leads.length === 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No leads in this section today._" },
      });
    } else {
      for (const lead of section.leads) {
        blocks.push(buildLeadBlock(lead));
      }
    }

    blocks.push({ type: "divider" });
  }

  return blocks;
}

function buildLeadBlock(lead) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const stage = lead._stage;
  const assignedTo = lead.assignedTo ?? "Unassigned";
  const lastActivity = lead.lastActivityAt ? new Date(lead.lastActivityAt) : null;
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000)
    : null;

  const staleFlag =
    daysSinceActivity !== null && daysSinceActivity > STALE_DAYS ? " 🚨" : "";
  const activityText =
    daysSinceActivity !== null
      ? `${daysSinceActivity}d since last activity`
      : "No activity logged";

  const phone = lead.phones?.[0]?.value ?? "";
  const fubLink = `https://app.followupboss.com/2/people/view/${lead.id}`;

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${fubLink}|${name}>*${staleFlag}\n${stage} · ${assignedTo} · ${activityText}${phone ? " · " + phone : ""}`,
    },
  };
}

async function postToSlack(webhookUrl, blocks) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
