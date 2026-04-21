# Conversation History — Career Café Rush

This document summarizes the chat that produced the game, so Claude Code has the
same context without needing the raw chat transcript.

## Turn-by-turn summary

### Turn 1 — Tutorial system
User asked for a built-in tutorial system with 9 steps (welcome, dragging
ingredients, combining recipes, serving customers, timer intro, money system,
combo system, special celebrity customers, completion), plus a skip button and a
replay option in settings.

**Built:** `tutorial-reference.jsx` (single React file). A playable tutorial
mockup with spotlight overlays, directional pointer arrows, step-gated
advancement (player must actually drag/combine/serve to proceed), and a settings
modal with a replay button. This file is kept in `source/` as a reference — the
tutorial logic was later merged into the full game.

**Aesthetic established here** (kept throughout the project):
- Fonts: Fraunces (italic display) + Space Mono (uppercase labels)
- Palette: cream `#FFF4E2`, milk `#FFF9F0`, espresso `#3B2416`, cocoa `#6B4530`,
  caramel `#D4A13F`, tomato `#C85A4B`, peach `#E8856B`, pistachio `#A8C09A`
- Chunky offset shadows (`0 6px 0 #3B2416`), rounded 2.5px borders everywhere,
  slight pop/scale animations with `cubic-bezier(0.34, 1.56, 0.64, 1)`
- SVG noise grain overlay at 4% opacity for texture

### Turn 2 — Full game spec
User gave the full "Career Café Rush" spec: 8 professions each with 2 dishes
(police, firefighter, teacher, nurse, zookeeper, writer, manager, photographer),
14 total recipes (each 2 ingredients), 7 celebrities with 2×–5× payouts, 3 game
modes (Freeplay / Levels / Collection), 12 levels with every 5th being a
challenge (#5 Michelin, #10 Royal), shop/upgrades, backgrounds with multipliers,
combo system, progression tracking, golden chef badge when all levels cleared.

**Built:** `source/App.jsx` — the whole game in one React file. Reused tutorial
logic but merged into the main flow. Data is fully modular at the top of the
file (INGREDIENTS, RECIPES, PROFESSIONS, CELEBRITIES, LEVEL_DEFINITIONS,
UPGRADES, BACKGROUNDS — all plain objects/arrays). Session state uses refs to
avoid stale closures in the timer/spawner intervals. Celebrity spawn rate is 6%
and they only appear if their required dish is craftable given the current
allowed professions.

Caveats flagged at the time: no audio (can't ship royalty-free inline), HTML5
DnD doesn't work on touch, localStorage not supported in artifacts so progress
was in-memory.

### Turn 3 — "Make it a website my friends can play"
User asked for audio, mobile touch dragging, daily challenges, and how to
deploy.

**Built:**
- `AudioEngine` — Web Audio API synth, generates a C–Am–F–G pad loop plus SFX
  for pickup/combine/serve/coin/celebrity/bad/timeup. No external library.
- Custom `DragProvider` + `useDraggable` / `useDroppable` hooks that work with
  both mouse and touch pointer events. Drop zones visually highlight when
  hovered. Replaced all HTML5 DnD.
- Daily Challenge — seeded by UTC date (`getTodaySeed` + LCG RNG), picks 3–4
  random professions and a 8–12 target with a 150–210s timer. Completion is
  tracked by seed so it locks until the next UTC day.
- Ran `npm run build` successfully: 213 KB JS / 65 KB gzipped.

### Turn 4 — Persistence + project scaffold
User said "continue". Finished:
- `usePersistedState` hook writing to localStorage with Set serialization
- Full Vite project at `built-project/cafe-rush/` — package.json, vite.config,
  tailwind config, index.html, src/main.jsx entry, index.css with tailwind
  directives, README with deployment instructions for Vercel / Netlify /
  GitHub Pages

## Current status

Both source/App.jsx and built-project/cafe-rush/src/App.jsx are functionally
identical. The built-project version has the `usePersistedState` hook so
progress persists across browser sessions on a real website.

`npm run build` works. All features listed in the spec are implemented.

## Known limitations

- Emojis render slightly differently on iOS / Android / Windows (OS-level).
  Acceptable tradeoff; swapping to SVG illustrations would be a significant
  polish upgrade if desired later.
- Audio requires a user click first (browser autoplay policy). The speaker
  icon in the main menu starts it.
- No multiplayer or server state. Each player's save is local to their browser.
