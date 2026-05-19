# fub-daily-report

Cloudflare Worker — posts a sectioned FUB hit-list to Slack `#fub-dashboard` every weekday at 8:30am PT.

## What it does

Pulls leads from Follow Up Boss by stage, filtered to those updated in the last 10 days, and posts two sections to Slack:

- **New Business** — fresh inbound leads needing first contact
- **Money List** — warm pipeline leads in progress

Leads with no FUB activity in the last 5 days are flagged 🚨.

## Setup

### 1. Install deps

```bash
npm install
```

### 2. Set secrets

```bash
npm run secret:fub       # FUB API key (Admin > API in FUB)
npm run secret:slack     # Slack Incoming Webhook URL for #fub-dashboard
npm run secret:trigger   # Optional: shared secret for manual /run endpoint
```

Or directly:
```bash
wrangler secret put FUB_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
```

### 3. Configure stages (optional)

Edit `wrangler.toml` `[vars]` to change stage names, lookback window, or stale threshold:

```toml
STAGES = "New Business,Money List"
LOOKBACK_DAYS = "10"
STALE_DAYS = "5"
```

Stage names must **exactly match** the stage names in your FUB pipeline (case-sensitive).

### 4. Deploy

```bash
npm run deploy
```

### 5. Test manually

```bash
curl https://fub-daily-report.<your-subdomain>.workers.dev/run?secret=YOUR_TRIGGER_SECRET
```

Or trigger from Wrangler:
```bash
wrangler dev  # runs locally; cron won't fire but /run works
```

## Cron schedule

`30 15 * * 1-5` = 8:30am PDT (UTC-7), Mon-Fri.

**DST note:** Cloudflare crons are UTC and don't auto-adjust. From November to March (PST, UTC-8), update to `30 16 * * 1-5` so it fires at 8:30am PST instead of 7:30am.

## Slack message format

```
FUB Daily Hit-List — Monday, May 19

NEW BUSINESS — 4 leads
🚨  John Smith | 555-1234 | Arran | 7d
    Jane Doe | 555-5678 | Keri | 2d

MONEY LIST — 2 leads
🚨  Alice Green | 555-3456 | Keri | 6d
    Tom White | 555-7890 | Arran | 3d

4 total leads | Updated last 10 days | 🚨 = no activity >5 days
```

## Phase 2 roadmap

- Interactive "Mark as contacted" Slack buttons (Block Kit actions) that `POST /v1/events` back to FUB
- Arran/Keri routing summary section showing lead distribution by `assignedUserId`
- Alert if any stage has zero leads (possible data hygiene issue)
