/**
 * Tasbeeh — rebuilt to Mihrab's Tasbih counter design (screenshots,
 * re-implemented from scratch in AHDORA's own code).
 *
 * Full-screen black counter: the dhikr in big white text, a HUGE count
 * with "out of N" below it, and a vertical string of flower beads on
 * the right — counted beads are lit in the user's design colour,
 * upcoming beads are dimmed, and more light up as the count rises.
 * Tap anywhere in the counter area to count (haptics on every tap).
 * An "Exit" pill at the bottom goes back.
 *
 * Everything from the old screen is kept: the same 6 dhikr with the
 * same default targets (33/33/33/100/100/100), user-pickable target
 * (33 / 100 / 500 / 1000 or a custom number), the running count and
 * completed sessions saved per user / per day / per dhikr in
 * AsyncStorage (see src/lib/tasbih.ts), and the real "Today's total".
 * The count only ever moves by the user's own taps.
 *
 * The beads follow the user's design from "Design your tasbih"
 * (src/lib/tasbihDesign.ts) — golden flower beads by default.
 * When the target is reached, a completion banner offers to keep
 * counting past the target or reset; the session is recorded once,
 * when the real count first hits the target.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { F } from '../lib/theme';
import TasbihBead from '../components/TasbihBead';
import {
  loadRunningCount,
  loadTodayTotal,
  recordCompletedSession,
  saveRunningCount,
  todayDateKey,
} from '../lib/tasbih';
import { DEFAULT_DESIGN, loadDesign, type TasbihDesign } from '../lib/tasbihDesign';

const DHIKRS = [
  { name: 'SubhanAllah', display: 'Subhan Allah', arabic: 'سُبْحَانَ ٱللَّٰهِ', defaultTarget: 33 },
  { name: 'Alhamdulillah', display: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', defaultTarget: 33 },
  { name: 'Allahu Akbar', display: 'Allahu Akbar', arabic: 'ٱللَّٰهُ أَكْبَرُ', defaultTarget: 33 },
  { name: 'La ilaha illallah', display: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', defaultTarget: 100 },
  { name: 'Astaghfirullah', display: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', defaultTarget: 100 },
  { name: 'Salawat', display: 'Salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', defaultTarget: 100 },
] as const;

const DHIKR_NAMES = DHIKRS.map((d) => d.name);
const PRESET_TARGETS = [33, 100, 500, 1000] as const;
/** Beads on the string — 9 fits a phone screen (3 top + 6 below, as in the screenshot). */
const BEAD_COUNT = 9;
const BEAD_SIZE = 36;

/**
 * Light tap feedback. Guarded twice (missing function + thrown
 * error) so the screen never crashes on a device without haptics.
 */
function tapHaptic(): void {
  try {
    if (typeof Haptics.impactAsync !== 'function') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  } catch {
    // Haptics unavailable — visual feedback carries the tap.
  }
}

function completeHaptic(): void {
  try {
    if (typeof Haptics.notificationAsync !== 'function') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  } catch {
    // Haptics unavailable — the banner carries the moment.
  }
}

export default function TasbeehScreen({ lang, user, goTo, goBack }: ScreenProps) {
  const s = stringsFor(lang);
  const uid = user?.id ?? 'anon';
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [target, setTarget] = useState<number>(DHIKRS[0].defaultTarget);
  const [count, setCount] = useState(0);
  const [customText, setCustomText] = useState(String(DHIKRS[0].defaultTarget));
  const [todayTotal, setTodayTotal] = useState(0);
  const [design, setDesign] = useState<TasbihDesign>(DEFAULT_DESIGN);
  /** True once the user chose "Keep counting" past the target. */
  const [continued, setContinued] = useState(false);
  /** Synchronous mirror of `count` — taps read it, restores write it. */
  const countRef = useRef(0);
  /** Bumps on every restore so a stale load can't overwrite a newer dhikr. */
  const loadToken = useRef(0);

  const progress = target > 0 ? Math.min(1, count / target) : 0;
  const complete = count > 0 && count >= target;
  const remaining = Math.max(0, target - count);
  const dateKey = todayDateKey();
  /** Beads lit so far — real progress, one bead per 1/9th of the target. */
  const litBeads = complete ? BEAD_COUNT : Math.floor(progress * BEAD_COUNT);

  async function refreshTodayTotal(): Promise<void> {
    setTodayTotal(await loadTodayTotal(uid, dateKey, DHIKR_NAMES));
  }

  // First visit: restore today's saved count for the opening dhikr
  // (0 when nothing was counted yet), the real today's total, and
  // the user's bead design.
  useEffect(() => {
    const token = ++loadToken.current;
    void (async () => {
      const saved = await loadRunningCount(uid, dateKey, DHIKRS[0].name);
      if (token === loadToken.current) {
        countRef.current = saved;
        setCount(saved);
      }
      setTodayTotal(await loadTodayTotal(uid, dateKey, DHIKR_NAMES));
      setDesign(await loadDesign(uid));
    })();
  }, [uid, dateKey]);

  function applyTarget(next: number): void {
    setTarget(next);
    countRef.current = 0;
    setCount(0);
    setContinued(false);
    setCustomText(String(next));
    // A new target starts a fresh counter — the old running count is
    // discarded, completed sessions stay in today's total.
    void saveRunningCount(uid, dateKey, DHIKRS[dhikrIndex].name, 0).then(() =>
      refreshTodayTotal(),
    );
  }

  function applyCustomTarget(): void {
    const n = Number(customText.trim());
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      // An invalid number is ignored and the field goes back to the
      // current target.
      setCustomText(String(target));
      return;
    }
    applyTarget(n);
  }

  function selectDhikr(i: number): void {
    const d = DHIKRS[i];
    setDhikrIndex(i);
    // Each dhikr opens on its own default target, and restores the
    // count already saved for it today (0 when none).
    setTarget(d.defaultTarget);
    setCustomText(String(d.defaultTarget));
    setContinued(false);
    const token = ++loadToken.current;
    void (async () => {
      const saved = await loadRunningCount(uid, dateKey, d.name);
      if (token === loadToken.current) {
        countRef.current = saved;
        setCount(saved);
      }
    })();
  }

  async function handleTap(): Promise<void> {
    tapHaptic();
    const next = countRef.current + 1;
    countRef.current = next;
    setCount(next);
    await saveRunningCount(uid, dateKey, DHIKRS[dhikrIndex].name, next);
    if (next === target) {
      // Target reached: this run is a completed session now.
      completeHaptic();
      setContinued(false);
      await recordCompletedSession(uid, dateKey, DHIKRS[dhikrIndex].name, next);
    }
    await refreshTodayTotal();
  }

  async function handleReset(): Promise<void> {
    // Resets only the current counter — completed sessions stay in
    // today's total.
    countRef.current = 0;
    setCount(0);
    setContinued(false);
    await saveRunningCount(uid, dateKey, DHIKRS[dhikrIndex].name, 0);
    await refreshTodayTotal();
  }

  const dhikr = DHIKRS[dhikrIndex];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header: title + Design button. */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{s.tasTitle}</Text>
        <Pressable
          onPress={() => goTo('tasbihDesign')}
          style={styles.designBtn}
          accessibilityRole="button"
          accessibilityLabel={s.tasDesignTitle}
        >
          <Text style={styles.designBtnText}>{s.tasDesignOpen}</Text>
        </Pressable>
      </View>

      {/* Dhikr picker — horizontal chips, same 6 dhikr as before. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DHIKRS.map((d, i) => (
          <Pressable
            key={d.name}
            onPress={() => selectDhikr(i)}
            style={[styles.chip, i === dhikrIndex && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: i === dhikrIndex }}
          >
            <Text style={[styles.chipText, i === dhikrIndex && styles.chipTextOn]}>{d.display}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Target picker — presets + custom number. */}
      <View style={styles.targetRow}>
        {PRESET_TARGETS.map((t) => (
          <Pressable
            key={t}
            onPress={() => applyTarget(t)}
            style={[styles.chip, target === t && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: target === t }}
          >
            <Text style={[styles.chipText, target === t && styles.chipTextOn]}>{t}</Text>
          </Pressable>
        ))}
        <TextInput
          value={customText}
          onChangeText={setCustomText}
          placeholder={s.tasCustom}
          placeholderTextColor="#666666"
          keyboardType="number-pad"
          onSubmitEditing={applyCustomTarget}
          onBlur={applyCustomTarget}
          style={styles.customInput}
          accessibilityLabel={s.tasCustom}
        />
      </View>

      {/* Counter area — the whole area is the tap target. */}
      <Pressable
        onPress={() => void handleTap()}
        style={styles.counter}
        accessibilityRole="button"
        accessibilityLabel={s.tasTapAnywhere}
      >
        <View style={styles.countCol}>
          <Text style={styles.arabic}>{dhikr.arabic}</Text>
          <Text style={styles.dhikrName}>{dhikr.display}</Text>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.outOf}>
            {s.tasOutOf} {target}
          </Text>
          <Text style={styles.status}>
            {complete ? '' : `${remaining} ${s.tasMoreToGo}`}
          </Text>
          <Text style={styles.todayTotal}>
            {s.tasTodayTotal}: {todayTotal}
          </Text>
          <Pressable
            onPress={() => void handleReset()}
            accessibilityRole="button"
            accessibilityLabel={s.tasReset}
            hitSlop={8}
          >
            <Text style={styles.resetText}>{s.tasReset}</Text>
          </Pressable>

          {complete && !continued ? (
            <View style={styles.completeBox}>
              <Text style={styles.completeText}>{s.tasComplete}</Text>
              <View style={styles.completeRow}>
                <Pressable
                  onPress={() => setContinued(true)}
                  style={styles.continueBtn}
                  accessibilityRole="button"
                  accessibilityLabel={s.tasContinue}
                >
                  <Text style={styles.continueBtnText}>{s.tasContinue}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleReset()}
                  style={styles.completeResetBtn}
                  accessibilityRole="button"
                  accessibilityLabel={s.tasReset}
                >
                  <Text style={styles.completeResetText}>{s.tasReset}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Bead string — a real misbaha: beads on a thread, lit as you count. */}
        <View style={styles.stringCol} pointerEvents="none">
          <View style={styles.thread} />
          <View style={styles.beads}>
            {Array.from({ length: BEAD_COUNT }, (_, i) => (
              <TasbihBead
                key={i}
                size={BEAD_SIZE}
                shape={design.shape}
                color={design.color}
                effect={design.effect}
                lit={i < litBeads}
                showAllah
              />
            ))}
          </View>
        </View>
      </Pressable>

      {/* Bottom: tap hint + Exit pill. */}
      <Text style={styles.hint}>{s.tasTapAnywhere}</Text>
      <Pressable
        onPress={goBack}
        style={styles.exitBtn}
        accessibilityRole="button"
        accessibilityLabel={s.tasExit}
      >
        <Text style={styles.exitText}>{s.tasExit}</Text>
      </Pressable>
    </View>
  );
}

const GOLD = '#E9A93B';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerTitle: { fontFamily: F.sans, fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  designBtn: {
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  designBtnText: { fontFamily: F.sans, fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  chipRow: { paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: 'center' },
  chip: {
    backgroundColor: '#161616',
    borderWidth: 1.5,
    borderColor: '#333333',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { borderColor: GOLD, backgroundColor: '#241D08' },
  chipText: { fontFamily: F.sans, fontSize: 13.5, fontWeight: '700', color: '#999999' },
  chipTextOn: { color: '#FFFFFF' },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  customInput: {
    backgroundColor: '#161616',
    borderWidth: 1.5,
    borderColor: '#333333',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 84,
    textAlign: 'center',
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  counter: { flex: 1, flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8 },
  countCol: { flex: 1, justifyContent: 'center', paddingRight: 8 },
  arabic: { fontFamily: F.arabic, fontSize: 30, color: '#FFFFFF', lineHeight: 44 },
  dhikrName: { fontFamily: F.sans, fontSize: 34, fontWeight: '800', color: '#FFFFFF', marginTop: 6 },
  count: {
    fontFamily: F.sans,
    fontSize: 110,
    fontWeight: '200',
    lineHeight: 122,
    color: '#FFFFFF',
    marginTop: 10,
  },
  outOf: { fontFamily: F.sans, fontSize: 18, color: '#888888', marginTop: 2 },
  status: { fontFamily: F.sans, fontSize: 14, color: '#888888', marginTop: 10, minHeight: 20 },
  todayTotal: { fontFamily: F.sans, fontSize: 13, color: '#777777', marginTop: 4 },
  resetText: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#999999',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  completeBox: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 16,
    backgroundColor: '#1A1503',
    padding: 14,
  },
  completeText: { fontFamily: F.sans, fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  completeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  continueBtn: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  continueBtnText: { fontFamily: F.sans, fontSize: 13.5, fontWeight: '800', color: '#241D08' },
  completeResetBtn: {
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  completeResetText: { fontFamily: F.sans, fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  stringCol: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thread: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 2,
    backgroundColor: '#2E2E2E',
  },
  beads: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hint: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
  },
  exitBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 999,
    paddingHorizontal: 38,
    paddingVertical: 11,
    marginTop: 10,
    marginBottom: 18,
  },
  exitText: { fontFamily: F.sans, fontSize: 15, fontWeight: '600', color: '#999999' },
});
