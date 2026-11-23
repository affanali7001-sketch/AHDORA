/**
 * Now Playing — full-screen Quran audio player, music-app style.
 *
 * Opened by tapping the MiniPlayer bar. The CURRENT mushaf page
 * (from the global audio state's page) is the "album art" on top —
 * real Uthmani Arabic from AlQuran Cloud, rendered exactly like the
 * Quran Book reader (cream page, teal frame, surah band, circled
 * ayah markers, playing ayah highlighted). Below it sits the SAME
 * Tilawah player as the Quran Book and the ParaBook (Mihrab layout),
 * and a button back into the book. Nothing else.
 *
 * The audio itself lives in the global manager (src/lib/quranAudio);
 * this screen only subscribes and drives it — playback survives
 * navigation, and leaving this screen never stops it.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { EmptyState, PillButton } from '../components/ui';
import TilawahPlayer from '../components/TilawahPlayer';
import {
  getQuranAudioState,
  subscribeQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';
import {
  fetchMushafPage,
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
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  en: {
    emptyTitle: 'No audio is playing right now',
    emptyBody: 'Play a page from the Quran Book and the player will show here.',
  },
  hi: {
    emptyTitle: 'Abhi koi audio nahi chal raha hai',
    emptyBody: 'Quran Book se koi page chalao, phir yahan player dikhega.',
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

  if (!audio.hasAudio) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
        <EmptyState title={s.emptyTitle} body={s.emptyBody} />
        <View style={styles.emptyBtn}>
          <PillButton
            label={shared.openQuran}
            variant="primary"
            block
            onPress={() => goTo('quran')}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
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
        <MushafPageView page={pageData} playingAyah={audio.playingAyah} />
      ) : null}

      {/* The SAME Tilawah player as the Quran Book and the ParaBook
          (Mihrab layout) — seek, transport, speed, repeat, sleep,
          reciter, mode, auto-play all live here, so this screen and
          the readers always agree. No tarjuma text is shown on this
          screen, so its translation toggle is hidden rather than
          offered as a dead switch. */}
      <TilawahPlayer
        lang={lang}
        page={audio.page}
        ayahs={pageData?.ayahs ?? []}
        showTranslation
        onTranslationChange={() => undefined}
        showTranslationToggle={false}
        onOpenList={() => goTo('quran')}
      />

      <View style={styles.openBtn}>
        <PillButton
          label={shared.openQuran}
          variant="peach"
          block
          onPress={() => goTo('reader')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  loader: { marginVertical: 40 },
  emptyBtn: { marginTop: 16 },
  errorCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginTop: 14,
  },
  /* ---- Mushaf page (same values as QuranBook.tsx) ---- */
  mushaf: {
    marginTop: 14,
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
  openBtn: { marginTop: 16 },
});
