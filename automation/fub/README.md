# FUB Automation Hub

Central automation stack for Follow Up Boss CRM.

## fub-daily-report (Cloudflare Worker)

Posts a sectioned lead hit-list to Slack `#fub-dashboard` every weekday at 8:30am Pacific.

### Sections reported

| Section | Stages |
|---|---|
| New Business | New |
| Money List | Hot Lead-Responded, Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert |

**Filters:** Assigned leads with `updated` within last 10 days.  
**Flag:** 🚨 on any lead with no outbound contact in >5 days.

### Deploy

```bash
cd fub-daily-report
npm install
wrangler secret put FUB_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
npm run deploy
```

### Test locally

```bash
cp .dev.vars.example .dev.vars   # fill in real values
npm run dev
# In another terminal:
npm run trigger:manual
```

### Smart List → Stage mapping

| Smart List | FUB Stage |
|---|---|
| Hot List | Hot Lead-Responded |
| FUB Apps | Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission |
| Referrals To Convert | Referrals To Convert |

### Phase 2 roadmap

- Slack interactive buttons: "Mark as contacted" writes `lastActivity` back to FUB via FUB API
- Per-assignee DM alerts for stale leads
- Weekly pipeline roll-up (Sundays)
