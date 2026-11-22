/**
 * Tasbih persistence — honest, per-user, per-day storage for the dhikr
 * counter (Tasbeeh screen).
 *
 * Two things are stored in AsyncStorage, both keyed by user + local
 * date (YYYY-MM-DD) + dhikr name:
 *
 * - the RUNNING count (`tasbih:running:...`): the current counter for
 *   that dhikr today, saved on every tap so it survives an app restart;
 * - COMPLETED sessions (`tasbih:sessions:...`): a list of counts, one
 *   entry appended each time the counter reaches its target. Resetting
 *   the counter never deletes completed sessions.
 *
 * "Today's total" is the sum of all stored sessions plus all running
 * counts across every dhikr — only numbers that were really stored
 * are counted, so it is 0 when nothing has been counted yet. Nothing
 * here is ever invented or pre-filled.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Local date key `YYYY-MM-DD` (device local time). */
export function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function runningKey(uid: string, date: string, dhikr: string): string {
  return `tasbih:running:${uid}:${date}:${dhikr}`;
}

function sessionsKey(uid: string, date: string, dhikr: string): string {
  return `tasbih:sessions:${uid}:${date}:${dhikr}`;
}

/**
 * All tasbih writes go through one promise chain, so rapid taps can
 * never store counts out of order (a slow write for tap N must not
 * land after the write for tap N+1).
 */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(work: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(work).catch(() => undefined);
  writeQueue = run;
  return run;
}

function parseCount(raw: string | null): number {
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function parseSessions(raw: string | null): number[] {
  if (raw == null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
    );
  } catch {
    return [];
  }
}

/** Saved running count for this dhikr today (0 when nothing stored). */
export async function loadRunningCount(
  uid: string,
  date: string,
  dhikr: string,
): Promise<number> {
  try {
    return parseCount(await AsyncStorage.getItem(runningKey(uid, date, dhikr)));
  } catch {
    return 0;
  }
}

/** Save the running count for this dhikr today. */
export function saveRunningCount(
  uid: string,
  date: string,
  dhikr: string,
  count: number,
): Promise<void> {
  const safe = Math.max(0, Math.floor(count));
  return enqueueWrite(() =>
    AsyncStorage.setItem(runningKey(uid, date, dhikr), String(safe)),
  );
}

/**
 * Record one completed session (the counter reached its target).
 * Appended to the stored list for this dhikr today; never overwrites
 * earlier sessions.
 */
export function recordCompletedSession(
  uid: string,
  date: string,
  dhikr: string,
  count: number,
): Promise<void> {
  return enqueueWrite(async () => {
    const key = sessionsKey(uid, date, dhikr);
    const sessions = parseSessions(await AsyncStorage.getItem(key));
    sessions.push(Math.max(1, Math.floor(count)));
    await AsyncStorage.setItem(key, JSON.stringify(sessions));
  });
}

/**
 * Today's real total across every dhikr: completed sessions + running
 * counts. Only stored numbers are counted — 0 when nothing is stored.
 */
export async function loadTodayTotal(
  uid: string,
  date: string,
  dhikrs: readonly string[],
): Promise<number> {
  try {
    const keys = dhikrs.flatMap((d) => [runningKey(uid, date, d), sessionsKey(uid, date, d)]);
    const pairs = await AsyncStorage.multiGet(keys);
    const kinds = new Map(keys.map((k) => [k, k.startsWith('tasbih:sessions:')]));
    let total = 0;
    for (const [key, raw] of pairs) {
      if (raw == null) continue;
      if (kinds.get(key)) {
        for (const n of parseSessions(raw)) total += n;
      } else {
        total += parseCount(raw);
      }
    }
    return total;
  } catch {
    return 0;
  }
}
