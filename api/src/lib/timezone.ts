/**
 * Timezone helpers.
 *
 * A user's "today" is defined by their own profile timezone (default
 * Asia/Kolkata), NOT by the server's local clock. Several older routes
 * still use the server-local date (see the Phase 3 report); every new
 * date-sensitive feature must use these helpers instead.
 */

/** YYYY-MM-DD for `date` in the given IANA timezone. Falls back to the server-local date. */
export function dateKeyInTimezone(timezone: string, date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to the server-local date below.
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Minutes since midnight for `date` in the given IANA timezone, or null. */
export function nowMinutesInTimezone(timezone: string, date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return (hour === 24 ? 0 : hour) * 60 + minute;
  } catch {
    return null;
  }
}

/** "HH:mm" -> minutes since midnight, or null when the value is not valid. */
export function toMinutes(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Whole days between two YYYY-MM-DD keys (b - a). Negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  const parse = (key: string) => {
    const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

/** YYYY-MM-DD for `days` days after `key`. */
export function addDays(key: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
