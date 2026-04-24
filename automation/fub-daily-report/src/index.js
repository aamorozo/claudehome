import {
  STAGES,
  REPORT_WINDOW_DAYS,
  STALE_DAYS,
} from "./config.js";
import { getPeopleByStages, getLastOutbound, resolveAgentName } from "./fub.js";
import { buildSlackPayload, postToSlack } from "./slack.js";

// Cloudflare Worker entry point
export default {
  // HTTP handler — manual trigger via GET /run for testing
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      await runReport(env);
      return new Response("Report sent.", { status: 200 });
    }
    return new Response("FUB Daily Report Worker", { status: 200 });
  },

  // Cron trigger — wrangler.toml schedules Mon-Fri 8:30am PT (= 16:30 UTC in winter, 15:30 in summer)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReport(env));
  },
};

async function runReport(env) {
  const { FUB_API_KEY, SLACK_WEBHOOK_URL } = env;

  if (!FUB_API_KEY || !SLACK_WEBHOOK_URL) {
    throw new Error("Missing FUB_API_KEY or SLACK_WEBHOOK_URL in Worker env");
  }

  const agentCache = new Map();

  // Fetch both sections in parallel
  const [rawNewBiz, rawMoney] = await Promise.all([
    getPeopleByStages(STAGES.NEW_BUSINESS, REPORT_WINDOW_DAYS, FUB_API_KEY),
    getPeopleByStages(STAGES.MONEY_LIST, REPORT_WINDOW_DAYS, FUB_API_KEY),
  ]);

  // Enrich each lead with last outbound date (sequential to avoid rate-limit bursts)
  const enrich = async (lead) => {
    const lastOutbound = await getLastOutbound(lead.id, FUB_API_KEY);
    if (lead.assignedUserId) {
      lead.assignedTo = await resolveAgentName(
        lead.assignedUserId,
        FUB_API_KEY,
        agentCache
      );
    }
    return { lead, lastOutbound };
  };

  const newBusiness = await Promise.all(rawNewBiz.map(enrich));
  const moneyList = await Promise.all(rawMoney.map(enrich));

  const payload = buildSlackPayload(newBusiness, moneyList, STALE_DAYS);
  await postToSlack(SLACK_WEBHOOK_URL, payload);

  console.log(
    `Report posted: ${newBusiness.length} New Business, ${moneyList.length} Money List`
  );
}
