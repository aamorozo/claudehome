# fub-daily-report — Deploy Guide

## Prerequisites
- Cloudflare account with Workers enabled
- `wrangler` CLI installed: `npm i -g wrangler`
- Follow Up Boss API key
- Slack incoming webhook URL for #fub-dashboard

## Secrets (set once, never committed)

```bash
wrangler secret put FUB_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put ARRAN_USER_ID
wrangler secret put KERI_USER_ID
```

Get FUB user IDs from: FUB Settings → Team → click user → grab ID from URL.

## Deploy

```bash
cd automation/fub/fub-daily-report
wrangler deploy
```

## Test (manual trigger)

```bash
# Hits the /run route — fires the full report immediately
curl https://fub-daily-report.<your-subdomain>.workers.dev/run
```

## Cron Schedule

`30 16 * * 1-5` = 16:30 UTC = 8:30am PDT (summer).
Change to `30 15 * * 1-5` November–March for PST.

## Stage Groups Covered

**New Business**
- New, Attempting Contact, Contact Made, Working

**Money List** (Smart List stages)
- Hot Lead-Responded, Application, Appointments, No Show Appt,
  Application-Lending Pad, Pending Submission, Referrals To Convert

## Stale Lead Flag
Leads with no outbound contact in 5+ days get a 🚨 next to their name.
Leads are filtered to those updated within the last 10 days.
