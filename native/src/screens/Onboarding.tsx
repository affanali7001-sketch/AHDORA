/**
 * Onboarding — 8 steps matching the web app:
 * 0 personal info, 1 education, 2 college schedule, 3 study schedule,
 * 4 location / prayer calculation, 5 individual prayer timings,
 * 6 sleep schedule, 7 review & save.
 * Skip ("Baad me bharenge") is on EVERY step and saves whatever is
 * filled in so far as a partial profile (web contract).
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, S, T } from '../lib/theme';
import { Chip, PillButton, ProgressBar } from '../components/ui';
import {
  emptyProfileForm,
  isValidTime,
  loadProfileWithCompletion,
  saveProfileComplete,
  saveProfilePartial,
  sleepDurationLabel,
  PRAYER_NAMES,
  type PrayerName,
  type ProfileForm,
} from '../lib/apiCore';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const METHODS = [
  'University of Islamic Sciences, Karachi',
  'Islamic Society of North America (ISNA)',
  'Muslim World League (MWL)',
  'Egyptian General Authority of Survey',
  'Umm al-Qura University, Makkah',
];

function toggleDay(list: string[], day: string): string[] {
  return list.includes(day) ? list.filter((d) => d !== day) : [...list, day];
}

export default function OnboardingScreen({ lang, user, onOnboardingDone }: ScreenProps) {
  const s = stringsFor(lang);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(() => emptyProfileForm(user?.name ?? ''));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    loadProfileWithCompletion(user?.name ?? '')
      .then((result) => {
        if (!active) return;
        if (result.profile) setForm(result.profile);
        if (result.onboardingStep > 0 && result.onboardingStep < 8) {
          setStep(result.onboardingStep);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.name]);

  const update = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const updatePrayer = (
    prayer: PrayerName,
    field: 'timeOverride' | 'endTime',
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      prayerSettings: {
        ...prev.prayerSettings,
        [prayer]: { ...prev.prayerSettings[prayer], [field]: value },
      },
    }));
    setError('');
    setFieldErrors((prev) => {
      const key = `prayer:${prayer}`;
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** Per-step validation, mirroring the web app's required sets. */
  function validate(targetStep: number): boolean {
    const fields: Record<string, string> = {};
    if (targetStep === 0) {
      if (!form.name.trim()) fields.name = s.obRequired;
    } else if (targetStep === 1) {
      if (!form.education.trim()) fields.education = s.obRequired;
      if (!form.course.trim()) fields.course = s.obRequired;
      if (!form.semester.trim()) fields.semester = s.obRequired;
    } else if (targetStep === 2) {
      if (!form.collegeStart.trim()) fields.collegeStart = s.obRequired;
      if (!form.collegeEnd.trim()) fields.collegeEnd = s.obRequired;
      if (form.collegeDays.length === 0) fields.collegeDays = s.obRequired;
      if (form.collegeStart && !isValidTime(form.collegeStart)) fields.collegeStart = s.obInvalidTime;
      if (form.collegeEnd && !isValidTime(form.collegeEnd)) fields.collegeEnd = s.obInvalidTime;
    } else if (targetStep === 3) {
      if (!form.studyStart.trim()) fields.studyStart = s.obRequired;
      if (!form.studyEnd.trim()) fields.studyEnd = s.obRequired;
      if (!form.dailyStudyTarget.trim()) fields.dailyStudyTarget = s.obRequired;
      if (form.studyStart && !isValidTime(form.studyStart)) fields.studyStart = s.obInvalidTime;
      if (form.studyEnd && !isValidTime(form.studyEnd)) fields.studyEnd = s.obInvalidTime;
      if (form.preferredStudyDays.length === 0) fields.preferredStudyDays = s.obRequired;
    } else if (targetStep === 4) {
      if (!form.city.trim()) fields.city = s.obRequired;
      if (!form.state.trim()) fields.state = s.obRequired;
    } else if (targetStep === 5) {
      for (const prayer of PRAYER_NAMES) {
        const entry = form.prayerSettings[prayer];
        if (!isValidTime(entry.timeOverride) || !isValidTime(entry.endTime)) {
          fields[`prayer:${prayer}`] = s.obInvalidTime;
        }
      }
    } else if (targetStep === 6) {
      if (form.sleepStartTime && !isValidTime(form.sleepStartTime)) fields.sleepStartTime = s.obInvalidTime;
      if (form.sleepEndTime && !isValidTime(form.sleepEndTime)) fields.sleepEndTime = s.obInvalidTime;
    }
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) {
      setError(Object.values(fields)[0]);
      return false;
    }
    return true;
  }

  async function skip() {
    if (skipping || busy) return;
    setSkipping(true);
    setError('');
    try {
      await saveProfilePartial(form, step);
      onOnboardingDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setSkipping(false);
    }
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveProfileComplete(form);
      setDone(true);
      onOnboardingDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!validate(step)) return;
    if (step < 7) setStep(step + 1);
  }

  const titles = [
    [s.obStep1Title, s.obStep1Hint],
    [s.obStep2Title, s.obStep2Hint],
    [s.obStep3Title, s.obStep3Hint],
    [s.obStep4Title, s.obStep4Hint],
    [s.obStep5Title, s.obStep5Hint],
    [s.obStep6Title, s.obStep6Hint],
    [s.obStep7Title, s.obStep7Hint],
    [s.obStep8Title, s.obStep8Hint],
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.teal} />
        <Text style={[T.note, { marginTop: 12 }]}>{s.loading}</Text>
      </View>
    );
  }

  const fieldError = (key: string) =>
    fieldErrors[key] ? <Text style={T.error}>{fieldErrors[key]}</Text> : null;

  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <Text style={T.eyebrow}>
        {s.obStepOf} {step + 1} {s.obOf} 8
      </Text>
      <ProgressBar value={step + 1} max={8} />
      <Text style={[T.title, { marginTop: 16 }]}>{titles[step][0]}</Text>
      <Text style={[T.sub, { marginBottom: 20 }]}>{titles[step][1]}</Text>

      {step === 0 && (
        <View>
          <Text style={T.label}>{s.obName}</Text>
          <TextInput
            style={L.input}
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder={user?.name ?? ''}
            placeholderTextColor={C.muted}
            autoCapitalize="words"
          />
          {fieldError('name')}
          <Text style={T.label}>{s.obDob}</Text>
          <TextInput
            style={L.input}
            value={form.dateOfBirth}
            onChangeText={(v) => update('dateOfBirth', v)}
            placeholder="2005-01-15"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          <Text style={T.label}>{s.obGender}</Text>
          <View style={styles.chipRow}>
            <Chip
              label={s.obGenderFemale}
              selected={form.gender === 'female'}
              onPress={() => update('gender', 'female')}
            />
            <Chip
              label={s.obGenderMale}
              selected={form.gender === 'male'}
              onPress={() => update('gender', 'male')}
            />
            <Chip
              label={s.obGenderPrefer}
              selected={form.gender === 'prefer-not-to-say'}
              onPress={() => update('gender', 'prefer-not-to-say')}
            />
          </View>
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={T.label}>{s.obEducation}</Text>
          <TextInput
            style={L.input}
            value={form.education}
            onChangeText={(v) => update('education', v)}
            placeholder={s.obEducationPh}
            placeholderTextColor={C.muted}
          />
          {fieldError('education')}
          <Text style={T.label}>{s.obCourse}</Text>
          <TextInput
            style={L.input}
            value={form.course}
            onChangeText={(v) => update('course', v)}
            placeholder={s.obCoursePh}
            placeholderTextColor={C.muted}
          />
          {fieldError('course')}
          <Text style={T.label}>{s.obCollege}</Text>
          <TextInput
            style={L.input}
            value={form.collegeName}
            onChangeText={(v) => update('collegeName', v)}
            placeholderTextColor={C.muted}
          />
          <Text style={T.label}>{s.obClassYear}</Text>
          <TextInput
            style={L.input}
            value={form.classYear}
            onChangeText={(v) => update('classYear', v)}
            placeholderTextColor={C.muted}
          />
          <Text style={T.label}>{s.obBranch}</Text>
          <TextInput
            style={L.input}
            value={form.branch}
            onChangeText={(v) => update('branch', v)}
            placeholderTextColor={C.muted}
          />
          <Text style={T.label}>{s.obSemester}</Text>
          <TextInput
            style={L.input}
            value={form.semester}
            onChangeText={(v) => update('semester', v)}
            placeholder="4"
            placeholderTextColor={C.muted}
            keyboardType="numeric"
          />
          {fieldError('semester')}
          <Text style={T.label}>{s.obSubjects}</Text>
          <TextInput
            style={L.input}
            value={form.subjects}
            onChangeText={(v) => update('subjects', v)}
            placeholder="Maths, Physics, Programming"
            placeholderTextColor={C.muted}
          />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={T.label}>{s.obCollegeStart}</Text>
          <TextInput
            style={L.input}
            value={form.collegeStart}
            onChangeText={(v) => update('collegeStart', v)}
            placeholder="09:00"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          {fieldError('collegeStart')}
          <Text style={T.label}>{s.obCollegeEnd}</Text>
          <TextInput
            style={L.input}
            value={form.collegeEnd}
            onChangeText={(v) => update('collegeEnd', v)}
            placeholder="16:00"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          {fieldError('collegeEnd')}
          <Text style={T.label}>{s.obCollegeDays}</Text>
          <View style={styles.chipRow}>
            {DAYS.map((day) => (
              <Chip
                key={day}
                label={DAY_SHORT[day]}
                selected={form.collegeDays.includes(day)}
                onPress={() => update('collegeDays', toggleDay(form.collegeDays, day))}
              />
            ))}
          </View>
          {fieldError('collegeDays')}
          <Text style={T.label}>{s.obWeeklyOff}</Text>
          <View style={styles.chipRow}>
            {DAYS.map((day) => (
              <Chip
                key={day}
                label={DAY_SHORT[day]}
                selected={form.weeklyOffDays.includes(day)}
                onPress={() => update('weeklyOffDays', toggleDay(form.weeklyOffDays, day))}
              />
            ))}
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={T.label}>{s.obStudyStart}</Text>
          <TextInput
            style={L.input}
            value={form.studyStart}
            onChangeText={(v) => update('studyStart', v)}
            placeholder="18:00"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          {fieldError('studyStart')}
          <Text style={T.label}>{s.obStudyEnd}</Text>
          <TextInput
            style={L.input}
            value={form.studyEnd}
            onChangeText={(v) => update('studyEnd', v)}
            placeholder="21:00"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          {fieldError('studyEnd')}
          <Text style={T.label}>{s.obDailyTarget}</Text>
          <TextInput
            style={L.input}
            value={form.dailyStudyTarget}
            onChangeText={(v) => update('dailyStudyTarget', v)}
            placeholder="3"
            placeholderTextColor={C.muted}
            keyboardType="numeric"
          />
          {fieldError('dailyStudyTarget')}
          <Text style={T.label}>{s.obBreakMinutes}</Text>
          <TextInput
            style={L.input}
            value={form.studyBreakMinutes}
            onChangeText={(v) => update('studyBreakMinutes', v)}
            placeholder="10"
            placeholderTextColor={C.muted}
            keyboardType="numeric"
          />
          <Text style={T.label}>{s.obStudyDays}</Text>
          <View style={styles.chipRow}>
            {DAYS.map((day) => (
              <Chip
                key={day}
                label={DAY_SHORT[day]}
                selected={form.preferredStudyDays.includes(day)}
                onPress={() =>
                  update('preferredStudyDays', toggleDay(form.preferredStudyDays, day))
                }
              />
            ))}
          </View>
          {fieldError('preferredStudyDays')}
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={T.label}>{s.obCountry}</Text>
          <TextInput
            style={L.input}
            value={form.country}
            onChangeText={(v) => update('country', v)}
            placeholder="India"
            placeholderTextColor={C.muted}
          />
          <Text style={T.label}>{s.obState}</Text>
          <TextInput
            style={L.input}
            value={form.state}
            onChangeText={(v) => update('state', v)}
            placeholder="Maharashtra"
            placeholderTextColor={C.muted}
          />
          {fieldError('state')}
          <Text style={T.label}>{s.obCity}</Text>
          <TextInput
            style={L.input}
            value={form.city}
            onChangeText={(v) => update('city', v)}
            placeholder="Akkalkuwa"
            placeholderTextColor={C.muted}
          />
          {fieldError('city')}
          <Text style={T.label}>{s.obTimezone}</Text>
          <TextInput
            style={L.input}
            value={form.timezone}
            onChangeText={(v) => update('timezone', v)}
            placeholder="Asia/Kolkata"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          <Text style={T.label}>{s.obMethod}</Text>
          <View style={styles.chipRow}>
            {METHODS.map((method) => (
              <Chip
                key={method}
                label={method}
                selected={form.calculationMethod === method}
                onPress={() => update('calculationMethod', method)}
              />
            ))}
          </View>
          <Text style={T.label}>{s.obAsrMethod}</Text>
          <View style={styles.chipRow}>
            <Chip
              label={s.obAsrShafi}
              selected={form.asrMethod === 'Shafi'}
              onPress={() => update('asrMethod', 'Shafi')}
            />
            <Chip
              label={s.obAsrHanafi}
              selected={form.asrMethod === 'Hanafi'}
              onPress={() => update('asrMethod', 'Hanafi')}
            />
          </View>
        </View>
      )}

      {step === 5 && (
        <View>
          {PRAYER_NAMES.map((prayer) => {
            const entry = form.prayerSettings[prayer];
            return (
              <View key={prayer} style={styles.prayerBox}>
                <Text style={styles.prayerName}>{prayer}</Text>
                <Text style={T.label}>{s.timeOverride}</Text>
                <TextInput
                  style={L.input}
                  value={entry.timeOverride}
                  onChangeText={(v) => updatePrayer(prayer, 'timeOverride', v)}
                  placeholder="HH:mm"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                />
                <Text style={T.label}>{s.endTime}</Text>
                <TextInput
                  style={L.input}
                  value={entry.endTime}
                  onChangeText={(v) => updatePrayer(prayer, 'endTime', v)}
                  placeholder="HH:mm"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                />
                {fieldError(`prayer:${prayer}`)}
              </View>
            );
          })}
        </View>
      )}

      {step === 6 && (
        <View>
          <Text style={T.label}>{s.obSleepStart}</Text>
          <TextInput
            style={L.input}
            value={form.sleepStartTime}
            onChangeText={(v) => update('sleepStartTime', v)}
            placeholder="22:00"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          {fieldError('sleepStartTime')}
          <Text style={T.label}>{s.obSleepEnd}</Text>
          <TextInput
            style={L.input}
            value={form.sleepEndTime}
            onChangeText={(v) => update('sleepEndTime', v)}
            placeholder="04:00"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          {fieldError('sleepEndTime')}
          {form.sleepStartTime && form.sleepEndTime ? (
            <Text style={T.cardBody}>
              {s.obSleepDuration}: {sleepDurationLabel(form.sleepStartTime, form.sleepEndTime)}
            </Text>
          ) : null}
          <Text style={[T.label, { marginTop: 16 }]}>{s.obSleepReminder}</Text>
          <View style={styles.chipRow}>
            <Chip
              label={s.obYes}
              selected={form.sleepReminder}
              onPress={() => update('sleepReminder', true)}
            />
            <Chip
              label={s.obNo}
              selected={!form.sleepReminder}
              onPress={() => update('sleepReminder', false)}
            />
          </View>
        </View>
      )}

      {step === 7 && (
        <View>
          <ReviewRow label={s.obReviewName} value={form.name || '—'} />
          <ReviewRow label={s.obReviewCourse} value={form.course || '—'} />
          <ReviewRow label={s.obReviewCollege} value={form.collegeName || '—'} />
          <ReviewRow
            label={s.obReviewCity}
            value={[form.city, form.state, form.country].filter(Boolean).join(', ') || '—'}
          />
          <ReviewRow
            label={s.obReviewStudy}
            value={
              form.dailyStudyTarget
                ? `${form.dailyStudyTarget}h (${form.studyStart || '?'} – ${form.studyEnd || '?'})`
                : '—'
            }
          />
          <ReviewRow
            label={s.obReviewSleep}
            value={`${form.sleepStartTime || '?'} – ${form.sleepEndTime || '?'} (${sleepDurationLabel(
              form.sleepStartTime,
              form.sleepEndTime,
            )})`}
          />
          {done ? <Text style={[T.note, { color: C.teal2 }]}>{s.obSaved}</Text> : null}
        </View>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}

      <View style={{ marginTop: 24 }}>
        {step < 7 ? (
          <PillButton label={`${s.next} →`} onPress={next} />
        ) : (
          <PillButton label={s.obSaveFinish} onPress={finish} busy={busy} disabled={busy} />
        )}
        {step > 0 ? (
          <PillButton label={`← ${s.obBack}`} variant="ghost" onPress={() => setStep(step - 1)} />
        ) : null}
        <PillButton
          label={s.obSkip}
          variant="peach"
          onPress={skip}
          busy={skipping}
          disabled={skipping || busy}
        />
      </View>
    </ScrollView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ice },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  prayerBox: {
    backgroundColor: C.white,
    borderRadius: S.radiusSm,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 12,
  },
  prayerName: { fontSize: 16, fontWeight: '800', color: C.teal900, marginBottom: 10 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderRadius: S.radiusSm,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  reviewLabel: { fontSize: 14, fontWeight: '700', color: C.muted },
  reviewValue: { fontSize: 14, fontWeight: '700', color: C.ink, flexShrink: 1, textAlign: 'right' },
});
