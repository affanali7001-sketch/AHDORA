import { addDays } from './timezone.js';

/**
 * Study streak from a set of active day keys (pure, unit-tested).
 *
 * Rule (also shown in the UI): a day counts when a focus session
 * finishes OR a task is completed. The streak is the run of
 * consecutive active days ending today — or yesterday, if today has
 * no activity yet.
 */
export function computeStreakFromDayKeys(activeDays: ReadonlySet<string>, today: string): number {
  if (activeDays.size === 0) return 0;
  let cursor = activeDays.has(today) ? today : addDays(today, -1);
  if (!activeDays.has(cursor)) return 0;
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
