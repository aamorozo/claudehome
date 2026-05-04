# Engineering Surface Audit — Arran Amorozo

**Date:** 2026-05-04
**Author:** Claude Code (principal-engineer audit pass)
**Filed under:** `00 — COMMAND CENTER`
**Session:** `2026-05-04 misc — Engineering surface audit`

---

## 1. Executive Summary

1. **You have no single source of truth.** CLAUDE.md says skills live in `/mnt/skills/user/` — that mount does not exist. Skills actually live in `_setup/skills/`, and the inventory there disagrees with CLAUDE.md (has `interior-design`, missing `cowork-organizer` and `personal-finance`). Pick one. **Recommendation: kill `/mnt/skills/user/` from CLAUDE.md and promote `_setup/skills/` to canonical.**
2. **The repo is empty of the work CLAUDE.md describes.** Until this audit, none of `investorloan/ skills/ automation/ calc/ site/ tool/ reno/ misc/` existed. Created in this PR. The actual work lives elsewhere (OneDrive, Desktop, Cloudflare, GitHub) — the working tree is a shell.
3. **You have 12 simultaneous draft PRs (#2–#13) all iterating on the same FUB Cloudflare Worker.** This is the single biggest source of drift. Pick #13 as canonical, close #2–#12, ship.
4. **No `.claude/` at the project root.** Plugins are configured in `_setup/settings.json` (18 plugins enabled) but never wired into the working tree. Move it to `.claude/settings.json` and commit it.
5. **Follow Up Boss is the highest-leverage gap with no MCP.** Build the FUB → Cloudflare Worker → Slack pipeline you already started in PR #13. That is your missing nervous system.
6. **MCP coverage is broader than you're using.** GitHub, Supabase, Notion, Slack, Gmail, HubSpot, Firebase, ClickUp, GitLab, plus two unauth'd servers are wired in `_setup/settings.json`. Auth them, then use them — most are dormant.
7. **Claude.ai Projects 00–07 are your real source of truth, but Claude Code can't see into them.** Every session must end with the Rule-8 handoff line. Add a hook to enforce it.
8. **GitHub MCP is scoped only to `aamorozo/claudehome`.** You almost certainly own more repos. Widen the scope or paste a `gh repo list` so the next audit pass is complete.
9. **No CI on any PR.** 13 PRs, zero checks. Add a single `wrangler typecheck` + `markdownlint` GitHub Action this week.
10. **Tier-1 fixes are 90 minutes of work** for an order-of-magnitude reduction in drift. Do them this week.

---

## 2. Per-System Table

| System | Current state | Integration verdict (+ why) | Concrete recommendation | Sync risk if unfixed | Effort | Leverage |
|---|---|---|---|---|---|---|
| **GitHub (`aamorozo/claudehome`)** | 18 branches, 12 open draft PRs, no CI, last main commit 13 days ago. MCP wired. | **MCP** — already installed, idempotent, low blast radius. CLI (`gh`) is unavailable in this harness. | Keep `mcp__github__*`. Widen scope beyond a single repo so I can see all your repos. Add a `subscribe_pr_activity` watch when a PR is opened. | Branch sprawl, lost PR context, abandoned work | S | 10 |
| **GitHub (other repos)** | Unknown. MCP can't see them. | **MCP** with widened scope. | Edit `_setup/settings.json` to remove the `aamorozo/claudehome`-only restriction. OR paste `gh repo list aamorozo --limit 100 --json name,pushedAt,isArchived,defaultBranchRef` and I'll re-audit. | Untracked repos rotting silently | S | 9 |
| **Cloudflare Workers (FUB daily report)** | 12 draft PRs of the same Worker. Manually tested with `wrangler dev`. | **CLI** (`wrangler`) for deploy, **Webhook** for inbound from FUB, **Slack MCP** for outbound. | Pick PR #13 → squash-merge → `wrangler deploy` → set FUB webhook → done. Close #2–#12 with a "superseded by #13" comment. | Lead notifications silently break; you don't notice for hours | M | 10 |
| **Follow Up Boss** | No MCP, no CLI integration. Webhooks possible per FUB API docs. | **API + Webhook** — FUB has REST + webhooks but no official MCP. Don't write a custom MCP yet — overkill. | Cloudflare Worker (above) is the right pattern. One Worker handles: new lead → Slack DM, stage change → Notion row, daily digest → email. | Lost leads, missed stage changes, no audit trail | M | 10 |
| **Gmail** | MCP wired (`5a354c89-…`). Used for drafts + search. Label tools dropped mid-session today (server flake). | **MCP** for read/draft/search; **API** only for high-volume label automation. | Use MCP as primary. For lender-email skill (template send), keep `lender-email` skill in `_setup/skills/` as the source of truth and have the MCP send drafts only. | Inbound lender replies missed; templates drift | S | 8 |
| **Slack** | MCP wired. Canvases, search, send, schedule available. | **MCP** end-to-end. Webhooks only for Cloudflare Worker → Slack outbound. | Pin the FUB-alerts channel ID in a `.env`-style config under `automation/`. Use `slack_send_message` from sessions; webhook from Worker. | Notification noise, missed replies | S | 7 |
| **Notion** | MCP wired. Newsletter, meeting notes, databases reachable. | **MCP** for create/update; **API** only for bulk migrations. | Designate Notion as source of truth for: newsletter drafts, meeting notes, deal pipeline mirror. Claude.ai Projects stay source of truth for *prompts and chats*; Notion holds *records*. | Two systems competing for "where the deal lives" | M | 8 |
| **Supabase** | MCP wired (full DB + edge functions + branches). Project list unaudited. | **MCP** for migrations, **CLI** (`supabase`) for local dev only. | Use MCP `apply_migration` for schema changes from sessions. Keep one project per investorloan environment (prod/staging). Run `get_advisors` monthly — it surfaces RLS gaps. | Schema drift between local / staging / prod; RLS leaks | M | 8 |
| **Firebase** | MCP wired but **flapping** — disconnected twice in this session. Used for `mtgpro-ai` Next.js stack per SESSION_LOG. | **CLI** (`firebase`) is more reliable than MCP right now. **MCP** as a convenience layer. | Don't trust the MCP for anything destructive. For deploys, use `firebase deploy` from a session shell. Pick *either* Supabase *or* Firebase as your backend — running both is the drift. | Two backends, two auth models, ongoing tax | L | 9 |
| **HubSpot** | MCP wired (campaigns, CRM, properties). Unclear if you use it — FUB seems to be the actual CRM. | **MCP** if you use it; otherwise **kill**. | Decide: FUB or HubSpot. If FUB wins (likely), disable HubSpot MCP in `_setup/settings.json`. | Two CRMs = no CRM | S | 7 |
| **ClickUp** | MCP wired (came online mid-session). Tasks, docs, time tracking, chat. | **MCP** for task ops; **API** only if you build dashboards. | If you don't already live in ClickUp, **don't start now**. Notion + Claude.ai Projects + Cloudflare Worker alerts is enough. | Yet another inbox | S | 3 |
| **GitLab** | MCP authentication-only (no projects yet). | **None** — you are a GitHub shop. | Disable GitLab MCP. | Confusion when both are listed | S | 2 |
| **Claude.ai Projects 00–07** | Source of truth for *prompts, chats, decisions*. Not introspectable from Code. | **Hook** — enforce CLAUDE.md Rule 8 handoff via SessionEnd hook. | Add a `SessionEnd` hook that blocks session close until the model output contains `Handoff: open …`. See `automation/hooks/enforce-handoff.sh` (Tier 2). | Sessions end without handoff → work disappears | M | 9 |
| **`/mnt/skills/user/`** | Does not exist. Referenced in CLAUDE.md Rule 7. | **N/A — kill this path.** | Update CLAUDE.md Rule 7 to point at `_setup/skills/`. Reconcile names: drop `cowork-organizer`/`personal-finance` from rule (or add empty skills), and add `interior-design` to the rule. | Rule 7 lies; sessions look for skills in the wrong place | S | 9 |
| **`_setup/settings.json`** | 18 plugins enabled. Never moved to `.claude/settings.json`. | **Hook config** — must live at `.claude/settings.json` to actually apply. | Move `_setup/settings.json` → `.claude/settings.json`, commit. Keep `_setup/` for templates only. | Plugins listed but not actually loaded | S | 9 |
| **iPhone / Mac Mini / Windows** | Three sync planes for files. iCloud + OneDrive both in play (per SESSION_LOG). | **Pick one.** iCloud for personal, GitHub for code, Notion for records. Kill OneDrive duplication. | Migrate `OneDrive/Desktop/mortgagepro` → `~/code/mortgagepro` → `aamorozo/mortgagepro`. Stop editing on OneDrive. | "Which version is current?" — already happening per SESSION_LOG | L | 8 |
| **NMLS-branded calculators** | Live in `calc/` (now scaffolded, was missing). Source unknown — likely Excel + HTML in `_setup/skills/master-calculator`. | **Skill** as source of truth, **static site** for delivery. | One canonical calculator HTML in `calc/`, deploy via GitHub Pages. Embed on investorloan.us via `<iframe>`. | Two calculators with different math | M | 9 |
| **investorloan.us** | Next.js app, lives in OneDrive/Desktop per SESSION_LOG (drift). Firebase-backed. | **Vercel + GitHub** is the path. **MCP (Firebase/Supabase)** for backend ops. | Move source into `investorloan/` in this repo (or its own `aamorozo/investorloan` repo). Vercel auto-deploy on `main`. Branch protection on `main`. | Source on OneDrive = no real version control | M | 10 |

---

## 3. Per-Repo / Per-Branch Table

**Scope limit:** GitHub MCP can only see `aamorozo/claudehome`. Other repos are unaudited — see Blind Spots.

| Repo | Branch | Last commit | PR | CI | CLAUDE.md | SESSION_LOG.md | `.claude/settings.json` | Verdict |
|---|---|---|---|---|---|---|---|---|
| aamorozo/claudehome | `main` | 2026-04-21 | — | none | yes | yes | **no** (in `_setup/`) | Move settings.json into `.claude/`. |
| aamorozo/claudehome | `claude/recommend-tools-workflow-LypW9` | this session | this PR | none | yes | yes (cleaned) | no | **In progress.** This PR. |
| aamorozo/claudehome | `claude/exciting-keller-ApilV` | 2026-05-04 | #13 (draft) | none | inherits | inherits | no | **Promote to canonical FUB Worker. Merge.** |
| aamorozo/claudehome | `claude/exciting-keller-*` (×11 others) | 2026-04-21–05-03 | #2–#12 (draft) | none | inherits | inherits | no | **Close. Superseded by #13.** |
| aamorozo/claudehome | `claude/fix-missing-home-files-aJYVW` | unknown | none | none | inherits | inherits | no | **Investigate, then delete or merge.** |
| aamorozo/claudehome | `claude/deploy-cafe-rush-S0fcv` | 2026-04-21 (merged #1) | #1 (merged) | none | yes | yes | no | **Delete branch.** |

---

## 4. Dependency Graph

```mermaid
flowchart LR
    subgraph SOT["Single Sources of Truth (target state)"]
        CAI[Claude.ai Projects 00-07<br/>prompts, chats, decisions]
        GH[GitHub aamorozo/*<br/>all code]
        NOTION[Notion<br/>records: deals, meetings, newsletter]
        FUB[Follow Up Boss<br/>contacts, leads, stages]
        SKILLS[_setup/skills/<br/>domain logic templates]
    end

    subgraph EXEC["Execution Layer"]
        CC[Claude Code session]
        CW[Cloudflare Worker<br/>FUB daily report]
        VERCEL[Vercel<br/>investorloan.us]
        GHPAGES[GitHub Pages<br/>calculators, cafe-rush]
    end

    subgraph SURFACES["User Surfaces"]
        SLACK[Slack]
        EMAIL[Gmail]
        IFRAME[Calculator iframes]
        SITE[investorloan.us]
    end

    CAI -->|handoff line| CC
    SKILLS --> CC
    CC -->|commits| GH
    CC -->|writes records| NOTION
    CC -->|SESSION_LOG row| GH

    GH -->|push| VERCEL
    GH -->|push| GHPAGES
    GH -->|deploy hook| CW

    FUB -->|webhook| CW
    CW --> SLACK
    CW --> EMAIL
    CW --> NOTION

    VERCEL --> SITE
    GHPAGES --> IFRAME
    IFRAME --> SITE

    classDef drift fill:#ffe5e5,stroke:#c00,color:#000
    OD[OneDrive/Desktop<br/>mortgagepro]:::drift
    MNT[/mnt/skills/user/<br/>does not exist]:::drift
    HUBSPOT[HubSpot<br/>competing CRM]:::drift
    OD -.->|drift: source of truth split| GH
    MNT -.->|drift: dead path in CLAUDE.md| SKILLS
    HUBSPOT -.->|drift: pick FUB or HubSpot| FUB
```

**Drift violations to fix:**
- `OneDrive/Desktop/mortgagepro` ↔ GitHub (no source-of-truth declared).
- CLAUDE.md Rule 7 → `/mnt/skills/user/` (dead path).
- HubSpot ↔ FUB (two competing CRMs).
- `_setup/settings.json` ↔ `.claude/settings.json` (config in wrong location).

---

## 5. Tiered Action Plan

### Tier 1 — This week (≈ 90 min total, high-ROI / low-effort)

| # | Action | Owner | Acceptance |
|---|---|---|---|
| 1 | Merge PR #13 (FUB Worker), close #2–#12 with "superseded by #13" | Arran | `mcp__github__list_pull_requests state=open` returns ≤ 1 |
| 2 | Move `_setup/settings.json` → `.claude/settings.json`; commit | Claude Code | File exists at `.claude/settings.json`, plugins load on next session |
| 3 | Patch CLAUDE.md Rule 7: replace `/mnt/skills/user/` with `_setup/skills/`; reconcile skill names against actual `_setup/skills/` contents | Claude Code | `grep -c "/mnt/skills/user" CLAUDE.md` returns 0 |
| 4 | Disable GitLab MCP and (decide) HubSpot MCP in `.claude/settings.json` | Arran | Settings file no longer lists unused servers |
| 5 | Widen GitHub MCP scope beyond `aamorozo/claudehome` (or paste `gh repo list` output) | Arran | Re-run audit covers all repos |
| 6 | Delete merged branch `claude/deploy-cafe-rush-S0fcv` | Claude Code | `mcp__github__list_branches` no longer returns it |
| 7 | Add a single GitHub Action: `markdownlint` on `*.md` + `wrangler typecheck` on Worker dirs | Claude Code | Next PR shows green checks |

### Tier 2 — This month (structural)

| # | Action | Owner | Acceptance |
|---|---|---|---|
| 8 | Move `OneDrive/Desktop/mortgagepro` source into `investorloan/` (or its own repo). Stop editing on OneDrive | Arran | `git -C investorloan log` shows recent commits; OneDrive copy archived to `~/Archive/` |
| 9 | Wire investorloan.us deploy: GitHub → Vercel auto-deploy on `main`, branch protection on `main` | Arran | Pushes to `main` deploy automatically; PRs required |
| 10 | Build `automation/hooks/enforce-handoff.sh` SessionEnd hook that requires Rule-8 handoff line | Claude Code | Session close fails without handoff line |
| 11 | Build `automation/hooks/append-session-log.sh` SessionEnd hook that auto-appends a row to SESSION_LOG.md | Claude Code | Every session ends with a SESSION_LOG row |
| 12 | Pick FUB *or* HubSpot. Disable the loser. Migrate any data | Arran | One CRM in production, MCP for the other disabled |
| 13 | Pick Supabase *or* Firebase for investorloan backend. Migrate one to the other | Arran | One backend; the other's MCP disabled |
| 14 | Canonical calculator: one HTML in `calc/`, deploy via GitHub Pages, embed on investorloan.us | Arran | Calc URL stable; site embeds via iframe |
| 15 | Auth all wired MCPs (Notion, Slack, Gmail, Supabase, ClickUp) and re-run this audit with full visibility | Arran | Next audit has zero "blind spot" rows |

### Tier 3 — This quarter (architectural)

| # | Action | Owner | Acceptance |
|---|---|---|---|
| 16 | Create `aamorozo/investorloan` and `aamorozo/wcl-tools` repos. Each gets CLAUDE.md, SESSION_LOG.md, `.claude/settings.json` | Arran | Three live repos, each independently shippable |
| 17 | Cloudflare Worker becomes a router: FUB events → {Slack, Notion, Gmail digest, dashboard} | Claude Code | One Worker handling 4 downstreams, observable via `wrangler tail` |
| 18 | Friday Review automation: hook scans SESSION_LOG, posts diff to Claude.ai Project 00 prompt | Claude Code | Friday sessions end with auto-generated review draft |
| 19 | Decommission OneDrive entirely for code/work. Personal docs only | Arran | OneDrive contains zero `.py / .ts / .tsx / .jsx / .html` files |
| 20 | Sign + brand check on every client-facing artifact via a pre-commit hook (NMLS footer, navy/mid-blue/gold, Arial, no em dashes) | Claude Code | Hook blocks commits that violate Rule 9 |

---

## 6. Kill List

**Repos to archive:** *Unknown until GitHub MCP scope is widened.*

**Branches to delete:**
- `claude/deploy-cafe-rush-S0fcv` (merged, dead).
- All 11 superseded `claude/exciting-keller-*` branches once #13 merges.
- `claude/fix-missing-home-files-aJYVW` if its diff is empty or duplicated by this PR.

**PRs to close (without merging):**
- `#2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12` — superseded by #13. Comment: `Superseded by #13. Closing.`

**Integrations to retire:**
- **GitLab MCP** — you are GitHub-only.
- **HubSpot MCP** — assuming FUB is the real CRM.
- **One of Supabase/Firebase** — whichever you use less.
- **OneDrive as a code surface.**

**Skills to merge / clean:**
- Delete the `/mnt/skills/user/` reference from CLAUDE.md.
- Reconcile `_setup/skills/` against CLAUDE.md Rule 7 named list (currently mismatched).
- Either drop `interior-design` from disk or add it to the Rule 7 list.
- Either add `cowork-organizer` and `personal-finance` skills to disk or remove from Rule 7.

**Files to remove:**
- `_setup/settings.json` (after move to `.claude/settings.json`).

---

## 7. Golden-Path Runbooks

### (a) New investorloan feature

1. Open Claude.ai Project `03 — investorloan.us`. Decide spec in chat.
2. In Claude Code: `cd ~/code/investorloan` (or repo-of-record). Branch: `git checkout -b feat/<short-name>`.
3. Session name: `[YYYY-MM-DD] investorloan — <feature>`.
4. State plan in 2–4 bullets. Build.
5. If schema change: `mcp__supabase__apply_migration` (or `firebase deploy` if Firebase). Verify with `get_advisors`.
6. Brand check: navy `#1F3864`, mid-blue `#2E75B6`, gold `#C9A84C`, Arial, NMLS #1491497 footer, no em dashes.
7. Commit, push (`-u origin feat/<short-name>` with retry/backoff), open **draft** PR via `mcp__github__create_pull_request`.
8. Watch CI: `mcp__github__subscribe_pr_activity`.
9. Append SESSION_LOG row: `| YYYY-MM-DD | investorloan — <feature> | shipped | <PR url> | 03 investorloan.us |`.
10. **Handoff line:** `Handoff: open 03 — investorloan.us, start chat YYYY-MM-DD investorloan — <feature> review, reference <PR url>.`

### (b) Calculator update

1. Open Claude.ai Project `04 — Skills & Automation`. Confirm math change.
2. Edit `_setup/skills/master-calculator` *first* (skill is source of truth).
3. Regenerate `calc/<calc-name>.html` from the skill. Single canonical file per calculator.
4. Visual + numeric QA in browser at `file://`.
5. Commit on `feat/calc-<name>`. Open draft PR. Merge to `main` after CI.
6. GitHub Pages auto-publishes `calc/`. investorloan.us iframe picks up the new version on next page load.
7. Append SESSION_LOG row with `04 Skills & Automation`.
8. **Handoff:** `Handoff: open 04 — Skills & Automation, start chat YYYY-MM-DD calc — <name> v<n>, reference calc/<name>.html.`

### (c) Inbound lead (FUB → action)

This is the steady-state runbook *after* PR #13 ships. No human-in-the-loop required for routing — only for follow-up.

1. FUB webhook fires on new lead → Cloudflare Worker.
2. Worker classifies (DSCR / conventional / construction / other) using `dscr-analyzer` skill heuristics.
3. Worker writes Notion row: `04 — Lead pipeline` DB.
4. Worker DMs Arran in Slack with: name, source, classification, Notion link, FUB link.
5. Within 1 hour, Arran responds in Slack: `/follow-up <yes|no|defer>`.
6. If `yes`: Worker creates Gmail draft using `lender-email` skill template. Arran reviews + sends.
7. End of day: Worker posts daily digest to Slack: leads in / leads responded / leads stale.
8. **No Claude Code session needed for this loop.** Code only enters when changing the Worker logic.

### (d) Closing out a Claude Code session → Claude.ai

1. Confirm SESSION_LOG row appended (Rule 3). If hook from Tier 2 #11 is in place, automatic.
2. Confirm artifact path stated in chat (Rule 4): `Artifact: <filename> / Location: <path> / Belongs in Claude.ai Project: XX — <name>`.
3. Brand check the artifact if client/WCL-facing (Rule 9).
4. Commit + push + draft PR (per Git ops contract).
5. State the **Handoff line** (Rule 8):
   `Handoff: open 0X — <Project>, start chat YYYY-MM-DD <Category> — <subject>, reference <artifact>.`
6. If Friday and SESSION_LOG ≥ 3 new rows: remind Arran once to paste log into `00 — COMMAND CENTER` (Rule 10).
7. Open Claude.ai → Project → start chat → paste handoff line as the first message → continue work there.

---

## Blind Spots & What to Grant

To complete this audit at full fidelity, paste / grant the following:

1. **All your GitHub repos.** Run locally and paste:
   ```
   gh repo list aamorozo --limit 100 --json name,pushedAt,isArchived,defaultBranchRef,description
   ```
   Or widen the GitHub MCP scope in `.claude/settings.json` to `aamorozo/*`.
2. **FUB API key + webhook URL** (or paste the current FUB webhook config) so I can wire the Worker end-to-end.
3. **Claude.ai Projects 00–07 contents.** Paste the project list + a 1-line description of each so I can verify the Rule-8 handoff targets are accurate.
4. **Cloudflare account ID + Worker name(s)** so I can read PR #13's deployed state via API.
5. **Vercel project list** for investorloan.us (or `vercel ls` output).
6. **Supabase project list and Firebase project list** so I can recommend which to kill.
7. **Authenticated MCP sessions** for Notion, Slack, Gmail, Supabase, HubSpot — once auth'd, re-run this audit and the per-system rows become concrete instead of inferred.
8. **OneDrive / iCloud directory listings** for any code-bearing folders, so the kill list is complete.

---

## Artifact Handoff

**Artifact:** `2026-05-04-engineering-surface-audit.md`
**Location:** `/home/user/claudehome/misc/2026-05-04-engineering-surface-audit.md`
**Belongs in Claude.ai Project:** `00 — COMMAND CENTER`

**Handoff:** open `00 — COMMAND CENTER`, start chat `2026-05-04 misc — Engineering surface audit review`, reference `misc/2026-05-04-engineering-surface-audit.md`.
