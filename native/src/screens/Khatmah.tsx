/**
 * Khatmah — Quran completion plans.
 *
 * Pick a 30 / 60 / 90-day plan (or a custom number of days) and a
 * starting page, and the screen works out today's portion from
 * what is really left: ceil(remaining pages / remaining days), so
 * the plan always finishes on time even after a missed day.
 * "Mark done" records only the portion the user really read;
 * progress is pages actually marked done out of 604 — 0 until
 * the first portion is marked, never pre-filled.
 *
 * Continue stores today's first page (AsyncStorage key
 * `khatmah:target:<uid>`, see src/lib/khatmah.ts) and shows it,
 * so the coordinator can wire it to the Quran Book screen.
 * The Quran Book stores no "current page" of its own, so a new
 * plan starts at page 1 unless the user types another page.
 *
 * Strings live here (local STRINGS record), like Tasbeeh.tsx.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Chip, Field, Input, PillButton, ProgressBar } from '../components/ui';
import { setQuranPageTarget } from '../lib/navTarget';
import {
  TOTAL_PAGES,
  clearPlan,
  clearTargetPage,
  createPlan,
  loadPlan,
  loadTargetPage,
  markTodayDone,
  previewPagesPerDay,
  savePlan,
  saveTargetPage,
  todaysPortion,
  validatePlanInput,
  type KhatmahPlan,
  type PlanInputError,
} from '../lib/khatmah';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    loading: string;
    choosePlan: string;
    customDays: string;
    customDaysPlaceholder: string;
    startPage: string;
    startPagePlaceholder: string;
    startPageHint: string;
    preview: (n: number) => string;
    invalidDays: string;
    invalidPage: string;
    startPlan: string;
    planSummary: (days: number, startPage: number) => string;
    dayOf: (day: number, total: number) => string;
    daysLeft: (n: number) => string;
    todayLabel: string;
    todayRange: (from: number, to: number, pages: number) => string;
    pagesRead: (read: number) => string;
    overdue: string;
    doneToday: string;
    continueBtn: (page: number) => string;
    continueSaved: (page: number) => string;
    markDone: string;
    planComplete: string;
    planCompleteBody: string;
    startNew: string;
    cancelPlan: string;
    cancelConfirm: string;
    cancelYes: string;
    cancelNo: string;
  }
> = {
  en: {
    title: 'Khatmah',
    subtitle: 'Finish the whole Quran — 604 pages — one small portion a day.',
    loading: 'Loading…',
    choosePlan: 'How many days for your khatmah?',
    customDays: 'Your number of days',
    customDaysPlaceholder: 'e.g. 45',
    startPage: 'Starting page',
    startPagePlaceholder: '1',
    startPageHint: 'Start from page 1, or type the page you are on now.',
    preview: (n) => `About ${n} page${n === 1 ? '' : 's'} a day.`,
    invalidDays: 'Enter a number of days from 1 to 365.',
    invalidPage: 'Enter a starting page from 1 to 604.',
    startPlan: 'Start my khatmah',
    planSummary: (days, startPage) => `${days}-day plan · from page ${startPage}`,
    dayOf: (day, total) => `Day ${day} of ${total}`,
    daysLeft: (n) => `${n} day${n === 1 ? '' : 's'} left`,
    todayLabel: "Today's portion",
    todayRange: (from, to, pages) =>
      `Pages ${from}–${to} · ${pages} page${pages === 1 ? '' : 's'}`,
    pagesRead: (read) => `${read} / ${TOTAL_PAGES} pages read`,
    overdue: 'The end date has passed — the pages left are all due today, so you can still finish.',
    doneToday: "Today's portion is done — MashaAllah!",
    continueBtn: (page) => `Continue from page ${page}`,
    continueSaved: (page) => `Saved — continue from page ${page} in the Quran Book.`,
    markDone: "Mark today's portion as read",
    planComplete: 'Khatmah complete — MashaAllah!',
    planCompleteBody: 'You read every page of your plan. Start a new khatmah whenever you are ready.',
    startNew: 'Start a new khatmah',
    cancelPlan: 'Cancel this plan',
    cancelConfirm: 'Cancel this plan? Your recorded progress for this plan will be deleted.',
    cancelYes: 'Yes, cancel it',
    cancelNo: 'Keep my plan',
  },
  hi: {
    title: 'Khatmah',
    subtitle: 'Poora Quran khatm karo — 604 pages — roz thoda-thoda.',
    loading: 'Loading…',
    choosePlan: 'Khatmah kitne din me karni hai?',
    customDays: 'Apne din likho',
    customDaysPlaceholder: 'e.g. 45',
    startPage: 'Shuru wala page',
    startPagePlaceholder: '1',
    startPageHint: 'Page 1 se shuru karo, ya jis page par ho woh likho.',
    preview: (n) => `Roz lagbhag ${n} page${n === 1 ? '' : 's'}.`,
    invalidDays: '1 se 365 ke beech din likho.',
    invalidPage: '1 se 604 ke beech shuru wala page likho.',
    startPlan: 'Meri khatmah shuru karo',
    planSummary: (days, startPage) => `${days} din ka plan · page ${startPage} se`,
    dayOf: (day, total) => `Din ${day} / ${total}`,
    daysLeft: (n) => `${n} din baaki`,
    todayLabel: 'Aaj ka hissa',
    todayRange: (from, to, pages) =>
      `Pages ${from}–${to} · ${pages} page${pages === 1 ? '' : 's'}`,
    pagesRead: (read) => `${read} / ${TOTAL_PAGES} pages padhe`,
    overdue: 'End date nikal gayi — baaki saare pages aaj ke hain, abhi bhi poora kar sakte ho.',
    doneToday: "Aaj ka hissa ho gaya — MashaAllah!",
    continueBtn: (page) => `Page ${page} se jaari rakho`,
    continueSaved: (page) => `Save ho gaya — Quran Book me page ${page} se jaari rakho.`,
    markDone: 'Aaj ka hissa padh liya',
    planComplete: 'Khatmah poori ho gayi — MashaAllah!',
    planCompleteBody: 'Plan ke saare pages padh liye. Jab chaaho, nayi khatmah shuru karo.',
    startNew: 'Nayi khatmah shuru karo',
    cancelPlan: 'Plan cancel karo',
    cancelConfirm: 'Plan cancel kar doon? Is plan ki recorded progress delete ho jayegi.',
    cancelYes: 'Haan, cancel karo',
    cancelNo: 'Plan rakho',
  },
};

const PRESETS = [30, 60, 90] as const;
type Preset = (typeof PRESETS)[number] | 'custom';

export default function KhatmahScreen({ lang, user, goTo }: ScreenProps) {
  const s = STRINGS[lang];
  const uid = user?.id ?? 'anon';

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<KhatmahPlan | null>(null);
  const [preset, setPreset] = useState<Preset>(30);
  const [customDaysText, setCustomDaysText] = useState('45');
  const [startPageText, setStartPageText] = useState('1');
  const [inputError, setInputError] = useState<PlanInputError | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  /** Page Continue last saved — shown on screen, wired to the Quran Book by the coordinator. */
  const [targetPage, setTargetPage] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [savedPlan, savedTarget] = await Promise.all([loadPlan(uid), loadTargetPage(uid)]);
      if (!active) return;
      setPlan(savedPlan);
      setTargetPage(savedTarget);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [uid]);

  const chosenDays = preset === 'custom' ? Number(customDaysText.trim()) : preset;
  const chosenStartPage = Number(startPageText.trim());
  const pickerError = validatePlanInput(chosenDays, chosenStartPage);
  const preview =
    pickerError == null ? previewPagesPerDay(chosenDays, chosenStartPage) : null;

  const portion = plan ? todaysPortion(plan) : null;

  async function handleStartPlan(): Promise<void> {
    if (pickerError != null) {
      setInputError(pickerError);
      return;
    }
    setInputError(null);
    let next: KhatmahPlan;
    try {
      next = createPlan(chosenDays, chosenStartPage);
    } catch {
      setInputError(validatePlanInput(chosenDays, chosenStartPage));
      return;
    }
    await savePlan(uid, next);
    setPlan(next);
    setTargetPage(null);
    setConfirmCancel(false);
  }

  async function handleContinue(): Promise<void> {
    if (!portion || portion.complete) return;
    await saveTargetPage(uid, portion.fromPage);
    setTargetPage(portion.fromPage);
    setQuranPageTarget(portion.fromPage);
    goTo('reader');
  }

  async function handleMarkDone(): Promise<void> {
    if (!plan || !portion || portion.complete || portion.doneToday) return;
    const next = markTodayDone(plan);
    if (!next) return;
    await savePlan(uid, next);
    setPlan(next);
    // Today's portion is done — its Continue target is stale now.
    await clearTargetPage(uid);
    setTargetPage(null);
  }

  async function handleCancelPlan(): Promise<void> {
    await clearPlan(uid);
    await clearTargetPage(uid);
    setPlan(null);
    setTargetPage(null);
    setConfirmCancel(false);
    setInputError(null);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.title}</Text>
      <Text style={T.sub}>{s.subtitle}</Text>

      {loading ? (
        <Text style={T.note}>{s.loading}</Text>
      ) : plan == null || portion == null ? (
        <Card>
          <Field label={s.choosePlan}>
            <View style={styles.chipRow}>
              {PRESETS.map((days) => (
                <Chip
                  key={days}
                  label={String(days)}
                  selected={preset === days}
                  onPress={() => {
                    setPreset(days);
                    setInputError(null);
                  }}
                />
              ))}
              <Chip
                label="Custom"
                selected={preset === 'custom'}
                onPress={() => {
                  setPreset('custom');
                  setInputError(null);
                }}
              />
            </View>
          </Field>

          {preset === 'custom' ? (
            <Field label={s.customDays}>
              <Input
                value={customDaysText}
                onChangeText={(v) => {
                  setCustomDaysText(v);
                  setInputError(null);
                }}
                placeholder={s.customDaysPlaceholder}
                keyboardType="number-pad"
              />
            </Field>
          ) : null}

          <Field label={s.startPage}>
            <Input
              value={startPageText}
              onChangeText={(v) => {
                setStartPageText(v);
                setInputError(null);
              }}
              placeholder={s.startPagePlaceholder}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>{s.startPageHint}</Text>
          </Field>

          {preview != null ? <Text style={styles.preview}>{s.preview(preview)}</Text> : null}
          {inputError === 'days' ? <Text style={T.error}>{s.invalidDays}</Text> : null}
          {inputError === 'page' ? <Text style={T.error}>{s.invalidPage}</Text> : null}

          <View style={styles.startWrap}>
            <PillButton
              label={s.startPlan}
              variant="primary"
              block
              onPress={() => void handleStartPlan()}
            />
          </View>
        </Card>
      ) : portion.complete ? (
        <Card>
          <Text style={T.cardTitle}>{s.planComplete}</Text>
          <Text style={[T.cardBody, styles.bodyGap]}>{s.planCompleteBody}</Text>
          <Text style={styles.readLine}>{s.pagesRead(portion.pagesRead)}</Text>
          <ProgressBar value={portion.pagesRead} max={TOTAL_PAGES} />
          <View style={styles.startWrap}>
            <PillButton
              label={s.startNew}
              variant="primary"
              block
              onPress={() => void handleCancelPlan()}
            />
          </View>
        </Card>
      ) : (
        <View>
          <Card>
            <Text style={T.cardTitle}>{s.planSummary(plan.totalDays, plan.startPage)}</Text>
            <Text style={[T.cardBody, styles.bodyGap]}>
              {s.dayOf(portion.dayNumber, plan.totalDays)} · {s.daysLeft(portion.daysLeft)}
            </Text>

            <Text style={styles.todayLabel}>{s.todayLabel}</Text>
            <Text style={styles.todayRange}>
              {s.todayRange(portion.fromPage, portion.toPage, portion.pagesToday)}
            </Text>

            {portion.overdue ? <Text style={styles.overdue}>{s.overdue}</Text> : null}
            {portion.doneToday ? <Text style={styles.done}>{s.doneToday}</Text> : null}

            <View style={styles.progressWrap}>
              <ProgressBar value={portion.pagesRead} max={TOTAL_PAGES} />
              <Text style={styles.readLine}>{s.pagesRead(portion.pagesRead)}</Text>
            </View>
          </Card>

          <PillButton
            label={s.continueBtn(portion.fromPage)}
            variant="peach"
            block
            onPress={() => void handleContinue()}
          />
          {targetPage != null ? (
            <Text style={styles.saved}>{s.continueSaved(targetPage)}</Text>
          ) : null}

          <PillButton
            label={s.markDone}
            variant="primary"
            block
            disabled={portion.doneToday}
            onPress={() => void handleMarkDone()}
          />

          {confirmCancel ? (
            <Card>
              <Text style={T.cardBody}>{s.cancelConfirm}</Text>
              <View style={styles.confirmRow}>
                <PillButton
                  label={s.cancelYes}
                  variant="ghost"
                  small
                  onPress={() => void handleCancelPlan()}
                />
                <PillButton
                  label={s.cancelNo}
                  variant="soft"
                  small
                  onPress={() => setConfirmCancel(false)}
                />
              </View>
            </Card>
          ) : (
            <PillButton
              label={s.cancelPlan}
              variant="ghost"
              block
              onPress={() => setConfirmCancel(true)}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  preview: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 12,
  },
  startWrap: { marginTop: 16 },
  bodyGap: { marginTop: 6 },
  todayLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 16,
    marginBottom: 4,
  },
  todayRange: {
    fontFamily: F.sans,
    fontSize: 19,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.2,
  },
  overdue: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.amber,
    marginTop: 10,
    lineHeight: 18,
  },
  done: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 10,
  },
  progressWrap: { marginTop: 16 },
  readLine: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  saved: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.teal700,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 12,
    lineHeight: 18,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
});
