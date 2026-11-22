/**
 * Life Ayahs — a SEPARATE section from the Quran Book.
 *
 * ONLY the four previously verified curated ayahs, in the preview's
 * order (Ar-Ra'd → Al-Baqarah → Taha → Al-Mu'minun). Arabic,
 * Hinglish meaning and English are copied exactly from the curated
 * set already in this file (web app QuranDuas.tsx); Al-Baqarah
 * 2:286 shows ONLY the selected portion, labelled as such.
 * No other verse is added — the full Quran lives in Quran Book.
 *
 * Voice is REAL and now plays through the GLOBAL audio manager
 * (quranAudio.ts, same as Quran Book): tapping "Voice suno" plays
 * that ayah's tilawat (EveryAyah, Mishary Rashid Alafasy, AlQuran
 * Cloud CDN fallback), tapping "Tarjuma suno" plays the Urdu
 * tarjuma (Shamshad Ali Khan). The audio shows in the MiniPlayer,
 * keeps playing in the background, obeys the sleep timer, and gets
 * the manager's seek fix. Continue chain (user request 2026-11-22):
 * while auto-play is on, a finished tilawat starts its tarjuma on
 * its own, and a finished tarjuma starts the NEXT ayah's tilawat —
 * through all four ayahs, then it stops. Turn auto-play off to
 * play just one voice.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, PillButton, Switch } from '../components/ui';
import { everyAyahUrl } from '../lib/apiWorship';
import {
  getQuranAudioState,
  setQuranAutoPlay,
  startLifeAyah,
  stopQuranAudio,
  subscribeQuranAudio,
  type LifeAyahRef,
  type QuranAudioState,
} from '../lib/quranAudio';

/** The four curated ayahs — verbatim curated text, preview order. */
const CURATED_AYAHS = [
  {
    themeHi: 'Dil ka sukoon',
    themeEn: 'Peace of the heart',
    surah: 'Ar-Ra’d',
    surahNumber: 13,
    ayahStart: 28,
    ayahEnd: 28,
    reference: '13:28',
    para: 13,
    page: 252,
    arabic:
      'ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    meaning:
      'Jo log imaan laaye aur jinke dil Allah ke zikr se sukoon paate hain. Sun lo, Allah ke zikr hi se dilon ko sukoon milta hai.',
    english: 'Verily, in the remembrance of Allah do hearts find rest.',
  },
  {
    themeHi: 'Mushkil waqt ki dua (chuna hua hissa)',
    themeEn: 'Dua for hard times (selected portion)',
    surah: 'Al-Baqarah',
    surahNumber: 2,
    ayahStart: 286,
    ayahEnd: 286,
    reference: '2:286',
    para: 3,
    page: 49,
    // Selected portion ONLY (the full ayah is longer) — verbatim
    // prefix of the curated 2:286 text, as in the preview.
    arabic: 'رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا',
    meaning:
      'Ae hamare Rabb! Agar hum bhool jaayein ya galti kar dein to humein na pakadna.',
    english: 'Our Lord! Do not hold us accountable if we forget or make a mistake.',
  },
  {
    themeHi: 'Padhai / bolne se pehle ki dua',
    themeEn: 'Dua before studying or speaking',
    surah: 'Taha',
    surahNumber: 20,
    ayahStart: 25,
    ayahEnd: 28,
    reference: '20:25–28',
    para: 16,
    page: 313,
    arabic:
      'قَالَ رَبِّ ٱشْرَحْ لِى صَدْرِى ۝ وَيَسِّرْ لِىٓ أَمْرِى ۝ وَٱحْلُلْ عُقْدَةًۭ مِّن لِّسَانِى ۝ يَفْقَهُوا۟ قَوْلِى',
    meaning:
      'Ae mere Rab! Mera seena khol de, mera kaam mere liye aasaan kar de, meri zubaan ki girah khol de, taaki log meri baat samajh sakein.',
    english: 'My Lord, expand for me my chest and ease for me my task.',
  },
  {
    themeHi: 'Waswason se hifazat',
    themeEn: 'Protection from whisperings',
    surah: 'Al-Mu’minun',
    surahNumber: 23,
    ayahStart: 97,
    ayahEnd: 98,
    reference: '23:97–98',
    para: 18,
    page: 348,
    arabic:
      'وَقُل رَّبِّ أَعُوذُ بِكَ مِنْ هَمَزَٰتِ ٱلشَّيَـٰطِينِ ۝ وَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ',
    meaning:
      'Ae mere Rab! Main shaitanon ke waswason se Teri panaah maangta hoon. Aur Ae mere Rab! Main Teri panaah maangta hoon is baat se ki woh mere paas aayein.',
    english: 'My Lord, I seek refuge in You from the whisperings of the devils.',
  },
];

/**
 * Global ayah number of each curated surah's first ayah (verified:
 * surah starts — Al-Baqarah 8, Ar-Ra'd 1708, Taha 2349,
 * Al-Mu'minun 2674 — from AlQuran Cloud's 1..6236 numbering).
 * The fallback CDN and the Urdu audio both need the global number.
 */
const GLOBAL_START: Record<number, number> = {
  2: 8,
  13: 1708,
  20: 2349,
  23: 2674,
};

/**
 * The continue-chain playlist: the same 4 ayahs, in screen order,
 * as manager refs. Passed to startLifeAyah so the manager can walk
 * tilawat → tarjuma → next ayah on its own (see quranAudio.ts).
 */
const LIFE_PLAYLIST: LifeAyahRef[] = CURATED_AYAHS.map((ayah) => ({
  surah: ayah.surahNumber,
  ayahStart: ayah.ayahStart,
  ayahEnd: ayah.ayahEnd,
  globalAyahStart: GLOBAL_START[ayah.surahNumber] ?? 0,
  title: `Life Ayah · ${ayah.surah} ${ayah.reference}`,
  titleTarjuma: `Life Ayah (Tarjuma) · ${ayah.surah} ${ayah.reference}`,
}));

export default function LifeAyahsScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  /** Global audio state (MiniPlayer shares the same manager). */
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());
  /** Which card the user tapped here (the manager does not track it). */
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  /** Which voice is playing for playingRef: tilawat or Urdu tarjuma. */
  const [playingMode, setPlayingMode] = useState<'tilawat' | 'tarjuma' | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeQuranAudio(setAudio);
    // Warm up the first tilawat audio (Ar-Ra'd 13:28) so the first
    // tap starts faster: a HEAD request warms the connection
    // without downloading audio on slow mobile data.
    // Fire-and-forget — a failure here must never affect the screen.
    void (async () => {
      try {
        await fetch(everyAyahUrl(13, 28), {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* Prefetch is best-effort only. */
      }
    })();
    // Unsubscribe only — do NOT stop the audio on unmount. The
    // global manager keeps playing in the background (MiniPlayer).
    return unsubscribe;
  }, []);

  async function toggleVoice(ayah: (typeof CURATED_AYAHS)[number]): Promise<void> {
    // Tapping the playing card's own Voice button stops it.
    if (playingRef === ayah.reference && playingMode === 'tilawat' && audio.hasAudio) {
      stopQuranAudio();
      return;
    }
    setPlayingRef(ayah.reference);
    setPlayingMode('tilawat');
    const index = CURATED_AYAHS.findIndex((a) => a.reference === ayah.reference);
    await startLifeAyah(
      ayah.surahNumber,
      ayah.ayahStart,
      ayah.ayahEnd,
      GLOBAL_START[ayah.surahNumber] ?? 0,
      'tilawat',
      `Life Ayah · ${ayah.surah} ${ayah.reference}`,
      LIFE_PLAYLIST,
      index < 0 ? 0 : index,
    );
  }

  /**
   * Tarjuma voice (user request 2026-11-22): the Urdu tarjuma of
   * the same ayahs, Shamshad Ali Khan (ur.khan, Islamic Network
   * CDN, 64 kbps only — verified 200), one Urdu mp3 per ayah in
   * the range, played back-to-back through the global manager.
   * No fallback host exists for ur.khan, so a failure retries the
   * same URI once (the manager's playAt rule).
   * The 2:286 card shows only the selected portion of the Arabic,
   * but the tarjuma audio is the full ayah's tarjuma — that is
   * the real tarjuma of the ayah, not a cut.
   */
  async function toggleTarjuma(ayah: (typeof CURATED_AYAHS)[number]): Promise<void> {
    // Tapping the playing card's own Tarjuma button stops it.
    if (playingRef === ayah.reference && playingMode === 'tarjuma' && audio.hasAudio) {
      stopQuranAudio();
      return;
    }
    setPlayingRef(ayah.reference);
    setPlayingMode('tarjuma');
    const index = CURATED_AYAHS.findIndex((a) => a.reference === ayah.reference);
    await startLifeAyah(
      ayah.surahNumber,
      ayah.ayahStart,
      ayah.ayahEnd,
      GLOBAL_START[ayah.surahNumber] ?? 0,
      'urdu',
      `Life Ayah (Tarjuma) · ${ayah.surah} ${ayah.reference}`,
      LIFE_PLAYLIST,
      index < 0 ? 0 : index,
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.lifeTitle}</Text>
      <Text style={T.sub}>{s.lifeSub}</Text>

      {/* Auto-play (continue chain): on — a finished tilawat starts
          its tarjuma, a finished tarjuma starts the next ayah. Off
          — each voice plays alone. Same global switch as Quran Book. */}
      <View style={styles.autoRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.autoTitle}>{s.autoPlay}</Text>
          <Text style={styles.autoNote}>{s.autoPlayNote}</Text>
        </View>
        <Switch value={audio.autoPlay} onValueChange={setQuranAutoPlay} />
      </View>

      {playingRef !== null && audio.error ? (
        <Text style={T.error}>{audio.error}</Text>
      ) : null}

      {CURATED_AYAHS.map((ayah) => {
        const theme = lang === 'hi' ? ayah.themeHi : ayah.themeEn;
        // A card counts as playing only while THIS screen's tap is
        // the active global audio — the hasAudio gate keeps a
        // Quran Book page from lighting up a card here, and a stop
        // from the MiniPlayer clears the display without any
        // extra state juggling.
        const playingTilawat =
          playingRef === ayah.reference && playingMode === 'tilawat' && audio.hasAudio;
        const playingTarjuma =
          playingRef === ayah.reference && playingMode === 'tarjuma' && audio.hasAudio;
        const playing = playingTilawat || playingTarjuma;
        return (
          <Card key={ayah.reference}>
            <View style={styles.headRow}>
              <Text style={styles.theme}>{theme}</Text>
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>
                  Para {ayah.para} · Page {ayah.page}
                </Text>
              </View>
            </View>
            <Text style={styles.arabic}>{ayah.arabic}</Text>
            <Text style={styles.meaning}>{ayah.meaning}</Text>
            <Text style={styles.english}>{ayah.english}</Text>
            <View style={styles.divider} />
            <Text style={styles.ref}>
              Surah {ayah.surah} · {ayah.reference}
            </Text>
            <View style={styles.voiceRow}>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={
                    playingTilawat ? '■ Roko' : audio.busy && playing ? '…' : '▶ Voice suno'
                  }
                  variant="ghost"
                  small
                  block
                  busy={audio.busy && playingTilawat}
                  onPress={() => void toggleVoice(ayah)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={playingTarjuma ? s.lifeTarjumaStop : s.lifeTarjuma}
                  variant="peach"
                  small
                  block
                  busy={audio.busy && playingTarjuma}
                  onPress={() => void toggleTarjuma(ayah)}
                />
              </View>
            </View>
            {audio.busy && playing ? (
              <Text style={styles.loadingText}>{s.audioLoading}</Text>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  theme: {
    flex: 1,
    fontFamily: F.sans,
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
  },
  metaTag: {
    backgroundColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  metaTagText: {
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    color: C.peachInk,
  },
  arabic: {
    fontFamily: F.arabic,
    fontSize: 22,
    lineHeight: 44,
    color: C.teal900,
    textAlign: 'right',
    marginTop: 12,
    marginBottom: 6,
  },
  meaning: {
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    color: C.teal700,
  },
  english: {
    fontFamily: F.sans,
    fontSize: 13.5,
    color: C.muted,
    lineHeight: 21,
    marginTop: 5,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  voiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  autoTitle: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.ink },
  autoNote: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 2 },
  loadingText: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  ref: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, flex: 1 },
});
