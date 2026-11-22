/**
 * Duas — verified duas from the live API (GET /api/duas, 132 duas).
 * Rendered in the approved preview's (§13) card format: theme title
 * + reference tag, Arabic, Hinglish meaning and transliteration,
 * all always visible — no toggle, no count line, no "When:" line,
 * no "Source:" footer.
 *
 * Category filter (horizontal chips from the API's topics list)
 * and a search input (title / meaning / transliteration,
 * case-insensitive) were added 2026-11-23 when the library grew
 * from 22 to 132 duas. A filter/search that matches nothing shows
 * an honest empty state — it never pretends the library is empty.
 *
 * Honest gap: the API's duas carry NO English translation field
 * (see src/lib/apiWorship.ts Dua type), so no English line is
 * shown — the real transliteration field is shown instead. Nothing
 * is invented to fill that slot.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { C, F, L, T } from '../lib/theme';
import { EmptyState } from '../components/ui';
import { fetchDuas, type Dua } from '../lib/apiWorship';

type Topic = { id: string; label: string; hinglish: string };

function matchesQuery(dua: Dua, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack =
    dua.kind === 'dua'
      ? `${dua.title} ${dua.meaning} ${dua.transliteration}`
      : `${dua.title} ${dua.practice} ${dua.quranSurahName}`;
  return haystack.toLowerCase().includes(q);
}

export default function DuasScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [duas, setDuas] = useState<Dua[] | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDuas();
      setDuas(res.duas);
      setTopics(res.topics);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : lang === 'hi'
            ? 'Duas load nahi ho paye.'
            : 'Duas could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleDuas = useMemo(() => {
    if (!duas) return null;
    return duas.filter(
      (dua) =>
        (selectedTopic === 'all' || dua.topics.includes(selectedTopic)) &&
        matchesQuery(dua, query),
    );
  }, [duas, selectedTopic, query]);

  const allLabel = lang === 'hi' ? 'Sabhi' : 'All';
  const searchPlaceholder =
    lang === 'hi' ? 'Dua dhoondho… (jaise: neend, shukr)' : 'Search duas… (e.g. sleep, gratitude)';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.duaTitle}</Text>
      <Text style={T.sub}>{s.duaSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal500} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={T.error}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={styles.retryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : !duas || duas.length === 0 ? (
        <EmptyState
          title={lang === 'hi' ? 'Koi dua nahi mili.' : 'No duas found.'}
          body={
            lang === 'hi'
              ? 'Internet check karke dobara try karo.'
              : 'Check your connection and try again.'
          }
        />
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={C.muted}
            style={styles.search}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel={searchPlaceholder}
          />
          {topics.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chips}
              contentContainerStyle={styles.chipsContent}
            >
              <Pressable
                onPress={() => setSelectedTopic('all')}
                style={[styles.chip, selectedTopic === 'all' && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedTopic === 'all' }}
              >
                <Text
                  style={[styles.chipText, selectedTopic === 'all' && styles.chipTextActive]}
                >
                  {allLabel}
                </Text>
              </Pressable>
              {topics.map((topic) => {
                const active = selectedTopic === topic.id;
                return (
                  <Pressable
                    key={topic.id}
                    onPress={() => setSelectedTopic(topic.id)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {topic.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {!visibleDuas || visibleDuas.length === 0 ? (
            <EmptyState
              title={lang === 'hi' ? 'Isme koi dua nahi mili.' : 'No dua matches.'}
              body={
                lang === 'hi'
                  ? 'Koi aur category ya shabd try karo.'
                  : 'Try a different category or word.'
              }
            />
          ) : (
            visibleDuas.map((dua) => (
              <View key={dua.id} style={styles.card}>
                <View style={styles.headRow}>
                  <Text style={styles.cardTitle}>{dua.title}</Text>
                  <View style={styles.refTag}>
                    <Text style={styles.refTagText}>{dua.source}</Text>
                  </View>
                </View>
                {dua.kind === 'dua' ? (
                  <>
                    <Text style={styles.arabic}>{dua.arabic}</Text>
                    <Text style={styles.translit}>{dua.transliteration}</Text>
                    <Text style={styles.meaning}>{dua.meaning}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.quranRef}>
                      {dua.quranSurahName} {dua.quranSurah}:{dua.quranAyahStart}
                      {dua.quranAyahEnd !== dua.quranAyahStart
                        ? `–${dua.quranAyahEnd}`
                        : ''}
                    </Text>
                    <Text style={styles.meaning}>{dua.practice}</Text>
                  </>
                )}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  loader: { marginVertical: 40 },
  errorCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginTop: 16,
    alignItems: 'center',
  },
  retryBtn: {
    backgroundColor: C.teal700,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 12,
  },
  retryText: { fontFamily: F.sans, color: C.white, fontSize: 15, fontWeight: '800' },
  search: {
    backgroundColor: C.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 14,
    fontFamily: F.sans,
    fontSize: 14.5,
    color: C.ink,
  },
  chips: { marginTop: 12, marginHorizontal: -18, paddingHorizontal: 18 },
  chipsContent: { gap: 8, paddingRight: 16 },
  chip: {
    backgroundColor: C.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: C.teal700, borderColor: C.teal700 },
  chipText: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: C.teal700,
  },
  chipTextActive: { color: C.white },
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginTop: 12,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontFamily: F.sans,
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
  },
  refTag: {
    backgroundColor: C.teal100,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  refTagText: {
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    color: C.teal900,
  },
  arabic: {
    fontFamily: F.arabic,
    fontSize: 21,
    lineHeight: 42,
    color: C.teal900,
    textAlign: 'right',
    marginTop: 12,
    marginBottom: 6,
  },
  translit: {
    fontFamily: F.sans,
    fontSize: 13.5,
    lineHeight: 21,
    color: C.muted,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  meaning: {
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    color: C.teal700,
  },
  quranRef: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 12,
    marginBottom: 6,
  },
});
