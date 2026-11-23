import { describe, expect, it } from 'vitest';
import { resolvePerPrayerTimes, tahajjudTimeOrNull } from './prayer.js';

/**
 * P2/P6 regression tests: when Aladhan cannot resolve the saved city
 * (or is down), the prayer-times route falls back to the user's own
 * manual times instead of hiding them behind a 502. The resolver is
 * the pure core of that fallback.
 */
const calculated = {
  Fajr: '05:28',
  Sunrise: '06:45',
  Dhuhr: '12:20',
  Asr: '16:21',
  Maghrib: '17:56',
  Isha: '19:12',
};

describe('resolvePerPrayerTimes', () => {
  it('uses calculated times and next-prayer deadlines by default', () => {
    const { perPrayer, displayTimes, manualCount } = resolvePerPrayerTimes({}, calculated);
    expect(displayTimes.Fajr).toBe('05:28');
    expect(perPrayer.Fajr).toMatchObject({ time: '05:28', deadline: '12:20', source: 'calculated' });
    expect(perPrayer.Isha.deadline).toBe('23:59');
    expect(manualCount).toBe(0);
  });

  it('lets a manual timeOverride and endTime win over calculated times', () => {
    const { perPrayer, manualCount } = resolvePerPrayerTimes(
      { Fajr: { timeOverride: '05:15', endTime: '06:00', reminder: true } },
      calculated,
    );
    expect(perPrayer.Fajr).toMatchObject({ time: '05:15', deadline: '06:00', source: 'manual' });
    expect(perPrayer.Dhuhr.time).toBe('12:20');
    expect(manualCount).toBe(1);
  });

  it('serves manual times when Aladhan returns nothing (P2/P6 fallback)', () => {
    const { perPrayer, displayTimes, manualCount } = resolvePerPrayerTimes(
      { Fajr: { timeOverride: '05:15' } },
      null,
    );
    expect(displayTimes.Fajr).toBe('05:15');
    expect(perPrayer.Fajr).toMatchObject({ time: '05:15', source: 'manual' });
    expect(manualCount).toBe(1);
  });

  it('never fabricates a time: no manual + no calculated is unavailable, not guessed', () => {
    const { perPrayer, manualCount } = resolvePerPrayerTimes(
      { Fajr: { timeOverride: '05:15' } },
      null,
    );
    expect(perPrayer.Dhuhr).toMatchObject({ time: '', deadline: '', source: 'unavailable' });
    expect(perPrayer.Isha).toMatchObject({ time: '', deadline: '', source: 'unavailable' });
    expect(manualCount).toBe(1);
  });

  it('counts no manual times when nothing is set, so the route still 502s honestly', () => {
    const { manualCount } = resolvePerPrayerTimes({}, null);
    expect(manualCount).toBe(0);
  });

  it('ignores an invalid manual override instead of trusting it', () => {
    const { perPrayer, manualCount } = resolvePerPrayerTimes(
      { Fajr: { timeOverride: '25:99' } },
      calculated,
    );
    expect(perPrayer.Fajr).toMatchObject({ time: '05:28', source: 'calculated' });
    expect(manualCount).toBe(0);
  });
});

describe('tahajjudTimeOrNull (optional Tahajjud — unset means nothing, never a guess)', () => {
  it('passes a valid HH:mm time through', () => {
    expect(tahajjudTimeOrNull('03:30')).toBe('03:30');
    expect(tahajjudTimeOrNull(' 03:30 ')).toBe('03:30');
  });

  it('returns null when unset, empty, or malformed', () => {
    expect(tahajjudTimeOrNull('')).toBeNull();
    expect(tahajjudTimeOrNull(undefined)).toBeNull();
    expect(tahajjudTimeOrNull(null)).toBeNull();
    expect(tahajjudTimeOrNull('25:99')).toBeNull();
    expect(tahajjudTimeOrNull('3:30')).toBeNull();
  });
});
