# fub-daily-report

Cloudflare Worker — posts a FUB hit-list to `#fub-dashboard` Mon-Fri at 8:30am Pacific.

## What it posts

Two sections, leads updated within the last 10 days only:

- **New Business** — New, Attempted Contact, New Business, Referrals To Convert
- **Money List** — Hot Lead-Responded, Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission

Each lead line shows: name, stage, phone/email, assignee (Arran/Keri), days since update, days since last outbound.

🚨 = no outbound Call/Text/Email in 5+ days.

## Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Set secrets

```bash
wrangler secret put FUB_API_KEY
# Paste your FUB API key when prompted (plain key — no base64 encoding needed)

wrangler secret put SLACK_WEBHOOK_URL
# Paste the Incoming Webhook URL for #fub-dashboard
```

### 3. Set user IDs (optional but recommended)

In `wrangler.toml`, fill in:
- `ARRAN_USER_ID` — find in FUB Admin → Team → Arran's profile URL
- `KERI_USER_ID`  — same for Keri

### 4. Deploy

```bash
wrangler deploy
```

### 5. Adjust cron seasonally

Cloudflare cron is UTC. Edit `wrangler.toml` and redeploy when clocks change:
- **PDT (Mar-Nov):** `30 15 * * 1-5` (8:30am Pacific = 15:30 UTC)
- **PST (Nov-Mar):** `30 16 * * 1-5` (8:30am Pacific = 16:30 UTC)

## Manual trigger

```bash
curl -X POST https://fub-daily-report.<your-subdomain>.workers.dev/run
```

Or from Cloudflare dashboard: Workers → fub-daily-report → Triggers → Test.

## Stage configuration

Edit `STAGES` in `src/index.js` to add/remove pipeline stages from each section. Stage names must exactly match what's in FUB (case-sensitive).
