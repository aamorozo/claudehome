# fub-daily-report — Setup Guide

Cloudflare Worker. Posts FUB hit-list to #fub-dashboard at 8:30am Pacific Mon-Fri.

## Prerequisites

- Cloudflare account with Workers enabled
- FUB API key (Settings > API in Follow Up Boss)
- Slack Bot token with `chat:write` scope, installed to workspace
- Wrangler CLI: `npm i -g wrangler && wrangler login`

## Deploy

```bash
cd automation/fub-daily-report
npm install

# Set secrets (never stored in wrangler.toml)
wrangler secret put FUB_API_KEY
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put ARRAN_USER_ID     # FUB numeric user ID for Arran
wrangler secret put KERI_USER_ID      # FUB numeric user ID for Keri

wrangler deploy
```

## Get FUB User IDs

```bash
curl -u "YOUR_API_KEY:x" https://api.followupboss.com/v1/users | jq '.users[] | {id, name}'
```

## Cron Schedule

| Season | Cron (UTC) | Pacific time |
|--------|-----------|--------------|
| PDT (Mar–Nov) | `30 15 * * 1-5` | 8:30am PDT |
| PST (Nov–Mar) | `30 16 * * 1-5` | 8:30am PST |

Update `wrangler.toml` when clocks change.

## Manual Trigger

```bash
wrangler dev   # then curl http://localhost:8787
```

Or hit the deployed Worker URL with a GET request.

## Slack Bot Setup

1. Create app at api.slack.com/apps
2. Add OAuth scope: `chat:write`
3. Install to workspace
4. Invite bot to `#fub-dashboard`: `/invite @fub-daily-report`
5. Copy Bot User OAuth Token → `SLACK_BOT_TOKEN` secret

## Stage Config

Edit `src/stages.js` to adjust pipeline stages. The worker imports from this
file — `src/index.js` uses its own inline copy for portability; keep both in sync.

## 🚨 Stale Flag Logic

Leads with no outbound contact in >5 days are flagged with 🚨 and sorted to
the top of their section. "No outbound ever" always triggers the flag.
