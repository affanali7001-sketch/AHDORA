import { useEffect, useState } from 'react';

/**
 * Types the greeting one character at a time, with a blinking caret.
 * When the user prefers reduced motion the full text appears at once.
 */
export default function Typewriter({
  text,
  speed = 65,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      setDone(true);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);

  return (
    <span className={className}>
      {shown}
      {!done && <span className="auth-caret" aria-hidden="true" />}
    </span>
  );
}
