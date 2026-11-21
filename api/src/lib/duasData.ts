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
 * Tirmidhi 3426, 3458. New anxiety / overthinking / sleep entries
 * added 2026-11-21 (Phase 13): Bukhari 6369, 247, 5017, 3705,
 * 6318; Muslim 134, 2203, 2710; Abu Dawud 5090; Musnad Ahmad
 * 3712 (graded sahih); Quran 21:87, 3:173, 7:200, 16:98.
 *
 * Some requested items were NOT duplicated because they already
 * exist above: the distress dua (Bukhari 6346 / Muslim 2730) is
 * 'pareshani-mein'; the sleep duas Bukhari 6324, 6320 and 6325,
 * Ayat al-Kursi (2311) and Baqarah 2:285-286 (5009) are already
 * listed. The new sleep entries are only the three that were
 * missing: aslamtu-nafsi, teen Qul, Tasbeeh-e-Fatimah.
 */

export type DuaTopic = 'sleep' | 'morning' | 'daily' | 'wudu' | 'anxiety' | 'overthinking';

export const DUA_TOPICS: { id: DuaTopic; label: string; hinglish: string }[] = [
  { id: 'sleep', label: 'Neend', hinglish: 'Sone aur neend se judi duas' },
  { id: 'morning', label: 'Subah', hinglish: 'Jaagne par' },
  { id: 'daily', label: 'Rozana', hinglish: 'Roz-marra ke kaam' },
  { id: 'wudu', label: 'Wuzu', hinglish: 'Wuzu ke baad' },
  { id: 'anxiety', label: 'Anxiety', hinglish: 'Pareshani, ghabrahat aur bechaini ke liye' },
  { id: 'overthinking', label: 'Overthinking', hinglish: 'Waswas aur zyada sochne par' },
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
  // ---- Anxiety (pareshani / ghabrahat) — added 2026-11-21 ----
  {
    id: 'pareshani-ghabrahat',
    title: 'Fikr aur gham se panaah',
    topics: ['anxiety'],
    when: 'Jab fikr, gham ya ghabrahat mehsoos ho',
    source: 'Sahih al-Bukhari 6369',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    transliteration:
      "Allahumma inni a'udhu bika minal-hammi wal-hazani, wal-'ajzi wal-kasali, wal-jubni wal-bukhli, wa dala'id-dayni wa ghalabatir-rijal.",
    meaning:
      'Ae Allah! Main Teri panaah maangta hoon fikr aur gham se, be-basi aur susti se, buzdili aur kanjoosi se, qarz ke bojh se aur logon ke ghalbe se.',
  },
  {
    id: 'allahumma-inni-abduka',
    title: 'Bande ki dua — Quran dil ka noor bane',
    topics: ['anxiety'],
    when: 'Jab dil bojhal ho, gham ya fikr zyada ho',
    source: 'Musnad Ahmad 3712 (graded sahih)',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي عَبْدُكَ، ابْنُ عَبْدِكَ، ابْنُ أَمَتِكَ، نَاصِيَتِي بِيَدِكَ، مَاضٍ فِيَّ حُكْمُكَ، عَدْلٌ فِيَّ قَضَاؤُكَ، أَسْأَلُكَ بِكُلِّ اسْمٍ هُوَ لَكَ سَمَّيْتَ بِهِ نَفْسَكَ، أَوْ أَنْزَلْتَهُ فِي كِتَابِكَ، أَوْ عَلَّمْتَهُ أَحَدًا مِنْ خَلْقِكَ، أَوِ اسْتَأْثَرْتَ بِهِ فِي عِلْمِ الْغَيْبِ عِنْدَكَ، أَنْ تَجْعَلَ الْقُرْآنَ رَبِيعَ قَلْبِي، وَنُورَ صَدْرِي، وَجَلَاءَ حُزْنِي، وَذَهَابَ هَمِّي',
    transliteration:
      "Allahumma inni 'abduka ibnu 'abdika ibnu amatika, nasiyati biyadika, madin fiyya hukmuka, 'adlun fiyya qada'uka, as'aluka bikulli ismin huwa laka sammayta bihi nafsaka aw anzaltahu fi kitabika aw 'allamtahu ahadan min khalqika awista'tharta bihi fi 'ilmil-ghaybi 'indaka an taj'alal-Qur'ana rabi'a qalbi wa nura sadri wa jala'a huzni wa dhahaba hammi.",
    meaning:
      'Ae Allah! Main Tera banda hoon, Tere bande ka beta, Teri bandi ka beta. Meri peshani Tere haath mein hai, Tera hukm mujh par jaari hai, Tera faisla mere baare mein bilkul insaaf hai. Main Tujhse Tere har us naam ke wasile se maangta hoon jo Tune khud apne liye rakha, ya apni Kitab mein nazil kiya, ya apni makhlooq mein se kisi ko sikhaya, ya apne paas ghaib ke ilm mein mehfooz rakha — ke Tu Quran ko mere dil ki bahar, mere seene ka noor, mere gham ko door karne wala aur meri fikr ko mitaane wala bana de.',
    note: 'Isi hadith mein hai ke jo bhi is dua ko padhe, Allah uska gham aur fikr door karke uski jagah khushi de deta hai.',
  },
  {
    id: 'rehmat-ki-ummed',
    title: 'Allah ki rehmat ki ummeed',
    topics: ['anxiety'],
    when: 'Subah-shaam, ya jab dil bechain ho',
    source: 'Sunan Abi Dawud 5090 (hasan)',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ رَحْمَتَكَ أَرْجُو، فَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ، وَأَصْلِحْ لِي شَأْنِي كُلَّهُ، لَا إِلَهَ إِلَّا أَنْتَ',
    transliteration:
      "Allahumma rahmataka arju, fala takilni ila nafsi tarfata 'ayn, wa aslih li sha'ni kullahu, la ilaha illa anta.",
    meaning:
      'Ae Allah! Main Teri rehmat ki ummeed rakhta hoon — mujhe ek pal ke liye bhi mere nafs ke hawale na kar, aur mere saare kaam sudhaar de. Tere siwa koi ma’bood nahi.',
  },
  // ---- Overthinking / waswas — added 2026-11-21 ----
  {
    id: 'yunus-ki-dua',
    title: 'Yunus (A) ki dua',
    topics: ['overthinking'],
    when: 'Jab dil par bojh ho, ghabrahat ya galti ka ehsaas ho',
    source: 'Quran 21:87',
    kind: 'dua',
    arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    transliteration: 'La ilaha illa anta, subhanaka, inni kuntu minaz-zalimin.',
    meaning:
      'Tere siwa koi ma’bood nahi, Tu paak hai — beshak main hi zalimon mein se tha.',
    note: 'Yeh dua Hazrat Yunus (A) ne machhli ke pet mein padhi thi, aur Allah ne unki dua qubool karke unhe najaat di.',
  },
  {
    id: 'hasbunallahu',
    title: 'Hasbunallahu wa ni’mal-wakil',
    topics: ['overthinking'],
    when: 'Jab kisi baat ki fikr sataaye ya darr lage',
    source: 'Quran 3:173',
    kind: 'dua',
    arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    transliteration: "Hasbunallahu wa ni'mal-wakil.",
    meaning: 'Allah hi hamare liye kaafi hai, aur woh behtareen kaar-saaz hai.',
  },
  {
    id: 'amantu-billahi',
    title: 'Waswasa aaye to — imaan ka iqraar',
    topics: ['overthinking'],
    when: 'Jab shaitan dil mein waswasa dale',
    source: 'Sahih Muslim 134',
    kind: 'dua',
    arabic: 'آمَنْتُ بِاللَّهِ وَرُسُلِهِ',
    transliteration: 'Amantu billahi wa rusulihi.',
    meaning: 'Main Allah par aur uske Rasoolon par imaan laya.',
    note: 'Jab shaitan Allah ke baare mein bure khayal waswase ke roop mein dale, to yeh kehkar Allah ki panaah maangein — Sahih Muslim 134 mein iska hukm hai.',
  },
  {
    id: 'taawwudh',
    title: 'Ta’awwudh — shaitan se panaah',
    topics: ['overthinking'],
    when: 'Jab bhi waswasa ya bura khayal aaye',
    source: 'Quran 7:200; Quran 16:98',
    kind: 'dua',
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: "A'udhu billahi minash-shaytanir-rajim.",
    meaning: 'Main Allah ki panaah maangta hoon shaitan-e-mardood se.',
    note: 'Quran mein hukm hai: jab shaitan ki taraf se koi waswasa aaye, to Allah ki panaah maango (7:200); aur Quran padhne se pehle bhi ta’awwudh padho (16:98).',
  },
  {
    id: 'namaz-mein-waswasa',
    title: 'Namaz mein waswasa aaye to',
    topics: ['overthinking'],
    when: 'Namaz ke dauraan jab waswasa aaye',
    source: 'Sahih Muslim 2203',
    kind: 'dua',
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: "A'udhu billahi minash-shaytanir-rajim.",
    meaning: 'Main Allah ki panaah maangta hoon shaitan-e-mardood se.',
    note: 'Ta’awwudh padhein aur baayein taraf teen baar halki si thook dein (bina thook nikale). Nabi (ﷺ) ne Uthman ibn Abi al-’As (R) ko namaz mein waswasa aane par yahi tareeqa bataya tha.',
  },
  // ---- Sleep — new entries added 2026-11-21 ----
  // (Bismika Allahumma amutu wa ahya, Bismika Rabbi wada'tu janbi,
  //  jaagne ki dua, Ayat al-Kursi aur Baqarah ki aakhri do ayatein
  //  pehle se maujood hain — duplicate nahi kiye gaye.)
  {
    id: 'aslamtu-nafsi',
    title: 'Sone se pehle — apne aap ko Allah ke hawale',
    topics: ['sleep'],
    when: 'Sone se pehle, bistar par lete waqt',
    source: 'Sahih al-Bukhari 247; Sahih Muslim 2710',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، اللَّهُمَّ آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ',
    transliteration:
      "Allahumma aslamtu nafsi ilayk, wa fawwadtu amri ilayk, wa alja'tu zahri ilayk, raghbatan wa rahbatan ilayk, la malja'a wa la manja minka illa ilayk, Allahumma amantu bikitabikal-ladhi anzalt, wa binabiyyikal-ladhi arsalt.",
    meaning:
      'Ae Allah! Maine apni jaan Tere hawale kar di, apna kaam Tere supurd kar diya, apni peeth Teri taraf laga li — Teri taraf raghbat aur Tere darr ke saath. Tere siwa koi panaah aur najaat ki jagah nahi. Ae Allah! Main imaan laya Teri us Kitab par jo Tune nazil ki, aur Tere us Nabi par jise Tune bheja.',
    note: 'Hadith mein hai ke yeh padh kar sone wala agar usi raat inteqal kar jaye to fitrat (Islam) par hoga.',
  },
  {
    id: 'sone-se-pehle-teen-qul',
    title: 'Sone se pehle — Teen Qul',
    topics: ['sleep'],
    when: 'Sone se pehle, bistar par',
    source: 'Sahih al-Bukhari 5017',
    kind: 'quran-amal',
    quranSurah: 112,
    quranSurahName: 'Al-Ikhlas',
    quranAyahStart: 1,
    quranAyahEnd: 4,
    practice:
      'Sone se pehle Surah Al-Ikhlas (112), Surah Al-Falaq (113) aur Surah An-Nas (114) padh kar dono hatheliyon par phoonk dein, phir unhe sar aur chehre se shuru karke jism par jahan tak haath pahunche, pher lein — yeh teen baar karein. Hadith mein hai ke Nabi (ﷺ) har raat sone se pehle aisa karte the. Poori suratein Quran browser mein padhein — yahan unka text copy nahi kiya gaya.',
  },
  {
    id: 'tasbeeh-e-fatimah',
    title: 'Sone se pehle — Tasbeeh-e-Fatimah',
    topics: ['sleep'],
    when: 'Sone se pehle, bistar par',
    source: 'Sahih al-Bukhari 3705; Sahih al-Bukhari 6318',
    kind: 'dua',
    arabic: 'سُبْحَانَ اللَّهِ، الْحَمْدُ لِلَّهِ، اللَّهُ أَكْبَرُ',
    transliteration:
      'SubhanAllah (33 baar), Alhamdulillah (33 baar), Allahu Akbar (34 baar).',
    meaning:
      'SubhanAllah — Allah paak hai. Alhamdulillah — tamam tareefein Allah ke liye hain. Allahu Akbar — Allah sabse bada hai.',
    note: 'Nabi (ﷺ) ne Hazrat Fatimah (R) ko sone se pehle yeh tasbeeh padhne ko bataya tha — yeh khadim se behtar hai.',
  },
];

/** Pure helper used by the route (and unit-tested): filter by topic. */
export function filterDuasByTopic(duas: Dua[], topic: DuaTopic): Dua[] {
  return duas.filter((dua) => dua.topics.includes(topic));
}

export function isDuaTopic(value: string): value is DuaTopic {
  return DUA_TOPICS.some((topic) => topic.id === value);
}
