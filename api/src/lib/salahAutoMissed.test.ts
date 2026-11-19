import { describe, expect, it } from 'vitest';
import { MISSED_GRACE_MINUTES, prayersPastDeadline } from './salahAutoMissed.js';

const ALL = { Fajr: '05:27', Dhuhr: '12:20', Asr: '16:21', Maghrib: '17:56', Isha: '19:12' };

describe('prayersPastDeadline', () => {
  it('marks every prayer on a past date', () => {
    expect(prayersPastDeadline({}, null, true)).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });

  it('marks nothing before any deadline today', () => {
    expect(prayersPastDeadline(ALL, 300, false)).toEqual([]); // 05:00
  });

  it('marks a prayer only after deadline + 5-minute grace', () => {
    // Fajr deadline 05:27, grace ends 05:32.
    expect(prayersPastDeadline(ALL, 331, false)).toEqual([]); // 05:31
    expect(prayersPastDeadline(ALL, 332, false)).toEqual([]); // 05:32, grace boundary
    expect(prayersPastDeadline(ALL, 333, false)).toEqual(['Fajr']); // 05:33
  });

  it('marks several prayers at once later in the day', () => {
    expect(prayersPastDeadline(ALL, 800, false)).toEqual(['Fajr', 'Dhuhr']); // 13:20
  });

  it('never marks a prayer without a known deadline', () => {
    expect(prayersPastDeadline({ Fajr: '05:27' }, 1400, false)).toEqual(['Fajr']);
    expect(prayersPastDeadline({}, 1400, false)).toEqual([]);
  });

  it('marks nothing when the current time is unknown', () => {
    expect(prayersPastDeadline(ALL, null, false)).toEqual([]);
  });

  it('uses the 5-minute grace constant', () => {
    expect(MISSED_GRACE_MINUTES).toBe(5);
  });
});
