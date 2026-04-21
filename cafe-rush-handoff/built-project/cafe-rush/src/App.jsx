import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChefHat, Coffee, Sparkles, Clock, Coins, Flame, Star, ArrowRight, X,
  RotateCcw, Play, Check, Lock, Trophy, Book, Settings as SettingsIcon,
  ChevronLeft, Crown, Zap, Home, Shuffle, Award, TrendingUp, Heart,
  Calendar, Volume2, VolumeX
} from 'lucide-react';

/* ==========================================================================
   PERSISTENCE — save progress to localStorage
   Handles Set serialization. Safe to call during SSR / when storage is blocked.
   -------------------------------------------------------------------------- */
const STORAGE_KEY = 'cafe-rush-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Revive any fields named like "*Set" or known Set fields back into Set objects
    const setFields = ['discovered', 'dishesServed', 'celebsMet', 'levelsCompleted', 'ownedUpgrades', 'ownedBackgrounds'];
    setFields.forEach((k) => {
      if (Array.isArray(parsed[k])) parsed[k] = new Set(parsed[k]);
    });
    return parsed;
  } catch { return {}; }
}

function writeSave(partial) {
  try {
    const current = loadSave();
    const merged = { ...current, ...partial };
    // Convert Sets to arrays for JSON
    const serializable = {};
    for (const [k, v] of Object.entries(merged)) {
      serializable[k] = v instanceof Set ? [...v] : v;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {}
}

function usePersistedState(key, initial) {
  const save = useRef(null);
  if (save.current === null) save.current = loadSave();

  const initValue = save.current[key] !== undefined ? save.current[key] : initial;
  const [val, setVal] = useState(initValue);

  // Write to localStorage whenever the value changes
  useEffect(() => {
    writeSave({ [key]: val });
  }, [key, val]);

  return [val, setVal];
}

function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/* ==========================================================================
   AUDIO ENGINE — Web Audio API (no libs)
   Produces a gentle café loop + SFX. Starts silent until user toggles on.
   -------------------------------------------------------------------------- */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let musicNodes = [];
  let musicOn = false;
  let sfxOn = true;

  const ensure = () => {
    if (ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(ctx.destination);
  };

  // Short, simple chord progression: C - Am - F - G (I vi IV V)
  // We schedule ~4s of chord pads + soft bell motif, then loop forever.
  const startMusic = () => {
    ensure();
    if (!ctx || musicOn) return;
    if (ctx.state === 'suspended') ctx.resume();
    musicOn = true;

    const bpm = 72;
    const beat = 60 / bpm;
    const chords = [
      [261.63, 329.63, 392.00], // C major
      [220.00, 261.63, 329.63], // A minor
      [174.61, 220.00, 261.63], // F major
      [196.00, 246.94, 293.66], // G major
    ];
    const bell = [523.25, 587.33, 659.25, 783.99]; // C5 D5 E5 G5

    const playChord = (freqs, t, dur) => {
      freqs.forEach((f) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.4);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + dur + 0.1);
        musicNodes.push(o, g);
      });
    };
    const playBell = (f, t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      o.connect(g); g.connect(masterGain);
      o.start(t); o.stop(t + 1.3);
      musicNodes.push(o, g);
    };

    const scheduleBar = (startT, idx) => {
      playChord(chords[idx % 4], startT, beat * 4);
      // sprinkle 2 bell notes per bar
      playBell(bell[(idx * 2) % 4], startT + beat * 1);
      playBell(bell[(idx * 2 + 1) % 4], startT + beat * 3);
    };

    let cursor = ctx.currentTime + 0.1;
    const loopBars = 64; // reschedule every ~3 min
    const schedule = () => {
      if (!musicOn) return;
      for (let i = 0; i < loopBars; i++) {
        scheduleBar(cursor + i * beat * 4, i);
      }
      cursor += loopBars * beat * 4;
      setTimeout(schedule, (loopBars * beat * 4 - 2) * 1000);
    };
    schedule();
  };

  const stopMusic = () => {
    musicOn = false;
    musicNodes.forEach((n) => { try { n.stop && n.stop(); n.disconnect && n.disconnect(); } catch {} });
    musicNodes = [];
  };

  const sfx = (kind) => {
    ensure();
    if (!ctx || !sfxOn) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    const ping = (freq, dur, type = 'sine', vol = 0.15) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(masterGain);
      o.start(t); o.stop(t + dur + 0.05);
    };

    switch (kind) {
      case 'pickup':  ping(660, 0.1, 'sine', 0.12); break;
      case 'combine': ping(523, 0.15, 'triangle'); setTimeout(() => ping(784, 0.18, 'triangle'), 80); break;
      case 'serve':   ping(659, 0.12, 'sine'); setTimeout(() => ping(988, 0.25, 'sine', 0.18), 90); break;
      case 'coin':    ping(1200, 0.08, 'square', 0.08); setTimeout(() => ping(1600, 0.08, 'square', 0.08), 60); break;
      case 'celeb':   ping(784, 0.2, 'triangle'); setTimeout(() => ping(1047, 0.2, 'triangle'), 120); setTimeout(() => ping(1319, 0.3, 'triangle'), 240); break;
      case 'bad':     ping(220, 0.2, 'sawtooth', 0.1); setTimeout(() => ping(175, 0.3, 'sawtooth', 0.1), 120); break;
      case 'timeup':  ping(330, 0.2, 'square', 0.1); setTimeout(() => ping(220, 0.4, 'square', 0.1), 180); break;
      case 'click':   ping(880, 0.04, 'sine', 0.08); break;
      default: break;
    }
  };

  return {
    setMusic: (on) => { if (on) startMusic(); else stopMusic(); },
    setSfx:   (on) => { sfxOn = on; },
    sfx,
    isMusicOn: () => musicOn,
  };
})();

/* ==========================================================================
   DRAG & DROP — pointer-based, works on touch + mouse
   Shared context. Any element can be a drag source or a drop target.
   -------------------------------------------------------------------------- */
const DragCtx = React.createContext(null);

function DragProvider({ children }) {
  const [dragging, setDragging] = useState(null); // {payload, x, y, w, h, visual}
  const dropTargets = useRef(new Map()); // id -> {rect, onDrop}
  const currentHover = useRef(null);

  const registerDrop = useCallback((id, getRect, onDrop) => {
    dropTargets.current.set(id, { getRect, onDrop });
    return () => dropTargets.current.delete(id);
  }, []);

  const startDrag = useCallback((payload, e, visual) => {
    const point = getPoint(e);
    setDragging({
      payload, x: point.x, y: point.y,
      visual,
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const move = (e) => {
      const p = getPoint(e);
      setDragging((d) => d ? { ...d, x: p.x, y: p.y } : d);

      // Find hovered drop target
      let hover = null;
      for (const [id, { getRect }] of dropTargets.current) {
        const r = getRect();
        if (!r) continue;
        if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
          hover = id;
          break;
        }
      }
      if (hover !== currentHover.current) {
        currentHover.current = hover;
        // notify via custom event for styling
        window.dispatchEvent(new CustomEvent('dragHover', { detail: hover }));
      }
      // Prevent scroll during touch drag
      if (e.cancelable) e.preventDefault();
    };

    const end = (e) => {
      const p = getPoint(e, true);
      // Find drop target under release point
      let dropped = false;
      for (const [, { getRect, onDrop }] of dropTargets.current) {
        const r = getRect();
        if (!r) continue;
        if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
          onDrop(dragging.payload);
          dropped = true;
          break;
        }
      }
      currentHover.current = null;
      window.dispatchEvent(new CustomEvent('dragHover', { detail: null }));
      setDragging(null);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [dragging]);

  return (
    <DragCtx.Provider value={{ startDrag, registerDrop, dragging }}>
      {children}
      {dragging && (
        <div style={{
          position: 'fixed',
          left: dragging.x, top: dragging.y,
          transform: 'translate(-50%, -50%) scale(1.15) rotate(-3deg)',
          pointerEvents: 'none',
          zIndex: 9999,
          filter: 'drop-shadow(0 12px 20px rgba(30,18,10,0.4))',
        }}>
          {dragging.visual}
        </div>
      )}
    </DragCtx.Provider>
  );
}

function getPoint(e, useChanged) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function useDraggable({ enabled = true, payload, visual }) {
  const { startDrag, dragging } = React.useContext(DragCtx);
  const ref = useRef(null);

  const onPointerDown = (e) => {
    if (!enabled) return;
    // Prevent text selection / scroll
    if (e.cancelable) e.preventDefault();
    startDrag(payload, e, visual);
  };

  return {
    ref,
    draggingSelf: dragging?.payload === payload,
    dragHandlers: {
      onMouseDown: onPointerDown,
      onTouchStart: onPointerDown,
      style: { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' },
    },
  };
}

function useDroppable({ id, onDrop }) {
  const { registerDrop } = React.useContext(DragCtx);
  const ref = useRef(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const getRect = () => ref.current?.getBoundingClientRect();
    return registerDrop(id, getRect, onDrop);
  }, [id, onDrop, registerDrop]);

  useEffect(() => {
    const h = (e) => setHovering(e.detail === id);
    window.addEventListener('dragHover', h);
    return () => window.removeEventListener('dragHover', h);
  }, [id]);

  return { ref, hovering };
}

/* ==========================================================================
   DAILY CHALLENGE — seeded by UTC date
   -------------------------------------------------------------------------- */
function getTodaySeed() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function getDailyChallenge() {
  const seed = getTodaySeed();
  const rng = seededRng(seed);
  const profIds = Object.keys(PROFESSIONS);
  const picked = [];
  const pool = [...profIds];
  const count = 3 + Math.floor(rng() * 2); // 3 or 4 professions
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  const target = 8 + Math.floor(rng() * 5); // 8–12
  const time   = 150 + Math.floor(rng() * 60); // 150–210s
  const names = ['The Gauntlet', 'Power Hour', 'Triple Threat', 'Lunch Crunch', 'Fresh Blend', 'High Noon'];
  const name = names[seed % names.length];
  return { id: 'daily_' + seed, seed, name, prof: picked, target, time, type: 'daily' };
}


const INGREDIENTS = {
  sugar:      { name: 'Sugar',      emoji: '🍬', color: '#F9D5E5' },
  flour:      { name: 'Flour',      emoji: '🌾', color: '#FFF4D6' },
  bread:      { name: 'Bread',      emoji: '🍞', color: '#E8C9A0' },
  filling:    { name: 'Filling',    emoji: '🥓', color: '#E8A29A' },
  noodles:    { name: 'Noodles',    emoji: '🍝', color: '#FFE8B8' },
  sauce:      { name: 'Sauce',      emoji: '🍅', color: '#F29985' },
  broth:      { name: 'Broth',      emoji: '🥣', color: '#F0C988' },
  vegetables: { name: 'Veggies',    emoji: '🥕', color: '#FFC08A' },
  apple:      { name: 'Apple',      emoji: '🍎', color: '#E88A85' },
  dough:      { name: 'Dough',      emoji: '🥟', color: '#F4E2C4' },
  beans:      { name: 'Beans',      emoji: '🫘', color: '#C9A27E' },
  water:      { name: 'Water',      emoji: '💧', color: '#B8D8E8' },
  lettuce:    { name: 'Lettuce',    emoji: '🥬', color: '#B8DBA8' },
  dressing:   { name: 'Dressing',   emoji: '🫙', color: '#F0D890' },
  herbs:      { name: 'Herbs',      emoji: '🌿', color: '#A8C09A' },
  fruit:      { name: 'Fruit',      emoji: '🍓', color: '#F28A9A' },
  bowl:       { name: 'Bowl',       emoji: '🥥', color: '#D4B896' },
  milk:       { name: 'Milk',       emoji: '🥛', color: '#F5F1E8' },
  butter:     { name: 'Butter',     emoji: '🧈', color: '#F9E4A3' },
  meat:       { name: 'Meat',       emoji: '🥩', color: '#D68A85' },
  seasoning:  { name: 'Seasoning',  emoji: '🧂', color: '#E8D8C4' },
  eggs:       { name: 'Eggs',       emoji: '🥚', color: '#F8E8B8' },
};

/* ---------------------- DATA: RECIPES ---------------------- */
// key is a sorted ingredient pair "a+b"
const recipeKey = (a, b) => [a, b].sort().join('+');
const RECIPES = {
  [recipeKey('sugar','flour')]:      { name: 'Donut',      emoji: '🍩', reward: 12 },
  [recipeKey('bread','filling')]:    { name: 'Sandwich',   emoji: '🥪', reward: 14 },
  [recipeKey('noodles','sauce')]:    { name: 'Spaghetti',  emoji: '🍝', reward: 18 },
  [recipeKey('broth','vegetables')]: { name: 'Soup',       emoji: '🍲', reward: 15 },
  [recipeKey('apple','dough')]:      { name: 'Apple Pie',  emoji: '🥧', reward: 16 },
  [recipeKey('beans','water')]:      { name: 'Coffee',     emoji: '☕', reward: 10 },
  [recipeKey('lettuce','dressing')]: { name: 'Salad',      emoji: '🥗', reward: 13 },
  [recipeKey('herbs','water')]:      { name: 'Tea',        emoji: '🍵', reward: 9 },
  [recipeKey('fruit','bowl')]:       { name: 'Fruit Bowl', emoji: '🍇', reward: 14 },
  [recipeKey('fruit','milk')]:       { name: 'Smoothie',   emoji: '🥤', reward: 15 },
  [recipeKey('bread','butter')]:     { name: 'Toast',      emoji: '🍞', reward: 11 },
  [recipeKey('meat','seasoning')]:   { name: 'Steak',      emoji: '🥩', reward: 22 },
  [recipeKey('flour','eggs')]:       { name: 'Pancakes',   emoji: '🥞', reward: 16 },
  [recipeKey('fruit','water')]:      { name: 'Juice',      emoji: '🧃', reward: 12 },
};
const getRecipe = (a, b) => RECIPES[recipeKey(a, b)];
const findDishByName = (name) => Object.values(RECIPES).find((r) => r.name === name);

/* ---------------------- DATA: PROFESSIONS ---------------------- */
const PROFESSIONS = {
  police:       { name: 'Police Officer', emoji: '👮', dishes: ['Donut', 'Sandwich'],    color: '#6B8EB8' },
  firefighter:  { name: 'Firefighter',    emoji: '🧑‍🚒', dishes: ['Spaghetti', 'Soup'],   color: '#D96B4A' },
  teacher:      { name: 'Teacher',        emoji: '🧑‍🏫', dishes: ['Apple Pie', 'Coffee'], color: '#B87A6B' },
  nurse:        { name: 'Nurse',          emoji: '🧑‍⚕️', dishes: ['Salad', 'Tea'],        color: '#8AB8A8' },
  zookeeper:    { name: 'Zookeeper',      emoji: '🧑‍🌾', dishes: ['Fruit Bowl', 'Smoothie'], color: '#A8B86B' },
  writer:       { name: 'Writer',         emoji: '✍️',    dishes: ['Toast', 'Tea'],       color: '#A89080' },
  manager:      { name: 'Manager',        emoji: '💼',    dishes: ['Steak', 'Coffee'],    color: '#6B6B8A' },
  photographer: { name: 'Photographer',   emoji: '📷',    dishes: ['Pancakes', 'Juice'],  color: '#D89A5A' },
};

/* ---------------------- DATA: CELEBRITIES ---------------------- */
const CELEBRITIES = [
  { name: 'L. Bronze',   emoji: '🏀', dish: 'Smoothie', tier: 'rare',    mult: 2, tagline: 'MVP' },
  { name: 'M. Jordon',   emoji: '👟', dish: 'Steak',    tier: 'rare',    mult: 2, tagline: 'GOAT' },
  { name: 'M. Felps',    emoji: '🏊', dish: 'Pancakes', tier: 'rare',    mult: 3, tagline: 'Gold Medalist' },
  { name: 'M. Jaxon',    emoji: '🕺', dish: 'Soup',     tier: 'epic',    mult: 3, tagline: 'Moonwalker' },
  { name: 'Tayla S.',    emoji: '🎤', dish: 'Apple Pie', tier: 'epic',    mult: 4, tagline: 'Pop Royalty' },
  { name: 'Leo D.',      emoji: '🎬', dish: 'Steak',    tier: 'epic',    mult: 4, tagline: 'Oscar Winner' },
  { name: 'E. Muskrat',  emoji: '🚀', dish: 'Coffee',   tier: 'legend',  mult: 5, tagline: 'Tech Mogul' },
];

/* ---------------------- DATA: LEVELS ---------------------- */
// Every 5th level is a "challenge" — Michelin or Royal variant.
const LEVEL_DEFINITIONS = [
  { id: 1,  name: 'Police Station',   prof: ['police'],                          target: 4, time: 120, type: 'standard' },
  { id: 2,  name: 'Fire Hall',        prof: ['firefighter'],                     target: 5, time: 120, type: 'standard' },
  { id: 3,  name: 'Schoolyard',       prof: ['police','teacher'],                target: 6, time: 140, type: 'standard' },
  { id: 4,  name: 'Downtown Clinic',  prof: ['nurse','teacher'],                 target: 6, time: 140, type: 'standard' },
  { id: 5,  name: 'Michelin Bistro',  prof: ['manager','writer','teacher'],      target: 7, time: 110, type: 'michelin' },
  { id: 6,  name: 'City Zoo',         prof: ['zookeeper','photographer'],        target: 7, time: 150, type: 'standard' },
  { id: 7,  name: 'Newsroom',         prof: ['writer','photographer','manager'], target: 8, time: 150, type: 'standard' },
  { id: 8,  name: 'Corporate HQ',     prof: ['manager','writer'],                target: 8, time: 140, type: 'standard' },
  { id: 9,  name: 'Hospital Ward',    prof: ['nurse','manager','teacher'],       target: 9, time: 160, type: 'standard' },
  { id: 10, name: 'Royal Cuisine',    prof: ['manager','teacher','writer','nurse'], target: 9, time: 120, type: 'royal' },
  { id: 11, name: 'The Marathon',     prof: Object.keys(PROFESSIONS),            target: 10, time: 180, type: 'standard' },
  { id: 12, name: 'Press Gala',       prof: ['writer','photographer','manager','teacher'], target: 11, time: 170, type: 'standard' },
];

/* ---------------------- DATA: UPGRADES ---------------------- */
const UPGRADES = {
  prep_speed:   { name: 'Faster Prep',      desc: 'Dishes cook 30% faster',         cost: 80,  icon: Zap },
  patience:     { name: 'Patient Guests',   desc: '+15 sec per customer',           cost: 120, icon: Heart },
  combo_boost:  { name: 'Combo Master',     desc: 'Combos cap at x8 instead of x5', cost: 180, icon: Flame },
};
const BACKGROUNDS = {
  cozy:      { name: 'Cozy Café',    cost: 0,   mult: 1.0, swatch: ['#FFF4E2','#D4A13F'], unlocked: true },
  brick:     { name: 'Brick Loft',   cost: 100, mult: 1.1, swatch: ['#E8B8A0','#8B4A3C'] },
  garden:    { name: 'Rose Garden',  cost: 200, mult: 1.2, swatch: ['#F5D5D8','#C07080'] },
  midnight:  { name: 'Night Diner',  cost: 400, mult: 1.35, swatch: ['#3A3250','#D4A13F'] },
};

/* ============================================================
   ROOT APP — screen router + global save-like state
   ============================================================ */
export default function CareerCafeRush() {
  return (
    <DragProvider>
      <GameShell />
    </DragProvider>
  );
}

function GameShell() {
  const [screen, setScreen] = useState('menu'); // menu | freeplay | level | daily | collection | settings | upgrades
  const [pendingLevel, setPendingLevel] = useState(1);

  // Persistent state — auto-saves to localStorage
  const [money, setMoney] = usePersistedState('money', 50);
  const [discovered, setDiscovered] = usePersistedState('discovered', new Set());
  const [dishesServed, setDishesServed] = usePersistedState('dishesServed', new Set());
  const [celebsMet, setCelebsMet] = usePersistedState('celebsMet', new Set());
  const [levelsCompleted, setLevelsCompleted] = usePersistedState('levelsCompleted', new Set());
  const [ownedUpgrades, setOwnedUpgrades] = usePersistedState('ownedUpgrades', new Set());
  const [ownedBackgrounds, setOwnedBackgrounds] = usePersistedState('ownedBackgrounds', new Set(['cozy']));
  const [activeBackground, setActiveBackground] = usePersistedState('activeBackground', 'cozy');
  const [tutorialDone, setTutorialDone] = usePersistedState('tutorialDone', false);
  const [totalServed, setTotalServed] = usePersistedState('totalServed', 0);
  const [bestCombo, setBestCombo] = usePersistedState('bestCombo', 0);

  // Audio prefs (also persisted)
  const [musicOn, setMusicOn] = usePersistedState('musicOn', false);
  const [sfxOn, setSfxOn]     = usePersistedState('sfxOn', true);
  useEffect(() => { AudioEngine.setMusic(musicOn); }, [musicOn]);
  useEffect(() => { AudioEngine.setSfx(sfxOn); }, [sfxOn]);

  // Daily challenge completion tracking
  const [dailyCompletedOn, setDailyCompletedOn] = usePersistedState('dailyCompletedOn', null);
  const todayChallenge = useMemo(() => getDailyChallenge(), []);
  const dailyDone = dailyCompletedOn === todayChallenge.seed;

  const allLevelsDone = levelsCompleted.size >= LEVEL_DEFINITIONS.length;
  const profileGold = allLevelsDone;

  const state = {
    money, setMoney,
    discovered, setDiscovered,
    dishesServed, setDishesServed,
    celebsMet, setCelebsMet,
    levelsCompleted, setLevelsCompleted,
    ownedUpgrades, setOwnedUpgrades,
    ownedBackgrounds, setOwnedBackgrounds,
    activeBackground, setActiveBackground,
    tutorialDone, setTutorialDone,
    totalServed, setTotalServed,
    bestCombo, setBestCombo,
    profileGold,
    musicOn, setMusicOn,
    sfxOn, setSfxOn,
    dailyCompletedOn, setDailyCompletedOn,
    todayChallenge, dailyDone,
  };

  const resetProgress = () => {
    clearSave();
    setMoney(50);
    setDiscovered(new Set());
    setDishesServed(new Set());
    setCelebsMet(new Set());
    setLevelsCompleted(new Set());
    setOwnedUpgrades(new Set());
    setOwnedBackgrounds(new Set(['cozy']));
    setActiveBackground('cozy');
    setTutorialDone(false);
    setTotalServed(0);
    setBestCombo(0);
    setDailyCompletedOn(null);
  };

  return (
    <div style={rootStyle(activeBackground)}>
      <style>{globalCSS}</style>
      <div style={bgAmbient(activeBackground)} />
      <div style={bgGrain} />

      {screen === 'menu' && (
        <MainMenu state={state} setScreen={setScreen} setPendingLevel={setPendingLevel} />
      )}
      {screen === 'freeplay' && (
        <GameLoop mode="freeplay" state={state} onExit={() => setScreen('menu')} />
      )}
      {screen === 'level' && (
        <GameLoop mode="level" levelId={pendingLevel} state={state}
          onExit={() => setScreen('menu')}
          onComplete={(id) => setLevelsCompleted((prev) => new Set([...prev, id]))}
        />
      )}
      {screen === 'daily' && (
        <GameLoop mode="daily" dailyDef={todayChallenge} state={state}
          onExit={() => setScreen('menu')}
          onComplete={() => setDailyCompletedOn(todayChallenge.seed)}
        />
      )}
      {screen === 'levels' && (
        <LevelSelect state={state} onBack={() => setScreen('menu')}
          onPick={(id) => { setPendingLevel(id); setScreen('level'); }} />
      )}
      {screen === 'collection' && (
        <Collection state={state} onBack={() => setScreen('menu')} />
      )}
      {screen === 'upgrades' && (
        <UpgradesShop state={state} onBack={() => setScreen('menu')} />
      )}
      {screen === 'settings' && (
        <SettingsScreen state={state} onBack={() => setScreen('menu')} onReset={resetProgress} />
      )}
      {screen === 'mode' && (
        <ModeSelect state={state} setScreen={setScreen} />
      )}
    </div>
  );
}

/* ============================================================
   MAIN MENU
   ============================================================ */
function MainMenu({ state, setScreen, setPendingLevel }) {
  const { money, profileGold, levelsCompleted, discovered } = state;

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', padding: '48px 32px 32px' }}>
      {/* HUD top */}
      <div className="flex items-center justify-between max-w-[1200px] mx-auto mb-12">
        <ProfileBadge gold={profileGold} levels={levelsCompleted.size} discovered={discovered.size} />
        <div className="flex items-center gap-3">
          <Chip icon={<Coins size={14} strokeWidth={2.5} />} label="Coins" value={money} tint={PALETTE.caramel} />
          <IconBtn onClick={() => state.setMusicOn(!state.musicOn)} aria-label="Toggle music">
            {state.musicOn
              ? <Volume2 size={18} strokeWidth={2.5} color={PALETTE.espresso} />
              : <VolumeX size={18} strokeWidth={2.5} color={PALETTE.cocoa} />}
          </IconBtn>
          <IconBtn onClick={() => setScreen('settings')} aria-label="Settings"><SettingsIcon size={18} strokeWidth={2.5} color={PALETTE.espresso} /></IconBtn>
        </div>
      </div>

      {/* Title block */}
      <div style={{ textAlign: 'center', maxWidth: 900, margin: '0 auto', padding: '20px 0 40px' }}>
        <div style={{ ...styles.kicker, color: PALETTE.tomato, marginBottom: 12 }}>
          ★  A Cooking Adventure  ★
        </div>
        <h1 style={styles.megaTitle}>
          <span style={{ color: PALETTE.espresso }}>Career</span>{' '}
          <span style={{ color: PALETTE.tomato, fontStyle: 'italic' }}>Café</span>{' '}
          <span style={{ color: PALETTE.caramel }}>Rush</span>
        </h1>
        <div style={{ ...styles.subtitle, marginTop: 16 }}>
          Serve every profession in town — from cops on donut duty to celebrity chefs
        </div>
      </div>

      {/* Main nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 max-w-[1200px] mx-auto">
        <MenuCard
          label="Play"
          title="Freeplay"
          desc="No timer. Explore and discover."
          icon={<Play size={28} strokeWidth={2.5} />}
          tint={PALETTE.pistachio}
          onClick={() => { AudioEngine.sfx('click'); setScreen('freeplay'); }}
        />
        <MenuCard
          label="Levels"
          title="Challenges"
          desc="12 stages. Every 5th is elite."
          icon={<Trophy size={28} strokeWidth={2.5} />}
          tint={PALETTE.caramel}
          onClick={() => { AudioEngine.sfx('click'); setScreen('levels'); }}
          badge={`${state.levelsCompleted.size}/${LEVEL_DEFINITIONS.length}`}
        />
        <MenuCard
          label="Daily"
          title={state.todayChallenge.name}
          desc={state.dailyDone ? 'Come back tomorrow!' : 'New challenge every 24 hrs.'}
          icon={<Calendar size={28} strokeWidth={2.5} />}
          tint={PALETTE.tomato}
          onClick={() => { AudioEngine.sfx('click'); setScreen('daily'); }}
          badge={state.dailyDone ? '✓' : 'NEW'}
          disabled={state.dailyDone}
        />
        <MenuCard
          label="Book"
          title="Collection"
          desc="Recipes and professions."
          icon={<Book size={28} strokeWidth={2.5} />}
          tint={PALETTE.peach}
          onClick={() => { AudioEngine.sfx('click'); setScreen('collection'); }}
          badge={`${state.discovered.size}/${Object.keys(PROFESSIONS).length}`}
        />
        <MenuCard
          label="Shop"
          title="Upgrades"
          desc="Kitchen perks & backgrounds."
          icon={<TrendingUp size={28} strokeWidth={2.5} />}
          tint="#C89ABF"
          onClick={() => { AudioEngine.sfx('click'); setScreen('upgrades'); }}
        />
      </div>

      {/* Footer ribbon */}
      <div style={styles.footerRibbon}>
        <span>★</span> Drag to prep <span>★</span> Serve before time <span>★</span> Build combos <span>★</span>
      </div>
    </div>
  );
}

/* ============================================================
   MENU CARD
   ============================================================ */
function MenuCard({ label, title, desc, icon, tint, onClick, badge, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles.menuCard,
      opacity: disabled ? 0.55 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
      className={disabled ? '' : 'hover-lift transition-all active:translate-y-[2px] active:shadow-none'}>
      <div style={{ ...styles.menuIcon, background: tint }}>{icon}</div>
      <div style={{ ...styles.kicker, color: PALETTE.tomato }}>{label}</div>
      <div style={styles.menuTitle}>{title}</div>
      <div style={styles.menuDesc}>{desc}</div>
      {badge && <div style={styles.menuBadge}>{badge}</div>}
    </button>
  );
}

/* ============================================================
   LEVEL SELECT
   ============================================================ */
function LevelSelect({ state, onBack, onPick }) {
  const { levelsCompleted } = state;
  return (
    <ScreenShell title="Levels" subtitle="Every 5th stage is a challenge" onBack={onBack}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[1100px] mx-auto pb-10">
        {LEVEL_DEFINITIONS.map((lvl, i) => {
          const unlocked = i === 0 || levelsCompleted.has(LEVEL_DEFINITIONS[i - 1].id);
          const done = levelsCompleted.has(lvl.id);
          return (
            <button
              key={lvl.id}
              disabled={!unlocked}
              onClick={() => onPick(lvl.id)}
              style={{
                ...styles.levelCard,
                background: levelBg(lvl.type),
                opacity: unlocked ? 1 : 0.45,
                filter: unlocked ? 'none' : 'saturate(0.5)',
                cursor: unlocked ? 'pointer' : 'not-allowed',
              }}
              className={unlocked ? 'hover-lift active:translate-y-[2px]' : ''}
            >
              <div className="flex items-start justify-between mb-2">
                <div style={{ ...styles.kicker, color: levelAccent(lvl.type) }}>
                  Level {lvl.id} · {lvl.type === 'michelin' ? '★ Michelin' : lvl.type === 'royal' ? '♛ Royal' : 'Standard'}
                </div>
                {done && <div style={styles.completedTag}><Check size={10} strokeWidth={3} /> Done</div>}
                {!unlocked && <Lock size={16} strokeWidth={2.5} color={PALETTE.cocoa} />}
              </div>
              <div style={styles.levelTitle}>{lvl.name}</div>
              <div style={styles.levelMeta}>
                {lvl.prof.map((p) => PROFESSIONS[p].emoji).join(' ')}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <MiniStat icon={<Clock size={11} strokeWidth={2.5} />} val={`${Math.floor(lvl.time/60)}:${String(lvl.time%60).padStart(2,'0')}`} />
                <MiniStat icon={<Star size={11} strokeWidth={2.5} />} val={`Serve ${lvl.target}`} />
              </div>
            </button>
          );
        })}
      </div>
    </ScreenShell>
  );
}

/* ============================================================
   COLLECTION — recipe book
   ============================================================ */
function Collection({ state, onBack }) {
  const { discovered, dishesServed, celebsMet, totalServed, bestCombo } = state;
  const [selected, setSelected] = useState(null);

  return (
    <ScreenShell title="Recipe Book" subtitle="Every profession and dish you've met" onBack={onBack}>
      <div className="max-w-[1100px] mx-auto pb-10">
        {/* stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Professions" val={`${discovered.size} / ${Object.keys(PROFESSIONS).length}`} />
          <StatCard label="Dishes" val={`${dishesServed.size} / ${Object.keys(RECIPES).length}`} />
          <StatCard label="Celebrities" val={`${celebsMet.size} / ${CELEBRITIES.length}`} />
          <StatCard label="Best Combo" val={`x${bestCombo}`} />
        </div>

        {/* professions grid */}
        <div style={{ ...styles.kicker, color: PALETTE.cocoa, marginBottom: 10 }}>Professions</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Object.entries(PROFESSIONS).map(([id, p]) => {
            const unlocked = discovered.has(id);
            return (
              <button
                key={id}
                onClick={() => unlocked && setSelected(id)}
                style={{
                  ...styles.profCard,
                  borderColor: unlocked ? PALETTE.espresso : PALETTE.cocoa + '60',
                  opacity: unlocked ? 1 : 0.4,
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                }}
                className={unlocked ? 'hover-lift' : ''}
              >
                <div style={{ fontSize: 44, lineHeight: 1 }}>{unlocked ? p.emoji : '❓'}</div>
                <div style={styles.profName}>{unlocked ? p.name : '????'}</div>
                {!unlocked && <Lock size={12} strokeWidth={2.5} color={PALETTE.cocoa} />}
              </button>
            );
          })}
        </div>

        {/* celebrities */}
        <div style={{ ...styles.kicker, color: PALETTE.cocoa, marginBottom: 10 }}>Celebrity Sightings</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {CELEBRITIES.map((c) => {
            const met = celebsMet.has(c.name);
            return (
              <div key={c.name} style={{
                ...styles.celebCard,
                borderColor: met ? tierColor(c.tier) : PALETTE.cocoa + '40',
                opacity: met ? 1 : 0.45,
              }}>
                <div style={{ fontSize: 30 }}>{met ? c.emoji : '👤'}</div>
                <div style={styles.celebName}>{met ? c.name : '???'}</div>
                <div style={{ ...styles.kicker, color: tierColor(c.tier), fontSize: 8 }}>
                  {met ? `${c.tier} · ${c.mult}x` : c.tier}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <ProfessionDetail prof={PROFESSIONS[selected]} profId={selected} onClose={() => setSelected(null)} />
      )}
    </ScreenShell>
  );
}

function ProfessionDetail({ prof, onClose }) {
  return (
    <div style={styles.modalScrim} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} className="animate-[popCard_380ms_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div style={{ ...styles.kicker, color: PALETTE.tomato }}>Profession</div>
            <div style={styles.modalTitle}>{prof.emoji} {prof.name}</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} strokeWidth={2.5} /></button>
        </div>
        <div style={{ ...styles.kicker, color: PALETTE.cocoa, marginBottom: 8 }}>Preferred Dishes</div>
        {prof.dishes.map((dishName) => {
          const dish = findDishByName(dishName);
          const pair = Object.entries(RECIPES).find(([, r]) => r.name === dishName)[0].split('+');
          return (
            <div key={dishName} style={styles.recipeRow}>
              <div style={{ fontSize: 30 }}>{dish.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso }}>{dish.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={styles.ingPill}>{INGREDIENTS[pair[0]].emoji} {INGREDIENTS[pair[0]].name}</span>
                  <span style={{ color: PALETTE.tomato, fontWeight: 800 }}>+</span>
                  <span style={styles.ingPill}>{INGREDIENTS[pair[1]].emoji} {INGREDIENTS[pair[1]].name}</span>
                </div>
              </div>
              <div style={styles.rewardTag}><Coins size={10} strokeWidth={2.5} /> {dish.reward}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   UPGRADES SHOP
   ============================================================ */
function UpgradesShop({ state, onBack }) {
  const { money, setMoney, ownedUpgrades, setOwnedUpgrades, ownedBackgrounds, setOwnedBackgrounds, activeBackground, setActiveBackground } = state;

  const buyUpgrade = (id) => {
    const u = UPGRADES[id];
    if (money < u.cost || ownedUpgrades.has(id)) return;
    setMoney(money - u.cost);
    setOwnedUpgrades(new Set([...ownedUpgrades, id]));
  };
  const buyBg = (id) => {
    const b = BACKGROUNDS[id];
    if (ownedBackgrounds.has(id)) { setActiveBackground(id); return; }
    if (money < b.cost) return;
    setMoney(money - b.cost);
    setOwnedBackgrounds(new Set([...ownedBackgrounds, id]));
    setActiveBackground(id);
  };

  return (
    <ScreenShell title="Upgrades" subtitle="Invest coins back into your café" onBack={onBack} rightHud={
      <Chip icon={<Coins size={14} strokeWidth={2.5} />} label="Coins" value={money} tint={PALETTE.caramel} />
    }>
      <div className="max-w-[1000px] mx-auto pb-10">
        <div style={{ ...styles.kicker, color: PALETTE.cocoa, marginBottom: 10 }}>Kitchen Perks</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {Object.entries(UPGRADES).map(([id, u]) => {
            const owned = ownedUpgrades.has(id);
            const afford = money >= u.cost;
            const Icon = u.icon;
            return (
              <div key={id} style={styles.shopCard}>
                <div style={{ ...styles.shopIcon, background: owned ? PALETTE.pistachio : PALETTE.cream }}>
                  <Icon size={24} strokeWidth={2.5} color={PALETTE.espresso} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso, marginTop: 12 }}>{u.name}</div>
                <div style={{ fontSize: 13, color: PALETTE.cocoa, marginTop: 4, lineHeight: 1.5 }}>{u.desc}</div>
                <button
                  onClick={() => buyUpgrade(id)}
                  disabled={owned || !afford}
                  style={{
                    ...styles.buyBtn,
                    background: owned ? PALETTE.pistachio : afford ? PALETTE.tomato : PALETTE.cream,
                    color: owned || afford ? PALETTE.milk : PALETTE.cocoa,
                    cursor: owned ? 'default' : afford ? 'pointer' : 'not-allowed',
                  }}
                >
                  {owned ? <><Check size={14} strokeWidth={3} /> Owned</> : <><Coins size={14} strokeWidth={2.5} /> {u.cost}</>}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ ...styles.kicker, color: PALETTE.cocoa, marginBottom: 10 }}>Backgrounds (apply a money multiplier)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(BACKGROUNDS).map(([id, b]) => {
            const owned = ownedBackgrounds.has(id);
            const active = activeBackground === id;
            const afford = money >= b.cost;
            return (
              <button
                key={id}
                onClick={() => buyBg(id)}
                disabled={!owned && !afford}
                style={{
                  ...styles.bgCard,
                  background: `linear-gradient(135deg, ${b.swatch[0]}, ${b.swatch[1]})`,
                  borderColor: active ? PALETTE.tomato : PALETTE.espresso,
                  boxShadow: active ? `0 6px 0 ${PALETTE.tomato}` : `0 6px 0 ${PALETTE.espresso}`,
                  cursor: owned || afford ? 'pointer' : 'not-allowed',
                  opacity: !owned && !afford ? 0.5 : 1,
                }}
                className="hover-lift"
              >
                <div style={{ fontSize: 15, fontWeight: 800, fontStyle: 'italic', color: PALETTE.milk, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {b.name}
                </div>
                <div style={{ ...styles.kicker, color: PALETTE.milk, fontSize: 9, marginTop: 4 }}>
                  {b.mult}x payout
                </div>
                <div style={styles.bgStatus}>
                  {active ? 'ACTIVE' : owned ? 'OWNED' : `${b.cost} coins`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ScreenShell>
  );
}

/* ============================================================
   SETTINGS
   ============================================================ */
function SettingsScreen({ state, onBack, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <ScreenShell title="Settings" subtitle="Tune your café" onBack={onBack}>
      <div className="max-w-[600px] mx-auto pb-10">
        <div style={styles.settingsPanel}>
          <SettingsRow title="Music" sub="Ambient café loop"
            control={<ToggleButton on={state.musicOn} onChange={() => state.setMusicOn(!state.musicOn)} />} />
          <SettingsRow title="Sound effects" sub="Ding, coin, celebrity chime"
            control={<ToggleButton on={state.sfxOn} onChange={() => state.setSfxOn(!state.sfxOn)} />} />
          <SettingsRow title="Replay Tutorial" sub="See the intro walkthrough again"
            control={<button style={styles.smallBtn} onClick={() => state.setTutorialDone(false)}><RotateCcw size={12} strokeWidth={2.5} /> Replay</button>} />
          <SettingsRow title="Reset Progress" sub="Wipes money, levels, and collection"
            control={
              confirmReset
                ? <button style={{ ...styles.smallBtn, background: PALETTE.tomato, color: PALETTE.milk }}
                    onClick={() => { onReset(); setConfirmReset(false); }}>Confirm</button>
                : <button style={styles.smallBtn} onClick={() => setConfirmReset(true)}>Reset</button>
            } />
        </div>
        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: '"Space Mono", monospace', fontSize: 10, letterSpacing: '0.2em', color: PALETTE.cocoa, textTransform: 'uppercase' }}>
          Career Café Rush · v1.1 · Made with love
        </div>
      </div>
    </ScreenShell>
  );
}

function ToggleButton({ on, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 48, height: 26, borderRadius: 99,
        background: on ? PALETTE.pistachio : PALETTE.cream,
        border: `2px solid ${PALETTE.espresso}`, position: 'relative',
        cursor: 'pointer', padding: 0,
        boxShadow: `0 2px 0 ${PALETTE.espresso}`,
      }}
      aria-pressed={on}
    >
      <div style={{
        position: 'absolute', top: 1,
        left: on ? 24 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: PALETTE.milk, border: `1.5px solid ${PALETTE.espresso}`,
        transition: 'left 220ms cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </button>
  );
}

/* ============================================================
   GAME LOOP — the actual playable screen
   ============================================================ */
function GameLoop({ mode, levelId, dailyDef, state, onExit, onComplete }) {
  // Resolve the session "level" — regular level, or daily synthetic level
  const level = useMemo(() => {
    if (mode === 'level') return LEVEL_DEFINITIONS.find((l) => l.id === levelId);
    if (mode === 'daily') return dailyDef;
    return null;
  }, [mode, levelId, dailyDef]);

  // --- session state
  const [money, setMoney] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboCap] = useState(state.ownedUpgrades.has('combo_boost') ? 8 : 5);
  const [served, setServed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level ? level.time : null);
  const [sessionActive, setSessionActive] = useState(true);
  const [outcome, setOutcome] = useState(null); // null | 'won' | 'lost'
  const [showTutorial, setShowTutorial] = useState(!state.tutorialDone);

  // Refs mirror state so the timer/spawner closures can read current values
  const moneyRef = useRef(money);   useEffect(() => { moneyRef.current = money; }, [money]);
  const servedRef = useRef(served); useEffect(() => { servedRef.current = served; }, [served]);
  const comboRef = useRef(combo);   useEffect(() => { comboRef.current = combo; }, [combo]);

  // --- station state
  const [plate, setPlate] = useState([]); // [{id, ...}]
  const [completedDish, setCompletedDish] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [floatingCoins, setFloatingCoins] = useState([]);
  const [toast, setToast] = useState(null); // {kind, text}

  const upgradePatience = state.ownedUpgrades.has('patience');
  const upgradePrep     = state.ownedUpgrades.has('prep_speed');
  const bgMult          = BACKGROUNDS[state.activeBackground].mult;

  // allowed professions
  const allowedProfs = useMemo(() => {
    return level ? level.prof : Object.keys(PROFESSIONS);
  }, [level]);

  // active ingredients = union of all ingredients needed for allowed professions' dishes
  const activeIngredients = useMemo(() => {
    const set = new Set();
    allowedProfs.forEach((pid) => {
      PROFESSIONS[pid].dishes.forEach((dishName) => {
        const entry = Object.entries(RECIPES).find(([, r]) => r.name === dishName);
        entry[0].split('+').forEach((ing) => set.add(ing));
      });
    });
    return [...set];
  }, [allowedProfs]);

  // --- customer spawning
  const spawnCustomer = useCallback(() => {
    setCustomers((prev) => {
      if (prev.length >= 3) return prev;
      const id = Math.random().toString(36).slice(2, 9);

      // 6% chance for celebrity
      const isCeleb = Math.random() < 0.06;
      if (isCeleb) {
        const celeb = CELEBRITIES[Math.floor(Math.random() * CELEBRITIES.length)];
        // celebrity only if their dish is available in this level
        const dishAvail = allowedProfs.some((pid) => PROFESSIONS[pid].dishes.includes(celeb.dish));
        if (dishAvail) {
          const patience = (upgradePatience ? 55 : 40) + Math.floor(Math.random() * 10);
          return [...prev, {
            id, isCeleb: true, celeb,
            emoji: celeb.emoji, name: celeb.name,
            dishName: celeb.dish, tagline: celeb.tagline,
            mult: celeb.mult, tier: celeb.tier,
            patience, patienceMax: patience,
          }];
        }
      }

      const pid = allowedProfs[Math.floor(Math.random() * allowedProfs.length)];
      const prof = PROFESSIONS[pid];
      const dishName = prof.dishes[Math.floor(Math.random() * prof.dishes.length)];
      const basePatience = level?.type === 'royal' ? 22 : level?.type === 'michelin' ? 30 : 38;
      const patience = (upgradePatience ? basePatience + 15 : basePatience) + Math.floor(Math.random() * 8);

      // discovery
      if (!state.discovered.has(pid)) {
        state.setDiscovered(new Set([...state.discovered, pid]));
      }

      return [...prev, {
        id, profId: pid, emoji: prof.emoji, name: prof.name, color: prof.color,
        dishName, patience, patienceMax: patience, isCeleb: false,
      }];
    });
  }, [allowedProfs, level, upgradePatience, state.discovered]);

  // initial spawns
  useEffect(() => {
    spawnCustomer();
    const t1 = setTimeout(spawnCustomer, 1600);
    const t2 = setTimeout(spawnCustomer, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ongoing spawner
  useEffect(() => {
    if (!sessionActive) return;
    const iv = setInterval(() => {
      if (Math.random() < 0.5) spawnCustomer();
    }, 2800);
    return () => clearInterval(iv);
  }, [sessionActive, spawnCustomer]);

  // patience decay + session timer
  useEffect(() => {
    if (!sessionActive) return;
    const iv = setInterval(() => {
      // customer patience tick
      setCustomers((prev) => {
        const updated = prev.map((c) => ({ ...c, patience: c.patience - 1 }));
        const expired = updated.filter((c) => c.patience <= 0);
        if (expired.length) {
          setCombo(0);
          setMistakes((m) => m + expired.length);
          expired.forEach(() => flashToast('bad', 'Customer left!'));
        }
        return updated.filter((c) => c.patience > 0);
      });
      // session timer (any mode with a level/daily def)
      if (level) {
        setTimeLeft((t) => {
          if (t <= 1) { endSession(); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line
  }, [sessionActive, mode]);

  // auto-check level completion
  useEffect(() => {
    if (level && served >= level.target) {
      endSession(true);
    }
    // eslint-disable-next-line
  }, [served]);

  const endSession = (forceWin) => {
    setSessionActive(false);
    const finalServed = servedRef.current;
    const finalMoney = moneyRef.current;
    const finalCombo = comboRef.current;
    const won = forceWin || (level && finalServed >= level.target);
    setOutcome(won ? 'won' : 'lost');
    AudioEngine.sfx(won ? 'serve' : 'timeup');
    if (won && onComplete) onComplete(level?.id);
    // roll up coins into global
    state.setMoney(state.money + finalMoney);
    state.setTotalServed(state.totalServed + finalServed);
    state.setBestCombo(Math.max(state.bestCombo, finalCombo));
  };

  // --- combine logic
  useEffect(() => {
    if (plate.length === 2) {
      const recipe = getRecipe(plate[0].id, plate[1].id);
      const cookTime = upgradePrep ? 350 : 500;
      if (recipe) {
        const t = setTimeout(() => {
          setCompletedDish(recipe);
          setPlate([]);
          flashToast('good', `${recipe.name} ready!`);
          AudioEngine.sfx('combine');
          if (!state.dishesServed.has(recipe.name)) {
            state.setDishesServed(new Set([...state.dishesServed, recipe.name]));
          }
        }, cookTime);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => {
          setPlate([]);
          flashToast('meh', 'That doesn\'t combine');
          AudioEngine.sfx('bad');
        }, 600);
        return () => clearTimeout(t);
      }
    }
  }, [plate]);

  // --- drop handlers (called by the DragProvider when a drop lands)
  const onPlateDropPayload = useCallback((payload) => {
    if (!sessionActive) return;
    if (payload?.kind !== 'ing') return;
    if (completedDish) return;
    setPlate((p) => {
      if (p.length >= 2) return p;
      const ing = INGREDIENTS[payload.id];
      AudioEngine.sfx('pickup');
      return [...p, { id: payload.id, ...ing }];
    });
  }, [sessionActive, completedDish]);

  const handleCustomerDrop = useCallback((customer, payload) => {
    if (!sessionActive) return;
    if (payload?.kind !== 'dish' || !completedDish) return;

    const correct = completedDish.name === customer.dishName;
    if (correct) {
      const newCombo = Math.min(combo + 1, comboCap);
      setCombo(newCombo);
      const comboMult = 1 + (newCombo - 1) * 0.15;
      const celebMult = customer.isCeleb ? customer.mult : 1;
      const reward = Math.round(completedDish.reward * comboMult * celebMult * bgMult);
      setMoney((m) => m + reward);
      setServed((s) => s + 1);
      spawnFloatingCoins(customer.isCeleb ? 6 : 3, reward);
      flashToast('good', `+${reward} ${customer.isCeleb ? '★ CELEBRITY ★' : ''}`);
      AudioEngine.sfx(customer.isCeleb ? 'celeb' : 'serve');
      setTimeout(() => AudioEngine.sfx('coin'), 100);
      if (customer.isCeleb && !state.celebsMet.has(customer.name)) {
        state.setCelebsMet(new Set([...state.celebsMet, customer.name]));
      }
    } else {
      setCombo(0);
      setMistakes((m) => m + 1);
      flashToast('bad', `Wrong dish! They wanted ${customer.dishName}`);
      AudioEngine.sfx('bad');
    }
    setCompletedDish(null);
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
  }, [sessionActive, completedDish, combo, comboCap, bgMult, state]);

  const spawnFloatingCoins = (n, amt) => {
    const batch = Array.from({ length: n }).map((_, k) => ({
      id: Math.random().toString(36).slice(2),
      dx: (Math.random() - 0.5) * 100,
      delay: k * 70,
      amt: k === 0 ? amt : null,
    }));
    setFloatingCoins((prev) => [...prev, ...batch]);
    setTimeout(() => {
      setFloatingCoins((prev) => prev.filter((c) => !batch.find((b) => b.id === c.id)));
    }, 1400);
  };

  const flashToast = (kind, text) => {
    setToast({ kind, text, id: Math.random() });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 1500);
  };

  const timeStr = timeLeft !== null
    ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
    : '∞';
  const timeLow = mode === 'level' && timeLeft <= 15;

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', padding: '20px 24px 32px' }}>
      {/* Top HUD */}
      <div className="flex items-center justify-between max-w-[1200px] mx-auto mb-6">
        <button onClick={onExit} style={styles.exitBtn} className="hover-lift"><ChevronLeft size={16} strokeWidth={2.5} /> Menu</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ ...styles.kicker, color: PALETTE.tomato }}>
            {mode === 'level' ? `Level ${level.id}` : mode === 'daily' ? '✦ Daily Challenge ✦' : 'Freeplay'} {level?.type === 'michelin' && '· ★ Michelin'} {level?.type === 'royal' && '· ♛ Royal'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso, letterSpacing: '-0.02em' }}>
            {level ? level.name : 'Your Café'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Chip icon={<Clock size={14} strokeWidth={2.5} />} label="Time" value={timeStr} tint={timeLow ? PALETTE.tomato : PALETTE.peach} pulse={timeLow} />
          <Chip icon={<Coins size={14} strokeWidth={2.5} />} label="Run" value={money} tint={PALETTE.caramel} />
          <Chip icon={<Flame size={14} strokeWidth={2.5} />} label="Combo" value={`x${combo}`} tint={PALETTE.tomato} highlight={combo >= 3} />
        </div>
      </div>

      {/* Objective bar (level or daily mode) */}
      {level && (
        <div className="max-w-[1200px] mx-auto mb-5">
          <div style={styles.objBar}>
            <span style={{ ...styles.kicker, color: PALETTE.cocoa }}>Objective · Serve {level.target}</span>
            <div style={styles.objTrack}>
              <div style={{ ...styles.objFill, width: `${Math.min(100, (served / level.target) * 100)}%` }} />
            </div>
            <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, color: PALETTE.espresso, fontSize: 13 }}>{served}/{level.target}</span>
          </div>
        </div>
      )}

      {/* Main stage */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 max-w-[1200px] mx-auto">
        {/* LEFT — kitchen */}
        <section>
          <SectionLabel index="01" title="Kitchen" subtitle="Drag ingredients" />
          <div style={styles.tray}>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(activeIngredients.length, 6)}, minmax(0,1fr))` }}>
              {activeIngredients.map((iid) => (
                <IngredientTile
                  key={iid}
                  ingId={iid}
                  disabled={!sessionActive || !!completedDish}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel index="02" title="Prep Plate" subtitle="Drop to combine" />
            <PlateDropZone
              onDrop={onPlateDropPayload}
              completedDish={completedDish}
              plate={plate}
            />
          </div>
        </section>

        {/* RIGHT — customers */}
        <aside>
          <SectionLabel index="03" title="Counter" subtitle={`${customers.length} waiting`} />
          <div style={styles.counterStack}>
            {customers.length === 0 && (
              <div style={styles.emptyCounter}>
                <div style={{ fontSize: 32 }}>🚪</div>
                <div style={{ ...styles.kicker, color: PALETTE.cocoa }}>Waiting for guests…</div>
              </div>
            )}
            {customers.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                onDrop={(payload) => handleCustomerDrop(c, payload)}
              />
            ))}
          </div>
        </aside>
      </div>

      {/* Floating coins + toast overlay */}
      {floatingCoins.length > 0 && (
        <div style={{ position: 'fixed', top: '40%', left: '50%', pointerEvents: 'none', zIndex: 40 }}>
          {floatingCoins.map((c) => (
            <div key={c.id} style={{
              position: 'absolute', left: c.dx, top: 0,
              fontSize: c.amt ? 24 : 18, fontWeight: 900, color: PALETTE.caramel,
              fontFamily: '"Space Mono", monospace',
              animation: 'floatUp 1.1s ease-out forwards',
              animationDelay: `${c.delay}ms`,
              textShadow: `0 2px 0 ${PALETTE.espresso}`,
            }}>
              {c.amt ? `+${c.amt}` : '★'}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.kind === 'good' ? PALETTE.pistachio : toast.kind === 'bad' ? PALETTE.tomato : PALETTE.caramel,
          color: PALETTE.milk,
        }} className="animate-[slideUp_360ms_cubic-bezier(0.34,1.56,0.64,1)]">
          {toast.text}
        </div>
      )}

      {/* Tutorial overlay (freeplay, first time) */}
      {showTutorial && (
        <Tutorial onClose={() => { setShowTutorial(false); state.setTutorialDone(true); }} />
      )}

      {/* End screen */}
      {outcome && (
        <EndOverlay
          outcome={outcome}
          mode={mode}
          level={level}
          served={served}
          mistakes={mistakes}
          money={money}
          onReplay={() => window.location.reload && onExit()}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/* ---------------------- INGREDIENT TILE (draggable) ---------------------- */
function IngredientTile({ ingId, disabled }) {
  const ing = INGREDIENTS[ingId];
  const visual = (
    <div style={{
      ...styles.ingredient,
      background: ing.color,
      width: 78, height: 82,
    }}>
      <div style={{ fontSize: 34, lineHeight: 1 }}>{ing.emoji}</div>
      <div style={styles.ingName}>{ing.name}</div>
    </div>
  );
  const { draggingSelf, dragHandlers } = useDraggable({
    enabled: !disabled,
    payload: { kind: 'ing', id: ingId, _unique: ingId },
    visual,
  });
  return (
    <div
      {...dragHandlers}
      style={{
        ...styles.ingredient,
        background: ing.color,
        cursor: disabled ? 'not-allowed' : 'grab',
        opacity: disabled ? 0.5 : draggingSelf ? 0.3 : 1,
        ...dragHandlers.style,
      }}
      className="select-none hover:-translate-y-1 active:scale-95 transition-transform"
    >
      <div style={{ fontSize: 34, lineHeight: 1 }}>{ing.emoji}</div>
      <div style={styles.ingName}>{ing.name}</div>
    </div>
  );
}

/* ---------------------- PLATE DROP ZONE ---------------------- */
function PlateDropZone({ onDrop, completedDish, plate }) {
  const { ref, hovering } = useDroppable({ id: 'plate', onDrop });
  const dishVisual = completedDish ? (
    <div style={{ ...styles.completedDish }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>{completedDish.emoji}</div>
      <div style={styles.dishName}>{completedDish.name}</div>
    </div>
  ) : null;
  const { draggingSelf, dragHandlers } = useDraggable({
    enabled: !!completedDish,
    payload: { kind: 'dish' },
    visual: dishVisual,
  });

  return (
    <div
      ref={ref}
      style={{
        ...styles.plate,
        borderColor: hovering ? PALETTE.tomato : PALETTE.cocoa,
        background: hovering ? '#FFEEDA' : PALETTE.milk,
        transform: hovering ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 160ms ease',
      }}
    >
      {completedDish ? (
        <div
          {...dragHandlers}
          style={{
            ...styles.completedDish,
            ...dragHandlers.style,
            cursor: 'grab',
            opacity: draggingSelf ? 0.3 : 1,
          }}
          className="animate-[pop_420ms_cubic-bezier(0.34,1.56,0.64,1)]"
        >
          <div style={{ fontSize: 56, lineHeight: 1 }}>{completedDish.emoji}</div>
          <div style={styles.dishName}>{completedDish.name}</div>
          <div style={styles.dishTag}><Sparkles size={11} strokeWidth={2.5} /> Drag to customer</div>
        </div>
      ) : plate.length > 0 ? (
        <div className="flex items-center gap-4">
          {plate.map((p, i) => (
            <React.Fragment key={i}>
              <div style={styles.plateItem} className="animate-[pop_320ms_cubic-bezier(0.34,1.56,0.64,1)]">
                <span style={{ fontSize: 40 }}>{p.emoji}</span>
              </div>
              {i === 0 && plate.length < 2 && <div style={styles.plus}>+</div>}
            </React.Fragment>
          ))}
          {plate.length === 1 && <div style={styles.plateGhost}>?</div>}
        </div>
      ) : (
        <div style={styles.plateEmpty}>
          <div style={styles.plateCircle}><Coffee size={26} color="#9C7A5B" strokeWidth={1.8} /></div>
          <div style={styles.plateHint}>drag ingredients here</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------- CUSTOMER CARD ---------------------- */
function CustomerCard({ customer, onDrop }) {
  const { ref, hovering } = useDroppable({ id: 'cust-' + customer.id, onDrop });
  const pct = (customer.patience / customer.patienceMax) * 100;
  const urgent = pct < 30;
  const isCeleb = customer.isCeleb;
  const dish = findDishByName(customer.dishName);

  return (
    <div
      ref={ref}
      style={{
        ...styles.customerCard,
        background: hovering
          ? '#FFEEDA'
          : isCeleb ? `linear-gradient(135deg, ${tierColor(customer.tier)}25, ${PALETTE.milk})` : PALETTE.milk,
        borderColor: hovering ? PALETTE.tomato : isCeleb ? tierColor(customer.tier) : PALETTE.espresso,
        boxShadow: hovering
          ? `0 6px 0 ${PALETTE.tomato}, 0 10px 28px ${PALETTE.tomato}40`
          : isCeleb ? `0 6px 0 ${tierColor(customer.tier)}, 0 8px 24px ${tierColor(customer.tier)}30`
                    : `0 5px 0 ${PALETTE.espresso}`,
        transform: hovering ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 160ms ease',
      }}
      className="animate-[slideIn_420ms_cubic-bezier(0.34,1.56,0.64,1)]"
    >
      {isCeleb && (
        <div style={styles.celebRibbon}>
          <Crown size={10} strokeWidth={2.5} /> {customer.tier.toUpperCase()} · {customer.mult}× PAYOUT
        </div>
      )}
      <div className="flex items-center gap-3">
        <div style={{ ...styles.customerAvatar, background: isCeleb ? tierColor(customer.tier) : (customer.color || PALETTE.pistachio) }}>
          <span style={{ fontSize: 30 }}>{customer.emoji}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.customerName}>{customer.name}</div>
          <div style={styles.customerSub}>{isCeleb ? customer.tagline : 'wants'}</div>
        </div>
        <div style={styles.orderBubble}>
          <div style={{ fontSize: 28 }}>{dish?.emoji}</div>
          <div style={styles.orderDishName}>{customer.dishName}</div>
        </div>
      </div>
      <div style={{ ...styles.patienceTrack, marginTop: 12 }}>
        <div style={{
          ...styles.patienceFill,
          width: `${pct}%`,
          background: urgent
            ? `linear-gradient(90deg, ${PALETTE.tomato}, ${PALETTE.peach})`
            : `linear-gradient(90deg, ${PALETTE.peach}, ${PALETTE.caramel})`,
        }} />
      </div>
    </div>
  );
}

/* ---------------------- TUTORIAL ---------------------- */
function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const steps = [
    { t: 'Welcome to the café!', b: 'You run the counter. Every customer wants one specific dish. Serve them fast.', emoji: '👋' },
    { t: 'Drag ingredients', b: 'Grab an ingredient from the tray and drop it on the prep plate.', emoji: '🥕' },
    { t: 'Combine into a dish', b: 'Two ingredients make a recipe. Example: Sugar + Flour = Donut 🍩', emoji: '🍩' },
    { t: 'Serve the customer', b: 'Drag the finished dish onto the guest waiting at the counter.', emoji: '🧑‍🍳' },
    { t: 'Time & combos', b: 'Every guest has patience. Serve in a row to build combos for bonus coins.', emoji: '🔥' },
    { t: 'Celebrity guests', b: 'Rare VIPs appear sometimes — they pay 2x to 5x! Don\'t miss them.', emoji: '⭐' },
    { t: 'You\'re ready!', b: 'Good luck, chef. Your café awaits.', emoji: '🎉' },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div style={styles.modalScrim}>
      <div style={styles.tutorialCard} className="animate-[popCard_380ms_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 99,
                background: i <= step ? PALETTE.tomato : PALETTE.cream,
                transition: 'all 280ms',
              }} />
            ))}
          </div>
          <button onClick={onClose} style={styles.skipBtn}>Skip</button>
        </div>
        <div style={{ fontSize: 60, textAlign: 'center', margin: '10px 0 14px' }}>{s.emoji}</div>
        <div style={{ ...styles.kicker, color: PALETTE.tomato, textAlign: 'center' }}>Step {step + 1} of {steps.length}</div>
        <div style={{ ...styles.tutorialTitle, textAlign: 'center' }}>{s.t}</div>
        <div style={{ ...styles.tutorialBody, textAlign: 'center' }}>{s.b}</div>
        <button
          onClick={() => last ? onClose() : setStep(step + 1)}
          style={styles.nextBtn}
          className="hover-lift active:translate-y-[2px]"
        >
          {last ? 'Start cooking' : 'Next'}
          {last ? <Play size={16} strokeWidth={2.5} /> : <ArrowRight size={16} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );
}

/* ---------------------- END OVERLAY ---------------------- */
function EndOverlay({ outcome, mode, level, served, mistakes, money, onReplay, onExit }) {
  const won = outcome === 'won';
  return (
    <div style={styles.modalScrim}>
      <div style={{ ...styles.tutorialCard, maxWidth: 420 }} className="animate-[popCard_420ms_cubic-bezier(0.34,1.56,0.64,1)]">
        <div style={{ fontSize: 80, textAlign: 'center' }}>{won ? '🏆' : '⌛'}</div>
        <div style={{ ...styles.kicker, color: won ? PALETTE.pistachio : PALETTE.tomato, textAlign: 'center' }}>
          {won ? 'Service complete' : 'Time\'s up'}
        </div>
        <div style={{ ...styles.tutorialTitle, textAlign: 'center' }}>
          {won ? (mode === 'level' ? `${level.name} cleared!` : 'Well served!') : 'Better luck next time'}
        </div>
        <div className="grid grid-cols-3 gap-2 my-4">
          <EndStat label="Served" val={served} />
          <EndStat label="Earned" val={money} icon={<Coins size={11} strokeWidth={2.5} />} />
          <EndStat label="Misses" val={mistakes} />
        </div>
        <button onClick={onExit} style={styles.nextBtn} className="hover-lift active:translate-y-[2px]">
          Back to menu <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function EndStat({ label, val, icon }) {
  return (
    <div style={{ background: PALETTE.cream, borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: `2px solid ${PALETTE.espresso}` }}>
      <div style={{ ...styles.kicker, color: PALETTE.cocoa, fontSize: 9 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: PALETTE.espresso, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {icon}{val}
      </div>
    </div>
  );
}

/* ---------------------- MODE SELECT ---------------------- */
function ModeSelect({ state, setScreen }) {
  return (
    <ScreenShell title="Choose a mode" subtitle="How do you want to play?" onBack={() => setScreen('menu')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[900px] mx-auto">
        <MenuCard label="01" title="Freeplay" desc="No timer, unlimited flow" icon={<Play size={28} strokeWidth={2.5} />} tint={PALETTE.pistachio} onClick={() => setScreen('freeplay')} />
        <MenuCard label="02" title="Levels" desc="Structured challenges" icon={<Trophy size={28} strokeWidth={2.5} />} tint={PALETTE.caramel} onClick={() => setScreen('levels')} />
        <MenuCard label="03" title="Collection" desc="Recipe book" icon={<Book size={28} strokeWidth={2.5} />} tint={PALETTE.peach} onClick={() => setScreen('collection')} />
      </div>
    </ScreenShell>
  );
}

/* ============================================================
   SHARED UI PRIMITIVES
   ============================================================ */
function ScreenShell({ title, subtitle, onBack, children, rightHud }) {
  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', padding: '32px 24px' }}>
      <div className="flex items-center justify-between max-w-[1200px] mx-auto mb-8">
        <button onClick={onBack} style={styles.exitBtn} className="hover-lift"><ChevronLeft size={16} strokeWidth={2.5} /> Back</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...styles.kicker, color: PALETTE.tomato }}>{subtitle}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso, letterSpacing: '-0.02em' }}>{title}</div>
        </div>
        <div>{rightHud || <div style={{ width: 120 }} />}</div>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ index, title, subtitle }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <div style={{ ...styles.kicker, color: PALETTE.caramel, fontSize: 11 }}>{index}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ ...styles.kicker, color: PALETTE.cocoa, fontSize: 10 }}>— {subtitle}</div>
    </div>
  );
}

function Chip({ icon, label, value, tint, highlight, pulse }) {
  return (
    <div style={{
      ...styles.hudChip,
      transform: highlight ? 'scale(1.06)' : 'scale(1)',
      animation: pulse ? 'chipPulse 0.8s ease-in-out infinite' : 'none',
    }}>
      <div style={{ ...styles.hudIcon, background: tint }}>{icon}</div>
      <div>
        <div style={styles.hudLabel}>{label}</div>
        <div style={styles.hudValue}>{value}</div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, ...rest }) {
  return (
    <button onClick={onClick} style={styles.iconBtn} className="hover-lift active:translate-y-[2px] active:shadow-none" {...rest}>
      {children}
    </button>
  );
}

function ProfileBadge({ gold, levels, discovered }) {
  return (
    <div style={{
      ...styles.profileBadge,
      background: gold ? `linear-gradient(135deg, #FFE08A, #D4A13F)` : PALETTE.milk,
      boxShadow: gold ? `0 5px 0 #8B6A20, 0 0 24px #D4A13F80` : `0 5px 0 ${PALETTE.espresso}`,
    }}>
      <div style={{
        ...styles.profileAvatar,
        background: gold ? PALETTE.caramel : PALETTE.pistachio,
      }}>
        <ChefHat size={22} strokeWidth={2.5} color={PALETTE.espresso} />
        {gold && <div style={styles.sparkle1}>✦</div>}
        {gold && <div style={styles.sparkle2}>✧</div>}
      </div>
      <div>
        <div style={{ ...styles.kicker, fontSize: 9, color: PALETTE.cocoa }}>{gold ? '★ MASTER CHEF' : 'Chef'}</div>
        <div style={styles.profileStats}>
          <span><Trophy size={10} strokeWidth={2.5} /> {levels}</span>
          <span><Award size={10} strokeWidth={2.5} /> {discovered}</span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, val }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: PALETTE.cream, padding: '4px 8px', borderRadius: 8,
      fontFamily: '"Space Mono", monospace', fontSize: 10, fontWeight: 700, color: PALETTE.espresso,
      letterSpacing: '0.05em',
    }}>
      {icon} {val}
    </div>
  );
}

function StatCard({ label, val }) {
  return (
    <div style={{
      background: PALETTE.milk, padding: 14, borderRadius: 14,
      border: `2px solid ${PALETTE.espresso}`, boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    }}>
      <div style={{ ...styles.kicker, color: PALETTE.cocoa, fontSize: 9 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso, letterSpacing: '-0.02em' }}>{val}</div>
    </div>
  );
}

function SettingsRow({ title, sub, control }) {
  return (
    <div style={styles.settingsRow}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso }}>{title}</div>
        <div style={{ ...styles.kicker, fontSize: 9, color: PALETTE.cocoa, marginTop: 2 }}>{sub}</div>
      </div>
      {control}
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{
      width: 44, height: 24, borderRadius: 99,
      background: on ? PALETTE.pistachio : PALETTE.cream,
      border: `2px solid ${PALETTE.espresso}`, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 1,
        left: on ? 22 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: PALETTE.milk, border: `1.5px solid ${PALETTE.espresso}`,
        transition: 'left 240ms ease',
      }} />
    </div>
  );
}

/* ============================================================
   STYLE HELPERS
   ============================================================ */
const PALETTE = {
  cream: '#FFF4E2',
  milk: '#FFF9F0',
  espresso: '#3B2416',
  cocoa: '#6B4530',
  caramel: '#D4A13F',
  tomato: '#C85A4B',
  peach: '#E8856B',
  pistachio: '#A8C09A',
};

function levelBg(type) {
  if (type === 'michelin') return `linear-gradient(135deg, ${PALETTE.milk}, #F5E8C8)`;
  if (type === 'royal')    return `linear-gradient(135deg, #F5D8E0, #EAC4D0)`;
  return PALETTE.milk;
}
function levelAccent(type) {
  if (type === 'michelin') return PALETTE.caramel;
  if (type === 'royal')    return '#B85A7C';
  return PALETTE.tomato;
}
function tierColor(tier) {
  if (tier === 'rare')   return '#6B8EB8';
  if (tier === 'epic')   return '#A063C0';
  if (tier === 'legend') return '#D4A13F';
  return PALETTE.cocoa;
}

function rootStyle(bgId) {
  return {
    minHeight: '100vh',
    width: '100%',
    background: PALETTE.cream,
    fontFamily: '"Fraunces", "Playfair Display", Georgia, serif',
    color: PALETTE.espresso,
    position: 'relative',
    overflow: 'hidden',
  };
}
function bgAmbient(bgId) {
  const b = BACKGROUNDS[bgId] || BACKGROUNDS.cozy;
  return {
    position: 'absolute', inset: 0,
    background: `radial-gradient(circle at 20% 10%, ${b.swatch[0]}CC 0%, transparent 55%),
                 radial-gradient(circle at 85% 80%, ${b.swatch[1]}30 0%, transparent 55%),
                 radial-gradient(circle at 50% 50%, ${PALETTE.cream} 0%, #F5E5CF 100%)`,
    zIndex: 1,
  };
}
const bgGrain = {
  position: 'absolute', inset: 0, opacity: 0.04,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  zIndex: 2, pointerEvents: 'none',
};

const styles = {
  // Typography / shared
  kicker: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
    fontWeight: 700,
  },
  megaTitle: {
    fontSize: 'clamp(52px, 9vw, 96px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    lineHeight: 0.95,
    margin: 0,
  },
  subtitle: {
    fontSize: 15, color: PALETTE.cocoa, maxWidth: 520, margin: '0 auto',
    lineHeight: 1.5,
  },
  footerRibbon: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    textAlign: 'center',
    fontFamily: '"Space Mono", monospace',
    fontSize: 10, letterSpacing: '0.24em', color: PALETTE.cocoa,
    textTransform: 'uppercase',
  },

  // Menu cards
  menuCard: {
    background: PALETTE.milk,
    border: `2.5px solid ${PALETTE.espresso}`,
    borderRadius: 22,
    padding: 22,
    textAlign: 'left',
    position: 'relative',
    boxShadow: `0 6px 0 ${PALETTE.espresso}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: PALETTE.espresso,
  },
  menuIcon: {
    width: 56, height: 56, borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: PALETTE.espresso,
    border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `inset 0 -3px 0 rgba(0,0,0,0.1)`,
    marginBottom: 14,
  },
  menuTitle: {
    fontSize: 22, fontWeight: 800, fontStyle: 'italic',
    color: PALETTE.espresso, letterSpacing: '-0.02em', marginTop: 4,
  },
  menuDesc: {
    fontSize: 13, color: PALETTE.cocoa, lineHeight: 1.4, marginTop: 6,
  },
  menuBadge: {
    position: 'absolute', top: 16, right: 16,
    background: PALETTE.espresso, color: PALETTE.milk,
    padding: '4px 10px', borderRadius: 99,
    fontFamily: '"Space Mono", monospace', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.08em',
  },

  // HUD
  hudChip: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: PALETTE.milk, padding: '7px 12px 7px 7px',
    borderRadius: 14, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    transition: 'transform 240ms',
  },
  hudIcon: {
    width: 28, height: 28, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: PALETTE.milk,
  },
  hudLabel: {
    fontFamily: '"Space Mono", monospace', fontSize: 8, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: PALETTE.cocoa, fontWeight: 700,
  },
  hudValue: {
    fontSize: 15, fontWeight: 800, color: PALETTE.espresso, lineHeight: 1,
    letterSpacing: '-0.01em',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    background: PALETTE.milk, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  exitBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: PALETTE.milk, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    padding: '7px 14px 7px 10px', borderRadius: 12,
    fontFamily: '"Space Mono", monospace', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: PALETTE.espresso, cursor: 'pointer',
  },

  // Profile
  profileBadge: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: PALETTE.milk, padding: '8px 16px 8px 8px',
    borderRadius: 14, border: `2px solid ${PALETTE.espresso}`,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `2px solid ${PALETTE.espresso}`,
    position: 'relative',
  },
  profileStats: {
    display: 'flex', gap: 10,
    fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 700,
    color: PALETTE.espresso, letterSpacing: '0.03em',
  },
  sparkle1: {
    position: 'absolute', top: -4, right: -4,
    color: PALETTE.caramel, fontSize: 14,
    animation: 'twinkle 1.8s ease-in-out infinite',
  },
  sparkle2: {
    position: 'absolute', bottom: -2, left: -4,
    color: PALETTE.caramel, fontSize: 10,
    animation: 'twinkle 1.8s ease-in-out infinite 0.6s',
  },

  // Level cards
  levelCard: {
    border: `2.5px solid ${PALETTE.espresso}`, borderRadius: 20,
    padding: 18, boxShadow: `0 5px 0 ${PALETTE.espresso}`,
    textAlign: 'left', fontFamily: 'inherit', color: PALETTE.espresso,
  },
  levelTitle: {
    fontSize: 20, fontWeight: 800, fontStyle: 'italic',
    color: PALETTE.espresso, letterSpacing: '-0.02em',
  },
  levelMeta: {
    fontSize: 22, marginTop: 4, letterSpacing: '0.1em',
  },
  completedTag: {
    background: PALETTE.pistachio, color: PALETTE.milk,
    padding: '3px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700,
    fontFamily: '"Space Mono", monospace', letterSpacing: '0.08em',
    display: 'inline-flex', alignItems: 'center', gap: 4,
    border: `1.5px solid ${PALETTE.espresso}`,
  },

  // Ingredient tray
  tray: {
    background: PALETTE.milk, padding: 16, borderRadius: 22,
    border: `2.5px solid ${PALETTE.espresso}`,
    boxShadow: `0 6px 0 ${PALETTE.espresso}`,
  },
  ingredient: {
    aspectRatio: '1 / 1.05', borderRadius: 14,
    border: `2.5px solid ${PALETTE.espresso}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    userSelect: 'none',
  },
  ingName: {
    fontFamily: '"Space Mono", monospace', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase', color: PALETTE.espresso,
  },

  // Plate
  plate: {
    background: PALETTE.milk, minHeight: 180, borderRadius: 22,
    border: `2.5px dashed ${PALETTE.cocoa}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  plateEmpty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: 0.7 },
  plateCircle: {
    width: 80, height: 80, borderRadius: '50%',
    background: '#F5E5CF', border: `2px dashed ${PALETTE.cocoa}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  plateHint: {
    fontFamily: '"Space Mono", monospace', fontSize: 10, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: PALETTE.cocoa,
  },
  plateItem: {
    width: 84, height: 84, borderRadius: '50%',
    background: PALETTE.cream, border: `2.5px solid ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
  },
  plus: { fontSize: 28, fontWeight: 900, color: PALETTE.tomato, fontFamily: '"Space Mono", monospace' },
  plateGhost: {
    width: 84, height: 84, borderRadius: '50%',
    border: `2.5px dashed ${PALETTE.cocoa}60`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, color: PALETTE.cocoa, opacity: 0.5, fontWeight: 800,
  },
  completedDish: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '14px 26px', background: '#FFF0DD', borderRadius: 18,
    border: `2.5px solid ${PALETTE.espresso}`, boxShadow: `0 4px 0 ${PALETTE.espresso}`,
  },
  dishName: { fontSize: 18, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso, letterSpacing: '-0.01em' },
  dishTag: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontFamily: '"Space Mono", monospace', fontSize: 9,
    letterSpacing: '0.16em', textTransform: 'uppercase',
    color: PALETTE.tomato, fontWeight: 700,
  },

  // Counter + customer cards
  counterStack: { display: 'flex', flexDirection: 'column', gap: 12 },
  emptyCounter: {
    background: PALETTE.milk, border: `2.5px dashed ${PALETTE.cocoa}`,
    borderRadius: 18, padding: '32px 20px',
    textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  },
  customerCard: {
    border: `2.5px solid ${PALETTE.espresso}`, borderRadius: 18,
    padding: 14, position: 'relative', overflow: 'hidden',
  },
  celebRibbon: {
    position: 'absolute', top: 8, right: -30, transform: 'rotate(30deg)',
    background: PALETTE.espresso, color: PALETTE.caramel,
    padding: '3px 36px', fontFamily: '"Space Mono", monospace', fontSize: 8,
    fontWeight: 700, letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  customerAvatar: {
    width: 56, height: 56, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `2.5px solid ${PALETTE.espresso}`, boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    flexShrink: 0,
  },
  customerName: {
    fontSize: 16, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso,
    letterSpacing: '-0.01em', lineHeight: 1.1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  customerSub: {
    fontFamily: '"Space Mono", monospace', fontSize: 9,
    letterSpacing: '0.14em', textTransform: 'uppercase',
    color: PALETTE.cocoa, marginTop: 2,
  },
  orderBubble: {
    background: PALETTE.cream, border: `2px solid ${PALETTE.espresso}`,
    borderRadius: 14, padding: '8px 12px',
    boxShadow: `0 2px 0 ${PALETTE.espresso}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    flexShrink: 0,
  },
  orderDishName: {
    fontFamily: '"Space Mono", monospace', fontSize: 9,
    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: PALETTE.espresso,
  },
  patienceTrack: {
    height: 8, background: '#F5E5CF', borderRadius: 99,
    border: `2px solid ${PALETTE.espresso}`, overflow: 'hidden',
  },
  patienceFill: { height: '100%', transition: 'width 900ms linear' },

  // Objective bar
  objBar: {
    background: PALETTE.milk, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    borderRadius: 14, padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  objTrack: {
    flex: 1, height: 10, background: PALETTE.cream,
    border: `2px solid ${PALETTE.espresso}`, borderRadius: 99, overflow: 'hidden',
  },
  objFill: {
    height: '100%', background: `linear-gradient(90deg, ${PALETTE.pistachio}, ${PALETTE.caramel})`,
    transition: 'width 400ms ease',
  },

  // Collection
  profCard: {
    background: PALETTE.milk, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    borderRadius: 16, padding: 16, textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    fontFamily: 'inherit',
  },
  profName: {
    fontSize: 14, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso,
    letterSpacing: '-0.01em',
  },
  celebCard: {
    background: PALETTE.milk, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    borderRadius: 12, padding: 10, textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  celebName: {
    fontSize: 11, fontWeight: 800, color: PALETTE.espresso,
    fontFamily: '"Space Mono", monospace', letterSpacing: '0.03em',
  },

  // Modals
  modalScrim: {
    position: 'fixed', inset: 0, zIndex: 60,
    background: 'rgba(30, 18, 10, 0.55)',
    backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    background: PALETTE.milk, borderRadius: 22,
    border: `2.5px solid ${PALETTE.espresso}`, padding: 24,
    boxShadow: `0 8px 0 ${PALETTE.espresso}, 0 20px 60px rgba(30, 18, 10, 0.3)`,
    maxWidth: 440, width: '100%',
  },
  modalTitle: {
    fontSize: 24, fontWeight: 800, fontStyle: 'italic',
    color: PALETTE.espresso, letterSpacing: '-0.02em', marginTop: 4,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    background: PALETTE.cream, border: `2px solid ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: PALETTE.espresso,
  },
  recipeRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 0', borderTop: `1.5px dashed ${PALETTE.cocoa}40`,
  },
  ingPill: {
    background: PALETTE.cream, padding: '3px 8px', borderRadius: 8,
    fontFamily: '"Space Mono", monospace', fontSize: 10, fontWeight: 700,
    color: PALETTE.espresso, letterSpacing: '0.03em',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  rewardTag: {
    background: PALETTE.caramel, color: PALETTE.milk,
    padding: '4px 8px', borderRadius: 8,
    fontFamily: '"Space Mono", monospace', fontSize: 10, fontWeight: 800,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    border: `1.5px solid ${PALETTE.espresso}`,
  },

  // Tutorial
  tutorialCard: {
    background: PALETTE.milk, borderRadius: 22,
    border: `2.5px solid ${PALETTE.espresso}`, padding: 24,
    boxShadow: `0 8px 0 ${PALETTE.espresso}, 0 20px 60px rgba(30, 18, 10, 0.3)`,
    maxWidth: 380, width: '100%',
  },
  tutorialTitle: {
    fontSize: 22, fontWeight: 800, fontStyle: 'italic',
    color: PALETTE.espresso, letterSpacing: '-0.02em', margin: '8px 0',
  },
  tutorialBody: {
    fontSize: 14, lineHeight: 1.5, color: PALETTE.cocoa, marginBottom: 16,
  },
  skipBtn: {
    fontFamily: '"Space Mono", monospace', fontSize: 10,
    letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
    color: PALETTE.cocoa, background: 'transparent', border: 'none',
    cursor: 'pointer', padding: '4px 8px',
  },
  nextBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: PALETTE.tomato, color: PALETTE.milk,
    border: `2.5px solid ${PALETTE.espresso}`, borderRadius: 14,
    padding: '12px 16px', fontSize: 14, fontWeight: 800,
    cursor: 'pointer', boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    fontFamily: 'inherit',
  },

  // Shop
  shopCard: {
    background: PALETTE.milk, border: `2.5px solid ${PALETTE.espresso}`,
    borderRadius: 18, padding: 18, boxShadow: `0 5px 0 ${PALETTE.espresso}`,
    display: 'flex', flexDirection: 'column',
  },
  shopIcon: {
    width: 48, height: 48, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `2px solid ${PALETTE.espresso}`,
  },
  buyBtn: {
    marginTop: 14, padding: '10px 14px', borderRadius: 12,
    border: `2px solid ${PALETTE.espresso}`, boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 800,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  bgCard: {
    border: `2.5px solid ${PALETTE.espresso}`, borderRadius: 18,
    padding: 18, minHeight: 120, textAlign: 'left',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    cursor: 'pointer',
  },
  bgStatus: {
    alignSelf: 'flex-start',
    background: PALETTE.espresso, color: PALETTE.milk,
    padding: '4px 10px', borderRadius: 99,
    fontFamily: '"Space Mono", monospace', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.1em', marginTop: 8,
  },

  // Settings
  settingsPanel: {
    background: PALETTE.milk, border: `2.5px solid ${PALETTE.espresso}`,
    boxShadow: `0 6px 0 ${PALETTE.espresso}`, borderRadius: 18,
    padding: '6px 20px',
  },
  settingsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 0', borderTop: `1.5px dashed ${PALETTE.cocoa}40`,
  },
  smallBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: PALETTE.cream, border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 2px 0 ${PALETTE.espresso}`,
    padding: '6px 12px', borderRadius: 10,
    fontFamily: '"Space Mono", monospace', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: PALETTE.espresso, cursor: 'pointer',
  },

  // Toast
  toast: {
    position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
    padding: '12px 20px', borderRadius: 14,
    border: `2.5px solid ${PALETTE.espresso}`, boxShadow: `0 5px 0 ${PALETTE.espresso}`,
    fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    zIndex: 50,
  },
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;0,800;1,700;1,800&family=Space+Mono:wght@400;700&display=swap');
  body { font-family: "Fraunces", Georgia, serif; }
  .hover-lift { transition: transform 180ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 180ms; }
  .hover-lift:hover { transform: translateY(-3px); }

  @keyframes pop {
    0%   { transform: scale(0.3); opacity: 0; }
    60%  { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes popCard {
    0%   { transform: scale(0.85) translateY(10px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes slideIn {
    0%   { transform: translateX(40px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideUp {
    0%   { transform: translate(-50%, 30px); opacity: 0; }
    100% { transform: translate(-50%, 0); opacity: 1; }
  }
  @keyframes floatUp {
    0%   { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-70px); opacity: 0; }
  }
  @keyframes chipPulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.08); }
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.4; transform: scale(0.8); }
    50%      { opacity: 1;   transform: scale(1.2); }
  }
`;
