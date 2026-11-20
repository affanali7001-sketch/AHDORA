import { describe, expect, it } from 'vitest';
import {
  effectivePrayerTimes,
  manualOnlyTimings,
  prayerEventsDue,
  type ProfileLike,
} from './scheduler.js';

const ALL_MANUAL: ProfileLike = {
  prayerSettings: {
    Fajr: { timeOverride: '05:00', endTime: '06:00', reminder: true },
    Dhuhr: { timeOverride: '12:15', endTime: '13:00', reminder: true },
    Asr: { timeOverride: '16:30', endTime: '17:30', reminder: true },
    Maghrib: { timeOverride: '18:05', endTime: '19:00', reminder: true },
    Isha: { timeOverride: '19:30', endTime: '23:00', reminder: true },
  },
};

describe('manualOnlyTimings', () => {
  it('returns all five manual times when every prayer has an override', () => {
    expect(manualOnlyTimings(ALL_MANUAL)).toEqual({
      Fajr: '05:00',
      Dhuhr: '12:15',
      Asr: '16:30',
      Maghrib: '18:05',
      Isha: '19:30',
    });
  });

  it('returns null when any prayer has no override', () => {
    expect(
      manualOnlyTimings({
        prayerSettings: {
          Fajr: { timeOverride: '05:00' },
          Dhuhr: { timeOverride: '12:15' },
          Asr: { timeOverride: '16:30' },
          Maghrib: { timeOverride: '18:05' },
          Isha: { timeOverride: '' },
        },
      }),
    ).toBe(null);
    expect(manualOnlyTimings({})).toBe(null);
  });

  it('returns null for an invalid override', () => {
    expect(
      manualOnlyTimings({
        prayerSettings: {
          Fajr: { timeOverride: '25:00' },
          Dhuhr: { timeOverride: '12:15' },
          Asr: { timeOverride: '16:30' },
          Maghrib: { timeOverride: '18:05' },
          Isha: { timeOverride: '19:30' },
        },
      }),
    ).toBe(null);
  });
});

describe('manual times drive scheduler events', () => {
  it('fires start events at the manual times, not the calculated ones', () => {
    const calculated = {
      Fajr: '05:12',
      Dhuhr: '12:30',
      Asr: '16:45',
      Maghrib: '18:20',
      Isha: '19:45',
    };
    const effective = effectivePrayerTimes(ALL_MANUAL, calculated);
    // Manual Fajr is 05:00, calculated is 05:12 — only the manual time fires.
    expect(prayerEventsDue(effective, 5 * 60)).toEqual([{ kind: 'start', prayer: 'Fajr' }]);
    expect(prayerEventsDue(effective, 5 * 60 + 12)).toEqual([]);
    // Manual Dhuhr is 12:15.
    expect(prayerEventsDue(effective, 12 * 60 + 15)).toEqual([
      { kind: 'start', prayer: 'Dhuhr' },
    ]);
  });

  it('warns 15 minutes before the manual endTime deadline', () => {
    const calculated = {
      Fajr: '05:12',
      Dhuhr: '12:30',
      Asr: '16:45',
      Maghrib: '18:20',
      Isha: '19:45',
    };
    const effective = effectivePrayerTimes(ALL_MANUAL, calculated);
    expect(effective.Fajr.deadline).toBe('06:00');
    // Warning 15 min before the 06:00 manual deadline.
    expect(prayerEventsDue(effective, 5 * 60 + 45)).toEqual([
      { kind: 'deadline-warning', prayer: 'Fajr' },
    ]);
  });

  it('still respects a per-prayer reminder toggle switched off', () => {
    const off: ProfileLike = {
      prayerSettings: {
        Fajr: { timeOverride: '05:00', endTime: '06:00', reminder: false },
        Dhuhr: { timeOverride: '12:15', reminder: true },
        Asr: { timeOverride: '16:30', reminder: true },
        Maghrib: { timeOverride: '18:05', reminder: true },
        Isha: { timeOverride: '19:30', reminder: true },
      },
    };
    const calculated = {
      Fajr: '05:12',
      Dhuhr: '12:30',
      Asr: '16:45',
      Maghrib: '18:20',
      Isha: '19:45',
    };
    const effective = effectivePrayerTimes(off, calculated);
    expect(prayerEventsDue(effective, 5 * 60)).toEqual([]);
    expect(prayerEventsDue(effective, 12 * 60 + 15)).toEqual([
      { kind: 'start', prayer: 'Dhuhr' },
    ]);
  });

  it('works with manual times alone as the calculated input', () => {
    // This is what the scheduler does when all five overrides are set
    // and Aladhan is never consulted.
    const manual = manualOnlyTimings(ALL_MANUAL);
    expect(manual).not.toBe(null);
    const effective = effectivePrayerTimes(ALL_MANUAL, manual as Record<
      'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha',
      string
    >);
    expect(effective.Fajr.time).toBe('05:00');
    expect(effective.Isha.deadline).toBe('23:00');
    expect(prayerEventsDue(effective, 19 * 60 + 30)).toEqual([
      { kind: 'start', prayer: 'Isha' },
    ]);
  });
});
