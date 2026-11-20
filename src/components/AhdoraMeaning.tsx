import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * What AHDORA stands for — shown on the welcome page with a staggered
 * entrance animation when it scrolls into view:
 * A – Ambition, H – Habits, D – Discipline,
 * O – Ownership, R – Resilience, A – Achievement.
 * The animation only starts once the strip is visible, so people
 * actually see the letters arrive. Reduced-motion users see the
 * full strip at once, with no animation.
 */
const MEANING = [
  { letter: 'A', word: 'Ambition' },
  { letter: 'H', word: 'Habits' },
  { letter: 'D', word: 'Discipline' },
  { letter: 'O', word: 'Ownership' },
  { letter: 'R', word: 'Resilience' },
  { letter: 'A', word: 'Achievement' },
];

export default function AhdoraMeaning() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`meaning-strip${visible ? ' meaning-visible' : ''}`}
      id="meaning"
      aria-label="What AHDORA means"
    >
      <div className="meaning-intro">
        <span className="eyebrow">WHAT AHDORA MEANS</span>
        <h2>
          AHDORA sirf ek naam nahi —
          <br />
          ek tareeka hai jeene ka.
        </h2>
        <p>Har akshar ek aadat hai, jo tumhe thoda behtar banata hai.</p>
      </div>
      <div className="meaning-grid">
        {MEANING.map((item, index) => (
          <div
            className="meaning-item"
            key={`${item.letter}-${index}`}
            style={{ ['--d' as string]: `${index * 0.12}s` } as CSSProperties}
          >
            <span className="meaning-letter" aria-hidden="true">
              {item.letter}
            </span>
            <strong className="meaning-word">{item.word}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
