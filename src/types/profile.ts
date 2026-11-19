export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type PrayerSetting = {
  /** Manual HH:mm override for the calculated time. Empty = use calculated time. */
  timeOverride?: string;
  /** Deadline HH:mm for this prayer. Empty = next prayer's time (Isha: 23:59). */
  endTime?: string;
  /** Whether reminders are wanted for this prayer. Defaults to true. */
  reminder?: boolean;
};

export type PrayerSettings = Record<PrayerName, PrayerSetting>;

export const prayerNames: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const emptyPrayerSettings = (): PrayerSettings => ({
  Fajr: { timeOverride: '', endTime: '', reminder: true },
  Dhuhr: { timeOverride: '', endTime: '', reminder: true },
  Asr: { timeOverride: '', endTime: '', reminder: true },
  Maghrib: { timeOverride: '', endTime: '', reminder: true },
  Isha: { timeOverride: '', endTime: '', reminder: true },
});

export function sleepDurationLabel(start: string, end: string): string {
  const parse = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
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

export type UserProfile = {
  name: string;
  email: string;
  dateOfBirth?: string;
  gender?: '' | 'female' | 'male' | 'prefer-not-to-say';
  profilePictureUrl?: string;
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
  weekendSchedule?: string;
  scheduleNote?: string;
  studyStart: string;
  studyEnd: string;
  dailyStudyTarget: string;
  dailyStudyHours?: string;
  studyBreakMinutes?: string;
  subjectTargets?: string;
  preferredStudyDays: string[];
  country?: string;
  state?: string;
  city: string;
  timezone?: string;
  locationPermission?: boolean;
  calculationMethod: string;
  asrMethod: string;
  prayerSettings: PrayerSettings;
  /** Legacy bedtime choice, kept for old profiles / Focus fallback. */
  sleepTime: '22:00' | '23:00';
  sleepStartTime: string;
  sleepEndTime: string;
  sleepReminder?: boolean;
  focusStartTime?: string;
  focusEndTime?: string;
};

export type SavedProfile = {
  dateOfBirth?: string;
  gender?: '' | 'female' | 'male' | 'prefer-not-to-say';
  profilePictureUrl?: string;
  education: string;
  course: string;
  collegeName?: string;
  classYear?: string;
  branch?: string;
  semester: string;
  subjects: string[];
  collegeStartTime: string;
  collegeEndTime: string;
  collegeDays?: string[];
  weeklyOffDays?: string[];
  weekendSchedule?: string;
  scheduleNote?: string;
  studyStartTime: string;
  studyEndTime: string;
  dailyStudyTarget?: string;
  dailyStudyHours?: string;
  studyBreakMinutes?: string;
  subjectTargets?: string;
  preferredStudyDays?: string[];
  country?: string;
  state?: string;
  city: string;
  timezone?: string;
  locationPermission?: boolean;
  prayerCalculationMethod: string;
  asrMethod: '' | 'standard' | 'hanafi';
  prayerSettings?: PrayerSettings;
  sleepTime: string;
  sleepStartTime: string;
  sleepEndTime: string;
  sleepReminder?: boolean;
  focusStartTime?: string;
  focusEndTime?: string;
  onboardingCompleted: boolean;
};

export const emptyProfile = (name = '', email = ''): UserProfile => ({
  name,
  email,
  dateOfBirth: '',
  gender: '',
  profilePictureUrl: '',
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
  weekendSchedule: '',
  scheduleNote: '',
  studyStart: '',
  studyEnd: '',
  dailyStudyTarget: '',
  dailyStudyHours: '',
  studyBreakMinutes: '',
  subjectTargets: '',
  preferredStudyDays: [],
  country: 'India',
  state: '',
  city: '',
  timezone: 'Asia/Kolkata',
  locationPermission: false,
  calculationMethod: 'University of Islamic Sciences, Karachi',
  asrMethod: 'Hanafi',
  prayerSettings: emptyPrayerSettings(),
  sleepTime: '22:00',
  sleepStartTime: '22:00',
  sleepEndTime: '04:00',
  sleepReminder: true,
  focusStartTime: '',
  focusEndTime: '',
});

export function profileToApi(profile: UserProfile): SavedProfile {
  const sleepStartTime = profile.sleepStartTime || profile.sleepTime;
  const sleepEndTime =
    profile.sleepEndTime ||
    (() => {
      const [hours, minutes] = sleepStartTime.split(':').map(Number);
      return `${String(((hours || 0) + 6) % 24).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
    })();

  return {
    dateOfBirth: profile.dateOfBirth || undefined,
    gender: profile.gender || undefined,
    profilePictureUrl: profile.profilePictureUrl || undefined,
    education: profile.education,
    course: profile.course,
    collegeName: profile.collegeName,
    classYear: profile.classYear,
    branch: profile.branch,
    semester: profile.semester,
    subjects: profile.subjects
      .split(',')
      .map((subject) => subject.trim())
      .filter(Boolean),
    collegeStartTime: profile.collegeStart,
    collegeEndTime: profile.collegeEnd,
    collegeDays: profile.collegeDays,
    weeklyOffDays: profile.weeklyOffDays,
    weekendSchedule: profile.weekendSchedule || undefined,
    scheduleNote: profile.scheduleNote || undefined,
    studyStartTime: profile.studyStart,
    studyEndTime: profile.studyEnd,
    dailyStudyTarget: profile.dailyStudyTarget,
    dailyStudyHours: profile.dailyStudyHours || undefined,
    studyBreakMinutes: profile.studyBreakMinutes || undefined,
    subjectTargets: profile.subjectTargets || undefined,
    preferredStudyDays: profile.preferredStudyDays,
    country: profile.country || 'India',
    state: profile.state || undefined,
    city: profile.city,
    timezone: profile.timezone || 'Asia/Kolkata',
    locationPermission: profile.locationPermission ?? false,
    prayerCalculationMethod: profile.calculationMethod,
    asrMethod: profile.asrMethod.toLowerCase() === 'hanafi' ? 'hanafi' : 'standard',
    prayerSettings: profile.prayerSettings,
    sleepTime: profile.sleepTime,
    sleepStartTime,
    sleepEndTime,
    sleepReminder: profile.sleepReminder ?? true,
    focusStartTime: profile.focusStartTime || undefined,
    focusEndTime: profile.focusEndTime || undefined,
    onboardingCompleted: true,
  };
}

export function profileFromApi(
  saved: Partial<SavedProfile>,
  name: string,
  email: string,
): UserProfile {
  const base = emptyProfile(name, email);
  const sleepStartTime = saved.sleepStartTime || saved.sleepTime || '22:00';
  const sleepEndTime =
    saved.sleepEndTime ||
    (() => {
      const [hours, minutes] = sleepStartTime.split(':').map(Number);
      return `${String(((hours || 0) + 6) % 24).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
    })();
  const prayerSettings = emptyPrayerSettings();
  if (saved.prayerSettings) {
    for (const prayer of prayerNames) {
      const savedSetting = saved.prayerSettings[prayer];
      if (savedSetting) {
        prayerSettings[prayer] = {
          timeOverride: savedSetting.timeOverride ?? '',
          endTime: savedSetting.endTime ?? '',
          reminder: savedSetting.reminder ?? true,
        };
      }
    }
  }
  return {
    ...base,
    dateOfBirth: saved.dateOfBirth ?? '',
    gender: saved.gender ?? '',
    profilePictureUrl: saved.profilePictureUrl ?? '',
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
    weekendSchedule: saved.weekendSchedule ?? '',
    scheduleNote: saved.scheduleNote ?? '',
    studyStart: saved.studyStartTime ?? '',
    studyEnd: saved.studyEndTime ?? '',
    dailyStudyTarget: saved.dailyStudyTarget ?? '',
    dailyStudyHours: saved.dailyStudyHours ?? '',
    studyBreakMinutes: saved.studyBreakMinutes ?? '',
    subjectTargets: saved.subjectTargets ?? '',
    preferredStudyDays: saved.preferredStudyDays ?? [],
    country: saved.country ?? 'India',
    state: saved.state ?? '',
    city: saved.city ?? '',
    timezone: saved.timezone ?? 'Asia/Kolkata',
    locationPermission: saved.locationPermission ?? false,
    calculationMethod:
      saved.prayerCalculationMethod || 'University of Islamic Sciences, Karachi',
    asrMethod: saved.asrMethod === 'standard' ? 'Shafi' : 'Hanafi',
    prayerSettings,
    sleepTime: saved.sleepTime === '23:00' ? '23:00' : '22:00',
    sleepStartTime,
    sleepEndTime,
    sleepReminder: saved.sleepReminder ?? true,
    focusStartTime: saved.focusStartTime ?? '',
    focusEndTime: saved.focusEndTime ?? '',
  };
}
