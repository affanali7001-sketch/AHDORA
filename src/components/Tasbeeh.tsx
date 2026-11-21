import { useEffect, useState } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import './Tasbeeh.css';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';
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
export default function Tasbeeh({ userId, onBack, language }: { userId: string; onBack: () => void; language: AppLanguage }) {
  const s = stringsFor(language);
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
        <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.tasbeeh.title}</h4>
          <div className="asub">{s.tasbeeh.sub}</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn gh" onClick={resetRound}>
            <RotateCcw size={13} /> {s.tasbeeh.reset}
          </button>
        </div>
      </div>

      <div className="tasbeeh-dhikr">
        <div className="arab">{current.arabic}</div>
        <div className="tasbeeh-name">{current.label}</div>
        <div className="mut">
          {s.tasbeeh.targetLine(TASBEEH_TARGET, state.dailyTotal)}
        </div>
      </div>

      <button
        type="button"
        className="tasbcircle"
        onClick={tap}
        aria-label={s.tasbeeh.tapAria(current.label)}
      >
        <span>
          <b>{count}</b>
          <span className="tasbcircle-of">/ {TASBEEH_TARGET}</span>
          <span className="tasbcircle-hint">{s.tasbeeh.tapHint}</span>
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
          {s.tasbeeh.note(TASBEEH_TARGET)}
        </p>
      </div>
    </section>
  );
}
