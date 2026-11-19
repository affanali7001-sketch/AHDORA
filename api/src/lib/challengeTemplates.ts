import type { ChallengeCategory } from '../models/Challenge.js';

export type ChallengeTemplate = {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  durationDays: number;
  /** Rules shown to the user BEFORE joining. */
  rules: string[];
  /** What completes one day, in plain words. */
  requirement: string;
  /** True when the day is completed automatically from real activity. */
  auto: boolean;
};

/**
 * The rule that applies to leaving ANY challenge. Shown upfront on every
 * challenge detail page, before the user joins: leaving keeps history,
 * marks the attempt as left, and keeps the points already earned — there
 * is no clawback.
 */
export const LEAVE_RULE =
  'You can leave at any time. Leaving keeps your history and the points you already earned — nothing is taken back — but the attempt stops counting towards completion.';

/**
 * Built-in templates (app content, not user data). At least one per
 * category, with both 30-day and 365-day options. Joining a template
 * materialises it as a Challenge document with this templateId.
 *
 * Sleep, Quran and discipline days are completed by an honest
 * self-reported daily check-in, because there is no reliable measured
 * source for them yet. That is labelled "self-reported" everywhere the
 * progress is shown — it is never presented as verified activity.
 */
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'prayer-consistency-30',
    title: '30-Day Prayer Consistency',
    description: 'Pray all five daily prayers, on time or as Qaza, for 30 days.',
    category: 'prayers',
    durationDays: 30,
    rules: [
      'A day counts when all five prayers are recorded as prayed or Qaza.',
      'Missed prayers do not count for that day — Qaza them to keep the day.',
      'Days are counted in your own timezone.',
      LEAVE_RULE,
    ],
    requirement: 'All five prayers prayed or Qaza',
    auto: true,
  },
  {
    id: 'prayer-consistency-365',
    title: '365-Day Prayer Consistency',
    description: 'A full year of keeping up with all five daily prayers.',
    category: 'prayers',
    durationDays: 365,
    rules: [
      'A day counts when all five prayers are recorded as prayed or Qaza.',
      'Missed prayers do not count for that day — Qaza them to keep the day.',
      'Days are counted in your own timezone.',
      LEAVE_RULE,
    ],
    requirement: 'All five prayers prayed or Qaza',
    auto: true,
  },
  {
    id: 'study-consistency-30',
    title: '30-Day Study Consistency',
    description: 'Study every day for 30 days — finish a task or a focus session.',
    category: 'study',
    durationDays: 30,
    rules: [
      'A day counts when you complete at least one study task or finish a focus session.',
      'Days are counted in your own timezone.',
      LEAVE_RULE,
    ],
    requirement: 'Complete a task or finish a focus session',
    auto: true,
  },
  {
    id: 'study-habit-365',
    title: '365-Day Study Habit',
    description: 'A full year of showing up for your studies, one day at a time.',
    category: 'study',
    durationDays: 365,
    rules: [
      'A day counts when you complete at least one study task or finish a focus session.',
      'Days are counted in your own timezone.',
      LEAVE_RULE,
    ],
    requirement: 'Complete a task or finish a focus session',
    auto: true,
  },
  {
    id: 'deep-focus-30',
    title: '30-Day Deep Focus',
    description: 'Finish one real focus session every day for 30 days.',
    category: 'focus',
    durationDays: 30,
    rules: [
      'A day counts when you finish a focus (Pomodoro) session.',
      'Paused time does not count — only finished sessions count.',
      'Days are counted in your own timezone.',
      LEAVE_RULE,
    ],
    requirement: 'Finish a focus session',
    auto: true,
  },
  {
    id: 'quran-reading-30',
    title: '30-Day Quran Reading',
    description: 'Read from the Quran every day for 30 days.',
    category: 'quran',
    durationDays: 30,
    rules: [
      'Mark each day yourself after you have read — this is a self-reported check-in.',
      'There is no automatic reading tracking yet, so check-ins are shown as self-reported, never as verified.',
      'Only mark a day you actually read.',
      LEAVE_RULE,
    ],
    requirement: 'Self-reported daily check-in after reading',
    auto: false,
  },
  {
    id: 'sleep-rhythm-30',
    title: '30-Day Sleep Rhythm',
    description: 'Keep a steady sleep routine for 30 days.',
    category: 'sleep',
    durationDays: 30,
    rules: [
      'Mark each day yourself when you kept your planned sleep routine — this is a self-reported check-in.',
      'Sleep is not measured automatically yet, so check-ins are shown as self-reported, never as verified.',
      'Your planned sleep times are never shown as actual sleep.',
      LEAVE_RULE,
    ],
    requirement: 'Self-reported daily check-in',
    auto: false,
  },
  {
    id: 'discipline-365',
    title: '365-Day Discipline',
    description: 'One honest daily check-in on the habit you chose, for a full year.',
    category: 'discipline',
    durationDays: 365,
    rules: [
      'Mark each day yourself when you kept your chosen habit — this is a self-reported check-in.',
      'Check-ins are shown as self-reported, never as verified.',
      'Only mark a day you actually kept.',
      LEAVE_RULE,
    ],
    requirement: 'Self-reported daily check-in',
    auto: false,
  },
];

export function findTemplate(id: string): ChallengeTemplate | undefined {
  return CHALLENGE_TEMPLATES.find((t) => t.id === id);
}
