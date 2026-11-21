import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AhdoraLogo from './AhdoraLogo';
import type { PrayerName, UserProfile } from '../types/profile';
import { prayerNames, sleepDurationLabel } from '../types/profile';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STRINGS,
  pickText,
  type AppLanguage,
} from '../lib/language';


const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timezones = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
];

type Props = {
  user: UserProfile;
  onChange: (user: UserProfile) => void;
  onComplete: () => Promise<void>;
  /**
   * Skip this step (and the whole flow): the parent saves whatever has
   * been filled in so far as a partial profile and lets the user into
   * the app. Skipping never validates the current step. Receives the
   * step the user was on, so it can be stored as the resume point.
   */
  onSkip: (step: number) => Promise<void>;
  /** Step to open on (used when returning from Profile to finish/edit). */
  initialStep?: number;
  /** 'edit' when reopened from Profile & settings; 'initial' on signup. */
  mode?: 'initial' | 'edit';
  /** Edit mode only: go back to Profile without saving. */
  onCancel?: () => void;
  /** Phase 13 — chosen language; step titles, hints and buttons are bilingual. */
  language: AppLanguage;
};

function isValidTime(value: string): boolean {
  if (!value) return true;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return Boolean(match);
}

export default function Onboarding({ user, onChange, onComplete, onSkip, initialStep = 0, mode = 'initial', onCancel, language }: Props) {
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState('');
  /**
   * Per-field errors (P9): the old single generic message ("Please
   * complete your education details.") never said WHICH field was
   * missing — it took 3 attempts to find out. Each missing field now
   * gets its own message, shown under that field, and the summary
   * above the buttons names them all.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [skipping, setSkipping] = useState(false);

  /**
   * Resume safety (P9): `initialStep` is only the opening step, but
   * if the parent ever re-opens the form at a different step while
   * this component is still mounted, follow it — never sit on a stale
   * step. (The App-level fix is resetting the requested step on
   * signup/logout; this is the backstop inside the form.)
   */
  const prevInitialStepRef = useRef(initialStep);
  if (prevInitialStepRef.current !== initialStep) {
    prevInitialStepRef.current = initialStep;
    setStep(initialStep);
    setError('');
    setFieldErrors({});
  }

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  };

  const update = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    onChange({ ...user, [field]: value });
    setError('');
    clearFieldError(field as string);
  };

  const updatePrayer = (prayer: PrayerName, field: 'timeOverride' | 'endTime' | 'reminder', value: string | boolean) => {
    onChange({
      ...user,
      prayerSettings: {
        ...user.prayerSettings,
        [prayer]: { ...user.prayerSettings[prayer], [field]: value },
      },
    });
    setError('');
    clearFieldError(`prayer:${prayer}`);
  };

  // Phase 13 — step titles + hints are the preview's exact bilingual
  // pairs (steps / stepsEn). The chosen language is the big line, the
  // other language sits right below it. Field labels and validation
  // messages inside the steps stay as they are.
  const steps = useMemo(() => ONBOARDING_STEPS.map((stepInfo) => ({
    title: pickText(stepInfo.title, language),
    hint: pickText(stepInfo.hint, language),
  })), [language]);
  const backLabel = pickText(ONBOARDING_STRINGS.back, language);
  const skipLabel = pickText(ONBOARDING_STRINGS.skip, language);
  const saveLabel = pickText(ONBOARDING_STRINGS.save, language);

  /**
   * Per-step validation. Returns one message per missing/invalid
   * field, keyed by field name, plus a summary that names them all.
   * Required set per step (the audit's "ALL fields" confusion came
   * from this never being shown): step 1 — education, course,
   * semester, subjects (college, class/year and branch are optional);
   * step 2 — college start/end + at least one college day; step 3 —
   * study start/end, daily target + at least one study day; step 4 —
   * city AND state, both (P2: a city with no state cannot be resolved
   * for prayer times — Affan's saved "MAHARSTRA" with an empty state
   * is the live example). Steps 5–6 only check HH:mm formats.
   */
  function validateStep(targetStep: number): { message: string; fields: Record<string, string> } {
    const fields: Record<string, string> = {};
    if (targetStep === 1) {
      if (!user.education.trim()) fields.education = 'Education level is required.';
      if (!user.course.trim()) fields.course = 'Course / programme is required.';
      if (!user.semester.trim()) fields.semester = 'Semester is required.';
      if (!user.subjects.trim()) fields.subjects = 'Subjects are required.';
    }
    if (targetStep === 2) {
      if (!user.collegeStart) fields.collegeStart = 'College start time is required.';
      if (!user.collegeEnd) fields.collegeEnd = 'College end time is required.';
      if (user.collegeDays.length === 0) fields.collegeDays = 'Select at least one college day.';
    }
    if (targetStep === 3) {
      if (!user.studyStart) fields.studyStart = 'Study start time is required.';
      if (!user.studyEnd) fields.studyEnd = 'Study end time is required.';
      if (!user.dailyStudyTarget) fields.dailyStudyTarget = 'Daily study target is required.';
      if (user.preferredStudyDays.length === 0) fields.preferredStudyDays = 'Select at least one preferred study day.';
    }
    if (targetStep === 4) {
      if (!user.city.trim()) fields.city = 'City is required — prayer times are calculated for your city.';
      if (!(user.state ?? '').trim()) fields.state = 'State is required — it helps find your city for prayer times.';
    }
    if (targetStep === 5) {
      for (const prayer of prayerNames) {
        const setting = user.prayerSettings[prayer];
        if (!isValidTime(setting.timeOverride ?? '') || !isValidTime(setting.endTime ?? '')) {
          fields[`prayer:${prayer}`] = `Please use HH:mm times for ${prayer}, or leave them blank.`;
        }
      }
    }
    if (targetStep === 6) {
      for (const value of [user.sleepStartTime, user.sleepEndTime, user.focusStartTime ?? '', user.focusEndTime ?? '']) {
        if (!isValidTime(value)) {
          fields.sleepTimes = 'Please use HH:mm times for sleep and focus, or leave focus blank.';
          break;
        }
      }
    }
    const messages = Object.values(fields);
    return { fields, message: messages.join(' ') };
  }

  function validateCurrentStep(): { message: string; fields: Record<string, string> } {
    return validateStep(step);
  }

  /** Inline helpers for the per-field errors + required markers. */
  const fieldErrorText = (key: string) =>
    fieldErrors[key] ? (
      <p style={{ color: 'var(--red)', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors[key]}</p>
    ) : null;
  const requiredMark = <span style={{ color: 'var(--red)' }}> *</span>;
  const invalidStyle = (key: string) =>
    fieldErrors[key] ? { borderColor: 'var(--red)' } : undefined;

  function next(e?: FormEvent) {
    e?.preventDefault();
    const validation = validateCurrentStep();
    if (validation.message) {
      setFieldErrors(validation.fields);
      setError(validation.message);
      return;
    }
    setError('');
    setFieldErrors({});
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    // Final save must not slip past an earlier step: a fresh signup
    // could otherwise reach Review with an empty city/state and save
    // an unresolvable location. Re-check steps 1–6 and jump to the
    // first incomplete one. Edit mode is exempt — it re-saves an
    // already-completed profile, whose saved values are never judged
    // here (same grandfathering as the API's completion check).
    if (mode === 'initial') {
      for (let target = 1; target <= 6; target += 1) {
        const check = validateStep(target);
        if (check.message) {
          setFieldErrors(check.fields);
          setError(check.message);
          setStep(target);
          return;
        }
      }
    }
    const validation = validateCurrentStep();
    if (validation.message) {
      setFieldErrors(validation.fields);
      setError(validation.message);
      return;
    }
    setBusy(true);
    try {
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy || skipping) return;
    setSkipping(true);
    try {
      await onSkip(step);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skip nahi ho paya. Dobara try karo.');
    } finally {
      setSkipping(false);
    }
  }

  function toggleDay(field: 'collegeDays' | 'weeklyOffDays' | 'preferredStudyDays', day: string) {
    const selected = user[field];
    update(field, selected.includes(day) ? selected.filter((item) => item !== day) : [...selected, day]);
  }

  const sleepDuration = sleepDurationLabel(user.sleepStartTime, user.sleepEndTime);
  const reviewGroups: { label: string; step: number; lines: string[] }[] = [
    {
      label: 'Personal information',
      step: 0,
      lines: [
        `${user.name} · ${user.email}`,
        user.dateOfBirth ? `Date of birth: ${user.dateOfBirth}` : '',
        user.gender ? `Gender: ${user.gender}` : '',
        user.profilePictureUrl ? `Photo: ${user.profilePictureUrl}` : '',
      ].filter(Boolean),
    },
    {
      label: 'Education',
      step: 1,
      lines: [
        [user.education, user.course].filter(Boolean).join(' · '),
        [user.collegeName, user.classYear, user.semester, user.branch].filter(Boolean).join(' · '),
        user.subjects ? `Subjects: ${user.subjects}` : '',
      ].filter(Boolean),
    },
    {
      label: 'College schedule',
      step: 2,
      lines: [
        user.collegeStart && user.collegeEnd ? `${user.collegeStart} – ${user.collegeEnd}` : '',
        user.collegeDays.length ? `College days: ${user.collegeDays.join(', ')}` : '',
        user.weeklyOffDays.length ? `Off days: ${user.weeklyOffDays.join(', ')}` : '',
        user.weekendSchedule ? `Weekend: ${user.weekendSchedule}` : '',
        user.scheduleNote ? `Note: ${user.scheduleNote}` : '',
      ].filter(Boolean),
    },
    {
      label: 'Study schedule',
      step: 3,
      lines: [
        user.studyStart && user.studyEnd ? `${user.studyStart} – ${user.studyEnd}` : '',
        user.dailyStudyTarget ? `Daily target: ${user.dailyStudyTarget}` : '',
        user.dailyStudyHours ? `Daily hours: ${user.dailyStudyHours}` : '',
        user.studyBreakMinutes ? `Break: ${user.studyBreakMinutes} min` : '',
        user.subjectTargets ? `Subject targets: ${user.subjectTargets}` : '',
        user.preferredStudyDays.length ? `Study days: ${user.preferredStudyDays.join(', ')}` : '',
      ].filter(Boolean),
    },
    {
      label: 'Location & prayer calculation',
      step: 4,
      lines: [
        [user.city, user.state, user.country].filter(Boolean).join(', '),
        user.timezone ? `Timezone: ${user.timezone}` : '',
        `Method: ${user.calculationMethod} · Asr: ${user.asrMethod}`,
        user.locationPermission ? 'Location permission: on' : 'Location permission: off (manual city)',
      ].filter(Boolean),
    },
    {
      label: 'Individual prayer timings',
      step: 5,
      lines: prayerNames.map((prayer) => {
        const setting = user.prayerSettings[prayer];
        const parts = [
          setting.timeOverride ? `time ${setting.timeOverride}` : 'calculated time',
          setting.endTime ? `deadline ${setting.endTime}` : '',
          setting.reminder === false ? 'no reminder' : '',
        ].filter(Boolean);
        return `${prayer}: ${parts.join(', ')}`;
      }),
    },
    {
      label: 'Sleep schedule',
      step: 6,
      lines: [
        user.sleepStartTime && user.sleepEndTime
          ? `Sleep ${user.sleepStartTime} – ${user.sleepEndTime}${sleepDuration ? ` (${sleepDuration} planned)` : ''}`
          : '',
        user.sleepReminder === false ? 'Sleep reminder: off' : 'Sleep reminder: on',
        user.focusStartTime && user.focusEndTime ? `Focus window: ${user.focusStartTime} – ${user.focusEndTime}` : '',
      ].filter(Boolean),
    },
  ];

  return (
    <div className="auth-screen onboarding-screen">
      <div className="auth-card onboarding-card" style={{ maxWidth: 620 }}>
        <div className="auth-brand"><AhdoraLogo size={42} /><span>AHDORA</span></div>
        <div className="auth-heading">
          <span className="eyebrow">STEP {step + 1} OF {steps.length}</span>
          <h1>{steps[step].title.primary}</h1>
          <p className="bilingual-secondary bilingual-secondary-large">{steps[step].title.secondary}</p>
          <p style={{ marginTop: 8 }}>{steps[step].hint.primary}</p>
          <p className="bilingual-secondary">{steps[step].hint.secondary}</p>
        </div>

        <div className="progress-track" aria-label={`Onboarding step ${step + 1} of ${steps.length}`}>
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        {(step === 1 || step === 2 || step === 3 || step === 4) && (
          <p className="onboarding-help">Fields marked <span style={{ color: 'var(--red)' }}>*</span> are required. If something is missing, the exact field is named under it.</p>
        )}

        {step === 0 && (
          <div>
            <label className="field-label">Full name</label>
            <input className="form-input" value={user.name} readOnly />
            <label className="field-label">Email address</label>
            <input className="form-input" value={user.email} readOnly />
            <p className="onboarding-help">These values come from your authenticated account and cannot be changed here.</p>
            <div className="onboarding-two-col">
              <div><label className="field-label">Date of birth (optional)</label><input className="form-input" type="date" value={user.dateOfBirth ?? ''} onChange={(e) => update('dateOfBirth', e.target.value)} /></div>
              <div><label className="field-label">Gender (optional)</label><select className="form-input" value={user.gender ?? ''} onChange={(e) => update('gender', e.target.value as UserProfile['gender'])}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="prefer-not-to-say">Prefer not to say</option></select></div>
            </div>
            <label className="field-label">Profile picture URL (optional)</label>
            <input className="form-input" value={user.profilePictureUrl ?? ''} onChange={(e) => update('profilePictureUrl', e.target.value)} placeholder="https://…" />
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="field-label">Education level{requiredMark}</label>
            <select className="form-input" style={invalidStyle('education')} value={user.education} onChange={(e) => update('education', e.target.value)}>
              <option value="">Select education level</option>
              <option>School</option><option>Diploma / Polytechnic</option><option>Undergraduate degree</option>
              <option>Postgraduate degree</option><option>Competitive exam preparation</option><option>Other</option>
            </select>
            {fieldErrorText('education')}
            <label className="field-label">Course / programme{requiredMark}</label>
            <input className="form-input" style={invalidStyle('course')} value={user.course} onChange={(e) => update('course', e.target.value)} />
            {fieldErrorText('course')}
            <label className="field-label">College / institute (optional)</label>
            <input className="form-input" value={user.collegeName} onChange={(e) => update('collegeName', e.target.value)} />
            <div className="onboarding-two-col">
              <div><label className="field-label">Class / year (optional)</label><input className="form-input" value={user.classYear} onChange={(e) => update('classYear', e.target.value)} /></div>
              <div><label className="field-label">Semester{requiredMark}</label><input className="form-input" style={invalidStyle('semester')} value={user.semester} onChange={(e) => update('semester', e.target.value)} />{fieldErrorText('semester')}</div>
            </div>
            <label className="field-label">Branch (optional)</label>
            <input className="form-input" value={user.branch} onChange={(e) => update('branch', e.target.value)} />
            <label className="field-label">Subjects (comma separated){requiredMark}</label>
            <textarea className="form-input onboarding-textarea" style={invalidStyle('subjects')} value={user.subjects} onChange={(e) => update('subjects', e.target.value)} />
            {fieldErrorText('subjects')}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="onboarding-two-col">
              <div><label className="field-label">College starts{requiredMark}</label><input className="form-input" style={invalidStyle('collegeStart')} type="time" value={user.collegeStart} onChange={(e) => update('collegeStart', e.target.value)} />{fieldErrorText('collegeStart')}</div>
              <div><label className="field-label">College ends{requiredMark}</label><input className="form-input" style={invalidStyle('collegeEnd')} type="time" value={user.collegeEnd} onChange={(e) => update('collegeEnd', e.target.value)} />{fieldErrorText('collegeEnd')}</div>
            </div>
            <label className="field-label">College days{requiredMark}</label>
            <DayPicker selected={user.collegeDays} onToggle={(day) => toggleDay('collegeDays', day)} />
            {fieldErrorText('collegeDays')}
            <label className="field-label">Weekly off days (optional)</label>
            <DayPicker selected={user.weeklyOffDays} onToggle={(day) => toggleDay('weeklyOffDays', day)} />
            <label className="field-label">Weekend schedule (optional)</label>
            <input className="form-input" value={user.weekendSchedule ?? ''} onChange={(e) => update('weekendSchedule', e.target.value)} placeholder="e.g. Saturday 09:00–13:00, Sunday off" />
            <label className="field-label">Schedule note (optional)</label>
            <textarea className="form-input onboarding-textarea" value={user.scheduleNote ?? ''} onChange={(e) => update('scheduleNote', e.target.value)} placeholder="Different timings on some days, holidays, etc." />
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="onboarding-two-col">
              <div><label className="field-label">Study starts{requiredMark}</label><input className="form-input" style={invalidStyle('studyStart')} type="time" value={user.studyStart} onChange={(e) => update('studyStart', e.target.value)} />{fieldErrorText('studyStart')}</div>
              <div><label className="field-label">Study ends{requiredMark}</label><input className="form-input" style={invalidStyle('studyEnd')} type="time" value={user.studyEnd} onChange={(e) => update('studyEnd', e.target.value)} />{fieldErrorText('studyEnd')}</div>
            </div>
            <label className="field-label">Daily study target{requiredMark}</label>
            <select className="form-input" style={invalidStyle('dailyStudyTarget')} value={user.dailyStudyTarget} onChange={(e) => update('dailyStudyTarget', e.target.value)}>
              <option value="">Select target</option><option>30 minutes</option><option>1 hour</option><option>2 hours</option><option>3 hours</option><option>4+ hours</option>
            </select>
            {fieldErrorText('dailyStudyTarget')}
            <div className="onboarding-two-col">
              <div><label className="field-label">Daily study hours (optional)</label><input className="form-input" value={user.dailyStudyHours ?? ''} onChange={(e) => update('dailyStudyHours', e.target.value)} placeholder="e.g. 4" /></div>
              <div><label className="field-label">Break duration in minutes (optional)</label><input className="form-input" inputMode="numeric" value={user.studyBreakMinutes ?? ''} onChange={(e) => update('studyBreakMinutes', e.target.value)} placeholder="e.g. 10" /></div>
            </div>
            <label className="field-label">Subject-wise targets (optional)</label>
            <textarea className="form-input onboarding-textarea" value={user.subjectTargets ?? ''} onChange={(e) => update('subjectTargets', e.target.value)} placeholder="e.g. Maths: 1h, DBMS: 1h" />
            <label className="field-label">Preferred study days{requiredMark}</label>
            <DayPicker selected={user.preferredStudyDays} onToggle={(day) => toggleDay('preferredStudyDays', day)} />
            {fieldErrorText('preferredStudyDays')}
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="onboarding-two-col">
              <div><label className="field-label">Country</label><input className="form-input" value={user.country ?? 'India'} onChange={(e) => update('country', e.target.value)} /></div>
              <div><label className="field-label">State{requiredMark}</label><input className="form-input" style={invalidStyle('state')} value={user.state ?? ''} onChange={(e) => update('state', e.target.value)} placeholder="e.g. Maharashtra" />{fieldErrorText('state')}</div>
            </div>
            <label className="field-label">Your city{requiredMark}</label>
            <input className="form-input" style={invalidStyle('city')} value={user.city} onChange={(e) => update('city', e.target.value)} placeholder="e.g. Pune, Maharashtra" />
            {fieldErrorText('city')}
            <label className="field-label">Timezone</label>
            <select className="form-input" value={user.timezone ?? 'Asia/Kolkata'} onChange={(e) => update('timezone', e.target.value)}>
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <label className="field-label">Prayer time calculation method</label>
            <select className="form-input" value={user.calculationMethod} onChange={(e) => update('calculationMethod', e.target.value)}>
              <option>University of Islamic Sciences, Karachi</option><option>Muslim World League</option><option>Egyptian General Authority</option><option>Umm al-Qura University, Makkah</option><option>ISNA</option>
            </select>
            <label className="field-label">Asr calculation</label>
            <select className="form-input" value={user.asrMethod} onChange={(e) => update('asrMethod', e.target.value)}>
              <option value="Hanafi">Hanafi</option><option value="Shafi">Shafi</option>
            </select>
            <label className="field-label">
              <input type="checkbox" checked={user.locationPermission ?? false} onChange={(e) => update('locationPermission', e.target.checked)} />{' '}
              Use my device location when available (optional)
            </label>
            <p className="onboarding-help">Your city is used to calculate live prayer times. You can also enter it manually.</p>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="onboarding-help">Leave a time blank to use the calculated time. A manual time is marked as manual on the prayer screen.</p>
            {prayerNames.map((prayer) => {
              const setting = user.prayerSettings[prayer];
              return (
                <div key={prayer} style={{ marginBottom: 14 }}>
                  <label className="field-label">{prayer}</label>
                  <div className="onboarding-two-col">
                    <div><label className="field-label">Time override (optional)</label><input className="form-input" type="time" value={setting.timeOverride ?? ''} onChange={(e) => updatePrayer(prayer, 'timeOverride', e.target.value)} /></div>
                    <div><label className="field-label">Deadline / end time (optional)</label><input className="form-input" type="time" value={setting.endTime ?? ''} onChange={(e) => updatePrayer(prayer, 'endTime', e.target.value)} /></div>
                  </div>
                  <label className="field-label">
                    <input type="checkbox" checked={setting.reminder ?? true} onChange={(e) => updatePrayer(prayer, 'reminder', e.target.checked)} />{' '}
                    Remind me for {prayer}
                  </label>
                  {fieldErrorText(`prayer:${prayer}`)}
                </div>
              );
            })}
          </div>
        )}

        {step === 6 && (
          <div>
            <div className="onboarding-two-col">
              <div><label className="field-label">Sleep starts</label><input className="form-input" type="time" value={user.sleepStartTime} onChange={(e) => update('sleepStartTime', e.target.value)} /></div>
              <div><label className="field-label">Wake up</label><input className="form-input" type="time" value={user.sleepEndTime} onChange={(e) => update('sleepEndTime', e.target.value)} /></div>
            </div>
            {sleepDuration && <p className="onboarding-help">Planned sleep window: {sleepDuration}. This is your schedule, not measured sleep.</p>}
            <div className="onboarding-two-col">
              <div><label className="field-label">Focus starts (optional)</label><input className="form-input" type="time" value={user.focusStartTime ?? ''} onChange={(e) => update('focusStartTime', e.target.value)} /></div>
              <div><label className="field-label">Focus ends (optional)</label><input className="form-input" type="time" value={user.focusEndTime ?? ''} onChange={(e) => update('focusEndTime', e.target.value)} /></div>
            </div>
            <label className="field-label">
              <input type="checkbox" checked={user.sleepReminder ?? true} onChange={(e) => update('sleepReminder', e.target.checked)} />{' '}
              Remind me at sleep time
            </label>
            {fieldErrorText('sleepTimes')}
            <p className="onboarding-help">Sleep and focus settings are saved to your profile. App blocking is an Android-only feature and is not active on the web.</p>
          </div>
        )}

        {step === 7 && (
          <div>
            {reviewGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{group.label}</strong>
                  <button type="button" className="text-button" onClick={() => { setStep(group.step); setError(''); setFieldErrors({}); }}>
                    Edit <ArrowRight size={13} />
                  </button>
                </div>
                {group.lines.length > 0
                  ? group.lines.map((line) => <p key={line} className="onboarding-help" style={{ margin: '4px 0' }}>{line}</p>)
                  : <p className="onboarding-help">Not filled in yet.</p>}
              </div>
            ))}
            <p className="onboarding-help">Confirming saves all of this to your private AHDORA account in MongoDB. You can edit it later from Profile &amp; settings.</p>
          </div>
        )}

        {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
        <form onSubmit={step === steps.length - 1 ? submit : next} className="onboarding-actions">
          {step > 0 && <button type="button" className="outline-button" onClick={() => { setStep((current) => current - 1); setError(''); setFieldErrors({}); }}><ArrowLeft size={15} /><span className="bilingual-label"><span>{backLabel.primary}</span><small>{backLabel.secondary}</small></span></button>}
          <button type="submit" className="primary-button" disabled={busy || skipping}>
            {busy ? 'Saving profile...' : step === steps.length - 1 ? (
              mode === 'edit' ? 'Save karo' : (
                <span className="bilingual-label"><span>{saveLabel.primary}</span><small>{saveLabel.secondary}</small></span>
              )
            ) : (
              <>{ONBOARDING_STRINGS.next} <ArrowRight size={16} /></>
            )}
          </button>
        </form>
        <button type="button" className="text-button bilingual-skip" onClick={skip} disabled={busy || skipping} style={{ marginTop: 10 }}>
          {skipping ? 'Save ho raha hai…' : (<><span>{skipLabel.primary}</span><small>{skipLabel.secondary}</small></>)}
        </button>
        {' '}
        {mode === 'edit' && onCancel && (
          <button type="button" className="text-button" onClick={onCancel} disabled={busy || skipping} style={{ marginTop: 6 }}>
            Wapas jao (bina save kiye)
          </button>
        )}
        <p className="onboarding-help">Skip karne par jo kuch bhara hai wo save ho jayega — kuch bhi lost nahi hoga. Baad me Profile se poora kar sakte ho. Your profile is saved to your private AHDORA account.</p>
      </div>
    </div>
  );
}

function DayPicker({ selected, onToggle }: { selected: string[]; onToggle: (day: string) => void }) {
  return (
    <div className="day-picker">
      {days.map((day) => <button type="button" key={day} className={selected.includes(day) ? 'selected' : ''} onClick={() => onToggle(day)}>{day.slice(0, 3)}</button>)}
    </div>
  );
}
