import { useEffect, useState } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import './Tasbeeh.css';
import {
  TASBEEH_TARGET,
  loadTasbeeh,
  saveTasbeeh,
  type DhikrId,
  type TasbeehState,
} from '../lib/tasbeeh.js';

const DHIKRS: { id: DhikrId; arabic: string; label: string }[] = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', label: 'SubhanAllah' },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', label: 'Alhamdulillah' },
  { id: 'allahu-akbar', arabic: 'اللَّهُ أَكْبَرُ', label: 'Allahu Akbar' },
];

function vibrateOnRoundComplete() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(120);
    }
  } catch {
    // Vibration is a device capability, not data — never let it break the tap.
  }
}

/**
 * Tasbeeh — zikr counter (preview #10, dark).
 *
 * Tap the circle to count. At 99 the round completes (vibration if the
 * device supports it) and the round resets to 0 while the daily total
 * keeps counting. Reset zeroes the current round only, never the daily
 * total. Counts live in localStorage only, keyed by userId + today —
 * per-device by design, never fed into Dashboard/Analytics.
 */
export default function Tasbeeh({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [active, setActive] = useState<DhikrId>('subhanallah');
  const [state, setState] = useState<TasbeehState>(() => loadTasbeeh(userId));

  // A different signed-in user gets their own counts, never the previous user's.
  useEffect(() => {
    setState(loadTasbeeh(userId));
  }, [userId]);

  useEffect(() => {
    saveTasbeeh(userId, state);
  }, [userId, state]);

  const current = DHIKRS.find((d) => d.id === active) ?? DHIKRS[0];
  const count = state.counts[active];

  function tap() {
    setState((prev) => {
      const next = prev.counts[active] + 1;
      if (next >= TASBEEH_TARGET) {
        vibrateOnRoundComplete();
        return {
          counts: { ...prev.counts, [active]: 0 },
          dailyTotal: prev.dailyTotal + 1,
        };
      }
      return {
        counts: { ...prev.counts, [active]: next },
        dailyTotal: prev.dailyTotal + 1,
      };
    });
  }

  function resetRound() {
    setState((prev) => ({
      ...prev,
      counts: { ...prev.counts, [active]: 0 },
    }));
  }

  return (
    <section className="tasbeeh-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Tasbeeh</h4>
          <div className="asub">Tap karo, ginti badhegi</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn gh" onClick={resetRound}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      <div className="tasbeeh-dhikr">
        <div className="arab">{current.arabic}</div>
        <div className="tasbeeh-name">{current.label}</div>
        <div className="mut">
          Target: {TASBEEH_TARGET} · Aaj kul: {state.dailyTotal}
        </div>
      </div>

      <button
        type="button"
        className="tasbcircle"
        onClick={tap}
        aria-label={`${current.label} ki ginti badhao`}
      >
        <span>
          <b>{count}</b>
          <span className="tasbcircle-of">/ {TASBEEH_TARGET}</span>
          <span className="tasbcircle-hint">TAP KARO</span>
        </span>
      </button>

      <div className="tasbeeh-switcher">
        {DHIKRS.map((dhikr) => (
          <button
            key={dhikr.id}
            type="button"
            className={`sbtn ${dhikr.id === active ? 'pk' : 'gh'}`}
            onClick={() => setActive(dhikr.id)}
            aria-pressed={dhikr.id === active}
          >
            {dhikr.label}
          </button>
        ))}
      </div>

      <div className="acard">
        <p className="mut">
          Ginti {TASBEEH_TARGET} par vibration ke saath ek round poora hoga aur ginti phir 0 se
          shuru hogi. Reset sirf is round ki ginti zero karta hai — aaj ka kul total waisa hi
          rehta hai. Aaj ki ginti isi device par save hoti hai.
        </p>
      </div>
    </section>
  );
}
