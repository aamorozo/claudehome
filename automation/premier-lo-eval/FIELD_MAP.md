# Bonzo ↔ Premier LO ↔ FUB Field Mapping

Spec for the FUB-automation-layer build's lead model + the planned
Bonzo↔FUB sync. Skeleton populated from what we've captured so far —
holes marked clearly. Fill the remaining columns when:

- Bonzo column: Pull a sample prospect via Bonzo Public API v3 (we have
  the PowerShell scripts from the campaign export).
- Premier LO column: From the History page lead row + lead detail view
  once those are captured.
- FUB column: From `GET /v1/people/:id` against any real lead in Arran's
  FUB account.

---

## Lead identity fields

| Logical field | Bonzo | Premier LO | FUB | Notes |
|---|---|---|---|---|
| First name | `first_name` | `first_name` | `firstName` | |
| Last name | `last_name` | `last_name` | `lastName` | |
| Full name | computed | `full_name` (merge field) | computed | |
| Email | `email` | (TBD — captured via webhook) | `emails[].value` (primary first) | FUB stores array |
| Phone | `phone` | (TBD) | `phones[].value` (primary first) | FUB stores array |
| External ID | `id` | (UUID in event hook URL) | `id` | |

## Loan / qualification fields

| Logical field | Bonzo | Premier LO | FUB | Notes |
|---|---|---|---|---|
| Loan type | (custom field?) | `loan_type` (merge field, Refinance/Purchase) | tag or custom field | TBD — confirm in Bonzo |
| Property type | TBD | TBD | TBD | |
| Credit score | TBD | implicit — selects FHA tier when <630 | TBD | Premier LO needs this somewhere |
| Military status | TBD | implicit — selects VA tier | TBD | |
| Estimated home value | TBD | TBD | TBD | |
| Current balance | TBD | TBD | TBD | |
| Current rate | TBD | TBD | TBD | |
| State | TBD | derived → timezone | `addresses[].state` | |
| Timezone | derived | derived from state, else Default Timezone setting | derived | |

## Status fields

| Logical field | Bonzo | Premier LO | FUB | Notes |
|---|---|---|---|---|
| Lead status | (pipeline stage) | Active / Non-Active / Responded | `stage` | |
| First seen at | `created_at` | timestamp of event hook fire | `created` | |
| Last replied at | (response detection) | (auto-pause trigger) | `lastActivity` | |
| Source | `source` | (set per campaign) | `source` | |

## Agent / user fields (constants per LO, not per lead)

| Logical field | Premier LO Settings | FUB equivalent | Arran's value |
|---|---|---|---|
| Agent name | `agent_name` | `users[].name` | Arran Amorozo |
| Agent first name | `agent_first_name` | computed | Arran |
| Agent title | `agent_title` | `users[].role` (or custom) | Vice President |
| Agent years | `agent_years` | custom field | 10 |
| Agent phone | `agent_phone_formatted` | `users[].phone` | (949) 401-7593 |
| Agent email | `agent_email` | `users[].email` | aamorozo@westcaplending.com |
| Agent company | `company_name` | tenant-wide | West Capital Lending |
| Agent NMLS | (Quote Image Settings) | custom field | 1491497 |
| Agent website | (Quote Image Settings) | custom field | westcapitallending.com/team/arran-amorozo |
| Agent application link | (Quote Image Settings) | custom field | westcaplending.loanzify.io/register/arran-amorozo |
| Agent calendar link | (Quote Image Settings, empty) | custom field | TBD — fill in |
| Agent headshot URL | (Google profile, admin-managed) | profile image | TBD — broken in Premier LO |

---

## FUB API endpoint reference (relevant subset)

Auth: HTTP Basic with API key as username, blank password.
Base: `https://api.followupboss.com/v1`

| Purpose | Endpoint | Notes |
|---|---|---|
| Get person | `GET /people/:id` | Resolves webhook payload |
| Create person | `POST /people` | Upsert by email/phone |
| List people | `GET /people` | Pagination via `next` |
| Log activity | `POST /events` | Recommended for "new lead" attribution |
| Log SMS | `POST /textMessages` | Records to timeline; sending is external (Twilio) |
| Log email | `POST /emails` or `POST /em` | Records to timeline |
| Add note | `POST /notes` | Quote details onto contact |
| List webhooks | `GET /webhooks` | |
| Register webhook | `POST /webhooks` | Programmatic setup |
| Events to subscribe | `peopleCreated`, `peopleUpdated`, `peopleStageUpdated`, `textMessagesCreated`, `emailsCreated` | Last two enable auto-pause-on-reply |

Signature verification: `FUB-Signature` header = HMAC-SHA1 of raw body
with system key.

Rate limit: ~250 req / 10 sec per account. Returns 429 with `Retry-After`.

---

## Bonzo API endpoint reference (from existing campaign export work)

Auth: Bearer token (per-user, stored encrypted).
Base: `https://app.getbonzo.com/api/v3`

| Purpose | Endpoint | Notes |
|---|---|---|
| Get prospect | `GET /prospects/:id` | |
| List prospects | `GET /prospects` | |
| Create prospect | `POST /prospects` | |
| Update prospect | `PATCH /prospects/:id` | |
| List campaigns | `GET /campaigns` | Already pulled — 21 campaigns inventoried |
| Get campaign | `GET /campaigns/:id` | Structure only — no message content |
| List pipelines | `GET /pipelines` | 4 pipelines pulled |
| Event hooks | (account settings UI only?) | Bonzo→Premier LO uses event hook |

---

## Bonzo↔FUB sync — first-pass mapping

The mapping that the build needs to support so Bonzo can be sunset. This
is the minimum field set to round-trip a lead.

| Direction | Trigger | Action |
|---|---|---|
| Bonzo → FUB | Bonzo event hook fires `prospect.created` | Build receives webhook, calls FUB `POST /people` with mapped fields |
| Bonzo → FUB | Bonzo event hook fires `prospect.updated` | Build receives webhook, calls FUB `PUT /people/:id` |
| FUB → Bonzo | FUB webhook fires `peopleCreated` | Build calls Bonzo `POST /prospects` *(optional, only if dual-write needed during migration)* |
| Bonzo → Build | `prospect.created` | Persist Lead row, schedule quote generation |
| Build → FUB | Outbound email sent | `POST /emails` to log to timeline |
| Build → FUB | Outbound SMS sent | `POST /textMessages` to log to timeline |
| Build → FUB | Lead replied (via Twilio inbound or FUB webhook) | Update Lead.status = 'replied', cancel pending sequence steps, optionally `POST /notes` summarizing |

---

## Open items

- [ ] Sample Bonzo prospect JSON — to verify field names + nested structure
- [ ] Sample FUB person JSON — to verify field names + custom fields
- [ ] What does Premier LO actually store about a lead? (Need lead detail view screenshot)
- [ ] How does Premier LO detect "Responded" status? (Bonzo webhook on response? Email reply parsing? Twilio inbound?)
- [ ] Does Bonzo have a `credit_score` and `military_status` field, or are those Premier LO-only enrichments?
- [ ] FUB action plans vs. our sequence engine — make sure we don't double-send if the user leaves an action plan running
