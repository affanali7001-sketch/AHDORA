import { describe, expect, it } from 'vitest';
import {
  ddmmyyyyToIso,
  normaliseAladhanDay,
  shiftedLookup,
} from './hijri.js';

/**
 * P1 regression tests: Aladhan returns every date as DD-MM-YYYY
 * ("01-11-2026") while the codebase keys days as ISO YYYY-MM-DD.
 * Comparing the two formats directly never matched, so /today always
 * 502'd, the month grid stayed empty ("·2026") and the ± adjustment
 * silently did nothing.
 *
 * The day below mirrors the real upstream payload for 2026-11-20
 * (verified live: hijri 10-06-1448, Jumādá al-ākhirah).
 */
const rawDay = {
  gregorian: { date: '20-11-2026', weekday: { en: 'Friday' } },
  hijri: {
    date: '10-06-1448',
    day: '10',
    month: { number: 6, en: 'Jumādá al-ākhirah', ar: 'جُمادى الآخرة', days: 29 },
    year: '1448',
    holidays: [],
  },
};

describe('ddmmyyyyToIso', () => {
  it('converts the Aladhan format to ISO keys', () => {
    expect(ddmmyyyyToIso('01-11-2026')).toBe('2026-11-01');
    expect(ddmmyyyyToIso('20-11-2026')).toBe('2026-11-20');
  });

  it('rejects non-dates and impossible dates', () => {
    expect(ddmmyyyyToIso('2026-11-20')).toBe('');
    expect(ddmmyyyyToIso('31-02-2026')).toBe('');
    expect(ddmmyyyyToIso('')).toBe('');
    expect(ddmmyyyyToIso('not-a-date')).toBe('');
  });
});

describe('normaliseAladhanDay', () => {
  it('rewrites gregorian.date to ISO and keeps the Hijri fields', () => {
    const day = normaliseAladhanDay(rawDay);
    expect(day?.gregorian.date).toBe('2026-11-20');
    expect(day?.hijri.day).toBe('10');
    expect(day?.hijri.month.en).toBe('Jumādá al-ākhirah');
    expect(day?.hijri.year).toBe('1448');
  });

  it('drops a day whose Gregorian date cannot be parsed', () => {
    expect(
      normaliseAladhanDay({ ...rawDay, gregorian: { date: 'garbage' } }),
    ).toBeNull();
  });
});

describe('shiftedLookup', () => {
  const days = [
    normaliseAladhanDay({ ...rawDay, gregorian: { date: '19-11-2026' } })!,
    normaliseAladhanDay(rawDay)!,
    normaliseAladhanDay({ ...rawDay, gregorian: { date: '21-11-2026' } })!,
  ];

  it('finds the same day with no adjustment', () => {
    expect(shiftedLookup(days, '2026-11-20', 0)?.gregorian.date).toBe('2026-11-20');
  });

  it('shifts the Hijri lookup by the day adjustment', () => {
    expect(shiftedLookup(days, '2026-11-20', 1)?.gregorian.date).toBe('2026-11-21');
    expect(shiftedLookup(days, '2026-11-20', -1)?.gregorian.date).toBe('2026-11-19');
  });

  it('returns null when the shifted day is outside the loaded days', () => {
    expect(shiftedLookup(days, '2026-11-20', 2)).toBeNull();
  });
});
