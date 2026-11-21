/**
 * Tasbeeh — dhikr counter with a USER-SELECTABLE target.
 * Preset chips (33 / 99 / 100) plus a custom-number input. The
 * progress bar fills toward the chosen target; the count itself
 * is only ever incremented by the user's own taps — nothing is
 * faked or auto-filled.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';

/** Ice White / Deep Teal / Soft Peach — the AHDORA palette. No gold. */
const C = {
  ice: '#F5F7F6',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#687A75',
  teal950: '#06231F',
  teal900: '#0A352F',
  teal: '#0B4F4A',
  teal2: '#0F766E',
  peach: '#FFD9BE',
  peach2: '#FFF1E3',
  peachDeep: '#B45309',
  red: '#E11D2E',
  line: '#E6ECE9',
};

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    dhikr: string;
    target: string;
    customTarget: string;
    customPlaceholder: string;
    setTarget: string;
    invalidTarget: string;
    count: string;
    ofTarget: string;
    complete: string;
    tapToCount: string;
    reset: string;
    undo: string;
    rounds: string;
  }
> = {
  en: {
    title: 'Tasbeeh',
    subtitle: 'Count your dhikr — you choose the target.',
    dhikr: 'Dhikr',
    target: 'Your target',
    customTarget: 'Custom target',
    customPlaceholder: 'e.g. 500',
    setTarget: 'Set target',
    invalidTarget: 'Target must be a number between 1 and 100,000.',
    count: 'Count',
    ofTarget: 'of',
    complete: 'Target complete! MashaAllah.',
    tapToCount: 'Tap the circle to count',
    reset: 'Reset',
    undo: 'Undo −1',
    rounds: 'rounds done',
  },
  hi: {
    title: 'Tasbeeh',
    subtitle: 'Apna zikr gino — target aap khud chuno.',
    dhikr: 'Zikr',
    target: 'Aapka target',
    customTarget: 'Apna target likho',
    customPlaceholder: 'jaise 500',
    setTarget: 'Target set karo',
    invalidTarget: 'Target 1 se 100,000 ke beech ka number hona chahiye.',
    count: 'Ginti',
    ofTarget: '/',
    complete: 'Target poora ho gaya! MashaAllah.',
    tapToCount: 'Ginne ke liye circle par tap karo',
    reset: 'Reset',
    undo: 'Wapas −1',
    rounds: 'round poore',
  },
};

const DHIKRS = ['سُبْحَانَ ٱللَّٰهِ', 'ٱلْحَمْدُ لِلَّٰهِ', 'ٱللَّٰهُ أَكْبَرُ'] as const;
const DHIKR_NAMES = ['SubhanAllah', 'Alhamdulillah', 'Allahu Akbar'] as const;
const PRESET_TARGETS = [33, 99, 100] as const;

export default function TasbeehScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [target, setTarget] = useState(33);
  const [count, setCount] = useState(0);
  const [customText, setCustomText] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const progress = target > 0 ? Math.min(1, count / target) : 0;
  const rounds = target > 0 ? Math.floor(count / target) : 0;
  const complete = count > 0 && count % target === 0;

  function applyTarget(next: number): void {
    setTarget(next);
    setCount(0);
    setCustomError(null);
  }

  function applyCustomTarget(): void {
    const n = Number(customText.trim());
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      setCustomError(s.invalidTarget);
      return;
    }
    setCustomText('');
    applyTarget(n);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.subtitle}</Text>

      <Text style={styles.label}>{s.dhikr}</Text>
      <View style={styles.dhikrRow}>
        {DHIKR_NAMES.map((name, i) => (
          <Pressable
            key={name}
            onPress={() => {
              setDhikrIndex(i);
              setCount(0);
            }}
            style={[styles.dhikrChip, dhikrIndex === i && styles.dhikrChipOn]}
            accessibilityRole="button"
          >
            <Text style={[styles.dhikrChipText, dhikrIndex === i && styles.dhikrChipTextOn]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.counterCard}>
        <Text style={styles.dhikrArabic}>{DHIKRS[dhikrIndex]}</Text>
        <Pressable
          onPress={() => setCount((c) => c + 1)}
          style={styles.countCircle}
          accessibilityRole="button"
          accessibilityLabel={s.tapToCount}
        >
          <Text style={styles.countNum}>{count}</Text>
          <Text style={styles.countOf}>
            {s.ofTarget} {target}
          </Text>
        </Pressable>
        <Text style={styles.tapHint}>{s.tapToCount}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {Math.round(progress * 100)}% · {rounds > 0 ? `${rounds} ${s.rounds} · ` : ''}
          {s.count}: {count}
        </Text>
        {complete ? <Text style={styles.complete}>{s.complete}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => setCount((c) => Math.max(0, c - 1))}
            style={styles.smallBtn}
            accessibilityRole="button"
          >
            <Text style={styles.smallBtnText}>{s.undo}</Text>
          </Pressable>
          <Pressable
            onPress={() => setCount(0)}
            style={styles.smallBtn}
            accessibilityRole="button"
          >
            <Text style={styles.smallBtnText}>{s.reset}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.label}>{s.target}</Text>
      <View style={styles.targetRow}>
        {PRESET_TARGETS.map((t) => (
          <Pressable
            key={t}
            onPress={() => applyTarget(t)}
            style={[styles.targetChip, target === t && styles.targetChipOn]}
            accessibilityRole="button"
          >
            <Text
              style={[styles.targetChipText, target === t && styles.targetChipTextOn]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{s.customTarget}</Text>
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          value={customText}
          onChangeText={setCustomText}
          placeholder={s.customPlaceholder}
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          onSubmitEditing={applyCustomTarget}
        />
        <Pressable
          onPress={applyCustomTarget}
          style={styles.setBtn}
          accessibilityRole="button"
        >
          <Text style={styles.setBtnText}>{s.setTarget}</Text>
        </Pressable>
      </View>
      {customError ? <Text style={styles.error}>{customError}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 8 },
  dhikrRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },
  dhikrChip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: C.white,
  },
  dhikrChipOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  dhikrChipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  dhikrChipTextOn: { color: C.white },
  counterCard: {
    backgroundColor: C.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.line,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  dhikrArabic: { fontSize: 30, color: C.teal900, marginBottom: 20, textAlign: 'center' },
  countCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  countNum: { fontSize: 52, fontWeight: '800', color: C.white },
  countOf: { fontSize: 15, fontWeight: '700', color: C.peach },
  tapHint: { fontSize: 13, color: C.muted, marginBottom: 16 },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: C.peach2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: 10, backgroundColor: C.teal, borderRadius: 5 },
  progressText: { fontSize: 13, color: C.muted },
  complete: {
    fontSize: 15,
    fontWeight: '800',
    color: C.teal,
    marginTop: 12,
    textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', marginTop: 16 },
  smallBtn: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginHorizontal: 6,
    backgroundColor: C.white,
  },
  smallBtnText: { fontSize: 14, fontWeight: '700', color: C.ink },
  targetRow: { flexDirection: 'row', marginBottom: 18 },
  targetChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingVertical: 14,
    marginRight: 8,
    backgroundColor: C.white,
    alignItems: 'center',
  },
  targetChipOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  targetChipText: { fontSize: 18, fontWeight: '800', color: C.ink },
  targetChipTextOn: { color: C.white },
  customRow: { flexDirection: 'row' },
  customInput: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
    marginRight: 10,
  },
  setBtn: {
    backgroundColor: C.teal,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBtnText: { color: C.white, fontSize: 15, fontWeight: '800' },
  error: { color: C.red, fontSize: 13, fontWeight: '600', marginTop: 8 },
});
