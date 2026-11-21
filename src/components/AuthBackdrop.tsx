/**
 * Calm & Elegant animated backdrop for the auth screens.
 * Pure CSS motion: slow-drifting emerald orbs, a gently panning Islamic
 * eight-point-star lattice (inline SVG, no external images), a soft
 * crescent and a few twinkling stars. All animation is disabled by the
 * global `prefers-reduced-motion` rule in styles.css.
 */
export default function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-orb auth-orb-three" />
      <svg className="auth-pattern" aria-hidden="true">
        <defs>
          <pattern id="auth-star-pattern" width="84" height="84" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#147A6E" strokeWidth="1">
              <rect x="26" y="26" width="32" height="32" />
              <rect x="26" y="26" width="32" height="32" transform="rotate(45 42 42)" />
              <circle cx="42" cy="42" r="3" />
              <circle cx="0" cy="0" r="1.6" />
              <circle cx="84" cy="0" r="1.6" />
              <circle cx="0" cy="84" r="1.6" />
              <circle cx="84" cy="84" r="1.6" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-star-pattern)" />
      </svg>
      <span className="auth-crescent">☾</span>
      <span className="auth-star auth-star-one">✦</span>
      <span className="auth-star auth-star-two">✧</span>
      <span className="auth-star auth-star-three">✦</span>
    </div>
  );
}
