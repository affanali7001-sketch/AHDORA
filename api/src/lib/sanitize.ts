/**
 * Input sanitisation (pure, unit-tested).
 *
 * Defence in depth against MongoDB operator injection: every route
 * already validates input with zod, but this strips any key starting
 * with `$` or containing `.` from request bodies, query strings and
 * route params before handlers run, so a crafted payload can never
 * smuggle a query operator (e.g. `{"email": {"$ne": null}}`) into a
 * Mongoose query. Arrays and nested plain objects are walked
 * recursively; other values pass through untouched.
 */
export function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      out[key] = sanitizeValue(entry);
    }
    return out;
  }
  return value;
}

/** Mutates `target` in place, removing operator-like keys at any depth. */
export function sanitizeInPlace(target: unknown): void {
  if (Array.isArray(target)) {
    for (const entry of target) sanitizeInPlace(entry);
    return;
  }
  if (target !== null && typeof target === 'object' && Object.getPrototypeOf(target) === Object.prototype) {
    const record = target as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete record[key];
      } else {
        sanitizeInPlace(record[key]);
      }
    }
  }
}
