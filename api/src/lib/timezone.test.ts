import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKeyInTimezone,
  daysBetween,
  nowMinutesInTimezone,
  startOfDayUtc,
  toMinutes,
} from './timezone.js';

describe('dateKeyInTimezone', () => {
  it('uses the user timezone, not the server clock', () => {
    // 2026-11-19 00:30 UTC is still 2026-11-18 in New York and
    // already 2026-11-19 in Kolkata.
    const date = new Date('2026-11-19T00:30:00.000Z');
    expect(dateKeyInTimezone('Asia/Kolkata', date)).toBe('2026-11-19');
    expect(dateKeyInTimezone('America/New_York', date)).toBe('2026-11-18');
  });

  it('falls back to the server-local date for an unknown timezone', () => {
    const date = new Date('2026-11-19T12:00:00.000Z');
    const key = dateKeyInTimezone('Not/AZone', date);
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('nowMinutesInTimezone', () => {
  it('returns minutes since local midnight', () => {
    const date = new Date('2026-11-19T00:30:00.000Z'); // 06:00 in Kolkata
    expect(nowMinutesInTimezone('Asia/Kolkata', date)).toBe(360);
    expect(nowMinutesInTimezone('Not/AZone', date)).toBeNull();
  });
});

describe('toMinutes', () => {
  it('parses valid HH:mm and rejects the rest', () => {
    expect(toMinutes('05:27')).toBe(327);
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('23:59')).toBe(1439);
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('5:27')).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('abc')).toBeNull();
  });
});

describe('daysBetween / addDays', () => {
  it('counts whole days across month boundaries', () => {
    expect(daysBetween('2026-11-18', '2026-11-19')).toBe(1);
    expect(daysBetween('2026-11-19', '2026-11-18')).toBe(-1);
    expect(daysBetween('2026-01-31', '2026-02-02')).toBe(2);
    expect(daysBetween('2026-11-19', '2026-11-19')).toBe(0);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-11-19', 1)).toBe('2026-11-20');
    expect(addDays('2026-11-19', -1)).toBe('2026-11-18');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('startOfDayUtc', () => {
  it('returns midnight local time as a UTC instant (DST-aware)', () => {
    // Verified in Phase 4: Kolkata midnight = 18:30 UTC the day before.
    expect(startOfDayUtc('2026-11-19', 'Asia/Kolkata').toISOString()).toBe('2026-11-18T18:30:00.000Z');
    expect(startOfDayUtc('2026-11-19', 'America/New_York').toISOString()).toBe('2026-11-19T05:00:00.000Z');
  });
});
