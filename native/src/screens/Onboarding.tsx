/**
 * Onboarding (preview §4) — 8 steps, header + peach "Step X of 8" tag +
 * 12.5%-per-step progress bar. Only the preview's fields are shown;
 * everything the server contract carries but the preview hides keeps
 * its existing defaults (emptyProfileForm / loaded profile) and is
 * still sent by saveProfileComplete / saveProfilePartial, so the
 * POST /api/profile contract is unchanged. Skip is on every step.
 *
 * Preview values shown as placeholders (09:00, 16:30, 05:32, 17:47,
 * 22:30, 05:00) are samples from the preview — they are NOT prefilled
 * as the user's data. Study target defaults to 2 hours (the preview's
 * selected chip); sleep defaults to 22:30–05:00 (the preview's times).
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Chip, Field, Input, PillButton, ProgressBar } from '../components/ui';
import TimePickerField from '../components/TimePickerField';
import TutorialVideo from '../components/TutorialVideo';
import { HOW_TO_USE_VIDEO_URL, SIGNUP_VIDEO_URL } from '../lib/videos';
import { PRAYER_METHODS } from '../lib/prayerMethods';
import {
  emptyProfileForm,
  formatTime12h,
  isValidTime,
  loadProfileWithCompletion,
  PRAYER_NAMES,
  saveProfileComplete,
  saveProfilePartial,
  type PrayerName,
  type ProfileForm,
} from '../lib/apiCore';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

/** Semesters run 1–10 (a 5-year course), not 3–5. */
const SEMESTERS = ORDINALS.map((ord, i) => ({
  label: `${ord} Semester`,
  value: String(i + 1),
}));

/** School classes 1–12 have no semester at all. */
const CLASSES = Array.from({ length: 12 }, (_, i) => ({
  label: `Class ${i + 1}`,
  value: String(i + 1),
}));

const STUDY_HOURS = ['1', '2', '3', '4+'];

/** Step-5 input hints (samples only — never saved as the user's time). */
const PRAYER_PLACEHOLDERS: Record<PrayerName, string> = {
  Fajr: '05:32',
  Dhuhr: '12:30',
  Asr: '15:45',
  Maghrib: '17:47',
  Isha: '19:30',
};

export default function OnboardingScreen({ lang, user, onOnboardingDone, freshOnboarding }: ScreenProps) {
  const s = stringsFor(lang);
  // After a fresh signup the details form is where people get stuck —
  // show a one-time popup pointing to the (Hinglish) how-to video.
  // The popup text itself follows the user's language choice.
  const [videoPopup, setVideoPopup] = useState<'prompt' | 'video' | null>(
    freshOnboarding ? 'prompt' : null,
  );
  // Verify-mail popup — shown FIRST (before the video popup) on a
  // fresh signup when the email is not verified yet. The user asked
  // for this (2026-11-22): after signup, before the details video,
  // tell them to go to their mail to verify. Dismissing it reveals
  // the video popup underneath (videoPopup is already 'prompt').
  const [verifyPopup, setVerifyPopup] = useState(
    freshOnboarding === true && user?.emailVerified === false,
  );
  // How-to-use video popup — shown AFTER the details-video popup is
  // dismissed, fresh signups only. The user asked (2026-11-23): when
  // a new user signs up and comes inside, ask "Can you see the
  // video how to use this app?".
  const [howToPopup, setHowToPopup] = useState<'prompt' | 'video' | null>(null);
  /** Dismiss the details-video popup and, for a fresh signup only,
   * open the how-to-use video popup next. */
  function closeVideoPopup(): void {
    setVideoPopup(null);
    if (freshOnboarding) setHowToPopup('prompt');
  }
  const [step, setStep] = useState(0);
  // School (Class 1–12, no semester) vs Diploma/Degree (Semester
  // 1–10). Derived from the saved profile when it loads: a saved
  // classYear means school, a saved semester means college.
  const [eduType, setEduType] = useState<'school' | 'college'>('college');
  const [form, setForm] = useState<ProfileForm>(() => {
    const f = emptyProfileForm(user?.name ?? '');
    if (!f.dailyStudyTarget) f.dailyStudyTarget = '2';
    f.sleepStartTime = '22:30';
    f.sleepEndTime = '05:00';
    return f;
  });
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
        if (result.profile) {
          setForm((prev) => ({
            ...result.profile!,
            // The preview's selected study chip is 2 hours; a saved
            // profile's own target always wins over the default.
            dailyStudyTarget: result.profile!.dailyStudyTarget || prev.dailyStudyTarget,
          }));
          setEduType(result.profile.classYear?.trim() ? 'school' : 'college');
        }
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

  const updatePrayerTime = (prayer: PrayerName, value: string) => {
    setForm((prev) => ({
      ...prev,
      prayerSettings: {
        ...prev.prayerSettings,
        [prayer]: { ...prev.prayerSettings[prayer], timeOverride: value },
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

  /** Optional Tahajjud time — '' means unset, never a guessed time. */
  const updateTahajjudTime = (value: string) => {
    setForm((prev) => ({ ...prev, tahajjudTime: value }));
    setError('');
    setFieldErrors((prev) => {
      if (!('prayer:Tahajjud' in prev)) return prev;
      const next = { ...prev };
      delete next['prayer:Tahajjud'];
      return next;
    });
  };

  /** Switch School <-> Diploma/Degree: the other side's value is cleared, so a school student never carries a semester and a college student never carries a class. */
  const pickEduType = (type: 'school' | 'college') => {
    setEduType(type);
    setError('');
    if (type === 'school') {
      update('semester', '');
      update('education', 'School');
    } else {
      update('classYear', '');
      update('education', 'Diploma / Degree');
    }
  };

  /** Per-step validation — only the fields the preview shows on that step. */
  function validate(targetStep: number): boolean {
    const fields: Record<string, string> = {};
    if (targetStep === 0) {
      if (!form.name.trim()) fields.name = s.obRequired;
      if (!form.city.trim()) fields.city = s.obRequired;
      if (!form.state.trim()) fields.state = s.obRequired;
    } else if (targetStep === 1) {
      if (!form.course.trim()) fields.course = s.obRequired;
      // School (Class 1–12) has no semester — never ask for it.
      if (eduType === 'school') {
        if (!form.classYear.trim()) fields.classYear = s.obRequired;
      } else if (!form.semester.trim()) {
        fields.semester = s.obRequired;
      }
    } else if (targetStep === 2) {
      if (!form.collegeStart.trim()) fields.collegeStart = s.obRequired;
      if (!form.collegeEnd.trim()) fields.collegeEnd = s.obRequired;
      if (form.collegeStart && !isValidTime(form.collegeStart)) fields.collegeStart = s.obInvalidTime;
      if (form.collegeEnd && !isValidTime(form.collegeEnd)) fields.collegeEnd = s.obInvalidTime;
    } else if (targetStep === 3) {
      if (!form.dailyStudyTarget.trim()) fields.dailyStudyTarget = s.obRequired;
    } else if (targetStep === 5) {
      // Every prayer can carry its own time (empty = use the
      // calculated time). Tahajjud is optional: empty is fine, a
      // filled value must still be a real HH:mm time.
      for (const prayer of PRAYER_NAMES) {
        if (!isValidTime(form.prayerSettings[prayer].timeOverride)) {
          fields[`prayer:${prayer}`] = s.obInvalidTime;
        }
      }
      if (!isValidTime(form.tahajjudTime)) {
        fields['prayer:Tahajjud'] = s.obInvalidTime;
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
    else void finish();
  }

  const titles: [string, string][] = [
    [s.obP1Title, s.obP1Sub],
    [s.obP2Title, s.obP2Sub],
    [s.obP3Title, s.obP3Sub],
    [s.obP4Title, s.obP4Sub],
    [s.obP5Title, s.obP5Sub],
    [s.obP6Title, s.obP6Sub],
    [s.obP7Title, s.obP7Sub],
    [s.obP8Title, s.obP8Sub],
  ];

  const hourLabels = [s.obHour1, s.obHour2, s.obHour3, s.obHour4];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.teal700} />
        <Text style={[T.note, { marginTop: 12 }]}>{s.loading}</Text>
      </View>
    );
  }

  const fieldError = (key: string) =>
    fieldErrors[key] ? <Text style={T.error}>{fieldErrors[key]}</Text> : null;

  const semesterLabel =
    SEMESTERS.find((o) => o.value === form.semester)?.label ??
    (form.semester ? `${form.semester} Semester` : '—');

  const eduLabel =
    eduType === 'school'
      ? form.classYear
        ? `Class ${form.classYear}`
        : '—'
      : semesterLabel;

  // Review: only the prayer times the user actually set are listed
  // (blank = calculated time, so nothing is shown for those).
  const customTimes = [
    ...PRAYER_NAMES.filter((p) => form.prayerSettings[p].timeOverride.trim()).map(
      (p) => `${p} ${formatTime12h(form.prayerSettings[p].timeOverride)}`,
    ),
    ...(form.tahajjudTime.trim()
      ? [`Tahajjud ${formatTime12h(form.tahajjudTime)}`]
      : []),
  ];

  const reviewLines = [
    `${form.name || '—'} · ${form.city || '—'}${form.state ? `, ${form.state}` : ''}`,
    `${form.course || '—'} · ${eduLabel}`,
    `College ${form.collegeStart ? formatTime12h(form.collegeStart) : '?'} – ${
      form.collegeEnd ? formatTime12h(form.collegeEnd) : '?'
    } · Study ${form.dailyStudyTarget || '?'} ${lang === 'hi' ? 'ghante/roz' : 'hours/day'}`,
    `Asr: ${form.asrMethod || '—'} · Sleep ${
      form.sleepStartTime ? formatTime12h(form.sleepStartTime) : '?'
    } – ${form.sleepEndTime ? formatTime12h(form.sleepEndTime) : '?'}`,
    ...(customTimes.length > 0
      ? [`${lang === 'hi' ? 'Apne time' : 'My times'}: ${customTimes.join(' · ')}`]
      : []),
  ].join('\n');

  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <View style={styles.headRow}>
        <Text style={styles.headTitle}>{s.obTitle}</Text>
        <Chip
          label={`${s.obStepOf} ${step + 1} ${s.obOf} 8`}
          tone="peach"
        />
      </View>
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <ProgressBar value={step + 1} max={8} />
      </View>

      <Text style={styles.stepTitle}>{titles[step][0]}</Text>
      <Text style={styles.stepSub}>{titles[step][1]}</Text>

      {step === 0 && (
        <View>
          <Field label={s.obName}>
            <Input
              value={form.name}
              onChangeText={(v) => update('name', v)}
              placeholder={user?.name ?? ''}
              autoCapitalize="words"
            />
          </Field>
          {fieldError('name')}
          <Field label={s.obCity}>
            <Input
              value={form.city}
              onChangeText={(v) => update('city', v)}
              placeholder="Akkalkuwa"
              autoCapitalize="words"
            />
          </Field>
          {fieldError('city')}
          <Field label={s.obState}>
            <Input
              value={form.state}
              onChangeText={(v) => update('state', v)}
              placeholder="Uttar Pradesh"
              autoCapitalize="words"
            />
          </Field>
          {fieldError('state')}
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={styles.optionLabel}>{s.obEducation}</Text>
          <OptionRow
            label={s.obEduSchool}
            selected={eduType === 'school'}
            onPress={() => pickEduType('school')}
          />
          <OptionRow
            label={s.obEduCollege}
            selected={eduType === 'college'}
            onPress={() => pickEduType('college')}
          />
          <Field label={eduType === 'school' ? s.obSchool : s.obCourse}>
            <Input
              value={form.course}
              onChangeText={(v) => update('course', v)}
              placeholder={eduType === 'school' ? s.obSchoolPh : s.obCoursePh}
              autoCapitalize="words"
            />
          </Field>
          {fieldError('course')}
          {eduType === 'school' ? (
            <>
              <Text style={styles.optionLabel}>{s.obClass}</Text>
              <View style={styles.chipRow}>
                {CLASSES.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={form.classYear === opt.value}
                    onPress={() => update('classYear', opt.value)}
                  />
                ))}
              </View>
              {fieldError('classYear')}
            </>
          ) : (
            <>
              <Text style={styles.optionLabel}>{s.obSemester}</Text>
              <View style={styles.chipRow}>
                {SEMESTERS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={form.semester === opt.value}
                    onPress={() => update('semester', opt.value)}
                  />
                ))}
              </View>
              {fieldError('semester')}
            </>
          )}
        </View>
      )}

      {step === 2 && (
        <View>
          <Field label={s.obFrom ?? 'Shuru'}>
            <TimePickerField
              value={form.collegeStart}
              onChange={(v) => update('collegeStart', v)}
              placeholder="09:00"
              editable={!busy}
            />
          </Field>
          {fieldError('collegeStart')}
          <Field label={s.obTo ?? 'Khatam'}>
            <TimePickerField
              value={form.collegeEnd}
              onChange={(v) => update('collegeEnd', v)}
              placeholder="16:30"
              editable={!busy}
            />
          </Field>
          {fieldError('collegeEnd')}
        </View>
      )}

      {step === 3 && (
        <View>
          <View style={styles.chipRow}>
            {STUDY_HOURS.map((hours, i) => (
              <Chip
                key={hours}
                label={hourLabels[i]}
                selected={form.dailyStudyTarget === hours}
                onPress={() => update('dailyStudyTarget', hours)}
              />
            ))}
          </View>
          {fieldError('dailyStudyTarget')}
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={styles.optionLabel}>{s.obMethod}</Text>
          {PRAYER_METHODS.map((m) => (
            <OptionRow
              key={m.value}
              label={m.label}
              selected={form.calculationMethod === m.value}
              onPress={() => update('calculationMethod', m.value)}
            />
          ))}
          <Text style={[styles.optionLabel, { marginTop: 14 }]}>Asr</Text>
          <View style={styles.chipRow}>
            <Chip
              label="Hanafi"
              selected={form.asrMethod === 'Hanafi'}
              onPress={() => update('asrMethod', 'Hanafi')}
            />
            <Chip
              label={s.obAsrShafii}
              selected={form.asrMethod === 'Shafi'}
              onPress={() => update('asrMethod', 'Shafi')}
            />
          </View>
          <Field label={s.obTzLabel}>
            <Input
              value={form.timezone}
              onChangeText={(v) => update('timezone', v)}
              placeholder={s.obTzValue}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </View>
      )}

      {step === 5 && (
        <View>
          {/* All five prayers are editable — blank means "use the
              calculated time". Placeholders are samples, never saved. */}
          {PRAYER_NAMES.map((prayer) => (
            <View key={prayer}>
              <Field label={prayer}>
                <TimePickerField
                  value={form.prayerSettings[prayer].timeOverride}
                  onChange={(v) => updatePrayerTime(prayer, v)}
                  placeholder={PRAYER_PLACEHOLDERS[prayer]}
                  editable={!busy}
                />
              </Field>
              {fieldError(`prayer:${prayer}`)}
            </View>
          ))}
          <Field label={s.obTahajjud}>
            <TimePickerField
              value={form.tahajjudTime}
              onChange={updateTahajjudTime}
              placeholder="03:30"
              editable={!busy}
            />
          </Field>
          {fieldError('prayer:Tahajjud')}
          <Text style={[T.note, { textAlign: 'left', marginTop: 2 }]}>{s.obTahajjudNote}</Text>
        </View>
      )}

      {step === 6 && (
        <View>
          <Field label={s.obSleep}>
            <TimePickerField
              value={form.sleepStartTime}
              onChange={(v) => update('sleepStartTime', v)}
              placeholder="22:30"
              editable={!busy}
            />
          </Field>
          {fieldError('sleepStartTime')}
          <Field label={s.obWake}>
            <TimePickerField
              value={form.sleepEndTime}
              onChange={(v) => update('sleepEndTime', v)}
              placeholder="05:00"
              editable={!busy}
            />
          </Field>
          {fieldError('sleepEndTime')}
        </View>
      )}

      {step === 7 && (
        <View>
          <Card style={{ marginBottom: 0 }}>
            <Text style={styles.reviewText}>{reviewLines}</Text>
          </Card>
          {done ? <Text style={[T.note, { color: C.teal500 }]}>{s.obSaved}</Text> : null}
        </View>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}

      <View style={styles.footerRow}>
        {step > 0 ? (
          <PillButton
            label={`← ${s.obBack}`}
            variant="ghost"
            onPress={() => setStep(step - 1)}
            style={{ flex: 1 }}
          />
        ) : null}
        <PillButton
          label={step === 7 ? s.obSave : `${s.next} →`}
          onPress={next}
          busy={busy && step === 7}
          disabled={busy}
          style={{ flex: step > 0 ? 2 : 1 }}
        />
      </View>
      <PillButton
        label={s.obSkip}
        variant="soft"
        onPress={skip}
        busy={skipping}
        disabled={skipping || busy}
        block
      />

      {/* Verify-mail popup (fresh signup, unverified) — shown BEFORE
          the details-video popup. Dismissing it reveals the video
          popup underneath. */}
      <Modal
        visible={!loading && (verifyPopup || videoPopup !== null || howToPopup !== null)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setVerifyPopup(false);
          setVideoPopup(null);
          setHowToPopup(null);
        }}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            {verifyPopup ? (
              <>
                <Text style={styles.modalTitle}>{s.obVerifyMailT}</Text>
                <Text style={styles.modalBody}>{s.obVerifyMailB}</Text>
                <PillButton
                  label={s.obVerifyMailOk}
                  onPress={() => setVerifyPopup(false)}
                  block
                />
              </>
            ) : videoPopup === 'prompt' ? (
              <>
                <Text style={styles.modalTitle}>{s.obVideoPopT}</Text>
                <Text style={styles.modalBody}>{s.obVideoPopB}</Text>
                <PillButton
                  label={s.obVideoWatch}
                  onPress={() => setVideoPopup('video')}
                  block
                />
                <View style={{ marginTop: 10 }}>
                  <PillButton
                    label={s.obVideoLater}
                    variant="ghost"
                    onPress={() => closeVideoPopup()}
                    block
                  />
                </View>
              </>
            ) : videoPopup === 'video' ? (
              <>
                <TutorialVideo url={SIGNUP_VIDEO_URL} title={s.obVideoPopT} />
                <View style={{ marginTop: 12 }}>
                  <PillButton
                    label={s.obVideoClose}
                    variant="ghost"
                    onPress={() => closeVideoPopup()}
                    block
                  />
                </View>
              </>
            ) : howToPopup === 'prompt' ? (
              <>
                <Text style={styles.modalTitle}>{s.obHowToT}</Text>
                <Text style={styles.modalBody}>{s.obHowToB}</Text>
                <PillButton
                  label={s.obVideoWatch}
                  onPress={() => setHowToPopup('video')}
                  block
                />
                <View style={{ marginTop: 10 }}>
                  <PillButton
                    label={s.obVideoLater}
                    variant="ghost"
                    onPress={() => setHowToPopup(null)}
                    block
                  />
                </View>
              </>
            ) : howToPopup === 'video' ? (
              <>
                <TutorialVideo url={HOW_TO_USE_VIDEO_URL} title={s.obHowToT} />
                <View style={{ marginTop: 12 }}>
                  <PillButton
                    label={s.obVideoClose}
                    variant="ghost"
                    onPress={() => setHowToPopup(null)}
                    block
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/** Selectable option row (method dropdown equivalent — RN has no <select>). */
function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.optionRowOn,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <Text style={styles.optionRowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ice },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headTitle: {
    fontFamily: F.sans,
    fontSize: 19,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.2,
    flex: 1,
  },
  stepTitle: {
    fontFamily: F.sans,
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
    marginTop: 14,
    marginBottom: 2,
  },
  stepSub: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
    marginBottom: 6,
  },
  optionLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.teal700,
    marginBottom: 6,
    marginLeft: 4,
    marginTop: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  optionRowOn: { borderColor: C.teal700, backgroundColor: C.teal100 },
  pressed: { transform: [{ scale: 0.97 }] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOn: { borderColor: C.teal700 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.teal700 },
  optionRowText: { fontFamily: F.sans, fontSize: 14, fontWeight: '700', color: C.ink, flex: 1 },
  reviewText: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.ink,
    lineHeight: 27, // 14 * 1.9, preview .card p line-height
  },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(6, 48, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalTitle: {
    fontFamily: F.sans,
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 6,
  },
  modalBody: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
    marginBottom: 16,
  },
});
