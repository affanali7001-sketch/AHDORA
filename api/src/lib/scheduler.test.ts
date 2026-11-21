import { describe, expect, it } from 'vitest';
import {
  challengeEventsDue,
  effectivePrayerTimes,
  onboardingDue,
  prayerEventsDue,
  sleepEventsDue,
  taskEventsDue,
  type ChallengeParticipantLike,
  type ProfileLike,
  type TaskLike,
} from './scheduler.js';
import { prayerMissed, prayerStart, welcome } from './notificationCopy.js';

const calculated = {
  Fajr: '05:12',
  Dhuhr: '12:30',
  Asr: '16:45',
  Maghrib: '18:20',
  Isha: '19:45',
};

describe('effectivePrayerTimes', () => {
  it('uses calculated times and next-prayer deadlines by default', () => {
    const effective = effectivePrayerTimes({}, calculated);
    expect(effective.Fajr.time).toBe('05:12');
    expect(effective.Fajr.deadline).toBe('12:30');
    expect(effective.Isha.deadline).toBe('23:59');
    expect(effective.Fajr.reminder).toBe(true);
  });

  it('lets a manual timeOverride and endTime win', () => {
    const effective = effectivePrayerTimes(
      {
        prayerSettings: {
          Fajr: { timeOverride: '05:00', endTime: '06:00', reminder: true },
          Dhuhr: { timeOverride: '', endTime: '', reminder: false },
        },
      },
      calculated,
    );
    expect(effective.Fajr.time).toBe('05:00');
    expect(effective.Fajr.deadline).toBe('06:00');
    expect(effective.Dhuhr.reminder).toBe(false);
  });

  it('uses the next prayer override-aware time as the deadline', () => {
    const effective = effectivePrayerTimes(
      { prayerSettings: { Dhuhr: { timeOverride: '12:15' } } },
      calculated,
    );
    expect(effective.Fajr.deadline).toBe('12:15');
  });
});

describe('prayerEventsDue', () => {
  const effective = effectivePrayerTimes({}, calculated);

  it('fires a start event inside the 2-minute window', () => {
    expect(prayerEventsDue(effective, 5 * 60 + 12)).toEqual([
      { kind: 'start', prayer: 'Fajr' },
    ]);
    expect(prayerEventsDue(effective, 5 * 60 + 13)).toEqual([
      { kind: 'start', prayer: 'Fajr' },
    ]);
  });

  it('does not fire before the time or after the window', () => {
    expect(prayerEventsDue(effective, 5 * 60 + 11)).toEqual([]);
    expect(prayerEventsDue(effective, 5 * 60 + 14)).toEqual([]);
  });

  it('fires a deadline warning 15 minutes before the deadline', () => {
    // Fajr deadline is Dhuhr 12:30, warning at 12:15.
    expect(prayerEventsDue(effective, 12 * 60 + 15)).toEqual([
      { kind: 'deadline-warning', prayer: 'Fajr' },
    ]);
    expect(prayerEventsDue(effective, 12 * 60 + 14)).toEqual([]);
  });

  it('skips a prayer whose reminder toggle is off', () => {
    const off = effectivePrayerTimes(
      { prayerSettings: { Fajr: { reminder: false } } },
      calculated,
    );
    expect(prayerEventsDue(off, 5 * 60 + 12)).toEqual([]);
  });
});

describe('taskEventsDue', () => {
  const tasks: TaskLike[] = [
    { _id: '1', title: 'Maths', dueDate: '2026-11-20', startTime: '10:00', status: 'Pending' },
    { _id: '2', title: 'Old', dueDate: '2026-11-19', startTime: null, status: 'Pending' },
    { _id: '3', title: 'Done', dueDate: '2026-11-19', startTime: null, status: 'Completed' },
    { _id: '4', title: 'No date', dueDate: null, startTime: null, status: 'Pending' },
  ];

  it('fires due-soon 30 minutes before the start time', () => {
    const events = taskEventsDue(tasks, 9 * 60 + 30, '2026-11-20');
    // The overdue 'Old' task is also due at this tick (once per day).
    expect(events).toEqual([
      { kind: 'due-soon', task: tasks[0] },
      { kind: 'overdue', task: tasks[1] },
    ]);
  });

  it('flags overdue tasks once per day and ignores completed ones', () => {
    const events = taskEventsDue(tasks, 8 * 60, '2026-11-20');
    expect(events.map((e) => e.task.title)).toEqual(['Old']);
  });
});

describe('sleepEventsDue', () => {
  it('fires bedtime and wake-up in their windows', () => {
    const profile: ProfileLike = {
      sleepStartTime: '22:30',
      sleepEndTime: '05:30',
      sleepReminder: true,
    };
    expect(sleepEventsDue(profile, 22 * 60 + 30)).toEqual([{ kind: 'bedtime' }]);
    expect(sleepEventsDue(profile, 5 * 60 + 30)).toEqual([{ kind: 'wakeup' }]);
    expect(sleepEventsDue(profile, 12 * 60)).toEqual([]);
  });

  it('never fires when the sleep reminder is switched off', () => {
    const profile: ProfileLike = {
      sleepStartTime: '22:30',
      sleepEndTime: '05:30',
      sleepReminder: false,
    };
    expect(sleepEventsDue(profile, 22 * 60 + 30)).toEqual([]);
    expect(sleepEventsDue(profile, 5 * 60 + 30)).toEqual([]);
  });
});

describe('challengeEventsDue', () => {
  const participants: ChallengeParticipantLike[] = [
    { _id: 'p1', userId: 'u1', challengeId: 'c1', title: '30-Day Study', streak: 5 },
    { _id: 'p2', userId: 'u1', challengeId: 'c2', title: '30-Day Prayer', streak: 1 },
  ];

  it('is silent before 19:00 and reminds at 19:00', () => {
    expect(challengeEventsDue(participants, new Set(), 18 * 60 + 59)).toEqual([]);
    const events = challengeEventsDue(participants, new Set(), 19 * 60);
    expect(events.map((e) => e.kind)).toEqual(['checkin-reminder', 'checkin-reminder']);
  });

  it('warns about a 3+ day streak at risk from 21:00', () => {
    const events = challengeEventsDue(participants, new Set(), 21 * 60);
    expect(events).toEqual([
      { kind: 'streak-at-risk', participant: participants[0] },
      { kind: 'checkin-reminder', participant: participants[1] },
    ]);
  });

  it('skips participants whose day is already done', () => {
    expect(challengeEventsDue(participants, new Set(['p1', 'p2']), 21 * 60)).toEqual([]);
  });
});

describe('onboardingDue', () => {
  const old = new Date('2026-11-18T00:00:00Z');
  const now = new Date('2026-11-20T10:30:00Z');

  it('nudges an incomplete onboarding 24h after signup, from 10:00', () => {
    expect(onboardingDue({ onboardingCompleted: false, createdAt: old }, now, 630)).toBe(true);
  });

  it('does not nudge before 10:00, when complete, or within 24h', () => {
    expect(onboardingDue({ onboardingCompleted: false, createdAt: old }, now, 599)).toBe(false);
    expect(onboardingDue({ onboardingCompleted: true, createdAt: old }, now, 630)).toBe(false);
    expect(
      onboardingDue(
        { onboardingCompleted: false, createdAt: new Date('2026-11-20T09:00:00Z') },
        now,
        630,
      ),
    ).toBe(false);
  });
});

describe('notificationCopy (Hinglish)', () => {
  it('writes prayer copy in Hinglish with an action', () => {
    expect(prayerStart('Fajr')).toEqual({
      title: 'Fajr ka waqt ho gaya',
      body: 'Wuzu karo aur Fajr ki namaz abhi padho — waqt nikalne se pehle.',
    });
    expect(prayerMissed('Asr').title).toBe('Asr ki namaz reh gayi');
  });

  it('carries Quranic teaching in the Asr-missed copy, with a Qaza prompt', () => {
    const copy = prayerMissed('Asr');
    expect(copy.title).toBe('Asr ki namaz reh gayi');
    expect(copy.body).toContain('2:238');
    expect(copy.body).toContain('552');
    expect(copy.body).toContain('553');
    expect(copy.body).toContain('Qaza abhi padh lo');
    // Two short lines max, and no invented "shifa (healing) in Asr" claim.
    expect(copy.body.split('\n').length).toBeLessThanOrEqual(2);
    expect(copy.body.toLowerCase()).not.toContain('shifa');
  });

  it('carries Quranic teaching in the Fajr-missed copy, with a Qaza prompt', () => {
    const copy = prayerMissed('Fajr');
    expect(copy.title).toBe('Fajr ki namaz reh gayi');
    expect(copy.body).toContain('19:59');
    expect(copy.body).toContain('74:42-43');
    expect(copy.body).toContain('Qaza abhi padh lo');
    expect(copy.body.split('\n').length).toBeLessThanOrEqual(2);
    expect(copy.body.toLowerCase()).not.toContain('shifa');
  });

  it('keeps the plain missed copy (with Qaza prompt) for other prayers', () => {
    expect(prayerMissed('Dhuhr')).toEqual({
      title: 'Dhuhr ki namaz reh gayi',
      body: 'Dhuhr ki namaz miss ho gayi — Qaza padh lo, abhi bhi waqt hai.',
    });
    expect(prayerMissed('Maghrib').body).not.toContain('2:238');
    expect(prayerMissed('Isha').body).not.toContain('19:59');
  });

  it('welcomes the user by name in Hinglish', () => {
    const copy = welcome('Affan');
    expect(copy.title).toBe('AHDORA me swagat hai!');
    expect(copy.body).toContain('Assalamu Alaikum Affan');
  });
});
