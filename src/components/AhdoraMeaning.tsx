import { useEffect, useState } from 'react';

/**
 * What AHDORA stands for, typed out live on the login card, right
 * after the Salam greeting — no scrolling needed:
 *   A — Ambition, H — Habits, D — Discipline,
 *   O — Ownership, R — Resilience, A — Achievement.
 *
 * Each row plays in turn: the letter pops in, then its word types
 * out letter by letter beside it, with a blinking caret. All six
 * rows always take up their space, so the card never jumps around
 * while the animation plays. Reduced-motion users see all six
 * rows complete at once, with no animation.
 */
const MEANING = [
  { letter: 'A', word: 'Ambition' },
  { letter: 'H', word: 'Habits' },
  { letter: 'D', word: 'Discipline' },
  { letter: 'O', word: 'Ownership' },
  { letter: 'R', word: 'Resilience' },
  { letter: 'A', word: 'Achievement' },
];

const TYPE_SPEED_MS = 45;
const LETTER_PAUSE_MS = 300;
const ROW_PAUSE_MS = 350;

export default function AhdoraMeaning() {
  const [rowIndex, setRowIndex] = useState(0);
  const [letterShown, setLetterShown] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRowIndex(MEANING.length);
      setLetterShown(true);
      return;
    }
    if (rowIndex >= MEANING.length) return;
    if (!letterShown) {
      const timer = window.setTimeout(() => setLetterShown(true), LETTER_PAUSE_MS);
      return () => window.clearTimeout(timer);
    }
    const word = MEANING[rowIndex].word;
    if (charCount < word.length) {
      const timer = window.setTimeout(() => setCharCount((count) => count + 1), TYPE_SPEED_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setRowIndex((row) => row + 1);
      setLetterShown(false);
      setCharCount(0);
    }, ROW_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [rowIndex, letterShown, charCount]);

  const done = rowIndex >= MEANING.length;

  return (
    <div className="meaning-type" aria-label="What AHDORA means">
      {MEANING.map((item, index) => {
        const isPast = index < rowIndex;
        const isCurrent = index === rowIndex;
        const shown = isPast ? item.word : isCurrent && letterShown ? item.word.slice(0, charCount) : '';
        const letterVisible = isPast || (isCurrent && letterShown);
        return (
          <div className="meaning-type-row" key={`${item.letter}-${index}`}>
            <span
              className={`meaning-type-letter${letterVisible ? ' meaning-type-letter-in' : ''}`}
              aria-hidden="true"
            >
              {letterVisible ? item.letter : ''}
            </span>
            <span className="meaning-type-dash" aria-hidden="true">
              —
            </span>
            <span className="meaning-type-word">
              {shown}
              {isCurrent && !done && letterShown && (
                <span className="auth-caret" aria-hidden="true" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
