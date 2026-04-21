# Career Café Rush — Claude Code Handoff

This is a complete handoff package for continuing work on the **Career Café
Rush** game in Claude Code. Everything you need is here.

## Folder layout

```
cafe-rush-handoff/
├── CLAUDE.md                   ← Claude Code reads this automatically every session
├── docs/
│   ├── WINDOWS_QUICKSTART.md   ← start here if you're on Windows
│   ├── CLAUDE_CODE_PROMPT.md   ← the prompt to paste into Claude Code first
│   └── CONVERSATION_HISTORY.md ← summary of the chat that built this
├── source/
│   ├── App.jsx                 ← standalone reference copy
│   └── tutorial-reference.jsx  ← earlier tutorial-only build
└── built-project/cafe-rush/    ← the runnable Vite project
```

## ⚡ If you're on Windows

Skip to **[`docs/WINDOWS_QUICKSTART.md`](docs/WINDOWS_QUICKSTART.md)** — it
walks you through PowerShell setup, Claude Code install, and the exact
commands. Then come back here for anything else.

---

## How to use this

### If you don't have Claude Code installed yet

1. Install Node.js from https://nodejs.org (LTS version).
2. Install Claude Code:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
3. Run `claude` in any terminal. Follow the auth prompts.

Check the [official docs](https://docs.claude.com/en/docs/claude-code) for the
latest install steps — they may have changed.

### Starting the handoff

1. Open a terminal in **this folder** (`cafe-rush-handoff/`).
2. Run:
   ```
   claude
   ```
3. Open `docs/CLAUDE_CODE_PROMPT.md`, copy the text below the `---` line, and
   paste it as your first message.
4. Claude Code will read the context files, set up dependencies, and start the
   dev server. Follow along with what it tells you.

That's it. After the game is running, tell Claude Code what you want next —
deploying, adding content, tweaking balance, whatever.

## Why the folder is structured this way

`CLAUDE.md` at the root is the file Claude Code reads automatically when it
starts up in this directory. It contains project conventions, architectural
decisions, and things to avoid — so you don't have to re-explain them every
session.

`docs/CONVERSATION_HISTORY.md` is the chat-memory substitute. It summarizes
what was built over our four-turn conversation, what each file is, and why
certain decisions were made (single-file React, emoji graphics, synth audio,
etc).

`docs/CLAUDE_CODE_PROMPT.md` is your starting message — it tells Claude Code
what order to read things in and what the first concrete task is.

`built-project/cafe-rush/` is the actual working directory. The nested folder
structure (`built-project/cafe-rush/` rather than just `cafe-rush/`) is
intentional — it keeps the game code separate from the handoff docs so
`git init` or deploy tooling inside `cafe-rush/` stays clean.

## If something goes wrong

- **`claude` command not found** → Node/npm isn't installed, or the global
  install failed. Reinstall Node LTS from nodejs.org.
- **Claude Code doesn't read CLAUDE.md** → Make sure you launched `claude` from
  *this* folder (`cafe-rush-handoff/`), not from inside `built-project/`. Or
  copy `CLAUDE.md` into `built-project/cafe-rush/` if you plan to work from
  there instead.
- **Build fails** → Tell Claude Code the exact error. It can debug from there.

---

Have fun. The game is a complete, deployable product as-is — any work in
Claude Code is just polish and additions.
