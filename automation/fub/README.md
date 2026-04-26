# FUB Daily Report — Cloudflare Worker

Posts a sectioned hit-list to `#fub-dashboard` Monday-Friday at 8:30am Pacific.

## Sections

| Section | Stages Included |
|---|---|
| New Business | New, Attempted Contact, Contacted, Nurture |
| Money List | Hot Lead-Responded, Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert |

- Leads filtered to Arran + Keri only (`assignedUserId`)
- Only leads updated within the last **10 days** appear
- Leads with no outbound contact in **5+ days** are flagged :rotating_light:

## Setup

### 1. Secrets

```bash
wrangler secret put FUB_API_KEY       # FUB Settings > API > copy key
wrangler secret put FUB_SYSTEM_KEY    # optional
wrangler secret put SLACK_BOT_TOKEN   # xoxb-... from Slack App config
```

### 2. Update config.js

Set `ARRAN_USER_ID` and `KERI_USER_ID` to actual FUB user IDs.
Find them in FUB: Admin > Team Members > click user > check URL (`/team/123`).

### 3. Deploy

```bash
npm install -g wrangler
wrangler deploy
```

### 4. Test manually

```bash
wrangler dev          # local
curl http://localhost:8787/run
# or after deploy:
curl https://fub-daily-report.<your-subdomain>.workers.dev/run
```

## Cron schedule

`30 15 * * 1-5` = 3:30pm UTC = 8:30am PDT (UTC-7).
During PST (Nov-Mar), update to `30 16 * * 1-5` for 8:30am PST.

## Phase 2 roadmap

- Slack interactive buttons: "Mark as contacted" writes back to FUB via `/v1/events`
- Webhook receiver for FUB stage change alerts → Slack thread
