# Career Café Rush — Project Context

This file is automatically read by Claude Code at the start of each session.
It describes how this project is structured and the conventions to follow.

## What this is

A cozy café cooking simulation game. Players drag ingredients, combine recipes,
and serve customers based on their profession. Built as a single-file React app
with Vite. Originally scaffolded in a Claude chat, now living here.

## Folder layout

```
cafe-rush-handoff/
├── CLAUDE.md                   ← you are here
├── source/
│   ├── App.jsx                 standalone reference copy of the game
│   └── tutorial-reference.jsx  earlier tutorial-only build, kept as reference
├── built-project/
│   └── cafe-rush/              the actual runnable Vite project
│       ├── README.md           full run/deploy instructions for the human
│       ├── package.json
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.jsx        React entry
│           ├── App.jsx         the game (single file, ~2,300 lines)
│           └── index.css       Tailwind + body reset
└── docs/
    ├── CONVERSATION_HISTORY.md  how this project came to be
    └── CLAUDE_CODE_PROMPT.md    the prompt the human first used
```

**The live code is `built-project/cafe-rush/src/App.jsx`.** The version in
`source/` is a reference copy; don't edit it unless syncing changes.

## Tech stack

- **React 18** with hooks (no class components)
- **Vite** for build and dev server
- **Tailwind CSS v3** for utility classes — Tailwind classes are used alongside
  inline style objects (yes, mixed on purpose; see conventions below)
- **lucide-react** for icons
- **Web Audio API** for music and SFX (no external audio library)
- **localStorage** for save persistence

## Architecture conventions

### Single-file on purpose

`App.jsx` is one large file. This is deliberate — the game is self-contained
and splitting it across files hurts more than it helps for a project this size.
**Don't split it into multiple files unless the user explicitly asks.**

### Data at the top, components below

The file is organized in this order:
1. Imports
2. `AudioEngine` module (closure-based singleton)
3. Persistence helpers (`usePersistedState`, `loadSave`, etc.)
4. Drag-and-drop system (`DragProvider`, `useDraggable`, `useDroppable`)
5. Daily challenge helpers
6. **Game data** — `INGREDIENTS`, `RECIPES`, `PROFESSIONS`, `CELEBRITIES`,
   `LEVEL_DEFINITIONS`, `UPGRADES`, `BACKGROUNDS`
7. Root component and screen router (`CareerCafeRush`, `GameShell`)
8. Screen components (`MainMenu`, `LevelSelect`, `Collection`, `UpgradesShop`,
   `SettingsScreen`, `GameLoop`, etc.)
9. Shared UI primitives (`Chip`, `IconBtn`, `MenuCard`, etc.)
10. Style objects (`styles`) and the `PALETTE` constant
11. Global CSS string (keyframes and imports)

Adding content = edit the data objects in section 6. No component changes
needed.

### Styling approach

Two styling systems coexist:
- **Inline `style={}` objects** for anything with precise pixel values, borders,
  shadows, or values that reference the `PALETTE` constant
- **Tailwind classes** for layout (flex, grid, gap, positioning) and simple
  utility patterns (hover states, transitions)

This is intentional — don't try to "clean up" by converting everything to one
approach. The inline styles make the chunky-shadow café aesthetic consistent
and easy to tweak.

### State management

- Global-ish state lives in `GameShell` and gets passed down as a `state` prop
  object. That's the "save file" shape.
- Session state (a single run of the game) lives in `GameLoop`.
- Refs mirror session state for setInterval closures — don't remove them;
  they prevent stale-closure bugs in the timer and customer spawner.
- `usePersistedState` auto-saves to localStorage. Fields containing `Set`
  instances are serialized/deserialized automatically in `loadSave` — if you
  add a new Set-backed field, add it to the `setFields` array in `loadSave`.

## Visual / aesthetic conventions

The look is deliberate. Don't drift from it without the user asking.

- **Fonts:** Fraunces (Google Fonts, display + body, italic variants used) and
  Space Mono (uppercase kickers and labels). Loaded via the `@import` in
  `globalCSS`.
- **Palette** (defined in `PALETTE`):
  - `cream #FFF4E2`, `milk #FFF9F0`, `espresso #3B2416`, `cocoa #6B4530`,
    `caramel #D4A13F`, `tomato #C85A4B`, `peach #E8856B`, `pistachio #A8C09A`
- **Shadows:** offset block shadows like `0 6px 0 ${PALETTE.espresso}`. These
  give the toy-like look. Avoid soft blurs on UI elements.
- **Borders:** 2.5px solid espresso is standard for cards and tiles.
- **Corners:** 12–22px rounded corners everywhere. Not sharp, not pill-shaped.
- **Motion:** spring curve `cubic-bezier(0.34, 1.56, 0.64, 1)` for most
  interactions. Avoid linear timing.
- **Text hierarchy:** italic Fraunces for titles, uppercase Space Mono with
  0.22em letter-spacing for "kicker" labels above headings.

## Common tasks

### Add a new recipe

1. Add an entry to `RECIPES` at the top of `App.jsx`. Key is
   `recipeKey('ingredient_a', 'ingredient_b')` (sorted pair).
2. If the recipe uses a new ingredient, add it to `INGREDIENTS` first.
3. If you want a profession to prefer this dish, add the dish name to their
   `dishes` array in `PROFESSIONS`.

No component changes. The Collection screen and customer spawner pick it up
automatically.

### Add a new level

Add an entry to `LEVEL_DEFINITIONS`. Fields: `id`, `name`, `prof` (array of
profession ids), `target` (orders to serve), `time` (seconds), `type`
(`'standard' | 'michelin' | 'royal'`).

### Change game balance

Key tunable constants, all in `App.jsx`:
- Celebrity spawn rate: `0.06` in `spawnCustomer`
- Customer base patience: `basePatience` calculation in `spawnCustomer`
- Combo reward curve: `comboMult = 1 + (newCombo - 1) * 0.15` in the drop
  handler
- Combo cap: `5` default, `8` with upgrade — `comboCap` state in `GameLoop`
- Cook time: `cookTime = upgradePrep ? 350 : 500` in the combine effect

### Deploy

See `built-project/cafe-rush/README.md` — full instructions for Vercel,
Netlify, and GitHub Pages. Vercel via GitHub is the recommended path.

## Things to avoid

- Don't add a state management library (Redux, Zustand). The prop-drilled
  `state` object is sufficient for this game's scope.
- Don't add routing (`react-router`). The screen switcher in `GameShell` is
  intentional and simpler.
- Don't replace Tailwind with styled-components or CSS-in-JS libraries.
- Don't introduce TypeScript unless the user asks — the project is plain JS.
- Don't swap the emoji character set for an icon/sprite system unless the
  user specifically requests it. Emojis are a known tradeoff.

## When in doubt

Match the patterns already in the file. The codebase has strong internal
consistency — if you're adding a new screen, copy the structure of an existing
screen. If you're adding a new card, copy an existing card.
