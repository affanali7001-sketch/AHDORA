/**
 * Tasbeeh — dhikr counter with a USER-SELECTABLE target.
 * Rebuilt to the approved preview (§14): dhikr dropdown, target
 * chips 33 / 100 (default) / 500 / 1000, custom-number input,
 * 230px SVG ring with a gradient core, remaining/complete message,
 * ghost Reset button. The count only ever moves by the user's own
 * taps — nothing is faked or auto-filled.
 *
 * Upgrades: Salawat added to the dropdown; each dhikr has its own
 * sensible default target (33 for the three short tasbih, 100 for
 * La ilaha illallah / Astaghfirullah / Salawat). Light haptic on
 * every tap (guarded — the screen works fine without haptics).
 * The running count and every completed session are saved per user,
 * per day, per dhikr in AsyncStorage (see src/lib/tasbih.ts), so a
 * count survives an app restart, and a small "Today's total" line
 * shows the real taps today across all dhikrs. Reset clears only
 * the current counter — completed sessions stay in today's total.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { Chip, Field, Input, PillButton } from '../components/ui';
import {
  loadRunningCount,
  loadTodayTotal,
  recordCompletedSession,
  saveRunningCount,
  todayDateKey,
} from '../lib/tasbih';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    dhikr: string;
    customTarget: string;
    customPlaceholder: string;
    remaining: (n: number) => string;
    complete: string;
    tapToCount: string;
    reset: string;
    targetWord: string;
    todayTotal: (n: number) => string;
  }
> = {
  en: {
    title: 'Tasbeeh',
    subtitle: 'Choose the target yourself — you decide how many times to count.',
    dhikr: 'Choose a tasbeeh',
    customTarget: 'Or type your own number',
    customPlaceholder: 'e.g. 250',
    remaining: (n) => `${n} more to go`,
    complete: 'MashaAllah! Target complete 🎉',
    tapToCount: 'Tap to count',
    reset: 'Reset',
    targetWord: 'target',
    todayTotal: (n) => `Today's total: ${n}`,
  },
  hi: {
    title: 'Tasbeeh',
    subtitle: 'Target khud chuno — kitni baar ginna hai, tum decide karo.',
    dhikr: 'Tasbeeh chuno',
    customTarget: 'Ya apna number likho',
    customPlaceholder: 'e.g. 250',
    remaining: (n) => `${n} aur baaki`,
    complete: 'MashAllah! Target pura ho gaya 🎉',
    tapToCount: 'Ginne ke liye dabao',
    reset: 'Reset karo',
    targetWord: 'target',
    todayTotal: (n) => `Aaj ka kul: ${n}`,
  },
};

const DHIKRS = [
  { name: 'SubhanAllah', arabic: 'سُبْحَانَ ٱللَّٰهِ', defaultTarget: 33 },
  { name: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', defaultTarget: 33 },
  { name: 'Allahu Akbar', arabic: 'ٱللَّٰهُ أَكْبَرُ', defaultTarget: 33 },
  { name: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', defaultTarget: 100 },
  { name: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', defaultTarget: 100 },
  { name: 'Salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', defaultTarget: 100 },
] as const;

const DHIKR_NAMES = DHIKRS.map((d) => d.name);

const PRESET_TARGETS = [33, 100, 500, 1000] as const;
const RING_CIRCUMFERENCE = 653.4; // 2 * PI * 104 (preview §14)

/**
 * Light tap feedback. Guarded twice (missing function + thrown
 * error) so the screen never crashes on a device without haptics —
 * the ring still shows every tap.
 */
function tapHaptic(): void {
  try {
    if (typeof Haptics.impactAsync !== 'function') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  } catch {
    // Haptics unavailable — visual feedback carries the tap.
  }
}

export default function TasbeehScreen({ lang, user }: ScreenProps) {
  const s = STRINGS[lang];
  const uid = user?.id ?? 'anon';
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [dhikrOpen, setDhikrOpen] = useState(false);
  const [target, setTarget] = useState<number>(DHIKRS[0].defaultTarget);
  const [count, setCount] = useState(0);
  const [customText, setCustomText] = useState(String(DHIKRS[0].defaultTarget));
  const [todayTotal, setTodayTotal] = useState(0);
  /** Synchronous mirror of `count` — taps read it, restores write it. */
  const countRef = useRef(0);
  /** Bumps on every restore so a stale load can't overwrite a newer dhikr. */
  const loadToken = useRef(0);

  const progress = target > 0 ? Math.min(1, count / target) : 0;
  const complete = count > 0 && count >= target;
  const remaining = Math.max(0, target - count);
  const dateKey = todayDateKey();

  async function refreshTodayTotal(): Promise<void> {
    setTodayTotal(await loadTodayTotal(uid, dateKey, DHIKR_NAMES));
  }

  // First visit: restore today's saved count for the opening dhikr
  // (0 when nothing was counted yet) and the real today's total.
  useEffect(() => {
    const token = ++loadToken.current;
    void (async () => {
      const saved = await loadRunningCount(uid, dateKey, DHIKRS[0].name);
      if (token === loadToken.current) {
        countRef.current = saved;
        setCount(saved);
      }
      setTodayTotal(await loadTodayTotal(uid, dateKey, DHIKR_NAMES));
    })();
  }, [uid, dateKey]);

  function applyTarget(next: number): void {
    setTarget(next);
    countRef.current = 0;
    setCount(0);
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
      // No error UI in the preview: an invalid number is ignored and
      // the field goes back to the current target.
      setCustomText(String(target));
      return;
    }
    applyTarget(n);
  }

  function selectDhikr(i: number): void {
    const d = DHIKRS[i];
    setDhikrIndex(i);
    setDhikrOpen(false);
    // Each dhikr opens on its own default target, and restores the
    // count already saved for it today (0 when none).
    setTarget(d.defaultTarget);
    setCustomText(String(d.defaultTarget));
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
      await recordCompletedSession(uid, dateKey, DHIKRS[dhikrIndex].name, next);
    }
    await refreshTodayTotal();
  }

  async function handleReset(): Promise<void> {
    // Resets only the current counter — completed sessions stay in
    // today's total.
    countRef.current = 0;
    setCount(0);
    await saveRunningCount(uid, dateKey, DHIKRS[dhikrIndex].name, 0);
    await refreshTodayTotal();
  }

  const dhikr = DHIKRS[dhikrIndex];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.title}</Text>
      <Text style={T.sub}>{s.subtitle}</Text>

      <Field label={s.dhikr}>
        <Pressable
          onPress={() => setDhikrOpen((o) => !o)}
          style={styles.dropdown}
          accessibilityRole="button"
          accessibilityState={{ expanded: dhikrOpen }}
        >
          <View style={styles.dropdownSelected}>
            <Text style={styles.dropdownName}>{dhikr.name}</Text>
            <Text style={styles.dropdownArabic}>{dhikr.arabic}</Text>
          </View>
          <Text style={styles.dropdownCaret}>{dhikrOpen ? '▴' : '▾'}</Text>
        </Pressable>
        {dhikrOpen
          ? DHIKRS.map((d, i) => (
              <Pressable
                key={d.name}
                onPress={() => selectDhikr(i)}
                style={[styles.option, i === dhikrIndex && styles.optionOn]}
                accessibilityRole="button"
              >
                <Text style={[styles.optionName, i === dhikrIndex && styles.optionNameOn]}>
                  {d.name}
                </Text>
                <Text style={styles.optionArabic}>{d.arabic}</Text>
              </Pressable>
            ))
          : null}
      </Field>

      <View style={styles.chipRow}>
        {PRESET_TARGETS.map((t) => (
          <Chip
            key={t}
            label={String(t)}
            selected={target === t}
            onPress={() => applyTarget(t)}
          />
        ))}
      </View>

      <Field label={s.customTarget}>
        <Input
          value={customText}
          onChangeText={setCustomText}
          placeholder={s.customPlaceholder}
          keyboardType="number-pad"
          onSubmitEditing={applyCustomTarget}
          onBlur={applyCustomTarget}
        />
      </Field>

      <View style={styles.ringWrap}>
        <Svg width={230} height={230} viewBox="0 0 230 230">
          <Circle
            cx={115}
            cy={115}
            r={104}
            fill="none"
            stroke={C.teal100}
            strokeWidth={10}
          />
          <Circle
            cx={115}
            cy={115}
            r={104}
            fill="none"
            stroke={C.teal500}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 115 115)"
          />
        </Svg>
        <Pressable
          onPress={() => void handleTap()}
          style={styles.core}
          accessibilityRole="button"
          accessibilityLabel={s.tapToCount}
        >
          <LinearGradient
            colors={[C.teal700, C.teal900]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.coreGradient}
          >
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.of}>
              {s.targetWord} {target}
            </Text>
            <Text style={styles.tap}>{s.tapToCount}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Text style={styles.message}>
        {complete ? s.complete : s.remaining(remaining)}
      </Text>

      <Text style={styles.todayTotal}>{s.todayTotal(todayTotal)}</Text>

      <PillButton label={s.reset} variant="ghost" block onPress={() => void handleReset()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: S.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 50,
  },
  dropdownSelected: { flex: 1 },
  dropdownName: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.ink },
  dropdownArabic: { fontFamily: F.arabic, fontSize: 16, color: C.teal700, marginTop: 2 },
  dropdownCaret: { fontSize: 16, color: C.muted, marginLeft: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: S.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 6,
  },
  optionOn: { borderColor: C.teal700, backgroundColor: C.teal100 },
  optionName: { fontFamily: F.sans, fontSize: 14, fontWeight: '700', color: C.ink },
  optionNameOn: { color: C.teal900 },
  optionArabic: { fontFamily: F.arabic, fontSize: 17, color: C.teal700 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  ringWrap: {
    position: 'relative',
    width: 230,
    height: 230,
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  core: {
    position: 'absolute',
    left: 26,
    top: 26,
    width: 178,
    height: 178,
    borderRadius: 89,
    overflow: 'hidden',
    shadowColor: C.teal950,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  coreGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontFamily: F.sans,
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 48,
    color: C.white,
  },
  of: { fontFamily: F.sans, fontSize: 12.5, color: C.navInactive, fontWeight: '700' },
  tap: { fontFamily: F.sans, fontSize: 12.5, color: C.navInactive, marginTop: 2 },
  message: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    minHeight: 22,
    marginTop: 8,
    marginBottom: 6,
  },
  todayTotal: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
});
