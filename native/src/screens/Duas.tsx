/**
 * Duas — verified duas from the live API (GET /api/duas, 22 duas).
 * Each dua carries its exact source (Quran, Sahih al-Bukhari,
 * Sahih Muslim, Sunan Abi Dawud, Jami' at-Tirmidhi, Musnad Ahmad).
 * Nothing is added or invented here — the list comes from the API.
 */
import { useCallback, useEffect, useState } from 'react';
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
import type { AppLanguage } from '../lib/strings';
import { fetchDuas, type Dua, type DuasResponse } from '../lib/apiWorship';

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
    search: string;
    all: string;
    loading: string;
    loadFailed: string;
    retry: string;
    noResults: string;
    when: string;
    meaning: string;
    source: string;
    practice: string;
    quranRef: string;
    note: string;
  }
> = {
  en: {
    title: 'Duas',
    subtitle: 'Verified duas for daily life, with their exact source.',
    search: 'Search duas…',
    all: 'All',
    loading: 'Loading duas…',
    loadFailed: 'Duas load nahi ho paye.',
    retry: 'Dobara try karo',
    noResults: 'Is topic ya search ke liye koi dua nahi mili.',
    when: 'When',
    meaning: 'Hinglish meaning',
    source: 'Source',
    practice: 'Practice',
    quranRef: 'Quran reference',
    note: 'Note',
  },
  hi: {
    title: 'Duas',
    subtitle: 'Roz-marra ki verified duas, unke exact source ke saath.',
    search: 'Dua dhoondho…',
    all: 'Sabhi',
    loading: 'Duas load ho rahi hain…',
    loadFailed: 'Duas load nahi ho paye.',
    retry: 'Dobara try karo',
    noResults: 'Is topic ya search ke liye koi dua nahi mili.',
    when: 'Kab',
    meaning: 'Hinglish matlab',
    source: 'Source',
    practice: 'Amal',
    quranRef: 'Quran reference',
    note: 'Note',
  },
};

export default function DuasScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const [data, setData] = useState<DuasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDuas(t || undefined);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.loadFailed);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(topic);
  }, [topic, load]);

  const duas: Dua[] = data?.duas ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? duas.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.source.toLowerCase().includes(q) ||
          (d.kind === 'dua' && d.meaning.toLowerCase().includes(q)),
      )
    : duas;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.subtitle}</Text>
      {data ? (
        <Text style={styles.count}>
          {data.count} duas · {data.source}
        </Text>
      ) : null}

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={s.search}
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {data ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => setTopic('')}
            style={[styles.chip, topic === '' && styles.chipOn]}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, topic === '' && styles.chipTextOn]}>{s.all}</Text>
          </Pressable>
          {data.topics.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTopic(t.id)}
              style={[styles.chip, topic === t.id && styles.chipOn]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, topic === t.id && styles.chipTextOn]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <ActivityIndicator color={C.teal} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => void load(topic)}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.note}>{s.noResults}</Text>
      ) : (
        filtered.map((dua) => {
          const isOpen = expanded === dua.id;
          return (
            <View key={dua.id} style={styles.card}>
              <Text style={styles.cardTitle}>{dua.title}</Text>
              <Text style={styles.when}>
                {s.when}: {dua.when}
              </Text>
              {dua.kind === 'dua' ? (
                <>
                  <Text style={styles.arabic}>{dua.arabic}</Text>
                  {isOpen ? (
                    <>
                      <Text style={styles.translit}>{dua.transliteration}</Text>
                      <Text style={styles.label}>{s.meaning}</Text>
                      <Text style={styles.meaning}>{dua.meaning}</Text>
                      {dua.note ? (
                        <>
                          <Text style={styles.label}>{s.note}</Text>
                          <Text style={styles.meaning}>{dua.note}</Text>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.quranRef}>
                    {s.quranRef}: {dua.quranSurahName} {dua.quranSurah}:
                    {dua.quranAyahStart}
                    {dua.quranAyahEnd !== dua.quranAyahStart
                      ? `–${dua.quranAyahEnd}`
                      : ''}
                  </Text>
                  {isOpen ? (
                    <>
                      <Text style={styles.label}>{s.practice}</Text>
                      <Text style={styles.meaning}>{dua.practice}</Text>
                      {dua.note ? (
                        <>
                          <Text style={styles.label}>{s.note}</Text>
                          <Text style={styles.meaning}>{dua.note}</Text>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
              <Text style={styles.source}>
                {s.source}: {dua.source}
              </Text>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : dua.id)}
                style={styles.toggleBtn}
                accessibilityRole="button"
              >
                <Text style={styles.toggleText}>
                  {isOpen ? '↑ Kam dikhao' : '↓ Poora padho'}
                </Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: 4 },
  count: { fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 17 },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    marginTop: 14,
    marginBottom: 12,
  },
  chipScroll: { marginBottom: 14, flexGrow: 0 },
  chipRow: { paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: C.white,
  },
  chipOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  chipText: { fontSize: 13, fontWeight: '700', color: C.ink },
  chipTextOn: { color: C.white },
  loader: { marginVertical: 40 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 4 },
  when: { fontSize: 13, color: C.muted, marginBottom: 12 },
  arabic: {
    fontSize: 22,
    lineHeight: 40,
    color: C.teal900,
    textAlign: 'right',
    marginBottom: 12,
  },
  translit: {
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 4 },
  meaning: { fontSize: 15, lineHeight: 23, color: C.ink, marginBottom: 10 },
  quranRef: { fontSize: 14, fontWeight: '700', color: C.teal, marginBottom: 10 },
  source: { fontSize: 12, color: C.muted, marginTop: 4 },
  toggleBtn: { marginTop: 10, alignSelf: 'flex-start' },
  toggleText: { color: C.teal2, fontWeight: '700', fontSize: 14 },
  note: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 24 },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
});
