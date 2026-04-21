import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChefHat, Coffee, Sparkles, Clock, Coins, Flame, Star, ArrowRight, X, RotateCcw, Play, Check } from 'lucide-react';

// ============================================================
// Career Café Rush — Built-in Tutorial System
// ------------------------------------------------------------
// A simulated first-launch experience. Uses in-memory state
// (no browser storage) so "first launch" is triggered on mount.
// Replay the tutorial via the Settings gear.
// ============================================================

const INGREDIENTS = [
  { id: 'sugar', name: 'Sugar', emoji: '🍬', color: '#F9D5E5' },
  { id: 'flour', name: 'Flour', emoji: '🌾', color: '#FFF4D6' },
  { id: 'coffee', name: 'Coffee', emoji: '☕', color: '#C9A27E' },
  { id: 'berry', name: 'Berries', emoji: '🫐', color: '#B8C5E8' },
];

const RECIPES = {
  'sugar+flour': { name: 'Donut', emoji: '🍩', reward: 12 },
  'flour+sugar': { name: 'Donut', emoji: '🍩', reward: 12 },
  'coffee+sugar': { name: 'Latte', emoji: '🥤', reward: 10 },
  'sugar+coffee': { name: 'Latte', emoji: '🥤', reward: 10 },
  'berry+flour': { name: 'Muffin', emoji: '🧁', reward: 14 },
  'flour+berry': { name: 'Muffin', emoji: '🧁', reward: 14 },
};

// Tutorial step definitions. Each step either waits for a player
// action (requiresAction: true) or advances with a Next button.
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Career Café Rush!',
    body: 'Serve customers by making their favorite foods — fast. Ready to learn the ropes?',
    anchor: 'center',
    cta: "Let's go",
  },
  {
    id: 'drag',
    title: 'Grab an ingredient',
    body: 'Click and drag any ingredient onto the plate.',
    anchor: 'ingredients',
    arrow: 'down',
    requiresAction: true,
    hint: 'Drop one on the plate to continue',
  },
  {
    id: 'combine',
    title: 'Combine to cook',
    body: 'Two ingredients make a dish. Try Sugar + Flour to bake a Donut.',
    anchor: 'plate',
    arrow: 'up',
    requiresAction: true,
    hint: 'Complete one recipe',
  },
  {
    id: 'serve',
    title: 'Serve the customer',
    body: 'Drag the finished dish to the customer waiting at the counter.',
    anchor: 'customer',
    arrow: 'right',
    requiresAction: true,
    hint: 'Deliver one order',
  },
  {
    id: 'timer',
    title: 'Watch the clock',
    body: 'Every customer has a timer. Serve them before it runs out or they leave.',
    anchor: 'timer',
    arrow: 'down',
    cta: 'Got it',
  },
  {
    id: 'money',
    title: 'Earn coins',
    body: 'Every correct order pays out. Stack coins to unlock upgrades.',
    anchor: 'coins',
    arrow: 'down',
    cta: 'Nice',
  },
  {
    id: 'combo',
    title: 'Build combos',
    body: 'Serve back-to-back orders without mistakes to chain combos for bonus cash.',
    anchor: 'combo',
    arrow: 'down',
    cta: 'Let\'s chain it',
  },
  {
    id: 'special',
    title: 'Celebrity customers',
    body: 'Keep an eye out — rare VIP guests tip big if you nail their order.',
    anchor: 'center',
    cta: 'Ooh fancy',
  },
  {
    id: 'done',
    title: "You're ready to play!",
    body: 'All game modes unlocked. Now go run that café.',
    anchor: 'center',
    cta: 'Start playing',
    final: true,
  },
];

// ============================================================
// Root
// ============================================================
export default function CareerCafeRush() {
  // "first launch" — in a real game this would read a save file.
  const [hasLaunchedBefore, setHasLaunchedBefore] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [modesUnlocked, setModesUnlocked] = useState(false);

  // Game-state needed for the tutorial interactions
  const [plateItems, setPlateItems] = useState([]);
  const [completedDish, setCompletedDish] = useState(null);
  const [served, setServed] = useState(false);
  const [coins, setCoins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timer, setTimer] = useState(45);
  const [floatingCoins, setFloatingCoins] = useState([]);

  const step = tutorialActive ? TUTORIAL_STEPS[stepIndex] : null;

  // Advance step helpers
  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1;
      if (next >= TUTORIAL_STEPS.length) {
        setTutorialActive(false);
        setHasLaunchedBefore(true);
        setModesUnlocked(true);
        return i;
      }
      return next;
    });
  }, []);

  const skipTutorial = () => {
    setTutorialActive(false);
    setHasLaunchedBefore(true);
    setModesUnlocked(true);
  };

  const replayTutorial = () => {
    setStepIndex(0);
    setPlateItems([]);
    setCompletedDish(null);
    setServed(false);
    setTutorialActive(true);
    setShowSettings(false);
  };

  // Step completion detection ------------------------------------------------
  // Step "drag": advance once plate has >=1 item
  useEffect(() => {
    if (step?.id === 'drag' && plateItems.length >= 1) {
      const t = setTimeout(nextStep, 600);
      return () => clearTimeout(t);
    }
  }, [plateItems, step, nextStep]);

  // Step "combine": when plate has 2 items, check recipe
  useEffect(() => {
    if (plateItems.length === 2) {
      const key = `${plateItems[0].id}+${plateItems[1].id}`;
      const recipe = RECIPES[key];
      if (recipe) {
        const t = setTimeout(() => {
          setCompletedDish(recipe);
          setPlateItems([]);
          if (step?.id === 'combine') {
            setTimeout(nextStep, 700);
          }
        }, 500);
        return () => clearTimeout(t);
      } else {
        // wrong combo — clear after a beat
        const t = setTimeout(() => setPlateItems([]), 800);
        return () => clearTimeout(t);
      }
    }
  }, [plateItems, step, nextStep]);

  // Step "serve": when served flips true
  useEffect(() => {
    if (step?.id === 'serve' && served) {
      // reward the player with a coin pop for narrative flow
      spawnCoins(3);
      setCoins((c) => c + 12);
      const t = setTimeout(nextStep, 800);
      return () => clearTimeout(t);
    }
  }, [served, step, nextStep]);

  // Floating coin spawner
  const spawnCoins = (n = 1) => {
    const batch = Array.from({ length: n }).map((_, k) => ({
      id: Math.random().toString(36).slice(2),
      dx: (Math.random() - 0.5) * 80,
      delay: k * 80,
    }));
    setFloatingCoins((prev) => [...prev, ...batch]);
    setTimeout(() => {
      setFloatingCoins((prev) => prev.filter((c) => !batch.find((b) => b.id === c.id)));
    }, 1200);
  };

  // Drag handlers ------------------------------------------------------------
  const onIngredientDragStart = (e, ingredient) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'ingredient', ingredient }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onDishDragStart = (e) => {
    if (!completedDish) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'dish' }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onPlateDrop = (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.kind === 'ingredient') {
        // lock interactions during tutorial gating
        if (tutorialActive && step?.id !== 'drag' && step?.id !== 'combine') return;
        if (plateItems.length >= 2) return;
        setPlateItems((prev) => [...prev, data.ingredient]);
      }
    } catch {}
  };

  const onCustomerDrop = (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.kind === 'dish' && completedDish) {
        if (tutorialActive && step?.id !== 'serve') return;
        setServed(true);
        setCompletedDish(null);
      }
    } catch {}
  };

  const allowDrop = (e) => e.preventDefault();

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={styles.root}>
      <style>{globalCSS}</style>

      {/* Ambient background */}
      <div className="absolute inset-0" style={styles.bgGradient} />
      <div className="absolute inset-0 opacity-[0.04]" style={styles.bgGrain} />
      <div className="absolute inset-0 pointer-events-none" style={styles.bgSteam} />

      {/* Top HUD */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-10 pt-6">
        <div className="flex items-center gap-3">
          <div style={styles.logoBadge}>
            <ChefHat size={22} strokeWidth={2.5} color="#3B2416" />
          </div>
          <div>
            <div style={styles.logoKicker}>Career</div>
            <div style={styles.logoTitle}>Café Rush</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HudChip
            label="Timer"
            icon={<Clock size={16} strokeWidth={2.5} />}
            value={`0:${String(timer).padStart(2, '0')}`}
            highlight={step?.anchor === 'timer'}
            anchorId="anchor-timer"
            tint="#E8856B"
          />
          <HudChip
            label="Coins"
            icon={<Coins size={16} strokeWidth={2.5} />}
            value={coins}
            highlight={step?.anchor === 'coins'}
            anchorId="anchor-coins"
            tint="#D4A13F"
          />
          <HudChip
            label="Combo"
            icon={<Flame size={16} strokeWidth={2.5} />}
            value={`x${combo}`}
            highlight={step?.anchor === 'combo'}
            anchorId="anchor-combo"
            tint="#C85A4B"
          />
          <button
            onClick={() => setShowSettings(true)}
            style={styles.gearBtn}
            aria-label="Settings"
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Main stage */}
      <main className="relative z-10 px-6 md:px-10 pt-8 pb-24 max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* LEFT — Kitchen */}
          <section>
            <SectionLabel index="01" title="Kitchen" subtitle="Your ingredients" />

            {/* Ingredients tray */}
            <div
              id="anchor-ingredients"
              style={{
                ...styles.tray,
                ...(step?.anchor === 'ingredients' ? styles.trayHighlight : {}),
              }}
              className="relative"
            >
              {step?.anchor === 'ingredients' && <Pulse />}
              <div className="grid grid-cols-4 gap-3 relative z-10">
                {INGREDIENTS.map((ing) => (
                  <div
                    key={ing.id}
                    draggable={!completedDish}
                    onDragStart={(e) => onIngredientDragStart(e, ing)}
                    style={{
                      ...styles.ingredient,
                      background: ing.color,
                      cursor: completedDish ? 'not-allowed' : 'grab',
                      opacity: completedDish ? 0.5 : 1,
                    }}
                    className="select-none transition-transform hover:-translate-y-1 active:cursor-grabbing active:scale-95"
                  >
                    <div style={{ fontSize: 38, lineHeight: 1 }}>{ing.emoji}</div>
                    <div style={styles.ingredientName}>{ing.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prep plate */}
            <div className="mt-6">
              <SectionLabel index="02" title="Prep plate" subtitle="Drop to combine" />
              <div
                id="anchor-plate"
                onDragOver={allowDrop}
                onDrop={onPlateDrop}
                style={{
                  ...styles.plate,
                  ...(step?.anchor === 'plate' ? styles.plateHighlight : {}),
                }}
                className="relative"
              >
                {step?.anchor === 'plate' && <Pulse />}
                {completedDish ? (
                  <div
                    draggable
                    onDragStart={onDishDragStart}
                    style={styles.completedDish}
                    className="select-none animate-[pop_420ms_cubic-bezier(0.34,1.56,0.64,1)] cursor-grab active:cursor-grabbing"
                  >
                    <div style={{ fontSize: 64, lineHeight: 1 }}>{completedDish.emoji}</div>
                    <div style={styles.dishName}>{completedDish.name}</div>
                    <div style={styles.dishTag}>
                      <Sparkles size={12} strokeWidth={2.5} /> Ready to serve
                    </div>
                  </div>
                ) : plateItems.length > 0 ? (
                  <div className="flex items-center gap-5">
                    {plateItems.map((p, i) => (
                      <React.Fragment key={i}>
                        <div style={styles.plateItem} className="animate-[pop_320ms_cubic-bezier(0.34,1.56,0.64,1)]">
                          <span style={{ fontSize: 44 }}>{p.emoji}</span>
                        </div>
                        {i === 0 && plateItems.length < 2 && (
                          <div style={styles.plusSign}>+</div>
                        )}
                      </React.Fragment>
                    ))}
                    {plateItems.length === 1 && <div style={styles.plateGhost}>+</div>}
                  </div>
                ) : (
                  <div style={styles.plateEmpty}>
                    <div style={styles.plateCircle}>
                      <Coffee size={28} color="#9C7A5B" strokeWidth={1.8} />
                    </div>
                    <div style={styles.plateHint}>drag ingredients here</div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT — Customer */}
          <aside>
            <SectionLabel index="03" title="Counter" subtitle="Waiting guest" />
            <div
              id="anchor-customer"
              onDragOver={allowDrop}
              onDrop={onCustomerDrop}
              style={{
                ...styles.customerCard,
                ...(step?.anchor === 'customer' ? styles.customerHighlight : {}),
              }}
              className="relative"
            >
              {step?.anchor === 'customer' && <Pulse />}

              {/* speech bubble */}
              <div style={styles.bubble}>
                <div style={styles.bubbleLabel}>ORDER</div>
                <div className="flex items-center gap-2 mt-1">
                  <span style={{ fontSize: 34 }}>🍩</span>
                  <span style={styles.bubbleDish}>Donut, please!</span>
                </div>
                <div style={styles.bubbleTail} />
              </div>

              <div style={styles.customer}>
                <div style={styles.customerFace}>
                  <div style={styles.customerEmoji}>{served ? '😋' : '🧑'}</div>
                </div>
                <div style={styles.customerName}>Guest #1</div>
                <div style={styles.customerStatus}>
                  {served ? 'Served!' : 'Awaiting order'}
                </div>
              </div>

              {/* patience bar */}
              <div style={styles.patienceTrack}>
                <div style={{ ...styles.patienceFill, width: served ? '100%' : '72%' }} />
              </div>

              {/* floating coins */}
              <div className="absolute right-4 top-4 pointer-events-none">
                {floatingCoins.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      ...styles.floatCoin,
                      animationDelay: `${c.delay}ms`,
                      transform: `translateX(${c.dx}px)`,
                    }}
                  >
                    +
                  </div>
                ))}
              </div>
            </div>

            {/* Modes panel */}
            <div className="mt-6">
              <SectionLabel index="04" title="Game Modes" subtitle={modesUnlocked ? 'All unlocked' : 'Locked'} />
              <div className="grid grid-cols-2 gap-3">
                {['Story', 'Endless', 'Rush Hour', 'Challenge'].map((m) => (
                  <div
                    key={m}
                    style={{
                      ...styles.modeTile,
                      opacity: modesUnlocked ? 1 : 0.45,
                      filter: modesUnlocked ? 'none' : 'saturate(0.4)',
                    }}
                  >
                    <div style={styles.modeName}>{m}</div>
                    <div style={styles.modeStatus}>
                      {modesUnlocked ? (
                        <><Check size={12} strokeWidth={3} /> Ready</>
                      ) : (
                        'Locked'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Tutorial overlay */}
      {tutorialActive && step && (
        <TutorialOverlay
          step={step}
          stepIndex={stepIndex}
          total={TUTORIAL_STEPS.length}
          onNext={nextStep}
          onSkip={skipTutorial}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onReplay={replayTutorial}
          tutorialActive={tutorialActive}
        />
      )}
    </div>
  );
}

// ============================================================
// Tutorial Overlay — pop-up card + pointer arrow
// ============================================================
function TutorialOverlay({ step, stepIndex, total, onNext, onSkip }) {
  const isCenter = step.anchor === 'center';
  const [anchorRect, setAnchorRect] = useState(null);

  // Measure anchor element for non-center steps
  useEffect(() => {
    if (isCenter) { setAnchorRect(null); return; }
    const el = document.getElementById(`anchor-${step.anchor}`);
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, isCenter]);

  // Position the card beside the anchor
  const cardPos = (() => {
    if (isCenter || !anchorRect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    const { top, left, width, height } = anchorRect;
    const cardW = 340;
    const gap = 22;
    switch (step.arrow) {
      case 'down': // card above the element
        return { left: Math.max(20, left + width / 2 - cardW / 2), top: top - gap - 180 };
      case 'up':   // card below
        return { left: Math.max(20, left + width / 2 - cardW / 2), top: top + height + gap };
      case 'right': // card to the left
        return { left: Math.max(20, left - cardW - gap), top: top + height / 2 - 90 };
      case 'left':
        return { left: left + width + gap, top: top + height / 2 - 90 };
      default:
        return { left: left + width + gap, top };
    }
  })();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* dim scrim */}
      <div className="absolute inset-0 pointer-events-auto" style={styles.scrim} onClick={() => {}} />

      {/* spotlight cutout */}
      {!isCenter && anchorRect && (
        <div
          style={{
            position: 'fixed',
            top: anchorRect.top - 10,
            left: anchorRect.left - 10,
            width: anchorRect.width + 20,
            height: anchorRect.height + 20,
            borderRadius: 24,
            boxShadow: '0 0 0 9999px rgba(30, 18, 10, 0.55)',
            pointerEvents: 'none',
            transition: 'all 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      )}

      {/* Tutorial card */}
      <div
        style={{
          position: 'fixed',
          width: 340,
          ...cardPos,
          transition: 'all 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'auto',
        }}
        className="animate-[popCard_420ms_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        <div style={styles.tutorialCard}>
          {/* Progress dots */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === stepIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 99,
                    background: i <= stepIndex ? '#C85A4B' : '#EDDCC9',
                    transition: 'all 300ms ease',
                  }}
                />
              ))}
            </div>
            <button onClick={onSkip} style={styles.skipBtn}>
              Skip
            </button>
          </div>

          {/* Step label */}
          <div style={styles.stepLabel}>
            Step {stepIndex + 1} of {total}
          </div>

          {/* Title */}
          <div style={styles.tutorialTitle}>{step.title}</div>

          {/* Body */}
          <div style={styles.tutorialBody}>{step.body}</div>

          {/* Action hint or Next button */}
          {step.requiresAction ? (
            <div style={styles.actionHint}>
              <div style={styles.pulseDot} />
              <span>{step.hint}</span>
            </div>
          ) : (
            <button onClick={onNext} style={styles.nextBtn} className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
              {step.cta || 'Next'}
              {step.final ? <Play size={16} strokeWidth={2.5} /> : <ArrowRight size={16} strokeWidth={2.5} />}
            </button>
          )}
        </div>

        {/* Arrow pointer */}
        {!isCenter && step.arrow && <TutorialArrow direction={step.arrow} />}
      </div>
    </div>
  );
}

function TutorialArrow({ direction }) {
  const base = {
    position: 'absolute',
    width: 0,
    height: 0,
    filter: 'drop-shadow(0 4px 6px rgba(60, 30, 15, 0.2))',
  };
  // Wrap the arrow in a positioned container so the inner animation
  // doesn't fight the centering transform.
  const wrappers = {
    down:  { position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)' },
    up:    { position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)' },
    right: { position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)' },
    left:  { position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)' },
  };
  const triangles = {
    down:  { ...base, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `14px solid ${PALETTE.milk}` },
    up:    { ...base, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderBottom: `14px solid ${PALETTE.milk}` },
    right: { ...base, borderTop: '14px solid transparent', borderBottom: '14px solid transparent', borderLeft: `14px solid ${PALETTE.milk}` },
    left:  { ...base, borderTop: '14px solid transparent', borderBottom: '14px solid transparent', borderRight: `14px solid ${PALETTE.milk}` },
  };
  const animClass = {
    down: 'animate-[nudgeDown_1.2s_ease-in-out_infinite]',
    up: 'animate-[nudgeUp_1.2s_ease-in-out_infinite]',
    right: 'animate-[nudgeRight_1.2s_ease-in-out_infinite]',
    left: 'animate-[nudgeLeft_1.2s_ease-in-out_infinite]',
  };
  return (
    <div style={wrappers[direction]}>
      <div style={triangles[direction]} className={animClass[direction]} />
    </div>
  );
}

// ============================================================
// Settings Modal — Replay tutorial
// ============================================================
function SettingsModal({ onClose, onReplay, tutorialActive }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(30, 18, 10, 0.5)' }}>
      <div style={styles.settingsCard} className="animate-[popCard_380ms_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={styles.stepLabel}>Menu</div>
            <div style={styles.settingsTitle}>Settings</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={styles.settingsRowTitle}>Tutorial</div>
            <div style={styles.settingsRowSub}>
              {tutorialActive ? 'Currently in progress' : 'Replay the walkthrough any time'}
            </div>
          </div>
          <button onClick={onReplay} style={styles.replayBtn} className="transition-transform hover:scale-[1.03] active:scale-[0.97]">
            <RotateCcw size={14} strokeWidth={2.5} />
            Replay
          </button>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={styles.settingsRowTitle}>Sound</div>
            <div style={styles.settingsRowSub}>Music and FX</div>
          </div>
          <div style={styles.toggleOn}><div style={styles.toggleThumb} /></div>
        </div>

        <div style={styles.settingsRow}>
          <div>
            <div style={styles.settingsRowTitle}>Haptics</div>
            <div style={styles.settingsRowSub}>Vibration on actions</div>
          </div>
          <div style={styles.toggleOn}><div style={styles.toggleThumb} /></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Small components
// ============================================================
function SectionLabel({ index, title, subtitle }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <div style={styles.sectionIndex}>{index}</div>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionSub}>— {subtitle}</div>
    </div>
  );
}

function HudChip({ label, icon, value, highlight, anchorId, tint }) {
  return (
    <div
      id={anchorId}
      style={{
        ...styles.hudChip,
        ...(highlight ? { ...styles.hudChipHighlight, boxShadow: `0 0 0 3px ${tint}, 0 8px 24px rgba(200, 90, 75, 0.3)` } : {}),
      }}
      className="relative"
    >
      {highlight && <Pulse small />}
      <div style={{ ...styles.hudIcon, background: tint }}>{icon}</div>
      <div>
        <div style={styles.hudLabel}>{label}</div>
        <div style={styles.hudValue}>{value}</div>
      </div>
    </div>
  );
}

function Pulse({ small }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: small ? -4 : -8,
        borderRadius: small ? 18 : 28,
        border: '2px solid #C85A4B',
        pointerEvents: 'none',
      }}
      className="animate-[pulseRing_1.6s_ease-out_infinite]"
    />
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B2416" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ============================================================
// Styles — inline style objects (warm café palette)
// ============================================================
const PALETTE = {
  cream: '#FFF4E2',
  milk: '#FFF9F0',
  espresso: '#3B2416',
  cocoa: '#6B4530',
  caramel: '#D4A13F',
  tomato: '#C85A4B',
  peach: '#E8856B',
  pistachio: '#A8C09A',
  ink: '#2A1A10',
};

const styles = {
  root: {
    background: PALETTE.cream,
    fontFamily: '"Fraunces", "Playfair Display", Georgia, serif',
    color: PALETTE.espresso,
    minHeight: '100vh',
  },
  bgGradient: {
    background: `radial-gradient(circle at 20% 10%, #FFE4C4 0%, transparent 50%),
                 radial-gradient(circle at 85% 80%, #FFDFC4 0%, transparent 55%),
                 radial-gradient(circle at 50% 50%, #FFF4E2 0%, #F5E5CF 100%)`,
  },
  bgGrain: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  },
  bgSteam: {
    background: 'radial-gradient(ellipse at 70% 0%, rgba(255,255,255,0.4), transparent 40%)',
  },
  logoBadge: {
    width: 44, height: 44,
    borderRadius: 14,
    background: PALETTE.caramel,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 0 #A77F2F, 0 10px 20px rgba(60, 30, 15, 0.15)',
  },
  logoKicker: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: PALETTE.cocoa,
    fontWeight: 600,
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: PALETTE.espresso,
    fontStyle: 'italic',
  },
  hudChip: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: PALETTE.milk,
    padding: '8px 14px 8px 8px',
    borderRadius: 14,
    border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    transition: 'all 240ms ease',
  },
  hudChipHighlight: {
    transform: 'scale(1.06) translateY(-2px)',
  },
  hudIcon: {
    width: 30, height: 30,
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: PALETTE.milk,
    boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.15)',
  },
  hudLabel: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: PALETTE.cocoa,
    fontWeight: 700,
  },
  hudValue: {
    fontSize: 16,
    fontWeight: 800,
    color: PALETTE.espresso,
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  gearBtn: {
    width: 42, height: 42,
    borderRadius: 12,
    background: PALETTE.milk,
    border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },

  // Section labels
  sectionIndex: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    fontWeight: 700,
    color: PALETTE.caramel,
    letterSpacing: '0.1em',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    fontStyle: 'italic',
    color: PALETTE.espresso,
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: PALETTE.cocoa,
  },

  // Tray / ingredients
  tray: {
    background: PALETTE.milk,
    padding: 20,
    borderRadius: 24,
    border: `2.5px solid ${PALETTE.espresso}`,
    boxShadow: `0 8px 0 ${PALETTE.espresso}`,
    transition: 'all 300ms ease',
  },
  trayHighlight: {
    transform: 'translateY(-3px)',
    boxShadow: `0 11px 0 ${PALETTE.espresso}, 0 16px 40px rgba(200, 90, 75, 0.35)`,
  },
  ingredient: {
    aspectRatio: '1 / 1.05',
    borderRadius: 16,
    border: `2.5px solid ${PALETTE.espresso}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    userSelect: 'none',
    transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  ingredientName: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: PALETTE.espresso,
  },

  // Plate
  plate: {
    background: PALETTE.milk,
    minHeight: 200,
    borderRadius: 24,
    border: `2.5px dashed ${PALETTE.cocoa}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
    transition: 'all 300ms ease',
  },
  plateHighlight: {
    borderStyle: 'solid',
    borderColor: PALETTE.tomato,
    transform: 'translateY(-3px)',
    boxShadow: `0 10px 30px rgba(200, 90, 75, 0.35)`,
  },
  plateEmpty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    opacity: 0.7,
  },
  plateCircle: {
    width: 88, height: 88,
    borderRadius: '50%',
    background: '#F5E5CF',
    border: `2px dashed ${PALETTE.cocoa}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  plateHint: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: PALETTE.cocoa,
  },
  plateItem: {
    width: 90, height: 90,
    borderRadius: '50%',
    background: PALETTE.cream,
    border: `2.5px solid ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 4px 0 ${PALETTE.espresso}`,
  },
  plateGhost: {
    fontSize: 28, fontWeight: 800, color: PALETTE.cocoa, opacity: 0.4,
    fontFamily: '"Space Mono", monospace',
  },
  plusSign: {
    fontSize: 28, fontWeight: 800, color: PALETTE.tomato,
  },
  completedDish: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '14px 28px',
    background: '#FFF0DD',
    borderRadius: 20,
    border: `2.5px solid ${PALETTE.espresso}`,
    boxShadow: `0 5px 0 ${PALETTE.espresso}`,
  },
  dishName: {
    fontSize: 20, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso,
    letterSpacing: '-0.01em',
  },
  dishTag: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: '"Space Mono", monospace',
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: PALETTE.tomato,
    fontWeight: 700,
  },

  // Customer
  customerCard: {
    background: PALETTE.milk,
    padding: 24,
    borderRadius: 24,
    border: `2.5px solid ${PALETTE.espresso}`,
    boxShadow: `0 8px 0 ${PALETTE.espresso}`,
    transition: 'all 300ms ease',
    position: 'relative',
  },
  customerHighlight: {
    transform: 'translateY(-3px)',
    boxShadow: `0 11px 0 ${PALETTE.espresso}, 0 16px 40px rgba(200, 90, 75, 0.35)`,
  },
  bubble: {
    background: PALETTE.cream,
    borderRadius: 18,
    padding: '10px 14px',
    border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    marginBottom: 16,
    position: 'relative',
    width: 'fit-content',
  },
  bubbleLabel: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 9,
    letterSpacing: '0.2em',
    fontWeight: 700,
    color: PALETTE.tomato,
  },
  bubbleDish: {
    fontSize: 15, fontWeight: 700, color: PALETTE.espresso,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    left: 30,
    width: 0, height: 0,
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    borderTop: `8px solid ${PALETTE.espresso}`,
  },
  customer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    paddingTop: 8,
  },
  customerFace: {
    width: 120, height: 120,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${PALETTE.pistachio}, #8AAB7F)`,
    border: `3px solid ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 5px 0 ${PALETTE.espresso}`,
  },
  customerEmoji: { fontSize: 64, lineHeight: 1 },
  customerName: {
    fontSize: 16, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso,
    marginTop: 8,
  },
  customerStatus: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: PALETTE.cocoa,
  },
  patienceTrack: {
    marginTop: 14,
    height: 10,
    background: '#F5E5CF',
    borderRadius: 99,
    border: `2px solid ${PALETTE.espresso}`,
    overflow: 'hidden',
  },
  patienceFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${PALETTE.peach}, ${PALETTE.caramel})`,
    transition: 'width 600ms ease',
  },
  floatCoin: {
    display: 'inline-block',
    fontSize: 22,
    fontWeight: 900,
    color: PALETTE.caramel,
    fontFamily: '"Space Mono", monospace',
    animation: 'floatUp 1s ease-out forwards',
  },

  // Modes
  modeTile: {
    background: PALETTE.milk,
    padding: '14px 16px',
    borderRadius: 14,
    border: `2px solid ${PALETTE.espresso}`,
    boxShadow: `0 4px 0 ${PALETTE.espresso}`,
    transition: 'all 400ms ease',
  },
  modeName: {
    fontSize: 15, fontWeight: 800, fontStyle: 'italic', color: PALETTE.espresso,
    letterSpacing: '-0.01em',
  },
  modeStatus: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: PALETTE.cocoa,
    display: 'flex', alignItems: 'center', gap: 4,
    marginTop: 4,
  },

  // Tutorial card
  scrim: {
    background: 'rgba(30, 18, 10, 0.4)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  tutorialCard: {
    background: PALETTE.milk,
    borderRadius: 22,
    border: `2.5px solid ${PALETTE.espresso}`,
    padding: 22,
    boxShadow: `0 8px 0 ${PALETTE.espresso}, 0 20px 60px rgba(30, 18, 10, 0.25)`,
    position: 'relative',
  },
  stepLabel: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: PALETTE.tomato,
    fontWeight: 700,
    marginBottom: 6,
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: 800,
    fontStyle: 'italic',
    color: PALETTE.espresso,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    marginBottom: 8,
  },
  tutorialBody: {
    fontSize: 14.5,
    lineHeight: 1.5,
    color: PALETTE.cocoa,
    marginBottom: 16,
  },
  skipBtn: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: PALETTE.cocoa,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  nextBtn: {
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: PALETTE.tomato,
    color: PALETTE.milk,
    border: `2.5px solid ${PALETTE.espresso}`,
    borderRadius: 14,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    boxShadow: `0 5px 0 ${PALETTE.espresso}`,
    fontFamily: 'inherit',
  },
  actionHint: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#FFEDDE',
    border: `2px dashed ${PALETTE.tomato}`,
    borderRadius: 12,
    padding: '10px 14px',
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: PALETTE.tomato,
  },
  pulseDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: PALETTE.tomato,
    animation: 'pulse 1s ease-in-out infinite',
  },

  // Settings
  settingsCard: {
    width: '100%',
    maxWidth: 420,
    background: PALETTE.milk,
    borderRadius: 22,
    border: `2.5px solid ${PALETTE.espresso}`,
    padding: 24,
    boxShadow: `0 8px 0 ${PALETTE.espresso}, 0 20px 60px rgba(30, 18, 10, 0.4)`,
  },
  settingsTitle: {
    fontSize: 26,
    fontWeight: 800,
    fontStyle: 'italic',
    color: PALETTE.espresso,
    letterSpacing: '-0.02em',
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    background: PALETTE.cream,
    border: `2px solid ${PALETTE.espresso}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  settingsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0',
    borderTop: `1.5px dashed ${PALETTE.cocoa}40`,
  },
  settingsRowTitle: {
    fontSize: 15, fontWeight: 800, color: PALETTE.espresso, fontStyle: 'italic',
  },
  settingsRowSub: {
    fontFamily: '"Space Mono", monospace',
    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: PALETTE.cocoa, marginTop: 2,
  },
  replayBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: PALETTE.tomato,
    color: PALETTE.milk,
    border: `2px solid ${PALETTE.espresso}`,
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: `0 3px 0 ${PALETTE.espresso}`,
    fontFamily: '"Space Mono", monospace',
  },
  toggleOn: {
    width: 44, height: 24,
    borderRadius: 99,
    background: PALETTE.pistachio,
    border: `2px solid ${PALETTE.espresso}`,
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    right: 2, top: 1,
    width: 16, height: 16,
    borderRadius: '50%',
    background: PALETTE.milk,
    border: `1.5px solid ${PALETTE.espresso}`,
  },
};

// Load Google Fonts + keyframes
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;0,800;1,700;1,800&family=Space+Mono:wght@400;700&display=swap');
  @keyframes pop {
    0% { transform: scale(0.3); opacity: 0; }
    60% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes popCard {
    0% { transform: scale(0.85) translateY(10px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes pulseRing {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.15); opacity: 0; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.6; }
  }
  @keyframes nudgeDown {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(6px); }
  }
  @keyframes nudgeUp {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes nudgeRight {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(6px); }
  }
  @keyframes nudgeLeft {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(-6px); }
  }
  @keyframes floatUp {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-40px); opacity: 0; }
  }
`;
