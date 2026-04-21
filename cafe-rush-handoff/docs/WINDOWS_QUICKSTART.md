# Windows Quickstart

This is the shortest path from "just downloaded the zip" to "playing the game."
Everything happens in PowerShell. You do **not** need WSL, Administrator mode,
or Linux.

---

## One-time setup (first run only)

You need three things installed on Windows:

1. **Node.js** — runs the game's dev server
2. **Git for Windows** — required by Claude Code for its internal shell
3. **Claude Code** — the AI pair programmer

### Step 1 — Install Node.js

Go to https://nodejs.org and download the LTS installer (the big green button
on the left). Run it. Click Next through everything. Done.

### Step 2 — Install Git for Windows

Go to https://git-scm.com/downloads/win and download the installer. Run it.
You can click Next through every screen — the defaults are fine.

### Step 3 — Install Claude Code

Open **PowerShell**. The easiest way:

- Press the Windows key, type `powershell`, press Enter.

Your prompt should look like `PS C:\Users\YourName>`. The `PS` at the start
is how you know you're in PowerShell (not Command Prompt). Paste this command
and press Enter:

```powershell
irm https://claude.ai/install.ps1 | iex
```

When it finishes, **close PowerShell completely and reopen it.** This is
required — the `claude` command won't be recognized until you restart the
terminal. Then verify:

```powershell
claude --version
```

If you get a version number back, you're ready. If you get "not recognized
as the name of a cmdlet," see the Troubleshooting section at the bottom.

The first time you run `claude`, a browser will open asking you to sign in
with your Anthropic account. You need a Pro, Max, Team, or Enterprise plan —
the free plan does not include Claude Code.

---

## Running this project

Once everything above is installed:

### 1. Unzip the handoff folder

Unzip `cafe-rush-handoff.zip` somewhere easy to find. Your Desktop or a
`C:\Users\YourName\projects\` folder works great. **Avoid unzipping inside
OneDrive folders** — OneDrive sync can interfere with `node_modules`.

### 2. Open PowerShell in the unzipped folder

In File Explorer, navigate into the unzipped `cafe-rush-handoff` folder.
Then:

- Click on the **address bar** at the top of the File Explorer window.
- Type `powershell` and press Enter.

PowerShell opens with the folder as the current directory. Verify with:

```powershell
pwd
```

The path should end in `cafe-rush-handoff`.

### 3. Start Claude Code

```powershell
claude
```

Claude Code launches inside your terminal. You'll see a prompt where you can
type.

### 4. Paste the handoff prompt

Open `docs\CLAUDE_CODE_PROMPT.md` in Notepad (or any text editor). Copy
everything below the `---` line. Paste it as your first message to Claude
Code and press Enter.

Claude Code will read the project files, install dependencies, and start the
dev server. It'll tell you to open a URL like `http://localhost:5173` — paste
that into your browser. The game appears.

From there, tell Claude Code what you want to do next (deploy, add content,
tweak difficulty, etc).

---

## PowerShell basics (if you're new to it)

You'll use maybe three commands total. Here they are:

| What you want | PowerShell command |
|---|---|
| See where you are | `pwd` |
| List files in this folder | `ls` or `dir` |
| Change to a folder | `cd foldername` |
| Go up one folder | `cd ..` |
| Clear the screen | `cls` |

Things that are slightly different from tutorials you might see online:

- Use **`\`** (backslash) in paths: `src\App.jsx`, not `src/App.jsx`. Both
  actually work in PowerShell, but backslash is standard.
- Use **`;`** to chain commands, not `&&`. Example: `cd cafe-rush; npm install`
- To paste into PowerShell, use **right-click** or **Ctrl+V**. (Ctrl+C is
  "cancel" in a terminal, not "copy" — select text with your mouse and it
  auto-copies.)

---

## Troubleshooting

### "`claude` is not recognized as the name of a cmdlet"

You likely didn't close and reopen PowerShell after installing. Close the
window entirely and open a fresh PowerShell, then try again.

If that doesn't fix it, the installer succeeded but Windows doesn't know
where the `claude` binary lives. Run this one line to add it to your PATH
permanently:

```powershell
[Environment]::SetEnvironmentVariable("PATH", "$env:PATH;$env:USERPROFILE\.local\bin", [EnvironmentVariableTarget]::User)
```

Close and reopen PowerShell. Try `claude --version` again.

### "`irm` is not recognized"

You're in Command Prompt, not PowerShell. Your prompt shows `C:\...>` without
the `PS`. Close it and open PowerShell specifically — Windows key → type
`powershell` → Enter.

### "`npm` is not recognized"

Node.js didn't install correctly, or you didn't restart PowerShell after
installing. Reopen PowerShell and try `node --version`. If that also fails,
reinstall Node from https://nodejs.org.

### The dev server starts but the page is blank

Open your browser's DevTools (F12) → Console tab. Paste whatever error you
see into Claude Code and it'll diagnose it.

### OneDrive is doing weird things to my project

Move the unzipped folder outside any OneDrive-synced location. OneDrive can
lock files while syncing and corrupt `node_modules`. Somewhere like
`C:\projects\cafe-rush-handoff` is safer.

### I have a Pro account but Claude Code says I need one

Make sure you're signed in to the same account that has Pro. Run
`claude doctor` in PowerShell — it'll tell you what it sees and suggest a fix.

---

## Everything else

Once the game is running locally, the rest of the guidance in the main
`README.md` and `CLAUDE.md` applies identically regardless of OS. Claude Code
will handle cross-platform details for you — you just talk to it in plain
English about what you want.

For the official install docs (in case something on this page becomes
outdated), see: https://code.claude.com/docs/en/setup
