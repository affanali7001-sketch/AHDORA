/**
 * Tasbeeh — dhikr counter with a USER-SELECTABLE target.
 * Rebuilt to the approved preview (§14): dhikr dropdown, target
 * chips 33 / 100 (default) / 500 / 1000, custom-number input,
 * 230px SVG ring with a gradient core, remaining/complete message,
 * ghost Reset button. The count only ever moves by the user's own
 * taps — nothing is faked or auto-filled.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { Chip, Field, Input, PillButton } from '../components/ui';

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
  },
};

const DHIKRS = [
  { name: 'SubhanAllah', arabic: 'سُبْحَانَ ٱللَّٰهِ' },
  { name: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ' },
  { name: 'Allahu Akbar', arabic: 'ٱللَّٰهُ أَكْبَرُ' },
  { name: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ' },
  { name: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ' },
] as const;

const PRESET_TARGETS = [33, 100, 500, 1000] as const;
const RING_CIRCUMFERENCE = 653.4; // 2 * PI * 104 (preview §14)

export default function TasbeehScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [dhikrOpen, setDhikrOpen] = useState(false);
  const [target, setTarget] = useState(100);
  const [count, setCount] = useState(0);
  const [customText, setCustomText] = useState('');

  const progress = target > 0 ? Math.min(1, count / target) : 0;
  const complete = count > 0 && count >= target;
  const remaining = Math.max(0, target - count);

  function applyTarget(next: number): void {
    setTarget(next);
    setCount(0);
    setCustomText(String(next));
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
                onPress={() => {
                  setDhikrIndex(i);
                  setCount(0);
                  setDhikrOpen(false);
                }}
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
          onPress={() => setCount((c) => c + 1)}
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

      <PillButton label={s.reset} variant="ghost" block onPress={() => setCount(0)} />
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
    marginBottom: 14,
  },
});
