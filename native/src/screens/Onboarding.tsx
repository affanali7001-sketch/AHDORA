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
import TutorialVideo from '../components/TutorialVideo';
import { SIGNUP_VIDEO_URL } from '../lib/videos';
import {
  emptyProfileForm,
  formatTime12h,
  isValidTime,
  loadProfileWithCompletion,
  saveProfileComplete,
  saveProfilePartial,
  type ProfileForm,
} from '../lib/apiCore';

const METHODS = [
  'University of Islamic Sciences, Karachi',
  'Muslim World League (MWL)',
  'Islamic Society of North America (ISNA)',
];

const SEMESTERS = [
  { label: '3rd Semester', value: '3' },
  { label: '4th Semester', value: '4' },
  { label: '5th Semester', value: '5' },
];

const STUDY_HOURS = ['1', '2', '3', '4+'];

export default function OnboardingScreen({ lang, user, onOnboardingDone, freshOnboarding }: ScreenProps) {
  const s = stringsFor(lang);
  // After a fresh signup the details form is where people get stuck —
  // show a one-time popup pointing to the (Hinglish) how-to video.
  // The popup text itself follows the user's language choice.
  const [videoPopup, setVideoPopup] = useState<'prompt' | 'video' | null>(
    freshOnboarding ? 'prompt' : null,
  );
  const [step, setStep] = useState(0);
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

  const updatePrayerTime = (prayer: 'Fajr' | 'Maghrib', value: string) => {
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

  /** Per-step validation — only the fields the preview shows on that step. */
  function validate(targetStep: number): boolean {
    const fields: Record<string, string> = {};
    if (targetStep === 0) {
      if (!form.name.trim()) fields.name = s.obRequired;
      if (!form.city.trim()) fields.city = s.obRequired;
    } else if (targetStep === 1) {
      if (!form.course.trim()) fields.course = s.obRequired;
      if (!form.semester.trim()) fields.semester = s.obRequired;
    } else if (targetStep === 2) {
      if (!form.collegeStart.trim()) fields.collegeStart = s.obRequired;
      if (!form.collegeEnd.trim()) fields.collegeEnd = s.obRequired;
      if (form.collegeStart && !isValidTime(form.collegeStart)) fields.collegeStart = s.obInvalidTime;
      if (form.collegeEnd && !isValidTime(form.collegeEnd)) fields.collegeEnd = s.obInvalidTime;
    } else if (targetStep === 3) {
      if (!form.dailyStudyTarget.trim()) fields.dailyStudyTarget = s.obRequired;
    } else if (targetStep === 5) {
      for (const prayer of ['Fajr', 'Maghrib'] as const) {
        if (!isValidTime(form.prayerSettings[prayer].timeOverride)) {
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

  const reviewLines = [
    `${form.name || '—'} · ${form.city || '—'}`,
    `${form.course || '—'} · ${semesterLabel}`,
    `College ${form.collegeStart ? formatTime12h(form.collegeStart) : '?'} – ${
      form.collegeEnd ? formatTime12h(form.collegeEnd) : '?'
    } · Study ${form.dailyStudyTarget || '?'} ${lang === 'hi' ? 'ghante/roz' : 'hours/day'}`,
    `Asr: ${form.asrMethod || '—'} · Sleep ${
      form.sleepStartTime ? formatTime12h(form.sleepStartTime) : '?'
    } – ${form.sleepEndTime ? formatTime12h(form.sleepEndTime) : '?'}`,
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
        </View>
      )}

      {step === 1 && (
        <View>
          <Field label={s.obCourse}>
            <Input
              value={form.course}
              onChangeText={(v) => update('course', v)}
              placeholder="Diploma — Computer Science"
              autoCapitalize="words"
            />
          </Field>
          {fieldError('course')}
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
        </View>
      )}

      {step === 2 && (
        <View>
          <Field label={s.obFrom ?? 'Shuru'}>
            <Input
              value={form.collegeStart}
              onChangeText={(v) => update('collegeStart', v)}
              placeholder="09:00"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          {fieldError('collegeStart')}
          <Field label={s.obTo ?? 'Khatam'}>
            <Input
              value={form.collegeEnd}
              onChangeText={(v) => update('collegeEnd', v)}
              placeholder="16:30"
              autoCapitalize="none"
              autoCorrect={false}
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
          {METHODS.map((method) => (
            <OptionRow
              key={method}
              label={method}
              selected={form.calculationMethod === method}
              onPress={() => update('calculationMethod', method)}
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
          <Field label="Fajr">
            <Input
              value={form.prayerSettings.Fajr.timeOverride}
              onChangeText={(v) => updatePrayerTime('Fajr', v)}
              placeholder="05:32"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          {fieldError('prayer:Fajr')}
          <Field label="Maghrib">
            <Input
              value={form.prayerSettings.Maghrib.timeOverride}
              onChangeText={(v) => updatePrayerTime('Maghrib', v)}
              placeholder="17:47"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          {fieldError('prayer:Maghrib')}
        </View>
      )}

      {step === 6 && (
        <View>
          <Field label={s.obSleep}>
            <Input
              value={form.sleepStartTime}
              onChangeText={(v) => update('sleepStartTime', v)}
              placeholder="22:30"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          {fieldError('sleepStartTime')}
          <Field label={s.obWake}>
            <Input
              value={form.sleepEndTime}
              onChangeText={(v) => update('sleepEndTime', v)}
              placeholder="05:00"
              autoCapitalize="none"
              autoCorrect={false}
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

      {/* Details-video popup — fresh signup only, once per visit. */}
      <Modal
        visible={!loading && videoPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVideoPopup(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            {videoPopup === 'prompt' ? (
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
                    onPress={() => setVideoPopup(null)}
                    block
                  />
                </View>
              </>
            ) : (
              <>
                <TutorialVideo url={SIGNUP_VIDEO_URL} title={s.obVideoPopT} />
                <View style={{ marginTop: 12 }}>
                  <PillButton
                    label={s.obVideoClose}
                    variant="ghost"
                    onPress={() => setVideoPopup(null)}
                    block
                  />
                </View>
              </>
            )}
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
