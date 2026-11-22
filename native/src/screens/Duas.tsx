/**
 * Duas — verified duas from the live API (GET /api/duas, 22 duas).
 * Rendered in the approved preview's (§13) card format: theme title
 * + reference tag, Arabic, Hinglish meaning and transliteration,
 * all always visible — no search, no topic chips, no toggle, no
 * count line, no "When:" line, no "Source:" footer.
 *
 * Honest gap: the API's duas carry NO English translation field
 * (see src/lib/apiWorship.ts Dua type), so no English line is
 * shown — the real transliteration field is shown instead. Nothing
 * is invented to fill that slot.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { EmptyState } from '../components/ui';
import { fetchDuas, type Dua } from '../lib/apiWorship';

export default function DuasScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [duas, setDuas] = useState<Dua[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDuas();
      setDuas(res.duas);
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
        duas.map((dua) => (
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
