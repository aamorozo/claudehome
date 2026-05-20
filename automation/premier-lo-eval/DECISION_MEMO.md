# Premier LO — Buy vs. Build Decision Memo

**Date:** 2026-05-20
**Author:** Arran Amorozo (drafted in Claude Code session)
**Status:** Revised — pivoted from "Premier LO replacement" to "FUB
  automation layer." Build is the recommended path. Awaiting Sequences-
  page capture to finalize build estimate.
**Belongs in Claude.ai Project:** 04 — Skills & Automation

---

## Bottom line up front

**BUILD.** This isn't a Premier-LO-replacement project — it's the **FUB
automation layer that doesn't exist today.** Premier LO is a Bonzo-
attached workaround for FUB's missing SMS/drip automation. Building the
right tool replaces *both* Premier LO and the Bonzo-as-SMS-engine
dependency in one pass.

Three findings drove the pivot:

1. **Premier LO won't let you control your own rate sheet.** Loan Rates
   tab says "Rate preference managed by administrator." For a *quote*
   tool, the rate sheet is the central product. Customization is
   structurally off the table.
2. **You're currently on free trial, and the integration is broken
   anyway** — Bonzo API key shows "invalid or expired." Zero
   opportunity cost to switching paths.
3. **The actual problem you're solving** isn't Premier LO's limits —
   it's that FUB has no native SMS automation, which is the only reason
   Bonzo is still in your stack. The build solves that *and* gives you
   Premier LO functionality as a subset.

### Conditional cancellation logic (Premier LO trial)

| Trial state | Action |
|---|---|
| Trial hasn't started yet | Don't trigger it. Build in parallel. |
| Trial mid-month | Use what's left of the month for last-look UI capture (Sequences, Broadcast Messages, Bonzo Sync), then let it lapse. |
| Trial converts to paid before build ships | Re-evaluate based on actual price at conversion. If ≤ $30/mo and build still 3+ weeks out, OK to keep as cheap fallback. |

### Revised target architecture

```
Lead in (Zillow / Bonzo / website / referral)
        ↓
   FUB (system of record)
        ↓ webhook (peopleCreated)
   WCL Automation (the build)
        ├─ Quote image renderer    (Premier LO equivalent)
        ├─ AI email drafter        (Premier LO equivalent)
        ├─ AI SMS drafter          (NEW — FUB doesn't have this)
        ├─ Sequence engine         (NEW — FUB doesn't have this)
        ├─ Send-window scheduler   (8AM–8PM lead-local)
        ├─ Auto-pause on reply
        └─ Logs back to FUB timeline (POST /emails, /textMessages, /notes)
```

Bonzo color campaigns (Maroon/Brown/Emerald/Black/Blue/LT/LP/TOPAZ)
become sequences in the new tool, keyed off FUB tags or `source`.
Bonzo gets sunset once parity is reached.

---

## What Premier LO actually does (feature inventory)

Confirmed from screenshots Arran shared 2026-05-20. Full UI catalog in
`UI_CAPTURE.md`; verbatim copy in `TEMPLATES.md`.

### Core workflow
1. New lead enters Bonzo (or FUB, in your build) → CRM fires webhook to Premier LO
2. Premier LO fetches lead details back via CRM API
3. Picks rate tier from a stored rate sheet (credit / loan type / military)
4. Renders branded quote image (headshot, NMLS, rates, CTAs)
5. AI drafts email + SMS using user template
6. Conformance-check pass, regenerate once if it fails
7. Sends within 8 AM–8 PM lead-local time
8. Logs to CRM timeline
9. Runs follow-up drip until lead replies
10. Auto-pauses on reply (CRM-driven)

### Settings surface
- CRM event hook + shared secret
- CRM API key (with live validation)
- Toggle: send email via CRM vs. Gmail
- Toggle: automated email sequences
- Toggle: automated SMS sequences
- Toggle: auto-pause on reply
- Toggle: auto-send to new leads (email + SMS independent)
- Configurable send delay
- AI conformance retry (on/off)
- Default timezone fallback (ET/CT/MT/AZ/PT/AKT/HT)
- Quote image merge fields config
- Free trial auto-starts on first imported lead, runs to end of month

### Rate sheet
- Conventional (Better Rates / Worse Rates tiers, each multi-row)
- FHA (multi-row)
- VA (multi-row)
- Home Equity: HELOC, HELOAN-20, HELOAN-30
- Purchase Rates (3 options)
- Purchase FHA (3 options, used when credit < 630)
- Purchase VA (3 options, used for military)
- "Update to Global Rates" sync button

### Templates
- Email signature editor + "Import from Bonzo" button
- Email template with Subject + Refinance/Purchase variants
- Merge fields: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`,
  `{{company_name}}`, `{{loan_type}}`, `{{agent_name}}`

### History page
- Lead table, separate Email/SMS tabs
- Actions menu, refresh, filters, search, pagination
- (Support article you sent describes filter/manage UX — couldn't fetch,
  Cloudflare-walled. Need to capture by hand or have me browse via
  authenticated tool.)

---

## Buy-vs-build per feature

Effort estimates assume you're driving Claude Code, not coding from scratch.
"Hours" = your sit-at-desk time, not LLM token time.

| Feature | Build hours | Notes / customization upside |
|---|---|---|
| Google OAuth + user model | 3 | Boilerplate. shadcn + NextAuth. |
| FUB API key storage (encrypted) | 2 | libsodium sealed box. |
| FUB webhook receiver + HMAC verify | 4 | One subtle spot: FUB sends thin payloads, you re-fetch. |
| Bonzo webhook receiver (parallel) | 3 | You already have the secret + URL shape. |
| Lead persistence + dedupe | 6 | Single CRM (FUB) primary, optional Bonzo dual-write during migration. |
| Rate sheet CRUD UI | 5 | **Customization upside: you control this, not an admin** (Premier LO blocker). Add DSCR / non-QM / jumbo tiers their schema doesn't model. |
| Quote image renderer | 6 | `@vercel/og` or Puppeteer. **Customization upside: WCL navy/gold brand per Rule 9, not Premier LO's blue template.** |
| Email template editor + variants | 4 | Tiptap or plain textarea + preview. Seed with Premier LO's existing good copy (preserved in TEMPLATES.md). |
| SMS template editor | 1 | Plain text. |
| Scheduler + 8AM–8PM lead-local window | 6 | Luxon for tz, BullMQ for delays. |
| Sequence engine (multi-step drip) | 12 | **The non-trivial piece + per-color-campaign config.** Bonzo color campaigns map 1:1 to FUB tag/source → sequence. |
| Sequences page UI (sequence builder) | 10 | NEW vs. original estimate — Premier LO has a dedicated section we hadn't accounted for. |
| Broadcast Messages (mass send) | 8 | NEW vs. original estimate — Premier LO sidebar item, not in prior chat walkthrough. |
| Auto-pause on reply (Twilio inbound + FUB webhooks) | 5 | Two input channels. |
| AI drafter (Claude API) | 4 | Anthropic SDK. **Customization upside: WCL voice, no em dashes per Rule 9.** |
| AI conformance retry layer | 4 | Second LLM call w/ rubric. Steal Premier LO's "parroting / wrong qualifying step" guardrails verbatim. |
| Gmail send (OAuth per user) | 6 | Or send via FUB `/emails` to skip Gmail OAuth (4 hrs saved). |
| Twilio SMS send + logging back to FUB | 5 | Logs to FUB via `POST /textMessages`. |
| Lead history dashboard | 8 | Table, filters, search, pagination — replicate Premier LO's filter set + status badges. |
| Stats page (conversion, reply rate) | 6 | Charts. Defer to v2. |
| Trial / billing logic | 0 | Skip — single-tenant for you. |
| Deploy + ops (Vercel + Neon + Upstash Redis) | 4 | One-time. |
| **TOTAL** | **~125 hrs** | **~16 focused work days, or 10–13 weeks at 10 hrs/wk** |

Estimate revised up from 96 → 125 hrs after screenshot capture revealed
Sequences-page UI + Broadcast Messages as dedicated sections.
**Sequences page details still unknown** — estimate could move ±10 hrs
once that section is captured.

Cost to run: **~$50/mo** infra (Neon $19, Upstash $10, Vercel hobby $0,
Anthropic $20 at low volume) + your time.

---

## What you gain by building

Sorted by what I think matters most given your CLAUDE.md + the new
screenshot findings:

1. **You own your rate sheet.** Premier LO won't let you edit it (admin-
   controlled). For a quote tool, that's the central product. You can't
   buy your way past this.
2. **FUB becomes a complete system.** Today FUB lacks SMS automation,
   which is the only reason Bonzo is still in your stack. The build
   adds that layer → Bonzo can be sunset → real $/mo saved.
3. **Your color-campaign system survives the migration.** Your 9 active
   Bonzo campaigns (Maroon/Brown/Emerald/Black/Blue/LT/LP/TOPAZ) map 1:1
   to sequences in the new tool, keyed off FUB tags or source.
4. **DSCR / non-QM / jumbo rate logic.** Premier LO's rate model is
   Conv / FHA / VA / HELOC / Purchase only. Your investor-loan business
   needs DSCR tiers, prepay-penalty variants, entity-vs-personal logic.
5. **Brand control.** Navy 1F3864 / mid-blue 2E75B6 / gold C9A84C /
   Arial / NMLS #1491497 footer / no em dashes (Rule 9). Premier LO's
   blue template can't enforce that.
6. **Your AI voice + guardrails.** Premier LO's conformance rubric
   ("parroting / wrong qualifying step") is decent — steal it verbatim
   and add your own ("no em dashes", "WCL voice", "specific CTAs").
7. **Your headshot works without a support ticket.** Premier LO requires
   contacting their Help Desk to update the quote-image headshot. Yours
   = an Upload button.
8. **Data ownership.** Every lead / message / quote / reply lives in
   your Postgres. Future you can build analytics, train models, export
   freely.

## What you give up by building

1. **10–13 weeks before you send the first auto-quote** (revised from
   8–10 wks after Sequences/Broadcast added to scope). Mitigation: ship
   an MVP at week 4–5 covering email-only quoting against FUB, add SMS +
   sequences in subsequent sprints.
2. **Maintenance burden.** FUB API changes occasionally; Twilio rarely.
   ~1–2 hrs/mo ongoing.
3. **You become the on-call.** If the scheduler crashes Friday 5 PM
   and a Maroon lead doesn't get their quote, that's on you. Mitigation:
   Sentry + uptime monitor + a daily digest email confirming N quotes
   sent and 0 errors.
4. **No more "blame the vendor."** Today if Premier LO breaks (and it's
   currently broken), you have someone to email. Self-hosted = you fix
   it. Mitigation: this is also your *upside* — Premier LO breaking
   today is exactly why this matters.

---

## Risks specific to staying on Premier LO

1. **Admin-controlled rates.** Confirmed in screenshots. You can't
   customize the central product.
2. **Vendor concentration.** Cloudflare-walls their site to indexers,
   no public pricing, no G2/Capterra reviews, no public team page.
   Help-articles author is "Premier LO" (no individuals). Small shop —
   possibly one or two people. Single point of failure for your lead-
   response funnel.
3. **Bonzo-only integration.** No FUB. You're trying to consolidate
   *on* FUB.
4. **Currently broken.** Bonzo API key shows "invalid or expired" right
   now — confirms the small-shop maintenance risk.
5. **Half the sidebar is undocumented.** No help articles on Sequences
   page, Broadcast Messages, Bonzo Sync, or Manager Dashboard —
   suggests WIP product.
6. **Trial auto-starts on first imported lead** and runs only through
   end of calendar month. Translation: you can't evaluate at your own
   pace.
7. **Their AI prompts are theirs.** No tuning, no observability, no
   logs you can audit.
8. **Headshot requires support ticket.** Small but real friction.

---

## Decision matrix (still useful if trial converts)

Since you're in free trial, this only matters when (and if) the trial
converts. Numbers revised down from prior version after the
admin-controlled-rates finding.

| Premier LO price at conversion | Recommendation | Why |
|---|---|---|
| $0 (still trial / grandfathered) | Use what's left of trial for last-look UI capture, then build | Trial runs through end of current calendar month — burn the window for research, don't commit. |
| ≤ $30/mo | Allowed as cheap fallback only if build is still 3+ weeks out | Below this threshold, the monthly burn < 1 hr of your time. |
| $30–$99/mo | Don't subscribe. Build. | Even at the low end, you're paying for admin-controlled rates you can't change. |
| $100+/mo | Don't subscribe. Build. | ROI on build < 12 months even before factoring Bonzo sunset savings. |

---

## Open questions to fully close the memo

1. **Monthly lead volume into FUB** (and into Bonzo, today). Determines
   the cost of a 10–13-wk build window in lost revenue.
2. **FUB plan tier** — confirm yours supports `peopleCreated` webhooks
   (Pro+ on most pricing pages).
3. **Send channel preference:**
   - Email: Gmail OAuth (6 hrs + better deliverability) vs. FUB's
     `/emails` log-and-send (simpler).
   - SMS: Twilio (5 hrs + you own the number) vs. FUB native texting
     (simpler, logs to FUB timeline natively).
4. **MVP scope** — do you want quote-by-email-only at week 4–5 with SMS
   and sequences following, or hold the launch until full parity?
5. **Sequences page capture** — biggest unknown still. Run the
   Claude-in-Chrome script before the trial ends.

---

## Recommended next steps

1. **(You) Run Claude-in-Chrome capture script** in the plan file at
   `/root/.claude/plans/radiant-weaving-journal.md`. Paste the structured
   output back here when done. Specifically need: Sequences, Broadcast
   Messages, Bonzo Sync, History UI in action, lead detail view, Purchase
   email variant body.
2. **(You) Decide whether to fix the Bonzo API key in Premier LO** —
   pros: trial actually evaluates something real; cons: triggers the
   trial clock if not started yet.
3. **(Me, next session) Generate full sequence inventory from FUB **
   tags + Bonzo campaign data so we know how many sequences the new
   tool needs from day one.
4. **(Me, next session) Stand up empty FUB-automation-layer scaffold**
   (~6 hrs): Next.js + Fastify + Prisma + BullMQ, FUB webhook receiver
   that just logs to Postgres, encrypted FUB API key storage. Gives you
   a real data point on build velocity before committing the full ~125
   hrs.
5. **(Me, ongoing) Finalize FIELD_MAP.md** once you can paste one
   sample Bonzo prospect JSON + one sample FUB person JSON.

---

## Companion artifacts

- `UI_CAPTURE.md` — full Premier LO UI catalog, screen-by-screen, with
  capture status per section.
- `TEMPLATES.md` — verbatim Premier LO email subject + body + signature
  + merge fields. Use as the rebuild's starting copy.
- `FIELD_MAP.md` — Bonzo ↔ Premier LO ↔ FUB field mapping, also the
  spec for the new tool's lead model.

---

## Artifact

**Artifact:** DECISION_MEMO.md (+ UI_CAPTURE.md + TEMPLATES.md + FIELD_MAP.md)
**Location:** /home/user/claudehome/automation/premier-lo-eval/
**Belongs in Claude.ai Project:** 04 — Skills & Automation
