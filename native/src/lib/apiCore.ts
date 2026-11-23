/**
 * API clients for prayer times, profile/onboarding, salah records,
 * rewards and Quran reading progress — built on api.ts's apiFetch
 * (same CSRF + manual cookie jar as the verified login client).
 * All data is live from the server; nothing here is fabricated.
 */
import { apiFetch } from './api';
import { canonicalPrayerMethod } from './prayerMethods';

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export type SalahStatus = 'pending' | 'prayed' | 'qaza' | 'missed';

export type PrayerTimesResponse = {
  date: string;
  city: string;
  country: string;
  timezone: string;
  method: string;
  source: string;
  aladhanFailed?: boolean;
  notice?: string;
  hijri: { date: string | null; month: string | null; year: string | null } | null;
  timings: Record<PrayerName | 'Sunrise', string>;
  perPrayer: Record<
    PrayerName,
    { time: string; deadline: string; reminder: boolean; source: 'manual' | 'calculated' | 'unavailable' }
  >;
  nextPrayer: { name: PrayerName; time: string } | null;
};

export type PrayerSetting = {
  timeOverride: string;
  endTime: string;
  reminder: boolean;
};

export type PrayerSettings = Record<PrayerName, PrayerSetting>;

export const emptyPrayerSettings = (): PrayerSettings => ({
  Fajr: { timeOverride: '', endTime: '', reminder: true },
  Dhuhr: { timeOverride: '', endTime: '', reminder: true },
  Asr: { timeOverride: '', endTime: '', reminder: true },
  Maghrib: { timeOverride: '', endTime: '', reminder: true },
  Isha: { timeOverride: '', endTime: '', reminder: true },
});

export type PrayerEntry = {
  status: SalahStatus;
  wasMissed: boolean;
  missedAt: string | null;
  autoMissed: boolean;
};

export type PrayerRecord = Record<PrayerName, PrayerEntry>;

export const emptyPrayerRecord = (): PrayerRecord => ({
  Fajr: { status: 'pending', wasMissed: false, missedAt: null, autoMissed: false },
  Dhuhr: { status: 'pending', wasMissed: false, missedAt: null, autoMissed: false },
  Asr: { status: 'pending', wasMissed: false, missedAt: null, autoMissed: false },
  Maghrib: { status: 'pending', wasMissed: false, missedAt: null, autoMissed: false },
  Isha: { status: 'pending', wasMissed: false, missedAt: null, autoMissed: false },
});

function toEntry(value: unknown): PrayerEntry {
  const entry = (value ?? {}) as Partial<PrayerEntry>;
  const status = entry.status;
  return {
    status:
      status === 'prayed' || status === 'qaza' || status === 'missed' ? status : 'pending',
    wasMissed: entry.wasMissed ?? false,
    missedAt: entry.missedAt ?? null,
    autoMissed: entry.autoMissed ?? false,
  };
}

export function toRecord(value: unknown): PrayerRecord {
  const record = emptyPrayerRecord();
  const prayers = (value ?? {}) as Partial<Record<PrayerName, unknown>>;
  for (const name of PRAYER_NAMES) {
    record[name] = toEntry(prayers[name]);
  }
  return record;
}

export type CalendarDay = { date: string; prayers: PrayerRecord };
export type CalendarResponse = { days: CalendarDay[] };

export type Badge = {
  badgeId: string;
  title: string;
  description: string;
  awardedAt: string;
};

export type PointTransaction = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type RewardsSummary = {
  total: number;
  badges: Badge[];
  recent: PointTransaction[];
};

export type QuranHistory = {
  dailyTarget: number;
  ayahsOpenedToday: number;
  date: string;
  history: { surahNumber: number; lastAyahNumber: number; lastReadAt: string }[];
};

/** Local YYYY-MM-DD for the device's date. */
export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local YYYY-MM-DD for tomorrow (device timezone). */
export function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Minutes from now until an HH:mm time today (null when unparsable).
 * Shared by Dashboard (which had its own local copy) and Prayer.
 */
export function minutesUntil(timeHHmm: string, now = new Date()): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeHHmm.trim());
  if (!match) return null;
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/**
 * Minutes from now until an HH:mm time TOMORROW (null when unparsable).
 * Used for the next-prayer card after Isha: the server returns
 * nextPrayer null once every prayer today has passed, but the next
 * real prayer is tomorrow's Fajr — showing "No prayer times yet"
 * then is wrong, because the times did load.
 */
export function minutesUntilTomorrow(timeHHmm: string, now = new Date()): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeHHmm.trim());
  if (!match) return null;
  const target = new Date(now);
  target.setDate(target.getDate() + 1);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/**
 * Tomorrow's Fajr time (HH:mm), or null when it cannot be loaded.
 * Prefers the per-prayer time (manual override when the user set
 * one), falls back to the calculated timings table.
 */
export async function fetchTomorrowFajr(): Promise<string | null> {
  try {
    const t = await fetchPrayerTimes(tomorrowKey());
    const fajr = t.perPrayer?.Fajr?.time ?? t.timings?.Fajr ?? '';
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(fajr.trim()) ? fajr.trim() : null;
  } catch {
    return null;
  }
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** "05:12" -> "5:12 AM". Returns the input unchanged when it is not HH:mm. */
export function formatTime12h(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

export function sleepDurationLabel(start: string, end: string): string {
  const parse = (value: string) => {
    const parts = value.split(':').map(Number);
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin === null || endMin === null) return '';
  let diff = endMin - startMin;
  if (diff <= 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const details = (data as { details?: Record<string, string[] | undefined> }).details;
    const detailMessages = details
      ? Object.values(details).flatMap((messages) => messages ?? [])
      : [];
    const base =
      typeof data.error === 'string' && data.error.length > 0
        ? data.error
        : 'Request failed. Please try again.';
    throw new Error(
      detailMessages.length > 0 && !detailMessages.every((message) => base.includes(message))
        ? `${base} ${detailMessages.join(' ')}`
        : base,
    );
  }
  return data as T;
}

/** GET /api/prayer/times — today's (or a given date's) prayer times. */
export async function fetchPrayerTimes(date?: string): Promise<PrayerTimesResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return requestJson<PrayerTimesResponse>(`/api/prayer/times${query}`);
}

/** The user's own saved per-prayer times (from GET /api/profile). */
export async function fetchPrayerSettings(): Promise<PrayerSettings> {
  const data = await requestJson<{
    profile?: { prayerSettings?: Partial<Record<PrayerName, Partial<PrayerSetting>>> };
  }>('/api/profile');
  const settings = emptyPrayerSettings();
  const saved = data.profile?.prayerSettings ?? {};
  for (const prayer of PRAYER_NAMES) {
    const entry = saved[prayer];
    if (!entry) continue;
    settings[prayer] = {
      timeOverride: typeof entry.timeOverride === 'string' ? entry.timeOverride : '',
      endTime: typeof entry.endTime === 'string' ? entry.endTime : '',
      reminder: entry.reminder ?? true,
    };
  }
  return settings;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isValidTime(value: string): boolean {
  return value === '' || HHMM.test(value);
}

/** Persist the user's own per-prayer times via POST /api/profile. */
export async function savePrayerSettings(settings: PrayerSettings): Promise<void> {
  for (const prayer of PRAYER_NAMES) {
    const entry = settings[prayer];
    if (!isValidTime(entry.timeOverride) || !isValidTime(entry.endTime)) {
      throw new Error(`${prayer} ka time HH:mm format me hona chahiye.`);
    }
  }
  await requestJson('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ prayerSettings: settings }),
  });
}

/** GET /api/salah/day/:date — one day's prayer statuses (auto-missed recomputed server-side). */
export async function fetchSalahDay(date: string): Promise<PrayerRecord> {
  const data = await requestJson<{ prayers?: unknown }>(`/api/salah/day/${date}`);
  return toRecord(data.prayers);
}

/** PUT /api/salah/day/:date { prayer, status } — mark one prayer. */
export async function updateSalahStatus(
  date: string,
  prayer: PrayerName,
  status: SalahStatus,
): Promise<PrayerRecord> {
  const data = await requestJson<{ prayers?: unknown }>(`/api/salah/day/${date}`, {
    method: 'PUT',
    body: JSON.stringify({ prayer, status }),
  });
  return toRecord(data.prayers);
}

/** GET /api/salah/calendar/:month (YYYY-MM) — the whole month's records. */
export async function fetchSalahCalendar(month: string): Promise<Record<string, PrayerRecord>> {
  const data = await requestJson<{ days?: { date: string; prayers?: unknown }[] }>(
    `/api/salah/calendar/${month}`,
  );
  const records: Record<string, PrayerRecord> = {};
  for (const day of data.days ?? []) {
    if (typeof day.date === 'string') records[day.date] = toRecord(day.prayers);
  }
  return records;
}

/** GET /api/rewards/summary — server-side points total, badges, recent transactions. */
export async function fetchRewardsSummary(): Promise<RewardsSummary> {
  const data = await requestJson<{
    total?: number;
    badges?: Badge[];
    recent?: PointTransaction[];
  }>('/api/rewards/summary');
  return {
    total: typeof data.total === 'number' ? data.total : 0,
    badges: Array.isArray(data.badges) ? data.badges : [],
    recent: Array.isArray(data.recent) ? data.recent : [],
  };
}

/** GET /api/quran/history — today's real reading progress + last-read surahs. */
export async function fetchQuranHistory(): Promise<QuranHistory> {
  const data = await requestJson<{
    dailyTarget?: number;
    ayahsOpenedToday?: number;
    date?: string;
    history?: { surahNumber: number; lastAyahNumber: number; lastReadAt: string }[];
  }>('/api/quran/history');
  return {
    dailyTarget: typeof data.dailyTarget === 'number' ? data.dailyTarget : 10,
    ayahsOpenedToday: typeof data.ayahsOpenedToday === 'number' ? data.ayahsOpenedToday : 0,
    date: typeof data.date === 'string' ? data.date : todayKey(),
    history: Array.isArray(data.history) ? data.history : [],
  };
}

// ---------------------------------------------------------------------------
// Profile / onboarding (mirrors web types/profile.ts + lib/profileApi.ts)
// ---------------------------------------------------------------------------

export type ProfileForm = {
  name: string;
  dateOfBirth: string;
  gender: '' | 'female' | 'male' | 'prefer-not-to-say';
  education: string;
  course: string;
  collegeName: string;
  classYear: string;
  branch: string;
  semester: string;
  subjects: string;
  collegeStart: string;
  collegeEnd: string;
  collegeDays: string[];
  weeklyOffDays: string[];
  studyStart: string;
  studyEnd: string;
  dailyStudyTarget: string;
  studyBreakMinutes: string;
  preferredStudyDays: string[];
  country: string;
  state: string;
  city: string;
  timezone: string;
  calculationMethod: string;
  asrMethod: string;
  prayerSettings: PrayerSettings;
  sleepStartTime: string;
  sleepEndTime: string;
  sleepReminder: boolean;
};

export const emptyProfileForm = (name = ''): ProfileForm => ({
  name,
  dateOfBirth: '',
  gender: '',
  education: '',
  course: '',
  collegeName: '',
  classYear: '',
  branch: '',
  semester: '',
  subjects: '',
  collegeStart: '',
  collegeEnd: '',
  collegeDays: [],
  weeklyOffDays: [],
  studyStart: '',
  studyEnd: '',
  dailyStudyTarget: '',
  studyBreakMinutes: '',
  preferredStudyDays: [],
  country: 'India',
  state: '',
  city: '',
  timezone: 'Asia/Kolkata',
  calculationMethod: 'University of Islamic Sciences, Karachi',
  asrMethod: 'Hanafi',
  prayerSettings: emptyPrayerSettings(),
  sleepStartTime: '22:00',
  sleepEndTime: '04:00',
  sleepReminder: true,
});

type SavedProfileRaw = {
  dateOfBirth?: string;
  gender?: '' | 'female' | 'male' | 'prefer-not-to-say';
  education?: string;
  course?: string;
  collegeName?: string;
  classYear?: string;
  branch?: string;
  semester?: string;
  subjects?: string[];
  collegeStartTime?: string;
  collegeEndTime?: string;
  collegeDays?: string[];
  weeklyOffDays?: string[];
  studyStartTime?: string;
  studyEndTime?: string;
  dailyStudyTarget?: string;
  studyBreakMinutes?: string;
  preferredStudyDays?: string[];
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  prayerCalculationMethod?: string;
  asrMethod?: '' | 'standard' | 'hanafi';
  prayerSettings?: Partial<Record<PrayerName, Partial<PrayerSetting>>>;
  sleepStartTime?: string;
  sleepEndTime?: string;
  sleepTime?: string;
  sleepReminder?: boolean;
  onboardingCompleted?: boolean;
};

export function profileFromApi(saved: SavedProfileRaw, name: string): ProfileForm {
  const base = emptyProfileForm(name);
  const prayerSettings = emptyPrayerSettings();
  if (saved.prayerSettings) {
    for (const prayer of PRAYER_NAMES) {
      const entry = saved.prayerSettings[prayer];
      if (entry) {
        prayerSettings[prayer] = {
          timeOverride: entry.timeOverride ?? '',
          endTime: entry.endTime ?? '',
          reminder: entry.reminder ?? true,
        };
      }
    }
  }
  const sleepStartTime = saved.sleepStartTime || saved.sleepTime || '22:00';
  const sleepEndTime =
    saved.sleepEndTime ||
    (() => {
      const [hours, minutes] = sleepStartTime.split(':').map(Number);
      return `${String(((hours || 0) + 6) % 24).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
    })();
  return {
    ...base,
    dateOfBirth: saved.dateOfBirth ?? '',
    gender: saved.gender ?? '',
    education: saved.education ?? '',
    course: saved.course ?? '',
    collegeName: saved.collegeName ?? '',
    classYear: saved.classYear ?? '',
    branch: saved.branch ?? '',
    semester: saved.semester ?? '',
    subjects: Array.isArray(saved.subjects) ? saved.subjects.join(', ') : '',
    collegeStart: saved.collegeStartTime ?? '',
    collegeEnd: saved.collegeEndTime ?? '',
    collegeDays: saved.collegeDays ?? [],
    weeklyOffDays: saved.weeklyOffDays ?? [],
    studyStart: saved.studyStartTime ?? '',
    studyEnd: saved.studyEndTime ?? '',
    dailyStudyTarget: saved.dailyStudyTarget ?? '',
    studyBreakMinutes: saved.studyBreakMinutes ?? '',
    preferredStudyDays: saved.preferredStudyDays ?? [],
    country: saved.country ?? 'India',
    state: saved.state ?? '',
    city: saved.city ?? '',
    timezone: saved.timezone ?? 'Asia/Kolkata',
    calculationMethod: canonicalPrayerMethod(saved.prayerCalculationMethod),
    asrMethod: saved.asrMethod === 'standard' ? 'Shafi' : 'Hanafi',
    prayerSettings,
    sleepStartTime,
    sleepEndTime,
    sleepReminder: saved.sleepReminder ?? true,
  };
}

function profileToApi(form: ProfileForm): Record<string, unknown> {
  const sleepStartTime = form.sleepStartTime || '22:00';
  const sleepEndTime =
    form.sleepEndTime ||
    (() => {
      const [hours, minutes] = sleepStartTime.split(':').map(Number);
      return `${String(((hours || 0) + 6) % 24).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
    })();
  return {
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    education: form.education,
    course: form.course,
    collegeName: form.collegeName,
    classYear: form.classYear,
    branch: form.branch,
    semester: form.semester,
    subjects: form.subjects
      .split(',')
      .map((subject) => subject.trim())
      .filter(Boolean),
    collegeStartTime: form.collegeStart,
    collegeEndTime: form.collegeEnd,
    collegeDays: form.collegeDays,
    weeklyOffDays: form.weeklyOffDays,
    studyStartTime: form.studyStart,
    studyEndTime: form.studyEnd,
    dailyStudyTarget: form.dailyStudyTarget,
    studyBreakMinutes: form.studyBreakMinutes || undefined,
    preferredStudyDays: form.preferredStudyDays,
    country: form.country || 'India',
    state: form.state || undefined,
    city: form.city,
    timezone: form.timezone || 'Asia/Kolkata',
    prayerCalculationMethod: form.calculationMethod,
    asrMethod: form.asrMethod.toLowerCase() === 'hanafi' ? 'hanafi' : 'standard',
    prayerSettings: form.prayerSettings,
    sleepTime: sleepStartTime,
    sleepStartTime,
    sleepEndTime,
    sleepReminder: form.sleepReminder,
  };
}

export type OnboardingStatus = {
  profile: ProfileForm | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingSkipped: boolean;
};

/**
 * GET /api/profile — saved profile + onboarding summary, exactly as the
 * web app reads it. Returns null profile when the user has none yet.
 */
export async function loadProfileWithCompletion(
  name: string,
): Promise<OnboardingStatus> {
  const result = await requestJson<{
    profile: SavedProfileRaw | null;
    onboarding?: { status: string; step: number; completed: boolean; skipped: boolean };
  }>('/api/profile');
  if (!result.profile) {
    return {
      profile: null,
      onboardingCompleted: false,
      onboardingStep: 0,
      onboardingSkipped: false,
    };
  }
  const summary = result.onboarding;
  return {
    profile: profileFromApi(result.profile, name),
    onboardingCompleted: summary
      ? summary.completed
      : result.profile.onboardingCompleted !== false,
    onboardingStep: summary && Number.isInteger(summary.step) ? summary.step : 0,
    onboardingSkipped: summary ? summary.skipped : false,
  };
}

/** Complete save: POST /api/profile with onboardingCompleted: true, step 8. */
export async function saveProfileComplete(form: ProfileForm): Promise<void> {  await requestJson('/api/profile', {
    method: 'POST',
    body: JSON.stringify({
      ...profileToApi(form),
      onboardingCompleted: true,
      onboardingSkipped: false,
      onboardingStep: 8,
    }),
  });
}

/**
 * Skip-save: persist whatever is filled in so far and record the skip
 * (onboardingSkipped: true, onboardingStep = the step they were on),
 * exactly as the web app's saveProfilePartial does.
 */
export async function saveProfilePartial(form: ProfileForm, step: number): Promise<void> {
  const resumeStep = Math.min(8, Math.max(0, Math.floor(step) || 0));
  await requestJson('/api/profile', {
    method: 'POST',
    body: JSON.stringify({
      ...profileToApi(form),
      onboardingCompleted: false,
      onboardingSkipped: true,
      onboardingStep: resumeStep,
    }),
  });
}

/**
 * Change ONLY the prayer calculation method, from the Prayer screen.
 *
 * The server's POST /api/profile is a partial upsert ($set of the
 * fields sent), so sending just the method leaves every other saved
 * value untouched — except the onboarding flags, which the server's
 * applyOnboardingTransitions rewrites whenever they are absent
 * (it clears onboardingSkipped). The current flags are therefore
 * passed straight through, so a completed user stays completed and
 * a skipped user stays skipped with the same resume step. The
 * method itself must be one of PRAYER_METHODS (see
 * src/lib/prayerMethods.ts) — any other name would silently compute
 * Karachi on the server.
 */
export async function savePrayerCalculationMethod(
  method: string,
  onboarding: { completed: boolean; skipped: boolean; step: number },
): Promise<void> {
  await requestJson('/api/profile', {
    method: 'POST',
    body: JSON.stringify({
      prayerCalculationMethod: method,
      onboardingCompleted: onboarding.completed,
      onboardingSkipped: onboarding.skipped,
      onboardingStep: Math.min(8, Math.max(0, Math.floor(onboarding.step) || 0)),
    }),
  });
}
