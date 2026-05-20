# Premier LO — UI Capture Log

Cataloging every Premier LO screen Arran has shared. Updated as new
sections come in. Screenshots referenced live in `./screenshots/` (drop
the PNGs there as you save them locally).

---

## App shell

**Sidebar (left, dark navy)** — order top to bottom:

1. History
2. Sequences
3. Broadcast Messages
4. Bonzo Sync
5. Settings
6. My Stats
7. Manager Dashboard
8. Support
9. Logout

**Header card (top of sidebar):** "Welcome back, Arran Amorozo" with
person-icon avatar.

**Brand mark:** "Premier LO" wordmark with a lightning-bolt icon (cyan
on dark navy).

---

## Help Articles (public-ish, behind Cloudflare to bots)

Found 3 article categories totalling 12 articles:

### Quote Generation & Sending

- Setting Up Your Bonzo API Key — *"Learn how to connect your Bonzo CRM
  account to Premier LO by configuring your API key, enabling email and
  SMS integration, and setting up webhooks."*
- Quote Image Not Showing in Emails — *"What to do when the quote image
  isn't appearing in your emails, including how to check your email body
  template and troubleshoot rendering issues."*
- Setting Up Auto-Send for Faster Quoting — *"How to enable and
  configure auto-send so quotes are automatically emailed to leads as
  soon as they come in from Bonzo, saving you time on every lead."*
- Regenerating a Quote with Updated Rates — *"How to regenerate a quote
  for an existing lead when rates have changed, so you can resend with
  the latest pricing without re-entering lead information."*

### Email Sequences

- Setting up Sequences — *"Learn how to set up automated email and SMS
  sequences so leads are automatically enrolled when you send a quote."*
- Why My Sequence Emails Aren't Sending — *"Troubleshoot why your
  automated email sequence follow-ups aren't going out, including
  settings checks, send window configuration, and Gmail connection issues."*
- Understanding Merge Fields in Emails — *"A reference guide to all
  available merge fields for email templates and sequences, and how to
  use them to personalize your outreach at scale."*
- SMS Sequence Troubleshooting — *"How to fix common SMS sequence issues
  including messages not sending, business hours configuration, and
  Bonzo connection problems."*

### Settings & Configuration

- How to Import Leads from Bonzo — *"Learn how to connect your Bonzo CRM
  and import leads into Premier LO using the eventhook (automatic) or
  manual sync."*
- Fixing "Gmail Not Configured" Errors — *"How to reconnect your Gmail
  account when Premier LO shows a 'Gmail not configured' error, and how
  to prevent it from happening again."*
- Filtering and Managing Leads in History — *(captured below)*
- Customizing Your Email Signature — *"How to set up and customize your
  email signature in Premier LO, including importing from Bonzo, editing
  with the rich text editor, and troubleshooting formatting issues."*

Notable gap: **no articles** on Sequences page UI itself, Broadcast
Messages, Bonzo Sync, or Manager Dashboard. Either WIP features or
under-documented.

---

## History page

Doc: *"Filtering and Managing Leads in History"* — updated 2026-04-03,
tagged "Settings & Configuration".

### Overview
*"The History page is your command center for every lead you've quoted.
As your lead volume grows, knowing how to filter and manage leads
efficiently becomes critical to staying on top of your pipeline."*

### Finding Leads
- **Search bar** (top of page) — by borrower name, email, or phone.
- **Filters** (each shows a count badge):
  - **Status:** Active / Non-Active / Responded
  - **Timezone:** Eastern / Central / Mountain / Pacific *(fewer
    options than Settings dropdown — no AZ/AKT/HT here)*
  - **Lead Type:** Purchase / Refinance
  - **Campaign:** Filter by Bonzo campaign *(only appears when
    campaigns are set up)*

### Sequence status indicators
*"Leads with active email or SMS sequences show **sequence progress
dots** directly on their card in the History list..."* (rest cut off
in screenshot — capture remainder).

### NOT YET CAPTURED
- The actual History UI in action (we have the docs, not the screen)
- Lead row layout — columns, badges, dots
- Per-lead Actions menu (referenced as "Actions menu" in prior chat)
- Tabs: Email Leads / SMS Leads

---

## Settings → Settings sub-tab

### Bonzo Event Hook section
- **Event Hook URL:** `https://api.premierlo.com/eventhooks/bonzo/prospects/8b64a353-8c3d-4b90-8c02-739ac9de17ff`
- **x-bonzo-code field:** `....1fe5` (masked, last 4 shown)
- Setup instructions (numbered 1–8): copy URL → Bonzo → Account Settings → Event Hooks → Add hook → All options → copy x-bonzo-code → paste → Save Changes.

### Bonzo Settings section
- **⚠ Status banner: "API key is invalid or expired"** (red)
- **Bonzo API Key field:** `....WmBM` (masked, expired)
- **Send Emails Through Bonzo CRM** — toggle: ON (currently enabled).
  *"When enabled, all emails will be sent through Bonzo and appear in
  your prospect timeline. Requires Bonzo API key."*

### Automation toggles
- **Automated Email Sequences** — ON. *"When enabled, your default
  email sequence will automatically send follow-ups when leads don't
  respond to your quotes."*
- **Automated SMS Sequences** — ON. *"When enabled, your default SMS
  sequence will automatically send follow-ups when leads don't respond
  to your quote texts."*
- **Auto-Pause on Lead Reply** — OFF (unchecked). *"When enabled, email
  and SMS sequences will automatically pause when Bonzo detects a lead
  has responded. Sequences will automatically resume when a lead
  transitions from responded back to active."*
- **Auto-Send Quotes to New Leads** (boxed group):
  - Automatically send quote emails to new leads — OFF
  - Automatically send text messages to new leads — OFF
  - *"When enabled, new leads from Bonzo will automatically receive a
    quote email and/or text after the set delay. Messages are only sent
    between 8AM and 8PM in the lead's local time zone, and the system
    first verifies that the lead hasn't already responded before
    sending. If a lead comes in outside of these hours, the auto-send
    will resume at 8AM and send in accordance with the specified
    delay. SMS uses your default SMS template."*

### AI Conformance Retry section (boxed)
- **Auto-retry AI drafts that fail conformance checks** — ON.
  *"When the AI's draft response trips a quality guardrail (e.g.,
  parroting a value the lead just gave, asking the wrong qualification
  step), automatically ask the AI to regenerate the draft with
  corrective feedback. Each retry costs roughly one extra AI call on
  flagged drafts only. Disable this to A/B test whether the prompts
  alone produce good drafts."*

### Default Timezone
- Dropdown — currently set to **Pacific Time (PT)**. Options per prior
  chat: ET / CT / MT / AZ / PT / AKT / HT.
- *"Used for scheduling sequence emails when lead's timezone cannot be
  determined from their state. Emails will be sent at sequence step
  selected time."*

### Quote Image Settings (boxed)
- *"These settings are for merge fields used in your default email
  template."*
- **Headshot Display:**
  - Show headshot in text messages — OFF
  - *"Uses your Google profile picture from your account login. Please
    reach out to the Help Desk so they can add your headshot in your
    Google Marketing Profile Picture."* ← yellow warning text
  - Preview: green "A" (broken — using Google initials)
- **NMLS:** 1491497
- **Application Link:** https://westcaplending.loanzify.io/register/arran-amorozo
- **Figure Application Link:** https://heloc.westcapitallending.com/account/heloc/register?referrer=241cbddd-8894-4d6c-8417-b88ee5e9f5db
- **Calendar Link:** *(empty)*
- **Title:** Vice President
- **Name:** Arran Amorozo
- **Website:** https://westcapitallending.com/team/arran-amorozo
- **Years:** 10
- **Phone Number:** (949) 401-7593

### Free Trial section (boxed, clock icon)
*"Your free trial will start automatically when you import your first
lead. The trial runs through the end of that calendar month."*
[Learn more about the free trial] link.

### NOT YET CAPTURED on this tab
- Save Changes button location
- Delete Account button (mentioned in prior chat, not visible in screenshots)

---

## Settings → Loan Rates sub-tab

Visible sections in screenshot:

### Purchase Rates
- "Points are used in loan cost calculations but not shown on the quote"
- Option 1: 6.375 / 0.1
- Option 2: 5.99 / 1.4
- Option 3: 5.875 / 2.1

### Purchase FHA Rates
- "Used for purchase leads with credit score below 630"
- Option 1: 5.875 / 0.1
- Option 2: 5.625 / 1.2
- Option 3: 5.49 / 1.8

### Purchase VA Rates
- "Used for purchase leads with military status"
- Option 1: 5.875 / 0.202
- Option 2: 5.625 / 1.4
- Option 3: 5.492 / 2.3

### Footer
- **[Update My Rates to Global Rates]** — green button
- **"Rate preference managed by administrator"** — grayed-out indicator

### NOT YET CAPTURED
- Conventional rates (Better Rates / Worse Rates tiers)
- FHA (non-purchase)
- VA (non-purchase)
- HELOC / HELOAN20 / HELOAN30

---

## Settings → Email Signature sub-tab

- **[Import from Bonzo]** button at top — blue.
  *"Import your email signature directly from your Bonzo CRM account."*
- Rich text editor (CKEditor-style):
  - Source / Undo / Redo / Choose heading / A↑ size / A↓ size / Color / Highlight / B I U S / Align / Bullet / Number / Link / Image upload / Table / Quote / [calculator icon] / [clear formatting]
  - **Emoji** button (orange)
  - **Insert Merge Field** button (purple)
- Tip banner: *"For best results when pasting emails with images, copy
  from **Outlook desktop** or **Apple Mail** instead of Gmail web.
  Alternatively, download images and use the upload button (↑) above."*
- Buttons: Preview / Send Test Email / Save Signature

Current signature contents captured in `TEMPLATES.md`.

---

## Settings → Email sub-tab

- **Subject Line:** `{{first_name}} {{last_name}} - West Capital Lending Rate Options`
- *"Available merge fields: `{{first_name}}`, `{{last_name}}`,
  `{{full_name}}`, `{{company_name}}`, `{{loan_type}}`, `{{agent_name}}`.
  Leave blank to use the default."*
- **Variant tabs:** Refinance (active) / Purchase
- Same rich-text editor + Emoji + Insert Merge Field
- Buttons: Preview Email / Send Test Email / Save Email Body

Refinance body captured in `TEMPLATES.md`. Purchase body NOT YET captured.

---

## Sections NOT YET captured (capture priority)

| Section | Priority | Why |
|---|---|---|
| Sequences | HIGH | Biggest rebuild unknown — exact step-by-step copy, channels, delays |
| Broadcast Messages | MEDIUM | Mass-send feature not in prior estimate |
| Bonzo Sync | MEDIUM | Confirms inbound vs. bidirectional sync behavior |
| My Stats | LOW | Charts only |
| Manager Dashboard | LOW | Team feature — out of scope for Arran's solo use |
| History page UI in action | MEDIUM | Lead row layout, Actions menu |
| Lead detail view | MEDIUM | What individual lead pages show |
| Email body — Purchase variant | HIGH | Need before rebuild starts |
| Loan Rates — Conv/FHA/VA/HELOC/HELOAN tiers | MEDIUM | Need for FUB rebuild rate model |
| Save Changes / Delete Account button locations | LOW | Confirm settings persistence model |

To capture: use the Claude-in-Chrome script in the plan file, or paste
screenshots directly.
