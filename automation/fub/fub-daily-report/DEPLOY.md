# fub-daily-report — Deploy Guide

Cloudflare Worker. Posts FUB hit-list to Slack #fub-dashboard at 8:30am PT Mon-Fri.

## Sections

| Slack Section | FUB Stages |
|---|---|
| New Business | Hot Lead-Responded, Referrals To Convert |
| Money List | Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission |

Leads must be assigned and updated within the last 10 days to appear.
Stale flag (🚨) fires when no outbound contact in >5 days.

## First-time setup

```bash
cd automation/fub/fub-daily-report
npm install

# Add secrets (never commit these)
npm run secret:fub        # paste FUB API key when prompted
npm run secret:slack      # paste Slack Incoming Webhook URL for #fub-dashboard

npm run deploy
```

## Verify

After deploy, trigger manually:
```
GET https://fub-daily-report.<your-account>.workers.dev/?run=true
```
Then check #fub-dashboard in Slack.

## Smart List → Stage mapping (FUB Admin reference)

| FUB Smart List | Mapped Stages |
|---|---|
| Hot List | Hot Lead-Responded |
| FUB Apps | Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert |

## DST note

Cron is set to `30 15 * * 1-5` (15:30 UTC = 8:30am PDT).
During PST (Nov-Mar) this fires at 7:30am. To fix seasonally:
- PDT (Mar-Nov): `30 15 * * 1-5`
- PST (Nov-Mar): `30 16 * * 1-5`

## Lead routing (assignedUserId logic)

Arran and Keri each have a FUB userId. The worker filters on `assignedTo` (non-null).
To restrict the report to one agent, add `AGENT_USER_ID` env var and filter in `fetchStages()`.

## Secrets required

| Secret | Value |
|---|---|
| `FUB_API_KEY` | FUB Admin > Admin > API > API Key |
| `SLACK_WEBHOOK_URL` | Slack App > Incoming Webhooks > #fub-dashboard |
