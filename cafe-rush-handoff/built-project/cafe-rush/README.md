# Career Café Rush ☕

A cozy café simulation game. Serve dishes to customers based on their profession,
chain combos, catch celebrity tippers, and climb through 12 levels plus a daily
challenge.

![preview](https://img.shields.io/badge/built_with-React_%2B_Vite-F29985)

---

## 🎮 Run it locally

You need [Node.js](https://nodejs.org) (any recent version — 18 or newer is fine).

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

To build a production bundle:

```bash
npm run build
```

The output goes to `dist/`. You can preview it with `npm run preview`.

---

## 🌐 Put it online for your friends

Pick one of these. All three are free and all three take about 5 minutes.
**Vercel is the easiest.**

### Option A — Vercel (recommended)

1. Push this folder to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cafe-rush.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com), sign in with GitHub.
3. Click **Add New → Project**, pick your `cafe-rush` repo.
4. Vercel auto-detects Vite. Just hit **Deploy**.
5. Done. You get a URL like `cafe-rush-xyz.vercel.app`. Share it with friends.

Every future `git push` auto-deploys.

### Option B — Netlify

1. Run `npm run build` locally.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag the `dist/` folder onto the page.
4. You get a URL immediately. (Sign up to claim/customize it.)

### Option C — GitHub Pages

1. Install: `npm install --save-dev gh-pages`
2. Add to `package.json`:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/cafe-rush",
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```
3. Also add `base: '/cafe-rush/'` to `vite.config.js`.
4. Run `npm run deploy`.

---

## 📱 Does it work on phones?

Yes — the drag-and-drop system is built on pointer events, so touch works.
Save progress is stored in the browser (localStorage), so each friend has their
own save on their own device.

---

## 🛠 What's in here

- **`src/App.jsx`** — the whole game (~2,300 lines, single file on purpose)
- **`src/main.jsx`** — React root
- **`src/index.css`** — Tailwind directives + body reset
- **`index.html`** — entry page with emoji favicon
- **`vite.config.js`**, **`tailwind.config.js`**, **`postcss.config.js`** — build tooling

### Features

- 8 professions, 14 recipes, 7 celebrity guests (2×–5× payouts)
- 3 modes: Freeplay, 12-level Campaign (Michelin + Royal challenges), Daily
- Recipe book collection with progression tracking
- Kitchen upgrades + 4 unlockable backgrounds with payout multipliers
- Combo system capped at x5 (x8 with upgrade)
- Web Audio synth music + SFX (toggle in settings or header)
- Golden chef badge when all 12 levels are cleared
- Save persists across browser sessions

### Customizing

All game data sits at the top of `App.jsx`:

- `INGREDIENTS` — add new ingredients
- `RECIPES` — add new 2-ingredient combos
- `PROFESSIONS` — add new customer types
- `CELEBRITIES` — add new rare VIPs
- `LEVEL_DEFINITIONS` — add levels, tweak targets/timers
- `UPGRADES`, `BACKGROUNDS` — add shop items

Everything is data-driven; the components don't need changes when you add content.

---

## 🔧 Troubleshooting

**"npm: command not found"** — Install Node.js from https://nodejs.org (the LTS version). That gives you `npm`.

**Blank page after deploy** — On GitHub Pages, make sure `base: '/repo-name/'` is set in `vite.config.js`. On Vercel/Netlify, no change needed.

**No sound** — Browsers block autoplay audio. Click the speaker icon in the header once to start music.

**Drag feels glitchy on mobile** — Make sure you added `touch-action: manipulation` to `body` (already set in `index.css`).

---

Made with love. Have fun running your café.
