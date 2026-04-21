# Prompt to paste into Claude Code

Copy everything below the `---` line and paste it as your first message to
Claude Code after running `claude` in the `cafe-rush-handoff/` directory.

---

I'm handing off a game project called **Career Café Rush** that was built in a
web chat with you. I want to run it locally, then deploy it so my friends can
play.

## Your first tasks

1. Read `docs/CONVERSATION_HISTORY.md` — that's the context from the chat
   where this was built. It tells you what each file is and why it exists.
2. Read `built-project/cafe-rush/README.md` and skim
   `built-project/cafe-rush/src/App.jsx` so you know the codebase.
3. Read `CLAUDE.md` at the repo root — that has project conventions you should
   follow when making edits.

## What I want you to do right now

Get the game running on my machine. Specifically:

1. `cd built-project/cafe-rush`
2. Run `npm install`
3. Run `npm run dev`
4. Tell me the localhost URL to open and confirm the build succeeded.

If any of those steps fail, debug them. If Node isn't installed, tell me how to
install it for my OS before doing anything else. Don't assume anything about my
environment — check first.

## After it's running

Once I confirm I can see the game in my browser, I'll tell you what I want to
change or where I want to deploy it. Likely next steps:

- **Deploy to Vercel** so my friends can play at a real URL
- **Tweak game balance** (combo cap, celebrity spawn rate, level difficulty)
- **Add content** (more professions, recipes, or celebrities)
- **Polish visuals** (new backgrounds, animations, icons)

Don't do any of those yet — wait for me to pick.

## Ground rules

- The game is a single React file (`src/App.jsx`, ~2,300 lines). That's
  intentional. Don't split it into multiple files unless I ask you to.
- All game content (ingredients, recipes, professions, celebrities, levels,
  upgrades, backgrounds) is data-driven at the top of `App.jsx`. Adding content
  should never require touching the component code.
- The aesthetic is specific and already established — warm café colors, chunky
  offset shadows, Fraunces italic headers, Space Mono labels. Don't drift from
  this unless I explicitly ask for a redesign.
- Before making non-trivial changes, show me the plan first.
