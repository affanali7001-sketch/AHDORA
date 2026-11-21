/**
 * Life Ayahs — a SEPARATE section from the Quran Book.
 *
 * ONLY the four previously verified curated ayahs, copied exactly
 * from the web app's src/components/QuranDuas.tsx (Arabic,
 * transliteration, Hinglish meaning, English line, surah / para /
 * page references). No other verse is added here — the full Quran
 * lives in the Quran Book screen.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  line: '#E6ECE9',
};

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    note: string;
    para: string;
    page: string;
    meaning: string;
    showMore: string;
    showLess: string;
    openInBook: string;
  }
> = {
  en: {
    title: 'Life Ayahs',
    subtitle: 'Four verses to live by — how to live life.',
    note: 'Only these four verified ayahs are shown here. The full Quran is in the Quran Book.',
    para: 'Para',
    page: 'Page',
    meaning: 'Hinglish meaning',
    showMore: 'Show transliteration + English',
    showLess: 'Hide details',
    openInBook: 'Open in Quran Book →',
  },
  hi: {
    title: 'Life Ayahs',
    subtitle: 'Zindagi jeene ke liye chaar ayahs.',
    note: 'Yahan sirf ye chaar verified ayahs hain. Poora Quran, Quran Book me hai.',
    para: 'Para',
    page: 'Page',
    meaning: 'Hinglish matlab',
    showMore: 'Transliteration + English dikhao',
    showLess: 'Details chhupao',
    openInBook: 'Quran Book me kholo →',
  },
};

/** The four curated ayahs — verbatim from the web app (QuranDuas.tsx). */
const CURATED_AYAHS = [
  {
    title: 'Shaitani waswason se panaah',
    surah: 'Al-Mu’minun',
    surahNumber: 23,
    reference: '23:97–98',
    para: 18,
    pages: '348',
    arabic:
      'وَقُل رَّبِّ أَعُوذُ بِكَ مِنْ هَمَزَٰتِ ٱلشَّيَـٰطِينِ ۝ وَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ',
    transliteration:
      "Wa qul rabbi a'oodhu bika min hamazaatish-shayaateen. Wa a'oodhu bika rabbi an yahduroon.",
    meaning:
      'Ae mere Rab! Main shaitanon ke waswason se Teri panaah maangta hoon. Aur Ae mere Rab! Main Teri panaah maangta hoon is baat se ki woh mere paas aayein.',
    english: 'My Lord, I seek refuge in You from the whisperings of the devils.',
    category: 'Waswase aur panaah',
    type: 'Dua',
  },
  {
    title: 'Mushkil aur bojh ke waqt',
    surah: 'Al-Baqarah',
    surahNumber: 2,
    reference: '2:286',
    para: 3,
    pages: '49',
    arabic:
      'رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ ۖ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ',
    transliteration:
      "Rabbana la tu'aakhidhna in naseena aw akhta'na. Rabbana wa la tahmil 'alayna isran kama hamaltahu 'alal-lazeena min qablina. Rabbana wa la tuhammilna ma la taqata lana bih. Wa'fu 'anna, waghfir lana, warhamna.",
    meaning:
      'Ae hamare Rab! Agar hum bhool jaayein ya galti kar baithein toh humein na pakad. Hum par aisa bojh na daal jiski hum mein taaqat nahi. Humein maaf kar, humein bakhsh de aur hum par raham farma.',
    english: 'Our Lord, do not hold us accountable if we forget or make a mistake.',
    category: 'Maafi aur aasani',
    type: 'Selected dua portion',
  },
  {
    title: 'Dil khulne aur kaam aasaan hone ki dua',
    surah: 'Taha',
    surahNumber: 20,
    reference: '20:25–28',
    para: 16,
    pages: '313',
    arabic:
      'قَالَ رَبِّ ٱشْرَحْ لِى صَدْرِى ۝ وَيَسِّرْ لِىٓ أَمْرِى ۝ وَٱحْلُلْ عُقْدَةًۭ مِّن لِّسَانِى ۝ يَفْقَهُوا۟ قَوْلِى',
    transliteration:
      "Qaala rabbish-rah lee sadree. Wa yassir lee amree. Wahlul 'uqdatan min lisaanee. Yafqahoo qawlee.",
    meaning:
      'Ae mere Rab! Mera seena khol de, mera kaam mere liye aasaan kar de, meri zubaan ki girah khol de, taaki log meri baat samajh sakein.',
    english: 'My Lord, expand for me my chest and ease for me my task.',
    category: 'Aasani aur ilm',
    type: 'Dua',
  },
  {
    title: 'Dil ka sukoon',
    surah: 'Ar-Ra’d',
    surahNumber: 13,
    reference: '13:28',
    para: 13,
    pages: '252',
    arabic:
      'ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    transliteration:
      "Allazeena aamanoo wa tatma'innu quloobuhum bizikrillaah. Alaa bizikrillaahi tatma'innul-quloob.",
    meaning:
      'Jo log imaan laaye aur jinke dil Allah ke zikr se sukoon paate hain. Sun lo, Allah ke zikr hi se dilon ko sukoon milta hai.',
    english: 'Verily, in the remembrance of Allah do hearts find rest.',
    category: 'Sukoon aur zikr',
    type: 'Ayat, dua nahi',
  },
];

export default function LifeAyahsScreen({ lang, goTo }: ScreenProps) {
  const s = STRINGS[lang];
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.subtitle}</Text>
      <Text style={styles.note}>{s.note}</Text>

      {CURATED_AYAHS.map((ayah, index) => {
        const isOpen = expanded === index;
        return (
          <View key={ayah.reference} style={styles.card}>
            <View style={styles.chipRow}>
              <Text style={styles.chip}>{ayah.category}</Text>
              <Text style={styles.chipMuted}>{ayah.type}</Text>
            </View>
            <Text style={styles.cardTitle}>{ayah.title}</Text>
            <Text style={styles.ref}>
              {ayah.surah} · {ayah.reference} · {s.para} {ayah.para} · {s.page}{' '}
              {ayah.pages}
            </Text>
            <Text style={styles.arabic}>{ayah.arabic}</Text>
            <Text style={styles.label}>{s.meaning}</Text>
            <Text style={styles.meaning}>{ayah.meaning}</Text>
            {isOpen ? (
              <>
                <Text style={styles.translit}>{ayah.transliteration}</Text>
                <Text style={styles.english}>{ayah.english}</Text>
              </>
            ) : null}
            <Pressable
              onPress={() => setExpanded(isOpen ? null : index)}
              style={styles.toggleBtn}
              accessibilityRole="button"
            >
              <Text style={styles.toggleText}>{isOpen ? s.showLess : s.showMore}</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable
        onPress={() => goTo('quran')}
        style={styles.primaryBtn}
        accessibilityRole="button"
      >
        <Text style={styles.primaryBtnText}>{s.openInBook}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: 4 },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    backgroundColor: C.peach2,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    marginBottom: 18,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: {
    backgroundColor: C.teal,
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  chipMuted: { fontSize: 12, color: C.muted, alignSelf: 'center' },
  cardTitle: { fontSize: 19, fontWeight: '800', color: C.ink, marginBottom: 4 },
  ref: { fontSize: 13, color: C.muted, marginBottom: 14 },
  arabic: {
    fontSize: 23,
    lineHeight: 42,
    color: C.teal900,
    textAlign: 'right',
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 4 },
  meaning: { fontSize: 15, lineHeight: 23, color: C.ink, marginBottom: 10 },
  translit: {
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  english: { fontSize: 14, lineHeight: 21, color: C.ink },
  toggleBtn: { marginTop: 12, alignSelf: 'flex-start' },
  toggleText: { color: C.teal2, fontWeight: '700', fontSize: 14 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
});
