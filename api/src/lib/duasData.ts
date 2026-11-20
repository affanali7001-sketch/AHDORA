/**
 * Verified daily duas — static data, served by routes/duas.ts.
 *
 * Every dua here comes from an authentic (sahih) hadith collection
 * with its exact reference shown on screen. The Arabic wording is
 * the wording of the cited hadith; nothing is invented, paraphrased
 * into a "translation" and presented as the dua itself, or given a
 * "reviewed" claim. The Hinglish "meaning" is a plain-language
 * explanation of what the dua says — it is not the dua.
 *
 * Two sleep entries are "quran-amal" cards instead of dua texts:
 * for "neend na aaye" the Sunnah answer is to recite Ayat al-Kursi
 * (2:255) and the last two verses of Al-Baqarah (2:285-286). Those
 * long verses are NOT copied here — the card points at the Quran
 * browser, where the verified Uthmani text lives. The hadith
 * reference for the practice is shown on the card.
 *
 * The widely-shared "insomnia dua" (Allahumma gharat an-nujum...)
 * is deliberately NOT included: its chain is graded weak (da'if),
 * so it does not meet the "verified only" bar for this list.
 *
 * References were checked against sunnah.com / islamqa.info on
 * 2026-11-20: Bukhari 6324, 6325, 6320, 2311, 5009, 6346, 142,
 * 5376; Muslim 234, 2730, 2714; Abu Dawud 5095, 4023, 3767;
 * Tirmidhi 3426, 3458.
 */

export type DuaTopic = 'sleep' | 'morning' | 'daily' | 'wudu';

export const DUA_TOPICS: { id: DuaTopic; label: string; hinglish: string }[] = [
  { id: 'sleep', label: 'Neend', hinglish: 'Sone aur neend se judi duas' },
  { id: 'morning', label: 'Subah', hinglish: 'Jaagne par' },
  { id: 'daily', label: 'Rozana', hinglish: 'Roz-marra ke kaam' },
  { id: 'wudu', label: 'Wuzu', hinglish: 'Wuzu ke baad' },
];

export type DuaText = {
  kind: 'dua';
  /** Exact Arabic wording from the cited hadith. */
  arabic: string;
  /** Hinglish pronunciation — a reading aid only. */
  transliteration: string;
  /** Plain Hinglish explanation of what the dua says. */
  meaning: string;
};

export type QuranAmal = {
  kind: 'quran-amal';
  /** Surah / ayah to recite — text lives in the Quran browser. */
  quranSurah: number;
  quranSurahName: string;
  quranAyahStart: number;
  quranAyahEnd: number;
  /** Hinglish: what to recite and what the hadith says about it. */
  practice: string;
};

export type Dua = {
  id: string;
  /** Hinglish title, e.g. 'Sone se pehle'. */
  title: string;
  topics: DuaTopic[];
  /** When to say it, in Hinglish. */
  when: string;
  /** Exact source reference, e.g. 'Sahih al-Bukhari 6324'. */
  source: string;
  /** Optional extra note (Hinglish, may carry a short verified quote). */
  note?: string;
} & (DuaText | QuranAmal);

export const DUAS: Dua[] = [
  {
    id: 'sone-se-pehle',
    title: 'Sone se pehle',
    topics: ['sleep'],
    when: 'Sone se pehle, bistar par lete waqt',
    source: 'Sahih al-Bukhari 6324',
    kind: 'dua',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allaahumma amootu wa ahyaa.',
    meaning:
      'Ae Allah! Tere naam se main sota hoon (neend ek chhoti si maut hai) aur Tere hi naam se jaagta hoon.',
  },
  {
    id: 'bistar-par-lete-waqt',
    title: 'Bistar par lete waqt',
    topics: ['sleep'],
    when: 'Sone se pehle, bistar par letne ke baad',
    source: 'Sahih al-Bukhari 6320; Sahih Muslim 2714',
    kind: 'dua',
    arabic:
      'بِاسْمِكَ رَبِّ وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، إِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ',
    transliteration:
      "Bismika Rabbi wada'tu janbi, wa bika arfa'uhu. In amsakta nafsi farhamha, wa in arsaltaha fahfazha bima tahfazu bihi 'ibadakas-salihin.",
    meaning:
      'Tere naam se, ae mere Rab, maine apna pehlu (bistar par) rakha, aur Tere hi naam se main use uthata hoon. Agar Tu meri rooh rok le to us par raham farma, aur agar use wapas bhej de to uski hifazat farma, jaise Tu apne nek bandon ki hifazat farmata hai.',
  },
  {
    id: 'neend-na-aaye-ayat-kursi',
    title: 'Neend na aaye to — Ayat al-Kursi',
    topics: ['sleep'],
    when: 'Sone se pehle, jab neend na aa rahi ho',
    source: 'Sahih al-Bukhari 2311',
    kind: 'quran-amal',
    quranSurah: 2,
    quranSurahName: 'Al-Baqarah',
    quranAyahStart: 255,
    quranAyahEnd: 255,
    practice:
      'Sone se pehle Ayat al-Kursi (Surah Al-Baqarah, Ayat 255) padhein. Hadith mein hai: jo bistar par jaate waqt Ayat al-Kursi padhe, Allah ki taraf se ek muhafiz uske saath rehta hai aur subah tak koi shaitan uske qareeb nahi aata. Poori ayat Quran browser mein padhein — yahan uska text copy nahi kiya gaya.',
  },
  {
    id: 'neend-na-aaye-baqarah-aakhri',
    title: 'Neend na aaye to — Baqarah ki aakhri do ayatein',
    topics: ['sleep'],
    when: 'Raat ko sone se pehle',
    source: 'Sahih al-Bukhari 5009',
    kind: 'quran-amal',
    quranSurah: 2,
    quranSurahName: 'Al-Baqarah',
    quranAyahStart: 285,
    quranAyahEnd: 286,
    practice:
      'Raat ko Surah Al-Baqarah ki aakhri do ayatein (285–286) padhein. Hadith mein hai: jo inhe raat mein padhe, woh uske liye kaafi hain. Poori ayatein Quran browser mein padhein — yahan unka text copy nahi kiya gaya.',
  },
  {
    id: 'jaagne-par',
    title: 'Jaagne par (subah)',
    topics: ['morning', 'sleep'],
    when: 'Subah neend se jaagte hi',
    source: 'Sahih al-Bukhari 6324 (Sahih al-Bukhari 6325 mein bhi)',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: 'Alhamdu lillaahil-ladhee ahyaanaa ba’da maa amaatanaa wa ilayhin-nushoor.',
    meaning:
      'Tamam tareefein Allah ke liye hain, jisne humein neend (chhoti maut) ke baad zinda kiya, aur usi ki taraf (aakhir mein) lautna hai.',
  },
  {
    id: 'khana-shuru-karne-se-pehle',
    title: 'Khana shuru karne se pehle',
    topics: ['daily'],
    when: 'Khana khane se pehle',
    source: 'Sahih al-Bukhari 5376',
    kind: 'dua',
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillaah.',
    meaning: 'Allah ke naam se (shuru karta hoon).',
    note: 'Agar shuru mein kehna bhool jayein, to yaad aate hi kahein: Bismillaahi awwalahu wa aakhirahu (بِسْمِ اللَّهِ أَوَّلَهُ وَآخِرَهُ) — Sunan Abi Dawud 3767.',
  },
  {
    id: 'khane-ke-baad',
    title: 'Khane ke baad',
    topics: ['daily'],
    when: 'Khana khatam karne ke baad',
    source: 'Sunan Abi Dawud 4023; Jami’ at-Tirmidhi 3458',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    transliteration:
      'Alhamdu lillaahil-ladhee at’amanee haadhaa wa razaqaneehi min ghayri hawlin minnee wa laa quwwah.',
    meaning:
      'Tamam tareefein Allah ke liye hain, jisne mujhe yeh khana khilaya aur bina meri kisi taaqat ke mujhe yeh rizq diya.',
  },
  {
    id: 'ghar-se-nikalte-waqt',
    title: 'Ghar se nikalte waqt',
    topics: ['daily'],
    when: 'Ghar se bahar nikalte waqt',
    source: 'Sunan Abi Dawud 5095; Jami’ at-Tirmidhi 3426',
    kind: 'dua',
    arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'Bismillaahi tawakkaltu ‘alallaah, wa laa hawla wa laa quwwata illaa billaah.',
    meaning:
      'Allah ke naam se (nikalta hoon). Maine Allah par bharosa kiya. Buraai se bachne ki taaqat aur neki ki quwwat sirf Allah ki madad se hai.',
  },
  {
    id: 'pareshani-mein',
    title: 'Pareshani ya mushkil mein',
    topics: ['daily'],
    when: 'Jab koi pareshani ya mushkil aa jaye',
    source: 'Sahih al-Bukhari 6346; Sahih Muslim 2730',
    kind: 'dua',
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ',
    transliteration:
      'Laa ilaaha illallaahul-‘Adheemul-Haleem, laa ilaaha illallaahu Rabbul-‘Arshil-‘Adheem, laa ilaaha illallaahu Rabbus-samaawaati wa Rabbul-ardi wa Rabbul-‘Arshil-Kareem.',
    meaning:
      'Allah ke siwa koi ma’bood nahi, jo bahut bada aur bahut burdbaar hai. Allah ke siwa koi ma’bood nahi, jo azeem Arsh ka Rab hai. Allah ke siwa koi ma’bood nahi, jo aasmaano ka Rab, zameen ka Rab aur kareem Arsh ka Rab hai.',
  },
  {
    id: 'toilet-jane-se-pehle',
    title: 'Toilet (bathroom) jaane se pehle',
    topics: ['daily'],
    when: 'Bathroom / toilet mein dakhil hone se pehle',
    source: 'Sahih al-Bukhari 142',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
    transliteration: 'Allaahumma innee a’oodhu bika minal-khubuthi wal-khabaa’ith.',
    meaning: 'Ae Allah! Main Teri panaah maangta hoon har buraai aur bure (jinno / shayateen) se.',
    note: 'Hisnul Muslim mein is dua se pehle ‘Bismillah’ kehna bhi darj hai.',
  },
  {
    id: 'wuzu-ke-baad',
    title: 'Wuzu ke baad',
    topics: ['wudu'],
    when: 'Wuzu mukammal karne ke baad',
    source: 'Sahih Muslim 234',
    kind: 'dua',
    arabic:
      'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration:
      'Ash-hadu an laa ilaaha illallaahu wahdahu laa shareeka lah, wa ash-hadu anna Muhammadan ‘abduhu wa rasooluh.',
    meaning:
      'Main gawahi deta hoon ke Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; aur main gawahi deta hoon ke Muhammad (ﷺ) uske bande aur Rasool hain.',
  },
];

/** Pure helper used by the route (and unit-tested): filter by topic. */
export function filterDuasByTopic(duas: Dua[], topic: DuaTopic): Dua[] {
  return duas.filter((dua) => dua.topics.includes(topic));
}

export function isDuaTopic(value: string): value is DuaTopic {
  return DUA_TOPICS.some((topic) => topic.id === value);
}
