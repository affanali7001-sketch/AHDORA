import { describe, expect, it } from 'vitest';
import {
  collectHijriEvents,
  matchHijriEventKey,
  normaliseAladhanDay,
} from './hijri.js';

/**
 * GET /api/hijri/events — the next Ramadan / Eid-ul-Fitr /
 * Eid-ul-Adha (Bakrid) / Shab-e-Qadr / Arafah / Islamic New Year /
 * Ashura / Mawlid / Shab-e-Miraj / Shab-e-Barat, with Hijri +
 * Gregorian dates and a days-until countdown.
 *
 * Regression (user report 2026-11-22): the Hijri screen only
 * scanned the current month + 2 ahead, so Ramadan, Eid and Bakrid
 * — months away — never appeared anywhere in the app. The events
 * endpoint scans 14 Gregorian months forward (a full Hijri year is
 * ~354 days) and returns only real Aladhan holiday markers.
 *
 * These are pure-function tests (no HTTP, no DB): the route itself
 * is covered by the HTTP test in hijriPublic.test.ts.
 */

function rawDay(
  gregorianDDMMYYYY: string,
  hijriDay: string,
  hijriMonthEn: string,
  hijriYear: string,
  holidays: string[],
  hijriMonthNumber = 9,
) {
  return {
    gregorian: { date: gregorianDDMMYYYY, weekday: { en: 'Monday' } },
    hijri: {
      date: `${hijriDay}-09-1448`,
      day: hijriDay,
      month: { number: hijriMonthNumber, en: hijriMonthEn, ar: 'رمضان', days: 30 },
      year: hijriYear,
      holidays,
    },
  };
}

/** Small normalised day list around Ramadan 1447 (1 Ramadan = 08-02-2027). */
function ramadanDays() {
  return [
    rawDay('07-02-2027', '29', "Sha'bān", '1448', []),
    rawDay('08-02-2027', '1', 'Ramadan', '1447', ['1st Day of Ramadan']),
    rawDay('09-02-2027', '2', 'Ramadan', '1447', []),
    rawDay('27-02-2027', '20', 'Ramadan', '1447', []),
    rawDay('28-02-2027', '21', 'Ramadan', '1447', ['Lailat-ul-Qadr']),
    rawDay('10-03-2027', '1', 'Shawwāl', '1447', ['Eid al-Fitr']),
    rawDay('27-05-2027', '10', 'Dhū al-Hijjah', '1447', ['Eid al-Adha']),
    rawDay('26-05-2027', '9', 'Dhū al-Hijjah', '1447', ['Day of Arafah']),
  ]
    .map(normaliseAladhanDay)
    .filter((day): day is NonNullable<typeof day> => day !== null);
}

describe('matchHijriEventKey', () => {
  it('maps every key Aladhan holiday name to its key', () => {
    expect(matchHijriEventKey('1st Day of Ramadan')).toBe('ramadan');
    expect(matchHijriEventKey('Eid al-Fitr')).toBe('eid-fitr');
    expect(matchHijriEventKey('Eid al-Adha')).toBe('eid-adha');
    expect(matchHijriEventKey('Lailat-ul-Qadr')).toBe('qadr');
    expect(matchHijriEventKey('Day of Arafah')).toBe('arafah');
    // Aladhan spells it 'Arafa' (verified live 2027-05-15) — both spellings map.
    expect(matchHijriEventKey('Arafa')).toBe('arafah');
    expect(matchHijriEventKey('Islamic New Year')).toBe('new-year');
    expect(matchHijriEventKey('Day of Ashura')).toBe('ashura');
    expect(matchHijriEventKey("Prophet's Birthday")).toBe('mawlid');
    expect(matchHijriEventKey('Isra and Mi\u2019raj')).toBe('miraj');
    expect(matchHijriEventKey("Laylat al-Bara'at")).toBe('barat');
  });

  it('returns null for anything that is not a key day', () => {
    expect(matchHijriEventKey('Some random day')).toBeNull();
    expect(matchHijriEventKey('')).toBeNull();
  });

  it('checks specific names before the broad Ramadan match', () => {
    // Lailat-ul-Qadr falls in Ramadan but is its own key day.
    expect(matchHijriEventKey('Lailat-ul-Qadr')).toBe('qadr');
    expect(matchHijriEventKey('Eid al-Fitr')).toBe('eid-fitr');
  });
});

describe('collectHijriEvents', () => {
  it('finds Ramadan, Eid Fitr and Bakrid in date order with countdowns', () => {
    const events = collectHijriEvents(ramadanDays(), '2026-11-22', 0);
    const keys = events.map((event) => event.key);
    expect(keys).toEqual(['ramadan', 'qadr', 'eid-fitr', 'arafah', 'eid-adha']);
    const ramadan = events.find((event) => event.key === 'ramadan');
    expect(ramadan?.gregorianDate).toBe('2027-02-08');
    expect(ramadan?.hijriDay).toBe('1');
    expect(ramadan?.hijriMonth).toBe('Ramadan');
    expect(ramadan?.daysUntil).toBe(78);
    const fitr = events.find((event) => event.key === 'eid-fitr');
    expect(fitr?.gregorianDate).toBe('2027-03-10');
    const adha = events.find((event) => event.key === 'eid-adha');
    expect(adha?.gregorianDate).toBe('2027-05-27');
    expect(adha?.label).toBe('Eid al-Adha');
  });

  it('skips days before today', () => {
    const events = collectHijriEvents(ramadanDays(), '2027-03-11', 0);
    expect(events.map((event) => event.key)).toEqual(['arafah', 'eid-adha']);
  });

  it('records a key only at its first occurrence', () => {
    const days = [
      rawDay('08-02-2027', '1', 'Ramadan', '1447', ['1st Day of Ramadan']),
      rawDay('09-02-2027', '2', 'Ramadan', '1447', ['Ramadan']),
      rawDay('10-02-2027', '3', 'Ramadan', '1447', ['Ramadan']),
    ]
      .map(normaliseAladhanDay)
      .filter((day): day is NonNullable<typeof day> => day !== null);
    const events = collectHijriEvents(days, '2026-11-22', 0);
    expect(events).toHaveLength(1);
    expect(events[0]?.gregorianDate).toBe('2027-02-08');
  });

  it('returns an empty list when there are no key days', () => {
    const days = [rawDay('08-02-2027', '1', 'Ramadan', '1447', [])]
      .map(normaliseAladhanDay)
      .filter((day): day is NonNullable<typeof day> => day !== null);
    expect(collectHijriEvents(days, '2026-11-22', 0)).toEqual([]);
  });

  it('sorts by date even when the input is unsorted', () => {
    const events = collectHijriEvents([...ramadanDays()].reverse(), '2026-11-22', 0);
    const dates = events.map((event) => event.gregorianDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it('applies the day offset to the event date', () => {
    // With offset +1, the Hijri day of 08-02-2027 is shown on
    // 07-02-2027, so Ramadan is dated one day earlier.
    const events = collectHijriEvents(ramadanDays(), '2026-11-22', 1);
    const ramadan = events.find((event) => event.key === 'ramadan');
    expect(ramadan?.gregorianDate).toBe('2027-02-07');
    expect(ramadan?.daysUntil).toBe(77);
  });

  it('derives Arafah, New Year and Ashura from the Hijri date when Aladhan marks nothing', () => {
    // Verified live 2026-11-22: 15-05-2027 carries only 'Hajj' +
    // 'Arafa', and 06-06-2027 (1 Muharram) carries no New Year
    // marker at all — so these three come from the Hijri date
    // itself (real conversion data), not the holidays array.
    const days = [
      rawDay('15-05-2027', '9', 'Dhū al-Ḥijjah', '1448', ['Hajj'], 12),
      rawDay('06-06-2027', '1', 'Muḥarram', '1449', [], 1),
      rawDay('15-06-2027', '10', 'Muḥarram', '1449', ['Ashura'], 1),
    ]
      .map(normaliseAladhanDay)
      .filter((day): day is NonNullable<typeof day> => day !== null);
    const events = collectHijriEvents(days, '2026-11-22', 0);
    expect(events.map((event) => event.key)).toEqual(['arafah', 'new-year', 'ashura']);
    expect(events.find((event) => event.key === 'arafah')?.gregorianDate).toBe('2027-05-15');
    expect(events.find((event) => event.key === 'new-year')?.gregorianDate).toBe('2027-06-06');
    expect(events.find((event) => event.key === 'new-year')?.label).toBe('Islamic New Year');
  });

  it('lists a whole future year when earliest is that year (the ?year= mode)', () => {
    // User request 2026-11-22: any year must be browsable (2028,
    // 2029, 2030 … 2050), not just the next occurrence.
    const days = [
      rawDay('28-01-2028', '1', 'Ramadan', '1449', ['1st Day of Ramadan']),
      rawDay('27-02-2028', '1', 'Shawwāl', '1449', ['Eid al-Fitr']),
      rawDay('05-06-2028', '10', 'Dhū al-Hijjah', '1449', ['Eid al-Adha']),
    ]
      .map(normaliseAladhanDay)
      .filter((day): day is NonNullable<typeof day> => day !== null);
    const events = collectHijriEvents(days, '2026-11-22', 0, '2028-01-01');
    expect(events.map((event) => event.key)).toEqual(['ramadan', 'eid-fitr', 'eid-adha']);
    // daysUntil is still counted from today, so 2028 events are
    // hundreds of days away.
    expect(events.find((event) => event.key === 'ramadan')?.daysUntil).toBeGreaterThan(400);
  });

  it('counts today as 0 days away', () => {
    const events = collectHijriEvents(ramadanDays(), '2027-02-08', 0);
    expect(events.find((event) => event.key === 'ramadan')?.daysUntil).toBe(0);
  });
});
