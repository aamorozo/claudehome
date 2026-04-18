# CLAUDE.md — Arran's Claude Code Operating Instructions

Arran Amorozo — VP at West Capital Lending, mortgage producer. Runs Claude across Windows desktop, Mac Mini, iPhone, and Claude Code. Source of truth: Claude.ai Projects (00 COMMAND CENTER, 01 Mortgage Production, 02 Team & Newsletter, 03 investorloan.us, 04 Skills & Automation, 05 Renovation, 06 Personal Finance, 07 Inbox). Code sessions must log back to Claude.ai.

Execution preference: build, don't explain. Simplicity over cleverness.

## The Rules

1. SESSION NAMING
Every session named: [YYYY-MM-DD] [Parent Project] — [Specific task]
Parent projects: investorloan / skills / automation / calc / site / tool / reno / misc
Example: 2026-04-17 investorloan — DSCR calculator component

2. SESSION START
Silently check: existing work on this task? which parent project? relevant skill in /mnt/skills/user/?
State plan in 2-4 bullets. Start working. No long clarifying questions — Arran hates that.

3. SESSION LOG
Append one row to ./SESSION_LOG.md at end of every session:
| Date | Session name | Status | Artifact | Filed under |

4. ARTIFACT DESTINATION
End every build with:
Artifact: [filename]
Location: [path]
Belongs in Claude.ai Project: XX — Project Name

5. WORKING DIRECTORY
Standard structure: CLAUDE.md, SESSION_LOG.md, investorloan/, skills/, automation/, calc/, site/, tool/, reno/, misc/

6. NO GENERAL CHAT
Code is for dev work. Deal questions, newsletter, taxes, reno — redirect to Claude.ai.

7. SKILLS
Use /mnt/skills/user/ skills (arran-branding, personal-finance, master-calculator, dscr-analyzer, lender-email, construction-loan-builder, follow-up-boss-manager, context-compression, cowork-organizer) as source of truth when domains overlap.

8. HANDOFF TO CLAUDE.AI
End session with: "Handoff: open 0X — [Project], start chat [YYYY-MM-DD] [Category] — [subject], reference [artifact]."

9. BRANDING
Client/WCL-facing output: navy 1F3864, mid-blue 2E75B6, gold C9A84C, Arial, NMLS #1491497 footer. No em dashes.

10. FRIDAY REVIEW
If Friday and SESSION_LOG has 3+ new entries: remind Arran once to paste log into 00 COMMAND CENTER.

## Quick-Start

Arran Amorozo. Mortgage VP. Execution not explanation.
Source of truth: Claude.ai Projects (00-07).
Name sessions: [YYYY-MM-DD] [Parent Project] — [Task]
Projects: investorloan/skills/automation/calc/site/tool/reno/misc
Log to ./SESSION_LOG.md.
No general chat. Brand client output.

Last updated: 2026-04-17
