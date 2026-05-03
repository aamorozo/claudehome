# fub-daily-report — Deploy Runbook

## First-time setup

```bash
cd automation/fub/fub-daily-report
npm install
npx wrangler login
```

## Set secrets

```bash
npx wrangler secret put FUB_API_KEY
# paste your FUB API key when prompted

npx wrangler secret put SLACK_WEBHOOK_URL
# paste the #fub-dashboard incoming webhook URL

# Optional — for future assignedUserId filtering:
npx wrangler secret put ARRAN_USER_ID
npx wrangler secret put KERI_USER_ID
```

## Deploy

```bash
npm run deploy
```

## Test manually (local)

```bash
npm run dev
# In another terminal:
npm run trigger
```

## Test in production

```bash
npm run trigger:prod
# Replace <YOUR_SUBDOMAIN> with your Cloudflare Workers subdomain first
```

## Cron schedule

`30 15 * * 1-5` = Mon-Fri 8:30am PDT (UTC-7)

Update to `30 16 * * 1-5` each November (PST, UTC-8) and back each March.

## What gets posted

One Slack message to #fub-dashboard with:
- 🔵 NEW BUSINESS section — leads in "New Business" stage
- 💰 MONEY LIST section — leads in "Money List" stage
- Filtered to leads updated within last 10 days
- 🚨 flag = no outbound call/text/email in 5+ days
- ✅ flag = contacted within 5 days
- Footer summary: total leads, stale count, on-track count

## Stage mappings reference

See `../stage-mappings.json` for all Smart List → Stage mappings.
