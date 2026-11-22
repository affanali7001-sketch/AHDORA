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
 * Voice is REAL: tapping "Voice suno" plays that ayah's tilawat
 * (EveryAyah, Mishary Rashid Alafasy, AlQuran Cloud CDN fallback),
 * reusing the same retry-once player pattern as QuranBook.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, PillButton } from '../components/ui';
import {
  everyAyahUrl,
  tilawatFallbackUrl,
} from '../lib/apiWorship';

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

type AudioItem = { uri: string; fallbackUri: string };

export default function LifeAyahsScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const soundRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<AudioItem[]>([]);
  const queueIndexRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopAudio(): Promise<void> {
    queueRef.current = [];
    queueIndexRef.current = 0;
    setPlayingRef(null);
    setAudioBusy(false);
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) sound.remove();
  }

  async function playAt(index: number): Promise<void> {
    const queue = queueRef.current;
    if (index >= queue.length) {
      await stopAudio();
      return;
    }
    const item = queue[index];
    if (!item) return;
    queueIndexRef.current = index;
    const old = soundRef.current;
    soundRef.current = null;
    if (old) old.remove();
    const tryLoad = (uri: string): AudioPlayer => {
      const player = createAudioPlayer({ uri }, { updateInterval: 500 });
      let retried = false;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.error) {
          if (uri === item.uri) {
            player.replace({ uri: item.fallbackUri });
            player.play();
          } else if (!retried) {
            retried = true;
            player.replace({ uri });
            player.play();
          } else {
            setAudioError(
              lang === 'hi'
                ? 'Audio nahi chal paya. Dobara try karo.'
                : 'Audio could not play. Try again.',
            );
            void stopAudio();
          }
          return;
        }
        if (status.isLoaded) setAudioBusy(false);
        if (status.didJustFinish) void playAt(queueIndexRef.current + 1);
      });
      player.play();
      return player;
    };
    try {
      soundRef.current = tryLoad(item.uri);
    } catch {
      try {
        soundRef.current = tryLoad(item.fallbackUri);
      } catch {
        setAudioError(
          lang === 'hi'
            ? 'Audio nahi chal paya. Dobara try karo.'
            : 'Audio could not play. Try again.',
        );
        await stopAudio();
      }
    }
  }

  async function toggleVoice(ayah: (typeof CURATED_AYAHS)[number]): Promise<void> {
    if (playingRef === ayah.reference) {
      await stopAudio();
      return;
    }
    setAudioError(null);
    setAudioBusy(true);
    await stopAudio();
    // Global ayah number = ayahs before this surah + ayah-in-surah.
    // The fallback CDN needs the global number; EveryAyah needs
    // surah + ayah-in-surah. Exact global numbers for these four
    // ayahs (verified: surah starts — Al-Baqarah 8, Ar-Ra'd 1708,
    // Taha 2349, Al-Mu'minun 2674 — from AlQuran Cloud's 1..6236
    // numbering).
    const GLOBAL_START: Record<number, number> = {
      2: 8,
      13: 1708,
      20: 2349,
      23: 2674,
    };
    const start = GLOBAL_START[ayah.surahNumber] ?? 0;
    const queue: AudioItem[] = [];
    for (let a = ayah.ayahStart; a <= ayah.ayahEnd; a += 1) {
      queue.push({
        uri: everyAyahUrl(ayah.surahNumber, a),
        fallbackUri: tilawatFallbackUrl(start + a - 1),
      });
    }
    queueRef.current = queue;
    setPlayingRef(ayah.reference);
    await playAt(0);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.lifeTitle}</Text>
      <Text style={T.sub}>{s.lifeSub}</Text>
      {audioError ? <Text style={T.error}>{audioError}</Text> : null}

      {CURATED_AYAHS.map((ayah) => {
        const theme = lang === 'hi' ? ayah.themeHi : ayah.themeEn;
        const playing = playingRef === ayah.reference;
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
            <View style={styles.footRow}>
              <Text style={styles.ref}>
                Surah {ayah.surah} · {ayah.reference}
              </Text>
              <PillButton
                label={
                  playing ? '■ Roko' : audioBusy && !playing ? '…' : '▶ Voice suno'
                }
                variant="ghost"
                small
                busy={audioBusy && playing}
                onPress={() => void toggleVoice(ayah)}
              />
            </View>
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
  ref: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, flex: 1 },
});
