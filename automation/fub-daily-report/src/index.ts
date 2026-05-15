export interface Env {
  FUB_API_KEY: string;
  SLACK_WEBHOOK_URL: string;
  ARRAN_USER_ID: string;
  KERI_USER_ID: string;
}

interface FUBPerson {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  assignedUserId: number;
  stage: string;
  updatedAt: string;
  phones?: Array<{ value: string; type: string }>;
}

interface FUBEvent {
  id: number;
  type: string;
  direction?: string;
  createdAt: string;
}

interface FUBPeopleResponse {
  people: FUBPerson[];
  _metadata: { total: number; limit: number; offset: number };
}

interface FUBEventsResponse {
  events: FUBEvent[];
}

const TARGET_STAGES = ['New Business', 'Money List'];
const STALE_DAYS = 5;
const WINDOW_DAYS = 10;

const STAGE_EMOJI: Record<string, string> = {
  'New Business': '🏦',
  'Money List': '💰',
};

async function fubGet<T>(path: string, apiKey: string): Promise<T> {
  const auth = btoa(`${apiKey}:`);
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'X-System': 'FUB Daily Report',
      'X-System-Key': apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`FUB ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function getLeadsByStage(stage: string, apiKey: string): Promise<FUBPerson[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

  const leads: FUBPerson[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await fubGet<FUBPeopleResponse>(
      `/people?stage=${encodeURIComponent(stage)}&limit=${limit}&offset=${offset}&sort=-updated`,
      apiKey
    );

    const page = data.people ?? [];

    for (const person of page) {
      if (new Date(person.updatedAt) >= cutoff) {
        // Only include leads assigned to tracked agents
        leads.push(person);
      }
    }

    // Stop paging when remaining records are older than window
    if (page.length < limit) break;
    if (page.length > 0 && new Date(page[page.length - 1].updatedAt) < cutoff) break;
    offset += limit;
  }

  return leads;
}

async function daysSinceLastOutbound(personId: number, apiKey: string): Promise<number | null> {
  const data = await fubGet<FUBEventsResponse>(
    `/events?personId=${personId}&type[]=Call&type[]=Text&type[]=Email&limit=25&sort=-created`,
    apiKey
  );

  const outbound = (data.events ?? []).filter(
    (e) => e.direction === 'outgoing' || e.direction === 'outbound'
  );

  if (outbound.length === 0) return null;

  const lastDate = new Date(outbound[0].createdAt);
  return Math.floor((Date.now() - lastDate.getTime()) / 86_400_000);
}

function formatLeadLine(
  person: FUBPerson,
  agentName: string,
  daysSinceUpdate: number,
  daysNoOutbound: number | null
): string {
  const stale = daysNoOutbound === null || daysNoOutbound > STALE_DAYS;
  const flag = stale ? '🚨 ' : '';
  const outboundNote =
    daysNoOutbound !== null ? `${daysNoOutbound}d since outbound` : 'no outbound logged';

  return `${flag}*${person.name}* — ${agentName} | updated ${daysSinceUpdate}d ago | ${outboundNote}`;
}

async function buildSlackBlocks(env: Env): Promise<object[]> {
  const userMap: Record<number, string> = {
    [parseInt(env.ARRAN_USER_ID)]: 'Arran',
    [parseInt(env.KERI_USER_ID)]: 'Keri',
  };

  const ptDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

  let totalLeads = 0;
  let totalStale = 0;
  const stageSections: object[] = [];

  for (const stage of TARGET_STAGES) {
    const leads = await getLeadsByStage(stage, env.FUB_API_KEY);
    totalLeads += leads.length;

    const emoji = STAGE_EMOJI[stage] ?? '📌';
    const lines: string[] = [];

    for (const person of leads) {
      const agentName = userMap[person.assignedUserId] ?? `Agent ${person.assignedUserId}`;
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(person.updatedAt).getTime()) / 86_400_000
      );
      const daysNoOutbound = await daysSinceLastOutbound(person.id, env.FUB_API_KEY);
      const isStale = daysNoOutbound === null || daysNoOutbound > STALE_DAYS;

      if (isStale) totalStale++;
      lines.push(formatLeadLine(person, agentName, daysSinceUpdate, daysNoOutbound));
    }

    const body =
      leads.length === 0
        ? '_No leads updated in the last 10 days_'
        : lines.join('\n');

    stageSections.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${emoji} ${stage}* (${leads.length})\n${body}`,
      },
    });
    stageSections.push({ type: 'divider' });
  }

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 FUB Hit-List — ${ptDate}` },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${totalLeads} active leads · 🚨 ${totalStale} need outreach · stages: ${TARGET_STAGES.join(', ')} · updated within ${WINDOW_DAYS} days`,
        },
      ],
    },
    { type: 'divider' },
    ...stageSections,
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_FUB Daily Report · ${new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Los_Angeles',
            timeZoneName: 'short',
          })}_`,
        },
      ],
    },
  ];
}

async function postToSlack(webhookUrl: string, blocks: object[]): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
}

export default {
  // Cron trigger: 15:30 UTC = 8:30am PDT / 7:30am PST
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const blocks = await buildSlackBlocks(env);
        await postToSlack(env.SLACK_WEBHOOK_URL, blocks);
      })()
    );
  },

  // Manual trigger via GET /run (protected by checking for a test token)
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/run') {
      try {
        const blocks = await buildSlackBlocks(env);
        await postToSlack(env.SLACK_WEBHOOK_URL, blocks);
        return new Response('Report sent to #fub-dashboard', { status: 200 });
      } catch (err) {
        return new Response(`Error: ${(err as Error).message}`, { status: 500 });
      }
    }
    return new Response('FUB Daily Report Worker — POST /run to trigger manually', {
      status: 200,
    });
  },
};
