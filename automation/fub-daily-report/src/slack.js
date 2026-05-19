export function buildHitListBlocks(sections, dateLabel) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `FUB Daily Hit-List — ${dateLabel}`, emoji: true },
    },
    { type: 'divider' },
  ];

  let totalLeads = 0;

  for (const { stageName, leads } of sections) {
    totalLeads += leads.length;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${stageName.toUpperCase()} — ${leads.length} lead${leads.length !== 1 ? 's' : ''}*`,
      },
    });

    if (!leads.length) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '_No leads in this stage updated in last 10 days._' },
      });
    } else {
      const lines = leads.map((l) => {
        const flag = l.isStale ? '🚨' : '   ';
        const name = l.name || '(no name)';
        const phone = l.phone ? ` | ${l.phone}` : '';
        const agent = l.assignedTo ? ` | ${l.assignedTo}` : '';
        const age = l.daysSinceActivity !== null ? ` | ${l.daysSinceActivity}d` : '';
        return `${flag} ${name}${phone}${agent}${age}`;
      });

      // Slack section text max 3000 chars; split into chunks of 30 leads
      const CHUNK = 30;
      for (let i = 0; i < lines.length; i += CHUNK) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: lines.slice(i, i + CHUNK).join('\n') },
        });
      }
    }

    blocks.push({ type: 'divider' });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*${totalLeads} total leads* | Updated last 10 days | 🚨 = no activity >5 days`,
      },
    ],
  });

  return blocks;
}

export async function postToSlack(webhookUrl, blocks) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text().catch(() => '')}`);
}
