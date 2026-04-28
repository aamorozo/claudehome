/**
 * fub-daily-report — Cloudflare Worker
 * Runs 8:30am Pacific Mon-Fri via Cron Trigger
 * Posts sectioned hit-list to #fub-dashboard in Slack
 *
 * Env vars (set in Cloudflare dashboard secrets):
 *   FUB_API_KEY       — Follow Up Boss API key
 *   SLACK_WEBHOOK_URL — Incoming webhook URL for #fub-dashboard
 *   ARRAN_USER_ID     — FUB user ID for Arran
 *   KERI_USER_ID      — FUB user ID for Keri
 */

const STAGE_GROUPS = {
  "New Business": [
    "New",
    "Attempting Contact",
    "Contact Made",
    "Working",
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

const STALE_OUTBOUND_DAYS = 5;
const UPDATED_WITHIN_DAYS = 10;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReport(env));
  },

  // Dev/test: GET /run triggers manually
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/run") {
      ctx.waitUntil(runDailyReport(env));
      return new Response("Report triggered", { status: 200 });
    }
    return new Response("fub-daily-report worker", { status: 200 });
  },
};

async function runDailyReport(env) {
  const cutoffDate = daysAgo(UPDATED_WITHIN_DAYS);
  const sections = [];

  for (const [groupName, stages] of Object.entries(STAGE_GROUPS)) {
    const leads = await fetchLeadsForStages(stages, cutoffDate, env);
    if (leads.length === 0) continue;

    const sorted = leads.sort((a, b) => {
      const aLast = lastOutboundDays(a);
      const bLast = lastOutboundDays(b);
      return bLast - aLast; // most stale first
    });

    sections.push(buildSection(groupName, sorted));
  }

  if (sections.length === 0) {
    await postToSlack(env.SLACK_WEBHOOK_URL, [
      {
        type: "section",
        text: { type: "mrkdwn", text: "*FUB Daily Report* — No leads to surface today." },
      },
    ]);
    return;
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `FUB Hit-List — ${today}`, emoji: true },
    },
    { type: "divider" },
    ...sections.flat(),
  ];

  await postToSlack(env.SLACK_WEBHOOK_URL, blocks);
}

async function fetchLeadsForStages(stages, cutoffDate, env) {
  const allLeads = [];
  const userIds = [env.ARRAN_USER_ID, env.KERI_USER_ID].filter(Boolean);

  for (const stage of stages) {
    let offset = 0;
    const limit = 100;

    while (true) {
      const params = new URLSearchParams({
        stage,
        updatedAfter: cutoffDate,
        limit: String(limit),
        offset: String(offset),
        sort: "lastActivityDate",
      });

      if (userIds.length > 0) {
        userIds.forEach((id) => params.append("assignedUserId", id));
      }

      const resp = await fubGet(`/people?${params}`, env.FUB_API_KEY);
      const { people = [], metadata } = resp;

      for (const person of people) {
        person._stage = stage;
        allLeads.push(person);
      }

      if (people.length < limit) break;
      offset += limit;
    }
  }

  return allLeads;
}

function buildSection(groupName, leads) {
  const rows = leads.map((lead) => formatLeadRow(lead));
  const text = rows.join("\n");

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${groupName}* (${leads.length} lead${leads.length !== 1 ? "s" : ""})\n${text}`,
      },
    },
    { type: "divider" },
  ];
}

function formatLeadRow(lead) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const stage = lead._stage || lead.stage || "—";
  const phone = primaryPhone(lead);
  const staleDays = lastOutboundDays(lead);
  const staleFlag = staleDays >= STALE_OUTBOUND_DAYS ? " 🚨" : "";
  const assigned = lead.assignedTo?.name ?? "Unassigned";
  const daysSuffix = staleDays === null ? "no outbound" : `${staleDays}d since outbound`;

  return `• *${name}*${staleFlag} | ${stage} | ${phone} | ${assigned} | ${daysSuffix}`;
}

function primaryPhone(lead) {
  const phones = lead.phones ?? [];
  const primary = phones.find((p) => p.isPrimary) ?? phones[0];
  return primary?.value ?? "no phone";
}

function lastOutboundDays(lead) {
  // FUB surfaces lastActivityDate; for outbound specifically we fall back to that
  const raw = lead.lastCommunicatedAt ?? lead.lastActivityDate;
  if (!raw) return null;
  const ms = Date.now() - new Date(raw).getTime();
  return Math.floor(ms / 86_400_000);
}

async function fubGet(path, apiKey) {
  const base = "https://api.followupboss.com/v1";
  const resp = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Basic ${btoa(apiKey + ":")}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`FUB API ${resp.status} on ${path}: ${body}`);
  }

  return resp.json();
}

async function postToSlack(webhookUrl, blocks) {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Slack webhook ${resp.status}: ${body}`);
  }
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
