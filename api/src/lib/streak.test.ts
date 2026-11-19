import { describe, expect, it } from 'vitest';
import { computeStreakFromDayKeys } from './streak.js';

const days = (...keys: string[]) => new Set(keys);

describe('computeStreakFromDayKeys', () => {
  it('returns 0 with no activity', () => {
    expect(computeStreakFromDayKeys(days(), '2026-11-19')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(
      computeStreakFromDayKeys(days('2026-11-17', '2026-11-18', '2026-11-19'), '2026-11-19'),
    ).toBe(3);
  });

  it('counts from yesterday when today has no activity yet', () => {
    expect(
      computeStreakFromDayKeys(days('2026-11-17', '2026-11-18'), '2026-11-19'),
    ).toBe(2);
  });

  it('returns 0 when the last activity was two days ago', () => {
    expect(computeStreakFromDayKeys(days('2026-11-17'), '2026-11-19')).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(
      computeStreakFromDayKeys(days('2026-11-10', '2026-11-11', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'), '2026-11-19'),
    ).toBe(5);
  });

  it('counts a single day', () => {
    expect(computeStreakFromDayKeys(days('2026-11-19'), '2026-11-19')).toBe(1);
  });
});
