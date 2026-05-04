# FUB Automation — Follow Up Boss Central Hub

## Quick Reference

| Config | Location |
|--------|----------|
| Stage / Smart List mappings | `config/smart-lists.json` |
| Lead routing (Arran / Keri) | `config/routing.json` |
| Daily report worker | `fub-daily-report/` |

---

## fub-daily-report Cloudflare Worker

**What it does:** Posts a sectioned hit-list to `#fub-dashboard` every weekday at 8:30am Pacific.

**Sections:**
- **NEW BUSINESS** — stages: New, Active Prospect, Attempting to Contact, Working, Pre-Qualified
- **MONEY LIST** — stages: Hot Lead-Responded, Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert

**Filters:** Assigned leads updated within last 10 days.

**Stale flag:** 🚨 appended to any lead >5 days since last outbound contact.

### First-time deploy

```bash
cd fub-daily-report
npm install

# Set secrets
wrangler secret put FUB_API_KEY
wrangler secret put SLACK_WEBHOOK_URL

# Look up FUB user IDs for Arran + Keri
curl -u <FUB_API_KEY>: https://api.followupboss.com/v1/users | jq '.users[] | {id, name}'

# Paste IDs into wrangler.toml [vars] ARRAN_USER_ID and KERI_USER_ID
# Then deploy
wrangler deploy

# Tail logs
wrangler tail
```

### Manual trigger (testing)

```bash
curl https://fub-daily-report.<your-subdomain>.workers.dev/trigger
```

### Cron schedule

`30 15 * * 1-5` = 8:30am PDT. During PST (Nov-Mar) this fires at 7:30am Pacific.
To hold 8:30am year-round, update cron to `30 16 * * 1-5` in winter.

---

## Smart List → Stage Mappings

| Smart List | Stages |
|------------|--------|
| Hot List | Hot Lead-Responded |
| FUB Apps | Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert |
| New Business | New, Active Prospect, Attempting to Contact, Working, Pre-Qualified |

---

## Phase 2 Roadmap

- Interactive Slack buttons ("Mark as contacted") writing back to FUB via `/notes` API
- Webhook receiver for inbound FUB events → Slack alerts
- Stale lead escalation: auto-reassign or notify after N days no activity
