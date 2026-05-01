# fub-daily-report

Cloudflare Worker — posts a sectioned FUB hit-list to `#fub-dashboard` every weekday at 8:30am PT.

## Report format

```
📋 FUB Hit-List — Thursday, May 1, 2026
─────────────────────────────────────────
🆕 NEW BUSINESS (8 leads, 2 🚨)
• 🚨 Jane Doe — Keri — no outbound in 7d
• John Smith — Arran — last outbound 1d ago

💰 MONEY LIST (3 leads)
• Bob Johnson — Arran — last outbound 0d ago
─────────────────────────────────────────
🚨 = no outbound in >5d · Updated within 10d · fub-daily-report
```

## Setup

### 1. Install deps
```bash
npm install
```

### 2. Set secrets (production)
```bash
wrangler secret put FUB_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
```
- `FUB_API_KEY` — FUB Admin > API > copy key
- `SLACK_WEBHOOK_URL` — Slack App > Incoming Webhooks > `#fub-dashboard`

### 3. Local dev
```bash
cp .dev.vars.example .dev.vars
# fill in .dev.vars with real values
npm run dev
# Then hit: http://localhost:8787/run
```

### 4. Deploy
```bash
npm run deploy
```

### 5. Cron timing
Default cron `30 15 * * 1-5` = 8:30am PDT (UTC-7, Mar–Nov).
Change to `30 16 * * 1-5` in `wrangler.toml` Nov–Mar for PST (UTC-8).

## Stage name configuration

Default stages in `wrangler.toml [vars]`:
| Var | Default |
|-----|---------|
| `STAGE_NEW_BUSINESS` | `New Business` |
| `STAGE_MONEY_LIST` | `Money List` |

If FUB stage names differ, update `wrangler.toml` or override per-env.

## Smart List to Stage mappings (reference)
| Smart List | FUB Stage(s) |
|------------|-------------|
| Hot List | Hot Lead-Responded |
| FUB Apps | Application, Appointments, No Show Appt, Application-Lending Pad, Pending Submission, Referrals To Convert |

## Phase 2 roadmap
- Interactive Slack buttons ("Mark as contacted") that POST an event back to FUB via `/v1/events`
- Keri vs Arran split sections (filter by `assignedUserId`)
