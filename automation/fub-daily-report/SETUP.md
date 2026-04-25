# fub-daily-report — Setup

Cloudflare Worker. Posts a sectioned FUB lead hit-list to Slack #fub-dashboard at 8:30am Pacific, Mon-Fri.

## Requirements
- Node 18+ / npm
- Cloudflare account with Workers enabled
- FUB API key (FUB Settings > Admin > API)
- Slack incoming webhook for #fub-dashboard

## Deploy

```bash
npm install
wrangler secret put FUB_API_KEY       # paste FUB API key
wrangler secret put SLACK_WEBHOOK_URL # paste Slack webhook URL
wrangler secret put FUB_USER_IDS      # e.g. 12345,67890 (Arran,Keri userIds)
wrangler deploy
```

## Find FUB User IDs

```bash
curl -u "YOUR_API_KEY:" https://api.followupboss.com/v1/users | jq '.users[] | {id, name}'
```

## Test Locally

```bash
npm run dev       # starts local worker on :8787
npm run test      # hits /run endpoint to trigger report manually
```

## Cron Schedule

| Trigger     | UTC   | Pacific      |
|-------------|-------|--------------|
| PST (winter)| 16:30 | 8:30am PST   |
| PDT (summer)| 15:30 | 8:30am PDT   |

Both crons run; Cloudflare will execute whichever fires Mon-Fri.

## Report Logic

- **Sections:** New Business, Money List
- **Filter:** Assigned to Arran or Keri, updated within last 10 days
- **Stale flag (🚨):** Lead not contacted outbound in >5 days

## Stage Mappings (Smart List reference)

| Smart List     | FUB Stage(s)                                                                 |
|----------------|------------------------------------------------------------------------------|
| Hot List       | Hot Lead-Responded                                                           |
| FUB Apps       | Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert |
| New Business   | New, Attempted Contact, Active Buyer, Active Seller, New Business            |
| Money List     | Hot Lead, Hot Lead-Responded, Referral, Past Client                          |

## Updating Stage Lists

Edit `SECTIONS` in `worker.js` to add/remove stages from each report section.
