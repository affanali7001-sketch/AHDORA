
export type UserProfile = {
  name: string;
  email: string;
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
  preferredStudyDays: string[];
  city: string;
  calculationMethod: string;
  asrMethod: string;
  sleepTime: '22:00' | '23:00';
};

export type SavedProfile = {
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
  studyStartTime: string;
  studyEndTime: string;
  dailyStudyTarget?: string;
  preferredStudyDays?: string[];
  city: string;
  prayerCalculationMethod: string;
  asrMethod: '' | 'standard' | 'hanafi';
  sleepTime: string;
  sleepStartTime: string;
  sleepEndTime: string;
  onboardingCompleted: boolean;
};

export const emptyProfile = (name = '', email = ''): UserProfile => ({
  name,
  email,
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
  preferredStudyDays: [],
  city: '',
  calculationMethod: 'University of Islamic Sciences, Karachi',
  asrMethod: 'Hanafi',
  sleepTime: '22:00',
});

export function profileToApi(profile: UserProfile): SavedProfile {
  const sleepStartTime = profile.sleepTime;
  const [hours, minutes] = sleepStartTime.split(':').map(Number);
  const sleepEndTime = `${String((hours + 6) % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
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
    studyStartTime: profile.studyStart,
    studyEndTime: profile.studyEnd,
    dailyStudyTarget: profile.dailyStudyTarget,
    preferredStudyDays: profile.preferredStudyDays,
    city: profile.city,
    prayerCalculationMethod: profile.calculationMethod,
    asrMethod: profile.asrMethod.toLowerCase() === 'hanafi' ? 'hanafi' : 'standard',
    sleepTime: profile.sleepTime,
    sleepStartTime,
    sleepEndTime,
    onboardingCompleted: true,
  };
}

export function profileFromApi(
  saved: Partial<SavedProfile>,
  name: string,
  email: string,
): UserProfile {
  return {
    ...emptyProfile(name, email),
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
    preferredStudyDays: saved.preferredStudyDays ?? [],
    city: saved.city ?? '',
    calculationMethod:
      saved.prayerCalculationMethod || 'University of Islamic Sciences, Karachi',
    asrMethod: saved.asrMethod === 'standard' ? 'Shafi' : 'Hanafi',
    sleepTime: saved.sleepTime === '23:00' ? '23:00' : '22:00',
  };
}