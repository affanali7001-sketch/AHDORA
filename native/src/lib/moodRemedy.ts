/**
 * Mood Remedy — "How are you feeling?" check-in + Quran-based remedies.
 *
 * Idea inspired by Noor Connect's "Quick Remedy" (12 moods → remedies);
 * NO Noor code or data copied (GPL v3; AHDORA is MIT). Every remedy
 * below is AHDORA's own verified content:
 *
 * - Ayahs: verified live 2026-11-23 via AlQuran Cloud
 *   (/v1/ayah/{ref}/editions/quran-uthmani,en.sahih). Arabic is the
 *   Uthmani text, English is Sahih International, verbatim.
 * - Duas/dhikr: copied verbatim from the verified library
 *   (api/src/lib/duasData.ts) — Arabic + transliteration + Hinglish
 *   meaning + exact source. No English translation was invented for
 *   duas (the library has Hinglish meanings only).
 *
 * Long ayahs (2:286, 13:11, 65:3, 40:60, 12:87) show the key clause
 * as the remedy text, labelled with quoteNote, with the FULL verified
 * text kept in fullArabic/fullTranslation and shown on tap.
 * 1:6: the API's Sahih text ends with a stray " -" (sentence continues
 * into 1:7); the standard rendering "Guide us to the straight path."
 * is used here.
 *
 * Deliberately LEFT OUT (could not be verified): no anger-specific
 * dua exists in the library (Angry uses patience/ta'awwudh items
 * only, 4 remedies); no loneliness-specific dua (Lonely uses
 * nearness ayahs only); no standalone hadith items; the da'if
 * "insomnia dua" and 'Allahumma ajirni minan-nar' 7x are excluded
 * by the library itself.
 *
 * Storage (per-user AsyncStorage, hifz.ts convention):
 *   `mood:checkins:<uid>`  → JSON array of MoodCheckin (one per day;
 *                              a second check-in the same day replaces
 *                              today's entry — never faked, never counted)
 *   `mood:favorites:<uid>` → JSON array of remedy ids
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayDateKey } from './tasbih';

export { todayDateKey };

export type MoodId =
  | 'anxious'
  | 'sad'
  | 'happy'
  | 'lost'
  | 'grateful'
  | 'tired'
  | 'stressed'
  | 'angry'
  | 'confused'
  | 'lonely'
  | 'sick'
  | 'motivated';

export type MoodAyahRemedy = {
  kind: 'ayah';
  /** Stable id, e.g. 'ayah-13-28'. Also the favorites key. */
  id: string;
  surah: number;
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  /** e.g. 'Quran 13:28' or 'Quran 20:25–28'. */
  reference: string;
  /** Text shown on the card: the full ayah, or the key clause for long ayahs. */
  arabic: string;
  /** Sahih International English for the shown text. */
  translation: string;
  /** Full verified text when `arabic` is only a clause. */
  fullArabic?: string;
  fullTranslation?: string;
  /** e.g. 'Opening of Quran 2:286' — shown when the card is a clause. */
  quoteNote?: string;
};

export type MoodDuaRemedy = {
  kind: 'dua' | 'dhikr';
  /** Dua id from the verified library, e.g. 'pareshani-ghabrahat'. */
  id: string;
  /** Hinglish title from the library. */
  title: string;
  arabic: string;
  transliteration: string;
  /** Hinglish meaning, verbatim from the library. */
  meaning: string;
  /** Exact source, e.g. 'Sahih al-Bukhari 6369'. */
  source: string;
};

export type MoodRemedy = MoodAyahRemedy | MoodDuaRemedy;

export type Mood = {
  id: MoodId;
  emoji: string;
  labelEn: string;
  labelHi: string;
  remedies: MoodRemedy[];
};

export type MoodCheckin = {
  /** Local date key YYYY-MM-DD. */
  date: string;
  mood: MoodId;
};

/**
 * Global ayah number of each surah's first ayah (1..6236 numbering,
 * verified from AlQuran Cloud's /v1/surah list 2026-11-23; cross-checked
 * with LifeAyahs.tsx: 2→8, 13→1708, 20→2349, 23→2674).
 * Needed by startLifeAyah for the Play button.
 */
export const SURAH_GLOBAL_START: Record<number, number> = {
  1: 1,
  2: 8,
  12: 1597,
  13: 1708,
  14: 1751,
  16: 1902,
  17: 2030,
  20: 2349,
  23: 2674,
  26: 2933,
  29: 3341,
  31: 3470,
  39: 4059,
  40: 4134,
  50: 4631,
  53: 4785,
  65: 5218,
  93: 6080,
  94: 6091,
};

/** Global (1..6236) number of an ayah inside a surah. */
export function globalAyahStart(surah: number, ayah: number): number {
  return (SURAH_GLOBAL_START[surah] ?? 0) + ayah - 1;
}

/* ------------------------------------------------------------------ */
/* Verified ayahs (AlQuran Cloud, 2026-11-23)                        */
/* ------------------------------------------------------------------ */

const AYAHS: Record<string, MoodAyahRemedy> = {
  'ayah-13-28': {
    kind: 'ayah',
    id: 'ayah-13-28',
    surah: 13,
    surahName: "Ar-Ra'd",
    ayahStart: 28,
    ayahEnd: 28,
    reference: 'Quran 13:28',
    arabic: 'ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    translation:
      'Those who have believed and whose hearts are assured by the remembrance of Allah. Unquestionably, by the remembrance of Allah hearts are assured.',
  },
  'ayah-2-286': {
    kind: 'ayah',
    id: 'ayah-2-286',
    surah: 2,
    surahName: 'Al-Baqarah',
    ayahStart: 286,
    ayahEnd: 286,
    reference: 'Quran 2:286',
    arabic: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation:
      "Allah does not charge a soul except [with that within] its capacity.",
    fullArabic:
      'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ ۖ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ ۚ أَنتَ مَوْلَىٰنَا فَٱنصُرْنَا عَلَى ٱلْقَوْمِ ٱلْكَٰفِرِينَ',
    fullTranslation:
      "Allah does not charge a soul except [with that within] its capacity. It will have [the consequence of] what [good] it has gained, and it will bear [the consequence of] what [evil] it has earned. 'Our Lord, do not impose blame upon us if we have forgotten or erred. Our Lord, and lay not upon us a burden like that which You laid upon those before us. Our Lord, and burden us not with that which we have no ability to bear. And pardon us; and forgive us; and have mercy upon us. You are our protector, so give us victory over the disbelieving people.'",
    quoteNote: 'Opening of Quran 2:286',
  },
  'ayah-20-25-28': {
    kind: 'ayah',
    id: 'ayah-20-25-28',
    surah: 20,
    surahName: 'Taha',
    ayahStart: 25,
    ayahEnd: 28,
    reference: 'Quran 20:25–28',
    arabic:
      'قَالَ رَبِّ ٱشْرَحْ لِى صَدْرِى\nوَيَسِّرْ لِىٓ أَمْرِى\nوَٱحْلُلْ عُقْدَةًۭ مِّن لِّسَانِى\nيَفْقَهُوا۟ قَوْلِى',
    translation:
      "[Moses] said, 'My Lord, expand for me my breast [with assurance]'\n'And ease for me my task'\n'And untie the knot from my tongue'\n'That they may understand my speech.'",
  },
  'ayah-23-97-98': {
    kind: 'ayah',
    id: 'ayah-23-97-98',
    surah: 23,
    surahName: "Al-Mu'minun",
    ayahStart: 97,
    ayahEnd: 98,
    reference: 'Quran 23:97–98',
    arabic:
      'وَقُل رَّبِّ أَعُوذُ بِكَ مِنْ هَمَزَٰتِ ٱلشَّيَٰطِينِ\nوَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ',
    translation:
      "And say, 'My Lord, I seek refuge in You from the incitements of the devils,'\n'And I seek refuge in You, my Lord, lest they be present with me.'",
  },
  'ayah-94-5': {
    kind: 'ayah',
    id: 'ayah-94-5',
    surah: 94,
    surahName: 'Ash-Sharh',
    ayahStart: 5,
    ayahEnd: 5,
    reference: 'Quran 94:5',
    arabic: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship [will be] ease.',
  },
  'ayah-94-6': {
    kind: 'ayah',
    id: 'ayah-94-6',
    surah: 94,
    surahName: 'Ash-Sharh',
    ayahStart: 6,
    ayahEnd: 6,
    reference: 'Quran 94:6',
    arabic: 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    translation: 'Indeed, with hardship [will be] ease.',
  },
  'ayah-39-53': {
    kind: 'ayah',
    id: 'ayah-39-53',
    surah: 39,
    surahName: 'Az-Zumar',
    ayahStart: 53,
    ayahEnd: 53,
    reference: 'Quran 39:53',
    arabic:
      '۞ قُلْ يَٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغْفِرُ ٱلذُّنُوبَ جَمِيعًا ۚ إِنَّهُۥ هُوَ ٱلْغَفُورُ ٱلرَّحِيمُ',
    translation:
      "Say, 'O My servants who have transgressed against themselves [by sinning], do not despair of the mercy of Allah. Indeed, Allah forgives all sins. Indeed, it is He who is the Forgiving, the Merciful.'",
  },
  'ayah-14-7': {
    kind: 'ayah',
    id: 'ayah-14-7',
    surah: 14,
    surahName: 'Ibrahim',
    ayahStart: 7,
    ayahEnd: 7,
    reference: 'Quran 14:7',
    arabic:
      'وَإِذْ تَأَذَّنَ رَبُّكُمْ لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ ۖ وَلَئِن كَفَرْتُمْ إِنَّ عَذَابِى لَشَدِيدٌ',
    translation:
      "And [remember] when your Lord proclaimed, 'If you are grateful, I will surely increase you [in favor]; but if you deny, indeed, My punishment is severe.'",
  },
  'ayah-2-186': {
    kind: 'ayah',
    id: 'ayah-2-186',
    surah: 2,
    surahName: 'Al-Baqarah',
    ayahStart: 186,
    ayahEnd: 186,
    reference: 'Quran 2:186',
    arabic:
      'وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا۟ لِى وَلْيُؤْمِنُوا۟ بِى لَعَلَّهُمْ يَرْشُدُونَ',
    translation:
      'And when My servants ask you, [O Muhammad], concerning Me — indeed I am near. I respond to the invocation of the supplicant when he calls upon Me. So let them respond to Me [by obedience] and believe in Me that they may be [rightly] guided.',
  },
  'ayah-1-6': {
    kind: 'ayah',
    id: 'ayah-1-6',
    surah: 1,
    surahName: 'Al-Fatiha',
    ayahStart: 6,
    ayahEnd: 6,
    reference: 'Quran 1:6',
    arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
    translation: 'Guide us to the straight path.',
  },
  'ayah-50-16': {
    kind: 'ayah',
    id: 'ayah-50-16',
    surah: 50,
    surahName: 'Qaf',
    ayahStart: 16,
    ayahEnd: 16,
    reference: 'Quran 50:16',
    arabic:
      'وَلَقَدْ خَلَقْنَا ٱلْإِنسَٰنَ وَنَعْلَمُ مَا تُوَسْوِسُ بِهِۦ نَفْسُهُۥ ۖ وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ ٱلْوَرِيدِ',
    translation:
      'And We have already created man and know what his soul whispers to him, and We are closer to him than [his] jugular vein',
  },
  'ayah-26-80': {
    kind: 'ayah',
    id: 'ayah-26-80',
    surah: 26,
    surahName: "Ash-Shu'ara",
    ayahStart: 80,
    ayahEnd: 80,
    reference: 'Quran 26:80',
    arabic: 'وَإِذَا مَرِضْتُ فَهُوَ يَشْفِينِ',
    translation: 'And when I am ill, it is He who cures me',
  },
  'ayah-13-11': {
    kind: 'ayah',
    id: 'ayah-13-11',
    surah: 13,
    surahName: "Ar-Ra'd",
    ayahStart: 11,
    ayahEnd: 11,
    reference: 'Quran 13:11',
    arabic: 'إِنَّ ٱللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا۟ مَا بِأَنفُسِهِمْ',
    translation:
      'Indeed, Allah will not change the condition of a people until they change what is in themselves.',
    fullArabic:
      'لَهُۥ مُعَقِّبَٰتٌۭ مِّنۢ بَيْنِ يَدَيْهِ وَمِنْ خَلْفِهِۦ يَحْفَظُونَهُۥ مِنْ أَمْرِ ٱللَّهِ ۗ إِنَّ ٱللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا۟ مَا بِأَنفُسِهِمْ ۗ وَإِذَآ أَرَادَ ٱللَّهُ بِقَوْمٍۢ سُوٓءًۭا فَلَا مَرَدَّ لَهُۥ ۚ وَمَا لَهُم مِّن دُونِهِۦ مِن وَالٍ',
    fullTranslation:
      'For each one are successive [angels] before and behind him who protect him by the decree of Allah. Indeed, Allah will not change the condition of a people until they change what is in themselves. And when Allah intends for a people ill, there is no repelling it. And there is not for them besides Him any patron.',
    quoteNote: 'From Quran 13:11',
  },
  'ayah-53-39': {
    kind: 'ayah',
    id: 'ayah-53-39',
    surah: 53,
    surahName: 'An-Najm',
    ayahStart: 39,
    ayahEnd: 39,
    reference: 'Quran 53:39',
    arabic: 'وَأَن لَّيْسَ لِلْإِنسَٰنِ إِلَّا مَا سَعَىٰ',
    translation:
      'And that there is not for man except that [good] for which he strives',
  },
  'ayah-94-7': {
    kind: 'ayah',
    id: 'ayah-94-7',
    surah: 94,
    surahName: 'Ash-Sharh',
    ayahStart: 7,
    ayahEnd: 7,
    reference: 'Quran 94:7',
    arabic: 'فَإِذَا فَرَغْتَ فَٱنصَبْ',
    translation: 'So when you have finished [your duties], then stand up [for worship].',
  },
  'ayah-94-8': {
    kind: 'ayah',
    id: 'ayah-94-8',
    surah: 94,
    surahName: 'Ash-Sharh',
    ayahStart: 8,
    ayahEnd: 8,
    reference: 'Quran 94:8',
    arabic: 'وَإِلَىٰ رَبِّكَ فَٱرْغَب',
    translation: "And to your Lord direct [your] longing.",
  },
  'ayah-2-152': {
    kind: 'ayah',
    id: 'ayah-2-152',
    surah: 2,
    surahName: 'Al-Baqarah',
    ayahStart: 152,
    ayahEnd: 152,
    reference: 'Quran 2:152',
    arabic: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ',
    translation:
      'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
  },
  'ayah-3-139': {
    kind: 'ayah',
    id: 'ayah-3-139',
    surah: 3,
    surahName: 'Aal-e-Imran',
    ayahStart: 139,
    ayahEnd: 139,
    reference: 'Quran 3:139',
    arabic: 'وَلَا تَهِنُوا۟ وَلَا تَحْزَنُوا۟ وَأَنتُمُ ٱلْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
    translation:
      'So do not weaken and do not grieve, and you will be superior if you are [true] believers.',
  },
  'ayah-65-3': {
    kind: 'ayah',
    id: 'ayah-65-3',
    surah: 65,
    surahName: 'At-Talaq',
    ayahStart: 3,
    ayahEnd: 3,
    reference: 'Quran 65:3',
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ',
    translation: 'And whoever relies upon Allah — then He is sufficient for him.',
    fullArabic:
      'وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۚ إِنَّ ٱللَّهَ بَٰلِغُ أَمْرِهِۦ ۚ قَدْ جَعَلَ ٱللَّهُ لِكُلِّ شَىْءٍۢ قَدْرًا',
    fullTranslation:
      'And will provide for him from where he does not expect. And whoever relies upon Allah — then He is sufficient for him. Indeed, Allah will accomplish His purpose. Allah has already set for everything a [decreed] extent.',
    quoteNote: 'From Quran 65:3',
  },
  'ayah-93-5': {
    kind: 'ayah',
    id: 'ayah-93-5',
    surah: 93,
    surahName: 'Ad-Duhaa',
    ayahStart: 5,
    ayahEnd: 5,
    reference: 'Quran 93:5',
    arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ',
    translation: 'And your Lord is going to give you, and you will be satisfied.',
  },
  'ayah-29-69': {
    kind: 'ayah',
    id: 'ayah-29-69',
    surah: 29,
    surahName: 'Al-Ankabut',
    ayahStart: 69,
    ayahEnd: 69,
    reference: 'Quran 29:69',
    arabic:
      'وَٱلَّذِينَ جَٰهَدُوا۟ فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا ۚ وَإِنَّ ٱللَّهَ لَمَعَ ٱلْمُحْسِنِينَ',
    translation:
      'And those who strive for Us — We will surely guide them to Our ways. And indeed, Allah is with the doers of good.',
  },
  'ayah-40-60': {
    kind: 'ayah',
    id: 'ayah-40-60',
    surah: 40,
    surahName: 'Ghafir',
    ayahStart: 60,
    ayahEnd: 60,
    reference: 'Quran 40:60',
    arabic: 'وَقَالَ رَبُّكُمُ ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ',
    translation: "And your Lord says, 'Call upon Me; I will respond to you.'",
    fullArabic:
      'وَقَالَ رَبُّكُمُ ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ ۚ إِنَّ ٱلَّذِينَ يَسْتَكْبِرُونَ عَنْ عِبَادَتِى سَيَدْخُلُونَ جَهَنَّمَ دَاخِرِينَ',
    fullTranslation:
      "And your Lord says, 'Call upon Me; I will respond to you.' Indeed, those who disdain My worship will enter Hell [rendered] contemptible.",
    quoteNote: 'Opening of Quran 40:60',
  },
  'ayah-16-97': {
    kind: 'ayah',
    id: 'ayah-16-97',
    surah: 16,
    surahName: 'An-Nahl',
    ayahStart: 97,
    ayahEnd: 97,
    reference: 'Quran 16:97',
    arabic:
      'مَنْ عَمِلَ صَٰلِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌۭ فَلَنُحْيِيَنَّهُۥ حَيَوٰةًۭ طَيِّبَةًۭ ۖ وَلَنَجْزِيَنَّهُمْ أَجْرَهُم بِأَحْسَنِ مَا كَانُوا۟ يَعْمَلُونَ',
    translation:
      'Whoever does righteousness, whether male or female, while he is a believer — We will surely cause him to live a good life, and We will surely give them their reward [in the Hereafter] according to the best of what they used to do.',
  },
  'ayah-2-153': {
    kind: 'ayah',
    id: 'ayah-2-153',
    surah: 2,
    surahName: 'Al-Baqarah',
    ayahStart: 153,
    ayahEnd: 153,
    reference: 'Quran 2:153',
    arabic:
      'يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ',
    translation:
      'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.',
  },
  'ayah-31-17': {
    kind: 'ayah',
    id: 'ayah-31-17',
    surah: 31,
    surahName: 'Luqman',
    ayahStart: 17,
    ayahEnd: 17,
    reference: 'Quran 31:17',
    arabic:
      'يَٰبُنَىَّ أَقِمِ ٱلصَّلَوٰةَ وَأْمُرْ بِٱلْمَعْرُوفِ وَٱنْهَ عَنِ ٱلْمُنكَرِ وَٱصْبِرْ عَلَىٰ مَآ أَصَابَكَ ۖ إِنَّ ذَٰلِكَ مِنْ عَزْمِ ٱلْأُمُورِ',
    translation:
      'O my son, establish prayer, enjoin what is right, forbid what is wrong, and be patient over what befalls you. Indeed, [all] that is of the matters [requiring] determination.',
  },
  'ayah-12-87': {
    kind: 'ayah',
    id: 'ayah-12-87',
    surah: 12,
    surahName: 'Yusuf',
    ayahStart: 87,
    ayahEnd: 87,
    reference: 'Quran 12:87',
    arabic: 'وَلَا تَا۟يْـَٔسُوا۟ مِن رَّوْحِ ٱللَّهِ',
    translation: 'Despair not of relief from Allah.',
    fullArabic:
      'يَٰبَنِىَّ ٱذْهَبُوا۟ فَتَحَسَّسُوا۟ مِن يُوسُفَ وَأَخِيهِ وَلَا تَا۟يْـَٔسُوا۟ مِن رَّوْحِ ٱللَّهِ ۖ إِنَّهُۥ لَا يَا۟يْـَٔسُ مِن رَّوْحِ ٱللَّهِ إِلَّا ٱلْقَوْمُ ٱلْكَٰفِرُونَ',
    fullTranslation:
      'O my sons, go and find out about Joseph and his brother and despair not of relief from Allah. Indeed, no one despairs of relief from Allah except the disbelieving people.',
    quoteNote: 'From Quran 12:87',
  },
  'ayah-17-82': {
    kind: 'ayah',
    id: 'ayah-17-82',
    surah: 17,
    surahName: 'Al-Isra',
    ayahStart: 82,
    ayahEnd: 82,
    reference: 'Quran 17:82',
    arabic:
      'وَنُنَزِّلُ مِنَ ٱلْقُرْءَانِ مَا هُوَ شِفَآءٌۭ وَرَحْمَةٌۭ لِّلْمُؤْمِنِينَ ۙ وَلَا يَزِيدُ ٱلظَّٰلِمِينَ إِلَّا خَسَارًا',
    translation:
      "And We send down of the Qur'an that which is healing and mercy for the believers, but it does not increase the wrongdoers except in loss.",
  },
};

/* ------------------------------------------------------------------ */
/* Verified duas / dhikr (duasData.ts, verbatim)                      */
/* ------------------------------------------------------------------ */

const DUAS: Record<string, MoodDuaRemedy> = {
  'pareshani-ghabrahat': {
    kind: 'dua',
    id: 'pareshani-ghabrahat',
    title: 'Fikr aur gham se panaah',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    transliteration:
      "Allahumma inni a'udhu bika minal-hammi wal-hazani, wal-'ajzi wal-kasali, wal-jubni wal-bukhli, wa dala'id-dayni wa ghalabatir-rijal.",
    meaning:
      'Ae Allah! Main Teri panaah maangta hoon fikr aur gham se, be-basi aur susti se, buzdili aur kanjoosi se, qarz ke bojh se aur logon ke ghalbe se.',
    source: 'Sahih al-Bukhari 6369',
  },
  'allahumma-inni-abduka': {
    kind: 'dua',
    id: 'allahumma-inni-abduka',
    title: 'Bande ki dua — Quran dil ka noor bane',
    arabic:
      'اللَّهُمَّ إِنِّي عَبْدُكَ، ابْنُ عَبْدِكَ، ابْنُ أَمَتِكَ، نَاصِيَتِي بِيَدِكَ، مَاضٍ فِيَّ حُكْمُكَ، عَدْلٌ فِيَّ قَضَاؤُكَ، أَسْأَلُكَ بِكُلِّ اسْمٍ هُوَ لَكَ سَمَّيْتَ بِهِ نَفْسَكَ، أَوْ أَنْزَلْتَهُ فِي كِتَابِكَ، أَوْ عَلَّمْتَهُ أَحَدًا مِنْ خَلْقِكَ، أَوِ اسْتَأْثَرْتَ بِهِ فِي عِلْمِ الْغَيْبِ عِنْدَكَ، أَنْ تَجْعَلَ الْقُرْآنَ رَبِيعَ قَلْبِي، وَنُورَ صَدْرِي، وَجَلَاءَ حُزْنِي، وَذَهَابَ هَمِّي',
    transliteration:
      "Allahumma inni 'abduka ibnu 'abdika ibnu amatika, nasiyati biyadika, madin fiyya hukmuka, 'adlun fiyya qada'uka, as'aluka bikulli ismin huwa laka sammayta bihi nafsaka aw anzaltahu fi kitabika aw 'allamtahu ahadan min khalqika awista'tharta bihi fi 'ilmil-ghaybi 'indaka an taj'alal-Qur'ana rabi'a qalbi wa nura sadri wa jala'a huzni wa dhahaba hammi.",
    meaning:
      'Ae Allah! Main Tera banda hoon, Tere bande ka beta, Teri bandi ka beta. Meri peshani Tere haath mein hai, Tera hukm mujh par jaari hai, Tera faisla mere baare mein bilkul insaaf hai. Main Tujhse Tere har us naam ke wasile se maangta hoon jo Tune khud apne liye rakha, ya apni Kitab mein nazil kiya, ya apni makhlooq mein se kisi ko sikhaya, ya apne paas ghaib ke ilm mein mehfooz rakha — ke Tu Quran ko mere dil ki bahar, mere seene ka noor, mere gham ko door karne wala aur meri fikr ko mitaane wala bana de.',
    source: 'Musnad Ahmad 3712 (graded sahih)',
  },
  'rehmat-ki-ummed': {
    kind: 'dua',
    id: 'rehmat-ki-ummed',
    title: 'Allah ki rehmat ki ummeed',
    arabic:
      'اللَّهُمَّ رَحْمَتَكَ أَرْجُو، فَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ، وَأَصْلِحْ لِي شَأْنِي كُلَّهُ، لَا إِلَهَ إِلَّا أَنْتَ',
    transliteration:
      "Allahumma rahmataka arju, fala takilni ila nafsi tarfata 'ayn, wa aslih li sha'ni kullahu, la ilaha illa anta.",
    meaning:
      'Ae Allah! Main Teri rehmat ki ummeed rakhta hoon — mujhe ek pal ke liye bhi mere nafs ke hawale na kar, aur mere saare kaam sudhaar de. Tere siwa koi ma\'bood nahi.',
    source: 'Sunan Abi Dawud 5090 (hasan)',
  },
  'pareshani-mein': {
    kind: 'dua',
    id: 'pareshani-mein',
    title: 'Pareshani ya mushkil mein',
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ',
    transliteration:
      "Laa ilaaha illallaahul-'Adheemul-Haleem, laa ilaaha illallaahu Rabbul-'Arshil-'Adheem, laa ilaaha illallaahu Rabbus-samaawaati wa Rabbul-ardi wa Rabbul-'Arshil-Kareem.",
    meaning:
      'Allah ke siwa koi ma\'bood nahi, jo bahut bada aur bahut burdbaar hai. Allah ke siwa koi ma\'bood nahi, jo azeem Arsh ka Rab hai. Allah ke siwa koi ma\'bood nahi, jo aasmaano ka Rab, zameen ka Rab aur kareem Arsh ka Rab hai.',
    source: 'Sahih al-Bukhari 6346; Sahih Muslim 2730',
  },
  'ya-hayyu-ya-qayyum': {
    kind: 'dua',
    id: 'ya-hayyu-ya-qayyum',
    title: 'Ya Hayyu, Ya Qayyum — rehmat se madad maango',
    arabic:
      'يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
    transliteration:
      "Ya Hayyu ya Qayyum, bi-rahmatika astaghith, aslih li sha'ni kullahu, wa la takilni ila nafsi tarfata 'ayn.",
    meaning:
      'Ae hamesha zinda rehne wale! Ae sab ko qaim rakhne wale! Main Teri rehmat ke zariye madad maangta hoon. Mere saare kaam sudhaar de, aur mujhe ek pal ke liye bhi mere nafs ke hawale na kar.',
    source: "Jami' at-Tirmidhi 3524; Hisn al-Muslim #88",
  },
  'yunus-ki-dua': {
    kind: 'dua',
    id: 'yunus-ki-dua',
    title: 'Yunus (A) ki dua',
    arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    transliteration: "La ilaha illa anta, subhanaka, inni kuntu minaz-zalimin.",
    meaning:
      'Tere siwa koi ma\'bood nahi, Tu paak hai — beshak main hi zalimon mein se tha.',
    source: 'Quran 21:87',
  },
  hasbunallahu: {
    kind: 'dua',
    id: 'hasbunallahu',
    title: "Hasbunallahu wa ni'mal-wakil",
    arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    transliteration: "Hasbunallahu wa ni'mal-wakil.",
    meaning:
      'Allah hi hamare liye kaafi hai, aur woh behtareen kaar-saaz hai.',
    source: 'Quran 3:173',
  },
  taawwudh: {
    kind: 'dua',
    id: 'taawwudh',
    title: "Ta'awwudh — shaitan se panaah",
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: "A'udhu billahi minash-shaytanir-rajim.",
    meaning:
      'Main Allah ki panaah maangta hoon shaitan-e-mardood se.',
    source: 'Quran 7:200; Quran 16:98',
  },
  'rabbi-inni-massaniyad-durr': {
    kind: 'dua',
    id: 'rabbi-inni-massaniyad-durr',
    title: 'Ayyub (A) ki dua — takleef mein',
    arabic: 'أَنِّي مَسَّنِيَ الضُّرُّ وَأَنْتَ أَرْحَمُ الرَّاحِمِينَ',
    transliteration: "Anni massaniyad-durru wa anta arhamur-rahimin.",
    meaning:
      'Beshak mujhe takleef pahunchi hai, aur Tu sabse zyada raham karne wala hai.',
    source: 'Quran 21:83',
  },
  'allahumma-la-sahla': {
    kind: 'dua',
    id: 'allahumma-la-sahla',
    title: 'Mushkil kaam aasan karne ki dua',
    arabic:
      'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
    transliteration:
      "Allahumma la sahla illa ma ja'altahu sahlan, wa anta taj'alul-hazna idha shi'ta sahlan.",
    meaning:
      'Ae Allah! Koi kaam aasan nahi, siwa uske jise Tu aasan kar de; aur Tu jab chahe mushkil ko aasan kar deta hai.',
    source: 'Sahih Ibn Hibban 2427',
  },
  'alhamdulillah-bini-matihi': {
    kind: 'dua',
    id: 'alhamdulillah-bini-matihi',
    title: 'Achhi khabar par — shukr',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
    transliteration: "Alhamdu lillahil-ladhi bini'matihi tatimmus-salihat.",
    meaning:
      'Tamam tareefein Allah ke liye hain, jiski ni\'mat se nek kaam mukammal hote hain.',
    source: 'Sunan Ibn Majah 3803',
  },
  'ni-amat-par-shukr': {
    kind: 'dua',
    id: 'ni-amat-par-shukr',
    title: 'Subah — har ni\'mat ka shukr',
    arabic:
      'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
    transliteration:
      "Allahumma ma asbaha bi min ni'matin aw bi-ahadin min khalqika faminka wahdaka la sharika lak, falakal-hamdu wa lakash-shukr.",
    meaning:
      'Ae Allah! Jo bhi ni\'mat subah ko mujhe mili, ya Teri kisi makhlooq ko mili, woh sirf Teri taraf se hai, Tu akela hai, Tera koi shareek nahi — to tareef Teri hi hai aur shukr Tera hi hai.',
    source: 'Sunan Abi Dawud 5073',
  },
  'hamdan-kathiran': {
    kind: 'dua',
    id: 'hamdan-kathiran',
    title: 'Bahut zyada, paak aur barkat wali tareef',
    arabic: 'الْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ',
    transliteration: "Alhamdu lillahi hamdan kathiran tayyiban mubarakan fih.",
    meaning:
      'Tamam tareefein Allah ke liye hain — bahut zyada, paak aur barkat wali tareef.',
    source: 'Sahih al-Bukhari 799',
  },
  'rabbi-awzi-ni': {
    kind: 'dua',
    id: 'rabbi-awzi-ni',
    title: 'Shukr ki taufeeq — Sulaiman (A) ki dua',
    arabic:
      'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَى وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَدْخِلْنِي بِرَحْمَتِكَ فِي عِبَادِكَ الصَّالِحِينَ',
    transliteration:
      "Rabbi awzi'ni an ashkura ni'matakallati an'amta 'alayya wa 'ala walidayya wa an a'mala salihan tardahu wa adkhilni bi-rahmatika fi 'ibadikas-salihin.",
    meaning:
      'Ae mere Rab! Mujhe taufeeq de ke main Teri us ni\'mat ka shukr ada karoon jo Tune mujh par aur mere walidain par ki, aur main woh nek amal karoon jo Tujhe pasand ho, aur mujhe apni rehmat se apne nek bandon mein dakhil kar de.',
    source: 'Quran 27:19',
  },
  'as-alullahal-azim': {
    kind: 'dua',
    id: 'as-alullahal-azim',
    title: 'Bimar ke liye — saat baar shifa ki dua',
    arabic:
      'أَسْأَلُ اللَّهَ الْعَظِيمَ، رَبَّ الْعَرْشِ الْعَظِيمِ، أَنْ يَشْفِيَكَ',
    transliteration:
      "As'alullahal-'Azima, Rabbal-'Arshil-'Azimi, an yashfiyak. (7 baar)",
    meaning:
      'Main Allah-e-Azeem se, Azeem Arsh ke Rab se maangta hoon ke woh tumhe shifa de.',
    source: "Sunan Abi Dawud 3106; Jami' at-Tirmidhi 2083",
  },
  'allahumma-rabban-nas': {
    kind: 'dua',
    id: 'allahumma-rabban-nas',
    title: 'Bimar ke liye — Rabban-nas, shifa de',
    arabic:
      'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَأْسَ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا',
    transliteration:
      "Allahumma Rabban-nas, adhhibil-ba's, ishfi antash-Shafi, la shifa'a illa shifa'uk, shifa'an la yughadiru saqama.",
    meaning:
      'Ae Allah, logon ke Rab! Takleef door kar de, shifa de — Tu hi Shifa dene wala hai. Teri shifa ke siwa koi shifa nahi, aisi shifa jo koi bimari baaki na chhode.',
    source: 'Sahih al-Bukhari 5675; Sahih Muslim 2191',
  },
  'dard-par-haath': {
    kind: 'dua',
    id: 'dard-par-haath',
    title: 'Dard wali jagah par haath rakh kar',
    arabic:
      'بِسْمِ اللَّهِ، بِسْمِ اللَّهِ، بِسْمِ اللَّهِ، أَعُوذُ بِاللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
    transliteration:
      "Bismillah (3 baar), phir: A'udhu billahi wa qudratihi min sharri ma ajidu wa uhadhir (7 baar).",
    meaning:
      'Allah ke naam se (teen baar). Main Allah ki aur uski qudrat ki panaah maangta hoon us takleef ki burai se jo main mehsoos kar raha hoon aur jiska mujhe darr hai.',
    source: 'Sahih Muslim 2202',
  },
  'la-ba-sa-tahurun': {
    kind: 'dua',
    id: 'la-ba-sa-tahurun',
    title: 'Bimar se — koi baat nahi, paaki hai',
    arabic: 'لَا بَأْسَ، طَهُورٌ إِنْ شَاءَ اللَّهُ',
    transliteration: "La ba'sa, tahurun in sha Allah.",
    meaning:
      'Koi baat nahi, yeh (bimari) paak karne wali hai, in sha Allah.',
    source: 'Sahih al-Bukhari 5656',
  },
  'ruqyah-jibril': {
    kind: 'dua',
    id: 'ruqyah-jibril',
    title: 'Ruqyah — Jibril (A) ki dua',
    arabic:
      'بِسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللَّهُ يَشْفِيكَ، بِسْمِ اللَّهِ أَرْقِيكَ',
    transliteration:
      "Bismillahi arqika, min kulli shay'in yu'dhika, min sharri kulli nafsin aw 'ayni hasid, Allahu yashfika, Bismillahi arqika.",
    meaning:
      'Allah ke naam se main tum par ruqyah (dam) karta hoon — har us cheez se jo tumhe takleef de, har nafs ki burai se aur hasad karne wale ki nazar se. Allah tumhe shifa de; Allah ke naam se main tum par ruqyah karta hoon.',
    source: 'Sahih Muslim 2186',
  },
  istikhara: {
    kind: 'dua',
    id: 'istikhara',
    title: 'Istikhara — faisle se pehle',
    arabic:
      'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ، فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ، وَتَعْلَمُ وَلَا أَعْلَمُ، وَأَنْتَ عَلَّامُ الْغُيُوبِ، اللَّهُمَّ إِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ خَيْرٌ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاقْدُرْهُ لِي وَيَسِّرْهُ لِي، ثُمَّ بَارِكْ لِي فِيهِ، وَإِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ شَرٌّ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاصْرِفْهُ عَنِّي وَاصْرِفْنِي عَنْهُ، وَاقْدُرْ لِيَ الْخَيْرَ حَيْثُ كَانَ، ثُمَّ أَرْضِنِي بِهِ',
    transliteration:
      "Allahumma inni astakhiruka bi'ilmika, wa astaqdiruka bi-qudratika, wa as'aluka min fadlikal-'azim, fa innaka taqdiru wa la aqdiru, wa ta'lamu wa la a'lamu, wa anta 'allamul-ghuyub. Allahumma in kunta ta'lamu anna hadhal-amra khayrun li fi dini wa ma'ashi wa 'aqibati amri, faqdurhu li wa yassirhu li, thumma barik li fih. Wa in kunta ta'lamu anna hadhal-amra sharrun li fi dini wa ma'ashi wa 'aqibati amri, fasrifhu 'anni wasrifni 'anh, waqdur liyal-khayra haythu kana, thumma ardini bih.",
    meaning:
      'Ae Allah! Main Tere ilm ke zariye Tujhse behtari maangta hoon, Teri qudrat ke zariye Tujhse taaqat maangta hoon, aur Tere azeem fazl se maangta hoon. Beshak Tu qadir hai aur main qadir nahi, Tu jaanta hai aur main nahi jaanta, aur Tu ghaib ka sabse zyada jaanne wala hai. Ae Allah! Agar Tu jaanta hai ke yeh kaam mere deen, meri duniya aur mere anjaam ke liye behtar hai, to use mere liye muqarrar kar de, mere liye aasan kar de, phir usmein mere liye barkat de. Aur agar Tu jaanta hai ke yeh kaam mere deen, meri duniya aur mere anjaam ke liye bura hai, to use mujhse door kar de aur mujhe usse door kar de, aur mere liye bhalai muqarrar kar de jahan bhi ho, phir mujhe us par raazi kar de.',
    source: "Sahih al-Bukhari 1166",
  },
  'dua-e-qunoot': {
    kind: 'dua',
    id: 'dua-e-qunoot',
    title: 'Dua-e-Qunoot — Witr mein',
    arabic:
      'اللَّهُمَّ اهْدِنِي فِيمَنْ هَدَيْتَ، وَعَافِنِي فِيمَنْ عَافَيْتَ، وَتَوَلَّنِي فِيمَنْ تَوَلَّيْتَ، وَبَارِكْ لِي فِيمَا أَعْطَيْتَ، وَقِنِي شَرَّ مَا قَضَيْتَ، فَإِنَّكَ تَقْضِي وَلَا يُقْضَى عَلَيْكَ، إِنَّهُ لَا يَذِلُّ مَنْ وَالَيْتَ، وَلَا يَعِزُّ مَنْ عَادَيْتَ، تَبَارَكْتَ رَبَّنَا وَتَعَالَيْتَ',
    transliteration:
      "Allahumma ihdini fiman hadayt, wa 'afini fiman 'afayt, wa tawallani fiman tawallayt, wa barik li fima a'tayt, wa qini sharra ma qadayt, fa innaka taqdi wa la yuqda 'alayk, innahu la yadhillu man walayt, wa la ya'izzu man 'adayt, tabarakta Rabbana wa ta'alayt.",
    meaning:
      'Ae Allah! Mujhe un logon mein hidayat de jinhe Tune hidayat di, un mein aafiyat de jinhe Tune aafiyat di, un mein apni dosti de jinhe Tune apni dosti di, jo Tune mujhe diya usmein barkat de, aur mujhe us faisle ki burai se bacha jo Tune kiya. Beshak Tu hi faisla karta hai aur Tere khilaf koi faisla nahi kar sakta. Jise Tu dost bana le woh kabhi zaleel nahi hota, aur jise Tu dushman bana le woh kabhi izzat nahi pata. Tu barkat wala hai, ae hamare Rab, aur Tu bahut buland hai.',
    source: "Sunan Abi Dawud 1425; Jami' at-Tirmidhi 464",
  },
  'allahumma-inni-asaluka-huda': {
    kind: 'dua',
    id: 'allahumma-inni-asaluka-huda',
    title: 'Hidayat, taqwa, paak-damani, be-niyazi',
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
    transliteration: "Allahumma inni as'alukal-huda wat-tuqa wal-'afafa wal-ghina.",
    meaning:
      'Ae Allah! Main Tujhse hidayat, taqwa, paak-damani aur (dil ki) be-niyazi maangta hoon.',
    source: 'Sahih Muslim 2721',
  },
  'rabbana-la-tuzigh': {
    kind: 'dua',
    id: 'rabbana-la-tuzigh',
    title: 'Hamare dilon ko tedha na kar',
    arabic:
      'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً، إِنَّكَ أَنْتَ الْوَهَّابُ',
    transliteration:
      "Rabbana la tuzigh qulubana ba'da idh hadaytana wa hab lana min ladunka rahmah, innaka antal-Wahhab.",
    meaning:
      'Ae mere Rab! Hamare dilon ko tedha na kar, uske baad ke Tune humein hidayat di, aur humein apne paas se rehmat ata farma. Beshak Tu hi bahut dene wala hai.',
    source: 'Quran 3:8',
  },
  'allahumma-inni-asaluka-hubbaka': {
    kind: 'dua',
    id: 'allahumma-inni-asaluka-hubbaka',
    title: 'Teri mohabbat maangta hoon',
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ حُبَّكَ، وَحُبَّ مَنْ يُحِبُّكَ، وَالْعَمَلَ الَّذِي يُبَلِّغُنِي حُبَّكَ',
    transliteration:
      "Allahumma inni as'aluka hubbak, wa hubba man yuhibbuka, wal-'amala alladhi yuballighuni hubbak.",
    meaning:
      'Ae Allah! Main Tujhse Teri mohabbat maangta hoon, aur uski mohabbat jo Tujhse mohabbat karta hai, aur woh amal jo mujhe Teri mohabbat tak pahuncha de.',
    source: "Jami' at-Tirmidhi 3490",
  },
  'tasbeeh-e-fatimah': {
    kind: 'dhikr',
    id: 'tasbeeh-e-fatimah',
    title: 'Sone se pehle — Tasbeeh-e-Fatimah',
    arabic: 'سُبْحَانَ اللَّهِ، الْحَمْدُ لِلَّهِ، اللَّهُ أَكْبَرُ',
    transliteration:
      'SubhanAllah (33 baar), Alhamdulillah (33 baar), Allahu Akbar (34 baar).',
    meaning:
      'SubhanAllah — Allah paak hai. Alhamdulillah — tamam tareefein Allah ke liye hain. Allahu Akbar — Allah sabse bada hai.',
    source: 'Sahih al-Bukhari 3705; Sahih al-Bukhari 6318',
  },
  'la-hawla-wa-la-quwwata': {
    kind: 'dhikr',
    id: 'la-hawla-wa-la-quwwata',
    title: 'La hawla wa la quwwata illa billah',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: "La hawla wa la quwwata illa billah.",
    meaning:
      'Buraai se bachne ki taaqat aur neki ki quwwat sirf Allah ki madad se hai.',
    source: 'Sahih al-Bukhari 4205; Sahih Muslim 2704',
  },
  'rabbi-zidni-ilma': {
    kind: 'dua',
    id: 'rabbi-zidni-ilma',
    title: 'Mera ilm badha de',
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: "Rabbi zidni 'ilma.",
    meaning: 'Ae mere Rab! Mera ilm badha de.',
    source: 'Quran 20:114',
  },
};

/* ------------------------------------------------------------------ */
/* Moods (12) — remedy counts: Anxious 6, Sad 6, Happy 5, Lost 5,     */
/* Grateful 6, Tired 5, Stressed 6, Angry 4, Confused 6, Lonely 5,    */
/* Sick 8, Motivated 8.                                               */
/* ------------------------------------------------------------------ */

function ayah(key: string): MoodAyahRemedy {
  return AYAHS[key] ?? AYAHS['ayah-13-28'];
}

function dua(key: string): MoodDuaRemedy {
  return DUAS[key] ?? DUAS['yunus-ki-dua'];
}

export const MOODS: Mood[] = [
  {
    id: 'anxious',
    emoji: '😟',
    labelEn: 'Anxious',
    labelHi: 'Pareshan',
    remedies: [ayah('ayah-13-28'), ayah('ayah-2-186'), ayah('ayah-65-3'), dua('pareshani-ghabrahat'), dua('rehmat-ki-ummed'), dua('ya-hayyu-ya-qayyum')],
  },
  {
    id: 'sad',
    emoji: '😢',
    labelEn: 'Sad',
    labelHi: 'Udaas',
    remedies: [ayah('ayah-39-53'), ayah('ayah-3-139'), ayah('ayah-93-5'), ayah('ayah-12-87'), ayah('ayah-94-5'), dua('allahumma-inni-abduka')],
  },
  {
    id: 'happy',
    emoji: '😊',
    labelEn: 'Happy',
    labelHi: 'Khush',
    remedies: [ayah('ayah-14-7'), ayah('ayah-2-152'), ayah('ayah-16-97'), dua('alhamdulillah-bini-matihi'), dua('hamdan-kathiran')],
  },
  {
    id: 'lost',
    emoji: '😕',
    labelEn: 'Lost',
    labelHi: 'Bhatka hua',
    remedies: [ayah('ayah-1-6'), ayah('ayah-29-69'), ayah('ayah-2-186'), dua('istikhara'), dua('rabbana-la-tuzigh')],
  },
  {
    id: 'grateful',
    emoji: '🙏',
    labelEn: 'Grateful',
    labelHi: 'Shukr-guzar',
    remedies: [ayah('ayah-14-7'), ayah('ayah-2-152'), ayah('ayah-16-97'), dua('alhamdulillah-bini-matihi'), dua('ni-amat-par-shukr'), dua('rabbi-awzi-ni')],
  },
  {
    id: 'tired',
    emoji: '😴',
    labelEn: 'Tired',
    labelHi: 'Thaka hua',
    remedies: [ayah('ayah-2-286'), ayah('ayah-94-5'), ayah('ayah-94-6'), dua('pareshani-ghabrahat'), dua('tasbeeh-e-fatimah')],
  },
  {
    id: 'stressed',
    emoji: '😰',
    labelEn: 'Stressed',
    labelHi: 'Tension mein',
    remedies: [ayah('ayah-13-28'), ayah('ayah-2-286'), ayah('ayah-94-5'), ayah('ayah-2-153'), dua('pareshani-mein'), dua('yunus-ki-dua')],
  },
  {
    id: 'angry',
    emoji: '😠',
    labelEn: 'Angry',
    labelHi: 'Gussa',
    remedies: [ayah('ayah-2-153'), ayah('ayah-31-17'), ayah('ayah-94-5'), dua('taawwudh')],
  },
  {
    id: 'confused',
    emoji: '🤔',
    labelEn: 'Confused',
    labelHi: 'Uljan mein',
    remedies: [ayah('ayah-1-6'), ayah('ayah-20-25-28'), ayah('ayah-29-69'), dua('istikhara'), dua('allahumma-inni-asaluka-huda'), dua('dua-e-qunoot')],
  },
  {
    id: 'lonely',
    emoji: '😔',
    labelEn: 'Lonely',
    labelHi: 'Akela',
    remedies: [ayah('ayah-50-16'), ayah('ayah-2-186'), ayah('ayah-40-60'), dua('hasbunallahu'), dua('allahumma-inni-asaluka-hubbaka')],
  },
  {
    id: 'sick',
    emoji: '🤒',
    labelEn: 'Sick',
    labelHi: 'Bimar',
    remedies: [ayah('ayah-26-80'), ayah('ayah-17-82'), dua('rabbi-inni-massaniyad-durr'), dua('allahumma-rabban-nas'), dua('as-alullahal-azim'), dua('la-ba-sa-tahurun'), dua('dard-par-haath'), dua('ruqyah-jibril')],
  },
  {
    id: 'motivated',
    emoji: '💪',
    labelEn: 'Motivated',
    labelHi: 'Hausla',
    remedies: [ayah('ayah-53-39'), ayah('ayah-29-69'), ayah('ayah-94-7'), ayah('ayah-94-8'), ayah('ayah-13-11'), dua('allahumma-la-sahla'), dua('la-hawla-wa-la-quwwata'), dua('rabbi-zidni-ilma')],
  },
];

export function moodById(id: MoodId): Mood {
  return MOODS.find((m) => m.id === id) ?? MOODS[0];
}

/** Find any remedy by its id (ayah id or dua id), for the Favorites view. */
export function remedyById(id: string): MoodRemedy | null {
  if (AYAHS[id]) return AYAHS[id];
  if (DUAS[id]) return DUAS[id];
  return null;
}

/**
 * Next remedy index, non-repeating: picks a random index that is not
 * the current one and not already shown in this session. When every
 * remedy has been shown, the shown set resets (but never returns the
 * one just shown, unless there is only one remedy).
 */
export function nextRemedyIndex(total: number, current: number, shown: number[]): number {
  if (total <= 1) return 0;
  const shownSet = new Set(shown);
  let pool: number[] = [];
  for (let i = 0; i < total; i += 1) {
    if (i !== current && !shownSet.has(i)) pool.push(i);
  }
  if (pool.length === 0) {
    // Everything shown: start a fresh round, just not the same one twice in a row.
    pool = [];
    for (let i = 0; i < total; i += 1) {
      if (i !== current) pool.push(i);
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ------------------------------------------------------------------ */
/* Persistence (AsyncStorage, per-user)                                */
/* ------------------------------------------------------------------ */

function checkinsKey(uid: string): string {
  return `mood:checkins:${uid}`;
}

function favoritesKey(uid: string): string {
  return `mood:favorites:${uid}`;
}

/** All writes through ONE promise chain so rapid taps can't land out of order. */
let writeQueue: Promise<void> = Promise.resolve();
function enqueueWrite(work: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(work).catch(() => undefined);
  writeQueue = run;
  return run;
}

function parseCheckins(raw: string | null): MoodCheckin[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(MOODS.map((m) => m.id));
    return parsed.filter(
      (e): e is MoodCheckin =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as MoodCheckin).date === 'string' &&
        validIds.has((e as MoodCheckin).mood),
    );
  } catch {
    return [];
  }
}

function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && remedyById(id) !== null);
  } catch {
    return [];
  }
}

export async function loadCheckins(uid: string): Promise<MoodCheckin[]> {
  try {
    return parseCheckins(await AsyncStorage.getItem(checkinsKey(uid)));
  } catch {
    return [];
  }
}

export async function loadFavorites(uid: string): Promise<string[]> {
  try {
    return parseFavorites(await AsyncStorage.getItem(favoritesKey(uid)));
  } catch {
    return [];
  }
}

/**
 * Log today's check-in. One entry per day: checking in again the same
 * day replaces today's mood (the user changed their mind), it never
 * creates a second entry for the same date.
 */
export function saveCheckin(uid: string, entry: MoodCheckin): Promise<void> {
  return enqueueWrite(async () => {
    const existing = parseCheckins(await AsyncStorage.getItem(checkinsKey(uid)));
    const next = [entry, ...existing.filter((e) => e.date !== entry.date)];
    next.sort((a, b) => (a.date < b.date ? 1 : -1));
    await AsyncStorage.setItem(checkinsKey(uid), JSON.stringify(next));
  });
}

export function saveFavorites(uid: string, ids: string[]): Promise<void> {
  return enqueueWrite(async () => {
    await AsyncStorage.setItem(favoritesKey(uid), JSON.stringify(ids));
  });
}
