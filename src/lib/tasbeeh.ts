/**
 * Tasbeeh counter storage — localStorage only, per device by design.
 *
 * Counts are keyed by userId + today's LOCAL date, so one user's
 * counts never leak into another user's device state and a new day
 * starts fresh. Nothing here is sent to the server, so the daily
 * total must never be shown on Dashboard/Analytics as if it were
 * synced — it exists only on this device.
 */

export type DhikrId = 'subhanallah' | 'alhamdulillah' | 'allahu-akbar';

export type TasbeehState = {
  /** Current round count (0–98) for each dhikr. Switching dhikr keeps each round. */
  counts: Record<DhikrId, number>;
  /** Total taps today, across all three dhikrs. Completed rounds keep counting here. */
  dailyTotal: number;
};

export const DHIKR_IDS: DhikrId[] = ['subhanallah', 'alhamdulillah', 'allahu-akbar'];

export const TASBEEH_TARGET = 99;

export function emptyTasbeehState(): TasbeehState {
  return {
    counts: { subhanallah: 0, alhamdulillah: 0, 'allahu-akbar': 0 },
    dailyTotal: 0,
  };
}

/** Local YYYY-MM-DD (the user's day, not UTC). Same shape as SalahTracker's dateKey. */
export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function tasbeehStorageKey(userId: string, date = todayKey()): string {
  return `ahdora-tasbeeh:${userId}:${date}`;
}

function toCount(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(n, 0), TASBEEH_TARGET - 1);
}

export function loadTasbeeh(userId: string): TasbeehState {
  if (!userId) return emptyTasbeehState();
  try {
    const raw = localStorage.getItem(tasbeehStorageKey(userId));
    if (!raw) return emptyTasbeehState();
    const parsed = JSON.parse(raw) as Partial<TasbeehState>;
    const counts = (parsed.counts ?? {}) as Partial<Record<DhikrId, number>>;
    const dailyTotal =
      typeof parsed.dailyTotal === 'number' && Number.isFinite(parsed.dailyTotal)
        ? Math.max(0, Math.floor(parsed.dailyTotal))
        : 0;
    return {
      counts: {
        subhanallah: toCount(counts.subhanallah),
        alhamdulillah: toCount(counts.alhamdulillah),
        'allahu-akbar': toCount(counts['allahu-akbar']),
      },
      dailyTotal,
    };
  } catch {
    // Corrupt or unreadable entry: start the day fresh, never crash the screen.
    return emptyTasbeehState();
  }
}

export function saveTasbeeh(userId: string, state: TasbeehState): void {
  if (!userId) return;
  try {
    localStorage.setItem(tasbeehStorageKey(userId), JSON.stringify(state));
  } catch {
    // Storage full / unavailable (private mode): the counter still works
    // for this session, it just won't survive a reload.
  }
}
