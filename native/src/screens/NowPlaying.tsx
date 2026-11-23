/**
 * Tilawah — the Quran listening screen, Mihrab layout rebuilt from
 * scratch in AHDORA's own code (screenshot 11-33-42-51):
 *
 *   1. the dark navy Tilawah player card on top (the SAME shared
 *      player as the Quran Book and the ParaBook);
 *   2. under it, a preview of the mushaf page being played, with
 *      "Open in the reader ›" jumping into the full reader;
 *   3. a "Start from" surah list — tap any surah to start its
 *      tilawat from its first page (real navigation: the surah's
 *      first mushaf page is fetched and its tilawat starts there).
 *
 * The audio itself lives in the global manager (src/lib/quranAudio);
 * this screen only subscribes and drives it — playback survives
 * navigation, and leaving this screen never stops it.
 *
 * Honest limits, as documented: no cast target (no cast pill),
 * no offline reciter downloads (the reciter sheet has preview
 * only), Hafs only, per-ayah progress highlight only — no fake
 * word-by-word highlight is claimed anywhere here.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Input, PillButton } from '../components/ui';
import TilawahPlayer from '../components/TilawahPlayer';
import {
  getQuranAudioState,
  startQuranPage,
  subscribeQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';
import {
  fetchMushafPage,
  fetchSurahFirstPage,
  fetchSurahList,
  type MushafAyah,
  type MushafPage,
  type MushafSurahRef,
} from '../lib/apiWorship';

const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
/* Mihrab mushaf colours — same values as QuranBook.tsx. */
const MUSHAF_BG = '#FFFFFF';
const MUSHAF_INK = '#191814';

/** Screen-local labels with no global key in strings.ts. */
const STRINGS: Record<
  AppLanguage,
  {
    pageShort: (page: number) => string;
    surahAyahs: (n: number) => string;
    startFailed: string;
  }
> = {
  en: {
    pageShort: (page) => `p. ${page}`,
    surahAyahs: (n) => `${n} ayahs`,
    startFailed: 'That surah could not start. Try again.',
  },
  hi: {
    pageShort: (page) => `p. ${page}`,
    surahAyahs: (n) => `${n} aayat`,
    startFailed: 'Wo surah shuru nahi ho payi. Dobara try karo.',
  },
};

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndic(n: number): string {
  return String(n)
    .split('')
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join('');
}

/* ------------------------------------------------------------------ */
/* Mushaf page — same rendering as the Quran Book reader               */
/* ------------------------------------------------------------------ */

function MushafPageView({
  page,
  playingAyah,
}: {
  page: MushafPage;
  playingAyah: number | null;
}) {
  const segments: { surah: MushafSurahRef; ayahs: MushafAyah[] }[] = [];
  for (const a of page.ayahs) {
    const last = segments[segments.length - 1];
    if (last && last.surah.number === a.surah.number) last.ayahs.push(a);
    else segments.push({ surah: a.surah, ayahs: [a] });
  }
  const firstAyah = page.ayahs[0];
  const firstSeg = segments[0];
  return (
    <View style={styles.mushaf}>
      <View style={styles.mushafInner}>
        <View style={styles.stripe} />
        <Text style={styles.pageNo}>— {page.number} —</Text>
        {segments.map((seg) => {
          const startsHere = seg.ayahs[0]?.numberInSurah === 1;
          // Surah Al-Fatiha's ayah 1 IS the Bismillah: it is shown
          // as the separate Bismillah line, not again in the flow.
          const flowAyahs =
            seg.surah.number === 1 && startsHere ? seg.ayahs.slice(1) : seg.ayahs;
          return (
            <View key={`${seg.surah.number}-${seg.ayahs[0]?.numberInSurah ?? 0}`}>
              {startsHere ? (
                <View style={styles.bandOuter}>
                  <View style={styles.surahBand}>
                    <Text style={styles.surahBandArabic}>۞ {seg.surah.name} ۞</Text>
                  </View>
                </View>
              ) : null}
              {startsHere && seg.surah.number !== 9 ? (
                <Text style={styles.bismillah}>
                  {BISMILLAH}
                  {seg.surah.number === 1 ? (
                    <Text style={styles.marker}> {toArabicIndic(1)} </Text>
                  ) : null}
                </Text>
              ) : null}
              <Text style={styles.ayahFlow}>
                {flowAyahs.map((a) => (
                  <Text
                    key={a.number}
                    style={playingAyah === a.number ? styles.ayahPlaying : undefined}
                  >
                    {a.text.trim()}{' '}
                    <Text style={styles.marker}> {toArabicIndic(a.numberInSurah)} </Text>{' '}
                  </Text>
                ))}
              </Text>
            </View>
          );
        })}
        <View style={styles.stripe} />
        <View style={styles.mushafFoot}>
          <Text style={styles.footText}>PARA {firstAyah?.juz ?? ''}</Text>
          <Text style={styles.footText}>
            SURAH {firstSeg?.surah.englishName.toUpperCase() ?? ''}
          </Text>
          <Text style={styles.footText}>PAGE {page.number}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */

export default function NowPlayingScreen({ lang, goTo }: ScreenProps) {
  const shared = stringsFor(lang);
  const s = STRINGS[lang];
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());

  useEffect(() => subscribeQuranAudio(setAudio), []);

  /* --- mushaf page for the currently playing page (cached per page) --- */
  const pageCache = useRef(new Map<number, MushafPage>());
  const [pageData, setPageData] = useState<MushafPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const page = audio.page;
  useEffect(() => {
    const cached = pageCache.current.get(page);
    if (cached) {
      setPageData(cached);
      setPageLoading(false);
      setPageError(null);
      return;
    }
    let cancelled = false;
    setPageData(null);
    setPageLoading(true);
    setPageError(null);
    void fetchMushafPage(page)
      .then((data) => {
        if (cancelled) return;
        pageCache.current.set(page, data);
        setPageData(data);
        setPageLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setPageError(
          e instanceof Error ? e.message : 'Page load nahi ho paya. Dobara try karo.',
        );
        setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadTick]);

  /* --- "Start from" surah list (all 114, searchable) --- */
  const [surahs, setSurahs] = useState<MushafSurahRef[]>([]);
  const [surahQuery, setSurahQuery] = useState('');
  const [surahLoading, setSurahLoading] = useState(true);
  const [surahError, setSurahError] = useState<string | null>(null);
  const [startingSurah, setStartingSurah] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const listY = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchSurahList()
      .then((list) => {
        if (!cancelled) {
          setSurahs(list);
          setSurahLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSurahError(shared.loadFailed);
          setSurahLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Start a surah's tilawat from its first mushaf page. Real
   * navigation, not a page turn: the first page is fetched, then
   * its tilawat starts in the picked reciter. */
  async function startSurah(su: MushafSurahRef): Promise<void> {
    if (startingSurah !== null) return;
    setStartingSurah(su.number);
    setStartError(null);
    try {
      const firstPage = await fetchSurahFirstPage(su.number);
      await startQuranPage(firstPage, 'tilawat');
    } catch {
      setStartError(s.startFailed);
    } finally {
      setStartingSurah(null);
    }
  }

  const filteredSurahs = surahs.filter((su) => {
    const q = surahQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      su.englishName.toLowerCase().includes(q) ||
      su.englishNameTranslation.toLowerCase().includes(q) ||
      String(su.number) === q
    );
  });

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={L.scroll}
    >
      <Text style={T.title}>Tilawah</Text>

      {/* 1 — the SAME Tilawah player as the Quran Book and the
          ParaBook (Mihrab layout) — seek, transport, speed,
          repeat, sleep, reciter, auto-play all live here, so this
          screen and the readers always agree. No tarjuma text is
          shown on this screen, so its translation toggle is hidden
          rather than offered as a dead switch. The list pill
          scrolls down to the "Start from" list below. */}
      <TilawahPlayer
        lang={lang}
        page={audio.page}
        ayahs={pageData?.ayahs ?? []}
        showTranslation
        onTranslationChange={() => undefined}
        showTranslationToggle={false}
        onOpenList={() =>
          scrollRef.current?.scrollTo({ y: Math.max(0, listY.current - 8), animated: true })
        }
      />

      {/* 2 — mushaf page preview under the player, with
          "Open in the reader ›" into the full reader. */}
      {pageLoading ? (
        <ActivityIndicator color={C.teal500} size="large" style={styles.loader} />
      ) : pageError ? (
        <View style={styles.errorCard}>
          <Text style={T.error}>{pageError}</Text>
          <PillButton
            label={shared.retry}
            variant="primary"
            block
            onPress={() => setReloadTick((t) => t + 1)}
          />
        </View>
      ) : pageData ? (
        <View style={styles.previewWrap}>
          <View style={styles.previewHead}>
            <Text style={styles.previewPage}>{s.pageShort(pageData.number)}</Text>
            <Pressable
              onPress={() => goTo('reader')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.previewLink}>{shared.tilawahOpenReader} ›</Text>
            </Pressable>
          </View>
          <MushafPageView page={pageData} playingAyah={audio.playingAyah} />
        </View>
      ) : null}

      {/* 3 — "Start from": every surah, searchable; tapping one
          starts its tilawat from its first page. */}
      <View
        style={styles.startWrap}
        onLayout={(e) => {
          listY.current = e.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.sectionTitle}>{shared.tilawahStartFrom}</Text>
        <Input
          value={surahQuery}
          onChangeText={setSurahQuery}
          placeholder={shared.quranSearchLbl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {surahLoading ? (
          <ActivityIndicator color={C.teal500} size="large" style={styles.loader} />
        ) : surahError ? (
          <Text style={T.error}>{surahError}</Text>
        ) : (
          filteredSurahs.map((su) => {
            const playing = audio.playingSurah === su.number;
            const starting = startingSurah === su.number;
            return (
              <Pressable
                key={su.number}
                onPress={() => void startSurah(su)}
                disabled={startingSurah !== null}
                style={[styles.surahRow, playing && styles.surahRowPlaying]}
                accessibilityRole="button"
              >
                <View style={styles.surahNum}>
                  <Text style={styles.surahNumText}>{su.number}</Text>
                </View>
                <View style={styles.surahMeta}>
                  <Text style={styles.surahName}>{su.englishName}</Text>
                  <Text style={styles.surahSub}>{s.surahAyahs(su.numberOfAyahs)}</Text>
                </View>
                {starting ? (
                  <ActivityIndicator color={C.teal500} size="small" />
                ) : playing ? (
                  <Text style={styles.playingMark}>▶</Text>
                ) : null}
                <Text style={styles.surahArabic}>{su.name}</Text>
              </Pressable>
            );
          })
        )}
        {startError ? <Text style={T.error}>{startError}</Text> : null}
      </View>
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
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    fontFamily: F.sans,
    fontSize: 16.5,
    fontWeight: '800',
    color: C.ink,
    marginTop: 20,
    marginBottom: 10,
  },
  /* ---- Mushaf page preview (same values as QuranBook.tsx) ---- */
  previewWrap: { marginTop: 16 },
  previewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewPage: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '800',
    color: C.muted,
  },
  previewLink: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '800',
    color: C.teal700,
  },
  mushaf: {
    backgroundColor: MUSHAF_BG,
    borderWidth: 2.5,
    borderColor: C.teal900,
    borderRadius: 8,
    padding: 8,
    shadowColor: C.teal950,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  mushafInner: {
    borderWidth: 1.5,
    borderColor: C.teal700,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: MUSHAF_BG,
  },
  stripe: { height: 7, backgroundColor: 'rgba(31,94,73,0.16)', borderRadius: 3 },
  pageNo: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 4,
    color: C.teal700,
    textAlign: 'center',
    marginVertical: 10,
  },
  bandOuter: {
    borderWidth: 1,
    borderColor: C.teal700,
    padding: 3,
    marginHorizontal: 6,
  },
  surahBand: {
    borderWidth: 2,
    borderColor: C.teal900,
    backgroundColor: C.teal100,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  surahBandArabic: {
    fontFamily: F.arabic,
    fontSize: 25,
    lineHeight: 38,
    color: C.teal950,
    textAlign: 'center',
  },
  bismillah: {
    fontFamily: F.arabic,
    fontSize: 24,
    lineHeight: 46,
    color: MUSHAF_INK,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  ayahFlow: {
    fontFamily: F.arabic,
    fontSize: 23.5,
    lineHeight: 53,
    color: MUSHAF_INK,
    textAlign: 'justify',
    marginVertical: 6,
  },
  marker: {
    fontFamily: F.arabic,
    fontSize: 14.5,
    color: C.teal700,
    backgroundColor: C.teal100,
    borderRadius: 13,
  },
  ayahPlaying: { color: C.teal500 },
  mushafFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.line,
    borderStyle: 'dashed',
    marginTop: 10,
    paddingTop: 8,
  },
  footText: {
    fontFamily: F.sans,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: C.muted,
  },
  /* ---- "Start from" surah list ---- */
  startWrap: { marginTop: 4 },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  surahRowPlaying: { borderColor: C.teal700, backgroundColor: C.teal100 },
  surahNum: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  surahNumText: { fontFamily: F.sans, fontSize: 15, fontWeight: '800', color: C.teal900 },
  surahMeta: { flex: 1 },
  surahName: { fontFamily: F.sans, fontSize: 16, fontWeight: '700', color: C.ink },
  surahSub: { fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 },
  surahArabic: { fontFamily: F.arabic, fontSize: 20, color: C.teal900 },
  playingMark: { fontSize: 13, color: C.teal700, marginRight: 8 },
});
