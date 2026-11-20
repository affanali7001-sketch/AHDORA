import { describe, expect, it } from 'vitest';
import { earnedFocusMinutes } from './study.js';

/**
 * Focus-minutes computation (P11, 2026-11-21): a finished focus
 * session earns whole minutes from the REAL elapsed running time —
 * never the planned minutes, and never a misleading "0m earned" for
 * a session that actually ran. Pure function, no DB (see
 * vitest.config.ts).
 *
 * The overnight live check found a finished 25-minute session showing
 * "0m earned" / "Focused today 0min": the session was finished inside
 * its first minute ("Finish now"), and the old Math.floor(elapsed/60s)
 * rounded that down to 0.
 */
describe('earnedFocusMinutes', () => {
  it('records a full 25-minute session as 25m', () => {
    expect(earnedFocusMinutes(25 * 60_000)).toBe(25);
    // A few seconds over the plan still counts as the plan.
    expect(earnedFocusMinutes(25 * 60_000 + 4_000)).toBe(25);
  });

  it('rounds to the nearest minute from real elapsed time', () => {
    // Finished at 24m31s of a 25-minute plan: 25m, not 24m.
    expect(earnedFocusMinutes((24 * 60 + 31) * 1000)).toBe(25);
    expect(earnedFocusMinutes((24 * 60 + 29) * 1000)).toBe(24);
    expect(earnedFocusMinutes(90_000)).toBe(2);
  });

  it('never shows 0m for a session that actually ran', () => {
    // The exact overnight-check case: finished seconds after starting.
    expect(earnedFocusMinutes(5_000)).toBe(1);
    expect(earnedFocusMinutes(45_000)).toBe(1);
    expect(earnedFocusMinutes(59_000)).toBe(1);
  });

  it('still earns 0 when nothing ran', () => {
    expect(earnedFocusMinutes(0)).toBe(0);
    expect(earnedFocusMinutes(-1_000)).toBe(0);
    expect(earnedFocusMinutes(Number.NaN)).toBe(0);
  });
});
