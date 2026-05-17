# fub-daily-report — Deploy Guide

Cloudflare Worker that posts the FUB hit-list to #fub-dashboard at 8:30am Pacific, Mon–Fri.

## First-time setup

```bash
npm install -g wrangler
wrangler login
```

## Set secrets

```bash
wrangler secret put FUB_API_KEY
# Paste your FUB API key when prompted

wrangler secret put SLACK_WEBHOOK_URL
# Paste the #fub-dashboard incoming webhook URL when prompted
```

## Deploy

```bash
cd automation/fub-daily-report
wrangler deploy
```

## Test manually

After deploy, hit the worker URL:
```
GET https://fub-daily-report.<your-subdomain>.workers.dev/trigger
```

Returns JSON with lead counts per stage and fires the Slack post.

## What it does

- Runs at 8:30am Pacific, Mon–Fri (two cron entries cover PDT + PST)
- Queries FUB for people in **New Business** and **Money List** stages
- Filters to leads updated in the last 10 days
- Checks each lead's event history for last outbound (Call, Email, Text, SMS)
- Flags leads with no outbound in >5 days with 🚨
- Posts a sectioned hit-list to #fub-dashboard with name, phone, assigned agent, and last contact

## Adding/changing stages

Edit `STAGES` array in `worker.js`:
```js
const STAGES = ["New Business", "Money List"];
```

Stage names must match FUB exactly (case-sensitive). Verify with:
```
GET https://api.followupboss.com/v1/stages
```

## Adjusting thresholds

| Constant | Default | Purpose |
|---|---|---|
| `LOOKBACK_DAYS` | 10 | Only show leads updated in this window |
| `STALE_DAYS` | 5 | Days without outbound before 🚨 flag |
