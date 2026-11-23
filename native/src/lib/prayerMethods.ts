/**
 * Prayer calculation methods — the list AHDORA actually offers.
 *
 * AUDIT vs Mihrab (2026-11-23): Mihrab certifies its times against
 * official national tables (Diyanet, Islamiska, Morocco, Algeria,
 * Kemenag) and lets the user pick the method + madhab. AHDORA's times
 * come from AlAdhan through the server (GET /api/prayer/times), and
 * the server maps a saved method NAME to an AlAdhan method id
 * (api/src/routes/prayer.ts `methodMap`, falling back to Karachi id 1
 * for any unknown name). So this list contains ONLY the names that
 * map exists for — offering more would silently compute Karachi
 * while displaying another method's name.
 *
 * The five names below are the server's exact `methodMap` keys
 * (verified live in the repo 2026-11-23), paired with the AlAdhan
 * method ids from GET https://api.aladhan.com/v1/methods:
 *   Karachi 1 · ISNA 2 · Muslim World League 3 · Makkah 4 · Egypt 5.
 *
 * KNOWN BUGS FIXED HERE: Onboarding used to offer
 * 'Muslim World League (MWL)' and 'Islamic Society of North America
 * (ISNA)' — names the server map does NOT have, so users picking
 * either silently got Karachi times while the screen showed the
 * picked method. The canonical saved values are now
 * 'Muslim World League' and 'ISNA'; the long names are display-only.
 * If the server map is ever extended
 * (Tehran 7, Gulf 8, Kuwait 9, Qatar 10, Singapore 11, Turkey /
 * Diyanet 13, Dubai 16, Malaysia / JAKIM 17, Tunisia 18, Algeria 19,
 * Indonesia / Kemenag 20, Morocco 21, Jordan 23 — all live AlAdhan
 * ids), add the new names here with their exact server keys.
 *
 * The Asr school (Hanafi / Shafi) is separate — it already lives in
 * the profile as `asrMethod` and is picked in Onboarding step 5.
 */
export type PrayerMethod = {
  /** Exact value saved to the profile — must match a server methodMap key. */
  value: string;
  /** Full display name (the AlAdhan method name). */
  label: string;
  /** Short label for chips / compact rows. */
  short: string;
  /** AlAdhan method id the server maps this name to. */
  aladhanId: number;
};

export const PRAYER_METHODS: readonly PrayerMethod[] = [
  {
    value: 'University of Islamic Sciences, Karachi',
    label: 'University of Islamic Sciences, Karachi',
    short: 'Karachi',
    aladhanId: 1,
  },
  {
    // The server's key is the bare 'ISNA', NOT the long name:
    // Onboarding used to save 'Islamic Society of North America
    // (ISNA)', which the map does not have, so ISNA picks silently
    // computed Karachi. The long name is display-only now.
    value: 'ISNA',
    label: 'Islamic Society of North America (ISNA)',
    short: 'ISNA',
    aladhanId: 2,
  },
  {
    value: 'Muslim World League',
    label: 'Muslim World League (MWL)',
    short: 'MWL',
    aladhanId: 3,
  },
  {
    value: 'Umm al-Qura University, Makkah',
    label: 'Umm al-Qura University, Makkah',
    short: 'Makkah',
    aladhanId: 4,
  },
  {
    value: 'Egyptian General Authority',
    label: 'Egyptian General Authority',
    short: 'Egypt',
    aladhanId: 5,
  },
];

export const DEFAULT_PRAYER_METHOD = PRAYER_METHODS[0].value;

/**
 * Coerce any stored method name to one this list offers. An old
 * saved value that is no longer offered (e.g. the old
 * 'Muslim World League (MWL)' string) maps to its canonical value
 * instead of falling through to Karachi unnoticed.
 */
export function coercePrayerMethod(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PRAYER_METHOD;
  const trimmed = value.trim();
  if (PRAYER_METHODS.some((m) => m.value === trimmed)) return trimmed;
  // Legacy saved values: Onboarding stored the display names
  // 'Muslim World League (MWL)' and 'Islamic Society of North
  // America (ISNA)' before this list existed; neither is a server
  // key, so map them to their canonical values instead of letting
  // them fall through to Karachi unnoticed.
  if (trimmed === 'Muslim World League (MWL)') return 'Muslim World League';
  if (trimmed === 'Islamic Society of North America (ISNA)') return 'ISNA';
  return DEFAULT_PRAYER_METHOD;
}

export function prayerMethodLabel(value: string): string {
  return PRAYER_METHODS.find((m) => m.value === value)?.label ?? value;
}

/**
 * Canonical saved value for a stored method name. Known legacy
 * display names map to their server keys; a value this list does
 * not know (e.g. a method added on the server later) passes through
 * unchanged — coercing it to Karachi would silently rewrite a
 * method the server does understand.
 */
export function canonicalPrayerMethod(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return DEFAULT_PRAYER_METHOD;
  const trimmed = value.trim();
  if (PRAYER_METHODS.some((m) => m.value === trimmed)) return trimmed;
  if (trimmed === 'Muslim World League (MWL)') return 'Muslim World League';
  if (trimmed === 'Islamic Society of North America (ISNA)') return 'ISNA';
  return trimmed;
}
