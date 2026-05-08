const FUB_CONTACT_BASE = 'https://app.followupboss.com/2/people/detail/';

export function buildDailyReport({ newBusiness, moneyList, staleDays, reportDate }) {
  const dateStr = reportDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles',
  });

  const blocks = [
    header(`FUB Daily Hit-List — ${dateStr}`),
    divider(),
  ];

  if (newBusiness.length === 0 && moneyList.length === 0) {
    blocks.push(section(':white_check_mark: No active assigned leads to review today.'));
    return { blocks };
  }

  if (newBusiness.length > 0) {
    blocks.push(section(':fire: *New Business*'));
    for (const lead of newBusiness) {
      blocks.push(leadRow(lead, staleDays));
    }
    blocks.push(divider());
  }

  if (moneyList.length > 0) {
    blocks.push(section(':money_with_wings: *Money List*'));
    for (const lead of moneyList) {
      blocks.push(leadRow(lead, staleDays));
    }
    blocks.push(divider());
  }

  const total = newBusiness.length + moneyList.length;
  const staleCount = [...newBusiness, ...moneyList].filter(l => l._isStale).length;
  const summaryParts = [`${total} lead${total !== 1 ? 's' : ''} active`];
  if (staleCount > 0) summaryParts.push(`:rotating_light: ${staleCount} stale (>${staleDays}d no outbound)`);
  blocks.push(section(`_${summaryParts.join(' · ')}_`));

  return { blocks };
}

function leadRow(lead, staleDays) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
  const stage = lead.stage || 'Unknown Stage';
  const assignedTo = lead.assignedTo || 'Unassigned';
  const fubUrl = `${FUB_CONTACT_BASE}${lead.id}`;

  let lastOutboundText;
  if (lead._lastOutbound) {
    const daysAgo = daysDiff(lead._lastOutbound);
    lastOutboundText = `${daysAgo}d ago`;
  } else {
    lastOutboundText = 'never';
  }

  const staleFlag = lead._isStale ? ' :rotating_light:' : '';
  const text = `*<${fubUrl}|${name}>*${staleFlag}  ·  ${stage}  ·  ${assignedTo}  ·  Last outbound: ${lastOutboundText}`;

  return section(text);
}

export async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook failed ${res.status}: ${body}`);
  }
}

// Block Kit helpers
function header(text) {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } };
}

function section(text) {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function divider() {
  return { type: 'divider' };
}

function daysDiff(date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}
