# ClaudeHome — Setup on a New Machine

## Windows
```powershell
git clone https://github.com/YOUR_USERNAME/claudehome.git C:\Users\YOUR_USERNAME\ClaudeHome
cd C:\Users\YOUR_USERNAME\ClaudeHome\_setup
.\setup-windows.ps1
```

## Mac
```bash
git clone https://github.com/YOUR_USERNAME/claudehome.git ~/ClaudeHome
cd ~/ClaudeHome/_setup
bash setup-mac.sh
```

## Then
Open Claude Code → click the working directory pill → navigate to `ClaudeHome`.

## iPhone
Claude Code doesn't run on iPhone. Instead:
- Open Claude.ai → Project 00 COMMAND CENTER
- The CLAUDE.md content is pinned there as your operating instructions
- View SESSION_LOG.md anytime at github.com (private repo, logged in via GitHub mobile)

## One-time: get local Windows desktop projects onto GitHub
So they show up on claude.ai/code from any device.

```powershell
cd C:\Users\arran\ClaudeHome\_setup
.\migrate-windows-projects-to-github.ps1 -DryRun   # preview
.\migrate-windows-projects-to-github.ps1           # real run
```

The script scans each folder for secrets, writes a hardened `.gitignore`,
creates a private `aamorozo/<repo>` on GitHub, and pushes. Edit the
`$Projects` list at the top of the script to add more folders.

Prereqs: `winget install GitHub.cli` then `gh auth login`.

## What syncs across devices, what doesn't
| Thing | Lives in | Synced? |
|---|---|---|
| CLAUDE.md, SESSION_LOG.md, project folders | this repo | yes (git) |
| Skill source files | `_setup/skills/` | yes (git) |
| Active skills / settings / plugins | `~/.claude/` | no — bootstrapped by setup scripts |
| Claude Code chat history | `~/.claude/sessions/` | no — machine-local |
| Claude.ai Projects 00–07 | claude.ai account | yes, everywhere you log in |
