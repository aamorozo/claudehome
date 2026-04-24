const FUB_APP_BASE = "https://app.followupboss.com/2/people/";

function daysSince(isoDate) {
  if (!isoDate) return null;
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / 86_400_000);
}

function formatLead(lead, lastOutbound, staleThreshold) {
  const staleDays = daysSince(lastOutbound);
  const isStale = staleDays === null || staleDays >= staleThreshold;
  const staleFlag = isStale ? " 🚨" : "";
  const staleSummary =
    staleDays === null
      ? "no outbound on record"
      : `last contact ${staleDays}d ago`;

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const phone = lead.phones?.[0]?.value ?? "";
  const email = lead.emails?.[0]?.value ?? "";
  const assigned = lead.assignedTo ?? "Unassigned";
  const url = `${FUB_APP_BASE}${lead.id}`;

  return `• <${url}|${name}>${staleFlag}  |  ${lead.stage}  |  ${assigned}  |  ${staleSummary}${phone ? `  |  ${phone}` : ""}${email ? `  |  ${email}` : ""}`;
}

function buildSection(title, lines) {
  if (lines.length === 0) return null;
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${title}* (${lines.length})\n${lines.join("\n")}`,
    },
  };
}

export function buildSlackPayload(newBusiness, moneyList, staleThreshold) {
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
        emoji: true,
      },
    },
    { type: "divider" },
  ];

  const newBizLines = newBusiness.map(({ lead, lastOutbound }) =>
    formatLead(lead, lastOutbound, staleThreshold)
  );
  const moneyLines = moneyList.map(({ lead, lastOutbound }) =>
    formatLead(lead, lastOutbound, staleThreshold)
  );

  const newBizBlock = buildSection("NEW BUSINESS", newBizLines);
  const moneyBlock = buildSection("MONEY LIST", moneyLines);

  if (newBizBlock) blocks.push(newBizBlock, { type: "divider" });
  if (moneyBlock) blocks.push(moneyBlock, { type: "divider" });

  const total = newBusiness.length + moneyList.length;
  const staleCount =
    newBusiness.filter((x) => {
      const d = daysSince(x.lastOutbound);
      return d === null || d >= staleThreshold;
    }).length +
    moneyList.filter((x) => {
      const d = daysSince(x.lastOutbound);
      return d === null || d >= staleThreshold;
    }).length;

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `${total} leads shown  |  🚨 ${staleCount} need outreach  |  Updated in last 10 days`,
      },
    ],
  });

  return { blocks };
}

export async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
}
