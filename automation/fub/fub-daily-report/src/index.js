/**
 * fub-daily-report — Cloudflare Worker
 * Cron: 8:30am Pacific Mon-Fri (15:30 UTC)
 * Posts FUB hit-list to Slack #fub-dashboard
 *
 * Required secrets (wrangler secret put):
 *   FUB_API_KEY         — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL   — Incoming webhook for #fub-dashboard
 */

const FUB_BASE = "https://api.followupboss.com/v1";
const STALE_DAYS = 5;
const ACTIVE_DAYS = 10;

// Stages shown in the report, grouped into sections
const SECTIONS = {
  "New Business": ["New"],
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
    ctx.waitUntil(runReport(env));
  },

  // Allow manual trigger via GET /run for testing
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/run") {
      await runReport(env);
      return new Response("Report sent.", { status: 200 });
    }
    return new Response("FUB Daily Report Worker", { status: 200 });
  },
};

async function runReport(env) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

  const blocks = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `FUB Hit-List — ${formatDate(now)}`,
    },
  });

  let totalLeads = 0;

  for (const [sectionName, stages] of Object.entries(SECTIONS)) {
    const leads = await fetchLeadsForStages(env, stages, cutoff);
    totalLeads += leads.length;

    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${sectionName}* — ${leads.length} lead${leads.length !== 1 ? "s" : ""}`,
      },
    });

    if (leads.length === 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No active leads in this section._" },
      });
      continue;
    }

    for (const lead of leads) {
      blocks.push(formatLeadBlock(lead, now));
    }
  }

  if (totalLeads === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No leads updated in the last 10 days across tracked stages._",
      },
    });
  }

  await postToSlack(env, blocks);
}

async function fetchLeadsForStages(env, stages, cutoff) {
  const authHeader = `Basic ${btoa(env.FUB_API_KEY + ":")}`;
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

      const resp = await fetch(`${FUB_BASE}/people?${params}`, {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "X-System": "fub-daily-report/1.0",
        },
      });

      if (!resp.ok) {
        console.error(`FUB API error for stage "${stage}": ${resp.status}`);
        break;
      }

      const data = await resp.json();
      const people = data.people ?? [];

      for (const person of people) {
        const updated = new Date(person.updated ?? person.created);
        if (updated < cutoff) break; // sorted by updated desc — stop early
        if (!allLeads.find((l) => l.id === person.id)) {
          allLeads.push(person);
        }
      }

      if (people.length < limit) break;

      // If last record is older than cutoff, no need to paginate further
      const lastUpdated = new Date(people[people.length - 1]?.updated ?? 0);
      if (lastUpdated < cutoff) break;

      offset += limit;
    }
  }

  // Sort by last activity ascending (oldest contact first = highest priority)
  allLeads.sort((a, b) => {
    const aLast = new Date(a.lastActivity ?? a.updated ?? 0);
    const bLast = new Date(b.lastActivity ?? b.updated ?? 0);
    return aLast - bLast;
  });

  return allLeads;
}

function formatLeadBlock(lead, now) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const stage = lead.stage ?? "—";
  const assignee = lead.assignees?.[0]?.name ?? "Unassigned";
  const phone = lead.phones?.[0]?.value ?? "";
  const email = lead.emails?.[0]?.value ?? "";

  const lastActivity = lead.lastActivity ? new Date(lead.lastActivity) : null;
  const daysSinceContact = lastActivity
    ? Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24))
    : null;

  const staleFlag =
    daysSinceContact !== null && daysSinceContact > STALE_DAYS ? " 🚨" : "";

  const contactLine =
    daysSinceContact !== null
      ? `Last contact: ${daysSinceContact}d ago${staleFlag}`
      : `Last contact: unknown${staleFlag}`;

  const details = [
    `Stage: ${stage}`,
    `Assigned: ${assignee}`,
    contactLine,
    phone ? `📞 ${phone}` : null,
    email ? `✉️ ${email}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  const fubUrl = `https://app.followupboss.com/2/people/view/${lead.id}`;

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${fubUrl}|${name}>*\n${details}`,
    },
  };
}

async function postToSlack(env, blocks) {
  const resp = await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Slack webhook error ${resp.status}: ${body}`);
  }
}

function formatDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
