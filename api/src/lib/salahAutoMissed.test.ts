import { describe, expect, it } from 'vitest';
import {
  MISSED_GRACE_MINUTES,
  applyStatusCorrection,
  prayersPastDeadline,
  prayersPastDeadlineSinceSignup,
} from './salahAutoMissed.js';

const ALL = { Fajr: '05:27', Dhuhr: '12:20', Asr: '16:21', Maghrib: '17:56', Isha: '19:12' };
const TZ = 'Asia/Kolkata';
/** 2026-11-20 19:00 IST — an account created in the evening. */
const CREATED_THIS_EVENING = new Date('2026-11-20T13:30:00.000Z');
/** Long before today. */
const CREATED_LONG_AGO = new Date('2026-11-01T00:00:00.000Z');

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

describe('prayersPastDeadlineSinceSignup', () => {
  it('does NOT mark earlier prayers missed for an account created this evening', () => {
    // 19:00 IST: Fajr, Dhuhr, Asr and Maghrib are all past deadline,
    // but the account did not exist when they were due.
    expect(
      prayersPastDeadlineSinceSignup(ALL, 19 * 60, false, '2026-11-20', TZ, CREATED_THIS_EVENING),
    ).toEqual([]);
  });

  it('marks past-deadline prayers as usual for an old account', () => {
    expect(
      prayersPastDeadlineSinceSignup(ALL, 19 * 60, false, '2026-11-20', TZ, CREATED_LONG_AGO),
    ).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib']);
  });

  it('marks nothing for a past date that predates signup', () => {
    expect(
      prayersPastDeadlineSinceSignup(ALL, null, true, '2026-11-19', TZ, CREATED_THIS_EVENING),
    ).toEqual([]);
  });

  it('marks only prayers due after signup on the signup day itself', () => {
    // Signup day, treated as a past date: only Isha (deadline 19:12)
    // falls after the 19:00 creation instant.
    expect(
      prayersPastDeadlineSinceSignup(ALL, null, true, '2026-11-20', TZ, CREATED_THIS_EVENING),
    ).toEqual(['Isha']);
  });

  it('excludes a prayer whose deadline is exactly the creation instant', () => {
    // Fajr deadline 05:27 IST on 2026-11-20 = 2026-11-19T23:57Z.
    const createdAtFajr = new Date('2026-11-19T23:57:00.000Z');
    expect(
      prayersPastDeadlineSinceSignup(ALL, 6 * 60 + 40, false, '2026-11-20', TZ, createdAtFajr),
    ).toEqual([]);
  });

  it('behaves like the plain check when there is no account creation time', () => {
    expect(
      prayersPastDeadlineSinceSignup(ALL, 19 * 60, false, '2026-11-20', TZ, null),
    ).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib']);
    expect(
      prayersPastDeadlineSinceSignup(ALL, 19 * 60, false, '2026-11-20', TZ, undefined),
    ).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib']);
  });

  it('uses end-of-day as the deadline when no deadline is known', () => {
    // No deadlines at all: a past day entirely before signup is excluded,
    // but the signup day itself is kept (the prayer could have been due
    // after signup — never assume).
    expect(
      prayersPastDeadlineSinceSignup({}, null, true, '2026-11-19', TZ, CREATED_THIS_EVENING),
    ).toEqual([]);
    expect(
      prayersPastDeadlineSinceSignup({}, null, true, '2026-11-20', TZ, CREATED_THIS_EVENING),
    ).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });
});

describe('applyStatusCorrection (Qaza preserves miss history)', () => {
  const missedAt = new Date('2026-11-20T13:00:00.000Z');
  const now = new Date('2026-11-20T15:00:00.000Z');

  it('keeps wasMissed and the original missedAt when correcting missed -> qaza', () => {
    const next = applyStatusCorrection(
      { status: 'missed', wasMissed: true, missedAt, autoMissed: true },
      'qaza',
      now,
    );
    expect(next.status).toBe('qaza');
    expect(next.wasMissed).toBe(true);
    expect(next.missedAt).toBe(missedAt);
    expect(next.updatedAt).toBe(now);
  });

  it('keeps wasMissed when correcting missed -> prayed', () => {
    const next = applyStatusCorrection(
      { status: 'missed', wasMissed: true, missedAt, autoMissed: true },
      'prayed',
      now,
    );
    expect(next.status).toBe('prayed');
    expect(next.wasMissed).toBe(true);
    expect(next.missedAt).toBe(missedAt);
  });

  it('records a manual missed with wasMissed and missedAt = now', () => {
    const next = applyStatusCorrection(
      { status: 'pending', wasMissed: false, missedAt: null, autoMissed: false },
      'missed',
      now,
    );
    expect(next.status).toBe('missed');
    expect(next.wasMissed).toBe(true);
    expect(next.missedAt).toBe(now);
    expect(next.autoMissed).toBe(false);
  });

  it('starts clean when there was no previous record', () => {
    const next = applyStatusCorrection(null, 'qaza', now);
    expect(next.status).toBe('qaza');
    expect(next.wasMissed).toBe(false);
    expect(next.missedAt).toBe(null);
  });
});
