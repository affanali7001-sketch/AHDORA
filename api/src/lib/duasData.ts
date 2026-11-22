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
 *
 * Expansion 2026-11-23: 110 more verified duas added (132 total),
 * drawn from Hisn al-Muslim (Fortress of the Muslim) and the same
 * sahih collections as the original 22. Every new entry carries its
 * exact collection + number; Quranic duas quote the verse wording
 * itself. A few well-known duas were deliberately LEFT OUT because
 * their chains are graded weak or their numbering would clash with
 * an entry already listed: 'Allahumma ajirni minan-nar' (7x after
 * Fajr/Maghrib), 'Hasbiyallahu' 7x morning/evening, the 'afini fi
 * badani' morning/evening dhikr (its Abu Dawud number 5090 is
 * already cited above for a different dua), the house-entering dua
 * (Abu Dawud 5096, graded da'if), and the mirror dua. Nothing was
 * padded to reach the count: entries whose Arabic or reference
 * could not be pinned down were skipped, not guessed.
 */

export type DuaTopic =
  | 'sleep'
  | 'morning'
  | 'evening'
  | 'daily'
  | 'wudu'
  | 'prayer'
  | 'adhan'
  | 'mosque'
  | 'food'
  | 'travel'
  | 'distress'
  | 'gratitude'
  | 'protection'
  | 'sickness'
  | 'forgiveness'
  | 'knowledge'
  | 'family'
  | 'work'
  | 'rain'
  | 'anxiety'
  | 'overthinking';

export const DUA_TOPICS: { id: DuaTopic; label: string; hinglish: string }[] = [
  { id: 'sleep', label: 'Neend', hinglish: 'Sone aur neend se judi duas' },
  { id: 'morning', label: 'Subah', hinglish: 'Jaagne par' },
  { id: 'evening', label: 'Shaam', hinglish: 'Shaam ke adhkar' },
  { id: 'daily', label: 'Rozana', hinglish: 'Roz-marra ke kaam' },
  { id: 'wudu', label: 'Wuzu', hinglish: 'Wuzu ke baad' },
  { id: 'prayer', label: 'Namaz', hinglish: 'Namaz ke baad aur namaz mein' },
  { id: 'adhan', label: 'Azan', hinglish: 'Azan ke waqt' },
  { id: 'mosque', label: 'Masjid', hinglish: 'Masjid aane-jaane par' },
  { id: 'food', label: 'Khana', hinglish: 'Khane-peene par' },
  { id: 'travel', label: 'Safar', hinglish: 'Safar par' },
  { id: 'distress', label: 'Mushkil', hinglish: 'Mushkil aur takleef mein' },
  { id: 'gratitude', label: 'Shukr', hinglish: 'Shukr ada karne par' },
  { id: 'protection', label: 'Hifazat', hinglish: 'Hifazat aur panaah ke liye' },
  { id: 'sickness', label: 'Bimari', hinglish: 'Bimari aur shifa ke liye' },
  { id: 'forgiveness', label: 'Maghfirat', hinglish: 'Tauba aur maghfirat ke liye' },
  { id: 'knowledge', label: 'Ilm', hinglish: 'Ilm aur padhai ke liye' },
  { id: 'family', label: 'Ghar', hinglish: 'Ghar, walidain aur aulaad ke liye' },
  { id: 'work', label: 'Kaam', hinglish: 'Kaam, rizq aur qarz ke liye' },
  { id: 'rain', label: 'Baarish', hinglish: 'Baarish aur mausam par' },
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
  // ---- Morning adhkar — added 2026-11-23 (Hisn al-Muslim) ----
  {
    id: 'subah-asbahna',
    title: 'Subah — din ki shuruaat',
    topics: ['morning'],
    when: 'Subah, Fajr ke baad',
    source: 'Sahih Muslim 2723',
    kind: 'dua',
    arabic:
      'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    transliteration:
      'Asbahna wa asbahal-mulku lillah, wal-hamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir. Rabbi as’aluka khayra ma fi hadhal-yawmi wa khayra ma ba’dah, wa a’udhu bika min sharri ma fi hadhal-yawmi wa sharri ma ba’dah. Rabbi a’udhu bika minal-kasali wa su’il-kibar. Rabbi a’udhu bika min ‘adhabin fin-nari wa ‘adhabin fil-qabr.',
    meaning:
      'Hum subah ko pahunche aur saari baadshahat Allah ki hai; tamam tareefein Allah ke liye hain. Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; baadshahat usi ki hai, tareef usi ki hai, aur woh har cheez par qadir hai. Ae mere Rab! Main Tujhse is din ki bhalai aur uske baad ki bhalai maangta hoon, aur is din ki burai aur uske baad ki burai se Teri panaah maangta hoon. Ae mere Rab! Main susti aur budhape ki kharabi se Teri panaah maangta hoon, aur aag ke azaab aur qabr ke azaab se Teri panaah maangta hoon.',
  },
  {
    id: 'bika-asbahna',
    title: 'Subah — Tere hi fazl se',
    topics: ['morning'],
    when: 'Subah, Fajr ke baad',
    source: 'Jami’ at-Tirmidhi 3391',
    kind: 'dua',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    transliteration: 'Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namut, wa ilaykan-nushur.',
    meaning:
      'Ae Allah! Tere hi (fazl) se hum subah ko pahunche, Tere hi (fazl) se hum shaam ko pahunche, Tere hi (fazl) se hum jeete hain aur Tere hi (fazl) se hum marte hain, aur (aakhir mein) Teri hi taraf lautna hai.',
  },
  {
    id: 'sayyid-al-istighfar',
    title: 'Sayyid al-Istighfar — sabse afzal istighfar',
    topics: ['morning', 'forgiveness'],
    when: 'Subah aur shaam, yaqeen ke saath',
    source: 'Sahih al-Bukhari 6306',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    transliteration:
      'Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana ‘abduk, wa ana ‘ala ‘ahdika wa wa’dika mastata’t, a’udhu bika min sharri ma sana’t, abu’u laka bini’matika ‘alayy, wa abu’u laka bidhanbi faghfir li, fa innahu la yaghfirudh-dhunuba illa anta.',
    meaning:
      'Ae Allah! Tu hi mera Rab hai, Tere siwa koi ma’bood nahi. Tune mujhe paida kiya aur main Tera banda hoon. Main apni taaqat bhar Tere ahd aur Tere waade par qaim hoon. Main apne kiye ki burai se Teri panaah maangta hoon. Main Tere saamne Teri ni’mat ka iqraar karta hoon jo mujh par hai, aur apne gunah ka bhi iqraar karta hoon — to mujhe bakhsh de, kyunki Tere siwa koi gunah bakhshne wala nahi.',
    note: 'Hadith mein hai ke jo is dua ko subah ya shaam yaqeen ke saath padhe aur usi din ya raat inteqal kar jaye, woh Jannat mein dakhil hoga.',
  },
  {
    id: 'raditu-billahi',
    title: 'Allah ko Rab maan kar raazi hoon',
    topics: ['morning', 'evening'],
    when: 'Subah aur shaam, teen baar',
    source: 'Sunan Abi Dawud 5072',
    kind: 'dua',
    arabic: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا',
    transliteration:
      'Raditu billahi Rabban, wa bil-Islami dinan, wa bi-Muhammadin sallallahu ‘alayhi wa sallam nabiyyan.',
    meaning:
      'Main Allah ko Rab maan kar, Islam ko deen maan kar aur Muhammad (ﷺ) ko Nabi maan kar raazi hoon.',
    note: 'Subah-shaam teen baar padhne ki fazilat hadith mein aayi hai.',
  },
  {
    id: 'bismillahil-ladhi',
    title: 'Jiske naam se koi cheez nuqsan nahi de sakti',
    topics: ['morning', 'evening', 'protection'],
    when: 'Subah aur shaam, teen baar',
    source: 'Sunan Abi Dawud 5088; Jami’ at-Tirmidhi 3388',
    kind: 'dua',
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration:
      'Bismillahil-ladhi la yadurru ma’asmihi shay’un fil-ardi wa la fis-sama’i wa huwas-Sami’ul-‘Alim.',
    meaning:
      'Allah ke naam se (shuru karta hoon), jiske naam ke saath zameen ya aasmaan ki koi cheez nuqsan nahi pahuncha sakti; aur woh sab kuch sunne wala, sab kuch jaanne wala hai.',
    note: 'Subah-shaam teen baar padhne wala kisi achanak museebat se mehfooz rehta hai.',
  },
  {
    id: 'subhanallahi-wa-bihamdihi-100',
    title: 'SubhanAllah wa bihamdihi — 100 baar',
    topics: ['morning'],
    when: 'Subah ya din mein kabhi bhi',
    source: 'Sahih Muslim 2692',
    kind: 'dua',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'Subhanallahi wa bihamdihi. (100 baar)',
    meaning: 'Allah paak hai aur tamam tareefein usi ke liye hain.',
    note: 'Jo din mein 100 baar yeh padhe, uske gunah maaf kar diye jate hain, chahe samundar ke jhaag ke barabar hon.',
  },
  {
    id: 'allahumma-inni-asaluka-ilman',
    title: 'Subah — faida dene wala ilm maango',
    topics: ['morning', 'knowledge'],
    when: 'Subah, Fajr ke baad',
    source: 'Sunan Ibn Majah 925',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
    transliteration:
      'Allahumma inni as’aluka ‘ilman nafi’an, wa rizqan tayyiban, wa ‘amalan mutaqabbalan.',
    meaning:
      'Ae Allah! Main Tujhse faida dene wala ilm, paak rizq aur qubool hone wala amal maangta hoon.',
  },
  {
    id: 'allahumma-alimal-ghayb',
    title: 'Ghaib aur haazir ke jaanne wale',
    topics: ['morning', 'evening', 'protection'],
    when: 'Subah aur shaam',
    source: 'Sunan Abi Dawud 5067; Jami’ at-Tirmidhi 3392',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ',
    transliteration:
      'Allahumma ‘alimal-ghaybi wash-shahadah, fatira as-samawati wal-ard, Rabba kulli shay’in wa malikah, ash-hadu an la ilaha illa anta, a’udhu bika min sharri nafsi wa min sharrish-shaytani wa shirkih, wa an aqtarifa ‘ala nafsi su’an aw ajurrahu ila muslim.',
    meaning:
      'Ae Allah! Ghaib aur haazir ke jaanne wale, aasmaano aur zameen ke banane wale, har cheez ke Rab aur Malik! Main gawahi deta hoon ke Tere siwa koi ma’bood nahi. Main apne nafs ki burai se, shaitan ki burai aur uske shirk se Teri panaah maangta hoon, aur is se (bhi panaah maangta hoon) ke main apne nafs par koi burai karoon ya kisi Musalman tak burai pahunchaoon.',
  },
  {
    id: 'afwa-wal-afiyah',
    title: 'Maafi aur aafiyat — subah-shaam',
    topics: ['morning', 'evening', 'protection'],
    when: 'Subah aur shaam',
    source: 'Sunan Abi Dawud 5074',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي',
    transliteration:
      'Allahumma inni as’alukal-‘afwa wal-‘afiyata fid-dunya wal-akhirah, Allahumma inni as’alukal-‘afwa wal-‘afiyata fi dini wa dunyaya wa ahli wa mali, Allahummastur ‘awrati wa amin raw’ati, Allahummahfazni min bayni yadayya wa min khalfi wa ‘an yamini wa ‘an shimali wa min fawqi, wa a’udhu bi-‘azamatika an ughtala min tahti.',
    meaning:
      'Ae Allah! Main Tujhse duniya aur aakhirat mein maafi aur aafiyat maangta hoon. Ae Allah! Main Tujhse apne deen, apni duniya, apne ghar walon aur apne maal mein maafi aur aafiyat maangta hoon. Ae Allah! Meri kamzoriyan chhupa le aur mere darr ko aman se badal de. Ae Allah! Meri hifazat farma mere saamne se, mere peeche se, mere daayein se, mere baayein se aur mere upar se; aur main Teri azmat ki panaah maangta hoon is se ke main neeche se (zameen mein) dhansa diya jaoon.',
  },
  {
    id: 'subhanallahi-adada-khalqihi',
    title: 'Makhlooq ki ginti ke barabar tasbeeh',
    topics: ['morning'],
    when: 'Subah, teen baar',
    source: 'Sahih Muslim 2726',
    kind: 'dua',
    arabic:
      'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ',
    transliteration:
      'Subhanallahi wa bihamdihi, ‘adada khalqihi, wa rida nafsihi, wa zinata ‘arshihi, wa midada kalimatihi. (3 baar)',
    meaning:
      'Allah paak hai aur tamam tareefein usi ke liye hain — uski makhlooq ki ginti ke barabar, uski raza ke barabar, uske Arsh ke wazan ke barabar, aur uske kalimaat ki siyahi ke barabar.',
  },
  // ---- Evening adhkar — added 2026-11-23 (Hisn al-Muslim) ----
  {
    id: 'shaam-amsayna',
    title: 'Shaam — raat ki shuruaat',
    topics: ['evening'],
    when: 'Shaam ko, Maghrib se pehle',
    source: 'Sahih Muslim 2723',
    kind: 'dua',
    arabic:
      'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    transliteration:
      'Amsayna wa amsal-mulku lillah, wal-hamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir. Rabbi as’aluka khayra ma fi hadhihil-laylati wa khayra ma ba’daha, wa a’udhu bika min sharri ma fi hadhihil-laylati wa sharri ma ba’daha. Rabbi a’udhu bika minal-kasali wa su’il-kibar. Rabbi a’udhu bika min ‘adhabin fin-nari wa ‘adhabin fil-qabr.',
    meaning:
      'Hum shaam ko pahunche aur saari baadshahat Allah ki hai; tamam tareefein Allah ke liye hain. Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; baadshahat usi ki hai, tareef usi ki hai, aur woh har cheez par qadir hai. Ae mere Rab! Main Tujhse is raat ki bhalai aur uske baad ki bhalai maangta hoon, aur is raat ki burai aur uske baad ki burai se Teri panaah maangta hoon. Ae mere Rab! Main susti aur budhape ki kharabi se Teri panaah maangta hoon, aur aag ke azaab aur qabr ke azaab se Teri panaah maangta hoon.',
  },
  {
    id: 'bika-amsayna',
    title: 'Shaam — Tere hi fazl se',
    topics: ['evening'],
    when: 'Shaam ko',
    source: 'Jami’ at-Tirmidhi 3391',
    kind: 'dua',
    arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
    transliteration: 'Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namut, wa ilaykal-masir.',
    meaning:
      'Ae Allah! Tere hi (fazl) se hum shaam ko pahunche, Tere hi (fazl) se hum subah ko pahunche, Tere hi (fazl) se hum jeete hain aur Tere hi (fazl) se hum marte hain, aur (aakhir mein) Teri hi taraf lautna hai.',
  },
  {
    id: 'a-udhu-bikalimatillah',
    title: 'Allah ke mukammal kalimaat ki panaah',
    topics: ['evening', 'protection'],
    when: 'Shaam ko, teen baar',
    source: 'Sahih Muslim 2709',
    kind: 'dua',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: 'A’udhu bikalimatillah it-tammati min sharri ma khalaq. (3 baar)',
    meaning:
      'Main Allah ke mukammal kalimaat ki panaah maangta hoon, uski har makhlooq ki burai se.',
  },
  {
    id: 'teen-qul-subah-shaam',
    title: 'Subah-shaam — Teen Qul',
    topics: ['morning', 'evening', 'protection'],
    when: 'Subah aur shaam, har surah teen baar',
    source: 'Jami’ at-Tirmidhi 3575',
    kind: 'quran-amal',
    quranSurah: 112,
    quranSurahName: 'Al-Ikhlas',
    quranAyahStart: 1,
    quranAyahEnd: 4,
    practice:
      'Subah aur shaam Surah Al-Ikhlas (112), Surah Al-Falaq (113) aur Surah An-Nas (114) — teeno suratein teen-teen baar padhein. Hadith mein hai ke yeh har cheez se kaafi hain. Poori suratein Quran browser mein padhein — yahan unka text copy nahi kiya gaya.',
  },
  // ---- Namaz — added 2026-11-23 ----
  {
    id: 'astaghfirullah-namaz-ke-baad',
    title: 'Namaz ke baad — Astaghfirullah',
    topics: ['prayer'],
    when: 'Har farz namaz ke baad, salam pherte hi',
    source: 'Sahih Muslim 591',
    kind: 'dua',
    arabic:
      'أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، اللَّهُمَّ أَنْتَ السَّلَامُ، وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
    transliteration:
      'Astaghfirullah, Astaghfirullah, Astaghfirullah. Allahumma antas-Salam, wa minkas-Salam, tabarakta ya Dhal-Jalali wal-Ikram.',
    meaning:
      'Main Allah se maghfirat maangta hoon (teen baar). Ae Allah! Tu hi Salam (aman dene wala) hai, aur aman Teri hi taraf se hai. Tu barkat wala hai, ae jalal aur ikram wale!',
  },
  {
    id: 'allahumma-a-inni-ala-dhikrik',
    title: 'Namaz ke baad — zikr ki madad maango',
    topics: ['prayer'],
    when: 'Har namaz ke baad, salam se pehle ya baad mein',
    source: 'Sunan Abi Dawud 1522',
    kind: 'dua',
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ',
    transliteration: 'Allahumma a’inni ‘ala dhikrika, wa shukrika, wa husni ‘ibadatik.',
    meaning:
      'Ae Allah! Apne zikr par, apna shukr ada karne par aur apni behtareen ibadat karne par meri madad farma.',
  },
  {
    id: 'la-ilaha-illallahu-wahdahu-namaz',
    title: 'Namaz ke baad — tawheed ka iqraar',
    topics: ['prayer'],
    when: 'Har farz namaz ke baad',
    source: 'Sahih Muslim 593',
    kind: 'dua',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir.',
    meaning:
      'Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; baadshahat usi ki hai, tareef usi ki hai, aur woh har cheez par qadir hai.',
  },
  {
    id: 'tasbih-namaz-ke-baad',
    title: 'Namaz ke baad — 33-33-33 tasbeeh',
    topics: ['prayer'],
    when: 'Har farz namaz ke baad',
    source: 'Sahih Muslim 597',
    kind: 'dua',
    arabic: 'سُبْحَانَ اللَّهِ، الْحَمْدُ لِلَّهِ، اللَّهُ أَكْبَرُ',
    transliteration:
      'SubhanAllah (33 baar), Alhamdulillah (33 baar), Allahu Akbar (33 baar), phir: La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir.',
    meaning:
      'SubhanAllah — Allah paak hai. Alhamdulillah — tamam tareefein Allah ke liye hain. Allahu Akbar — Allah sabse bada hai.',
    note: '33-33-33 ke baad ek baar ‘La ilaha illallahu wahdahu…’ padhne se (kul 100) gunah maaf kar diye jate hain, chahe samundar ke jhaag ke barabar hon.',
  },
  {
    id: 'allahumma-la-mani-a',
    title: 'Namaz ke baad — jo Tu de, koi rok nahi sakta',
    topics: ['prayer'],
    when: 'Har farz namaz ke baad',
    source: 'Sahih al-Bukhari 844; Sahih Muslim 593',
    kind: 'dua',
    arabic: 'اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ',
    transliteration:
      'Allahumma la mani’a lima a’tayta, wa la mu’tiya lima mana’ta, wa la yanfa’u dhal-jaddi minkal-jadd.',
    meaning:
      'Ae Allah! Jo Tu de, use koi rok nahi sakta; jo Tu roke, use koi de nahi sakta; aur kisi daulat wale ki daulat Tere saamne use koi faida nahi de sakti.',
  },
  {
    id: 'allahumma-inni-zalamtu',
    title: 'Namaz mein — apne nafs par zulm ka iqraar',
    topics: ['prayer', 'forgiveness'],
    when: 'Namaz mein, tashahhud ke baad aur salam se pehle',
    source: 'Sahih al-Bukhari 834; Sahih Muslim 2705',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا، وَلَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ، فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ وَارْحَمْنِي، إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ',
    transliteration:
      'Allahumma inni zalamtu nafsi zulman kathiran, wa la yaghfirudh-dhunuba illa anta, faghfir li maghfiratan min ‘indika warhamni, innaka antal-Ghafurur-Rahim.',
    meaning:
      'Ae Allah! Maine apne nafs par bahut zyada zulm kiya hai, aur Tere siwa koi gunah bakhshne wala nahi — to mujhe apni taraf se maghfirat ata farma aur mujh par raham farma. Beshak Tu hi bahut bakhshne wala, bahut raham karne wala hai.',
  },
  {
    id: 'rabbi-ghfir-li',
    title: 'Do sajdon ke beech',
    topics: ['prayer', 'forgiveness'],
    when: 'Namaz mein, do sajdon ke beech baith kar',
    source: 'Sunan Abi Dawud 874',
    kind: 'dua',
    arabic: 'رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي',
    transliteration: 'Rabbighfir li, Rabbighfir li.',
    meaning: 'Ae mere Rab! Mujhe bakhsh de, ae mere Rab! Mujhe bakhsh de.',
  },
  {
    id: 'allahumma-ghfir-li-ma-qaddamtu',
    title: 'Namaz mein — pehle aur baad ke gunah',
    topics: ['prayer', 'forgiveness'],
    when: 'Namaz mein, tashahhud ke baad aur salam se pehle',
    source: 'Sahih Muslim 771',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ اغْفِرْ لِي مَا قَدَّمْتُ وَمَا أَخَّرْتُ، وَمَا أَسْرَرْتُ وَمَا أَعْلَنْتُ، وَمَا أَنْتَ أَعْلَمُ بِهِ مِنِّي، أَنْتَ الْمُقَدِّمُ وَأَنْتَ الْمُؤَخِّرُ، لَا إِلَهَ إِلَّا أَنْتَ',
    transliteration:
      'Allahummaghfir li ma qaddamtu wa ma akhkhartu, wa ma asrartu wa ma a’lantu, wa ma anta a’lamu bihi minni, antal-Muqaddimu wa antal-Mu’akhkhiru, la ilaha illa anta.',
    meaning:
      'Ae Allah! Mere woh gunah bakhsh de jo maine pehle kiye aur jo baad mein kiye, jo chhup kar kiye aur jo khul kar kiye, aur woh bhi jinhe Tu mujhse zyada jaanta hai. Tu hi (kisi ko) aage badhane wala hai aur Tu hi peeche rakhne wala hai; Tere siwa koi ma’bood nahi.',
  },
  {
    id: 'ruku-ki-dua',
    title: 'Ruku mein',
    topics: ['prayer'],
    when: 'Namaz mein ruku ki haalat mein, teen baar',
    source: 'Sahih Muslim 772',
    kind: 'dua',
    arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    transliteration: 'Subhana Rabbiyal-‘Azim. (3 baar)',
    meaning: 'Mera Rab-e-Azeem paak hai.',
  },
  {
    id: 'sujud-ki-dua',
    title: 'Sajde mein',
    topics: ['prayer'],
    when: 'Namaz mein sajde ki haalat mein, teen baar',
    source: 'Sahih Muslim 772',
    kind: 'dua',
    arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    transliteration: 'Subhana Rabbiyal-A’la. (3 baar)',
    meaning: 'Mera Rab-e-A’la (sabse buland) paak hai.',
  },
  {
    id: 'tashahhud',
    title: 'Tashahhud — qa’de mein',
    topics: ['prayer'],
    when: 'Namaz mein qa’de (baithak) mein',
    source: 'Sahih al-Bukhari 831',
    kind: 'dua',
    arabic:
      'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration:
      'At-tahiyyatu lillahi was-salawatu wat-tayyibat, assalamu ‘alayka ayyuhan-Nabiyyu wa rahmatullahi wa barakatuh, assalamu ‘alayna wa ‘ala ‘ibadillahis-salihin, ash-hadu an la ilaha illallah wa ash-hadu anna Muhammadan ‘abduhu wa rasuluh.',
    meaning:
      'Tamam tareefein aur ibadatein aur paak cheezein Allah hi ke liye hain. Ae Nabi! Aap par salam ho, aur Allah ki rehmat aur uski barkatein. Hum par aur Allah ke nek bandon par salam ho. Main gawahi deta hoon ke Allah ke siwa koi ma’bood nahi aur main gawahi deta hoon ke Muhammad (ﷺ) Allah ke bande aur Rasool hain.',
  },
  {
    id: 'dua-e-qunoot',
    title: 'Dua-e-Qunoot — Witr mein',
    topics: ['prayer'],
    when: 'Witr ki namaz mein',
    source: 'Sunan Abi Dawud 1425; Jami’ at-Tirmidhi 464',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ اهْدِنِي فِيمَنْ هَدَيْتَ، وَعَافِنِي فِيمَنْ عَافَيْتَ، وَتَوَلَّنِي فِيمَنْ تَوَلَّيْتَ، وَبَارِكْ لِي فِيمَا أَعْطَيْتَ، وَقِنِي شَرَّ مَا قَضَيْتَ، فَإِنَّكَ تَقْضِي وَلَا يُقْضَى عَلَيْكَ، إِنَّهُ لَا يَذِلُّ مَنْ وَالَيْتَ، وَلَا يَعِزُّ مَنْ عَادَيْتَ، تَبَارَكْتَ رَبَّنَا وَتَعَالَيْتَ',
    transliteration:
      'Allahumma ihdini fiman hadayt, wa ‘afini fiman ‘afayt, wa tawallani fiman tawallayt, wa barik li fima a’tayt, wa qini sharra ma qadayt, fa innaka taqdi wa la yuqda ‘alayk, innahu la yadhillu man walayt, wa la ya’izzu man ‘adayt, tabarakta Rabbana wa ta’alayt.',
    meaning:
      'Ae Allah! Mujhe un logon mein hidayat de jinhe Tune hidayat di, un mein aafiyat de jinhe Tune aafiyat di, un mein apni dosti de jinhe Tune apni dosti di, jo Tune mujhe diya usmein barkat de, aur mujhe us faisle ki burai se bacha jo Tune kiya. Beshak Tu hi faisla karta hai aur Tere khilaf koi faisla nahi kar sakta. Jise Tu dost bana le woh kabhi zaleel nahi hota, aur jise Tu dushman bana le woh kabhi izzat nahi pata. Tu barkat wala hai, ae hamare Rab, aur Tu bahut buland hai.',
  },
  {
    id: 'witr-ke-baad',
    title: 'Witr ke baad — Subhanal-Malikil-Quddus',
    topics: ['prayer'],
    when: 'Witr ki namaz ke baad, teen baar',
    source: 'Sunan Abi Dawud 1430',
    kind: 'dua',
    arabic: 'سُبْحَانَ الْمَلِكِ الْقُدُّوسِ',
    transliteration: 'Subhanal-Malikil-Quddus. (3 baar; teesri baar awaaz buland karke)',
    meaning: 'Paak hai woh Baadshah jo har aib se paak hai.',
  },
  {
    id: 'istikhara',
    title: 'Istikhara — faisle se pehle',
    topics: ['prayer'],
    when: 'Koi aham faisla karne se pehle, do rak’at nafl ke baad',
    source: 'Sahih al-Bukhari 1166',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ، فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ، وَتَعْلَمُ وَلَا أَعْلَمُ، وَأَنْتَ عَلَّامُ الْغُيُوبِ، اللَّهُمَّ إِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ خَيْرٌ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاقْدُرْهُ لِي وَيَسِّرْهُ لِي، ثُمَّ بَارِكْ لِي فِيهِ، وَإِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ شَرٌّ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاصْرِفْهُ عَنِّي وَاصْرِفْنِي عَنْهُ، وَاقْدُرْ لِيَ الْخَيْرَ حَيْثُ كَانَ، ثُمَّ أَرْضِنِي بِهِ',
    transliteration:
      'Allahumma inni astakhiruka bi’ilmika, wa astaqdiruka bi-qudratika, wa as’aluka min fadlikal-‘azim, fa innaka taqdiru wa la aqdiru, wa ta’lamu wa la a’lamu, wa anta ‘allamul-ghuyub. Allahumma in kunta ta’lamu anna hadhal-amra khayrun li fi dini wa ma’ashi wa ‘aqibati amri, faqdurhu li wa yassirhu li, thumma barik li fih. Wa in kunta ta’lamu anna hadhal-amra sharrun li fi dini wa ma’ashi wa ‘aqibati amri, fasrifhu ‘anni wasrifni ‘anh, waqdur liyal-khayra haythu kana, thumma ardini bih.',
    meaning:
      'Ae Allah! Main Tere ilm ke zariye Tujhse behtari maangta hoon, Teri qudrat ke zariye Tujhse taaqat maangta hoon, aur Tere azeem fazl se maangta hoon. Beshak Tu qadir hai aur main qadir nahi, Tu jaanta hai aur main nahi jaanta, aur Tu ghaib ka sabse zyada jaanne wala hai. Ae Allah! Agar Tu jaanta hai ke yeh kaam mere deen, meri duniya aur mere anjaam ke liye behtar hai, to use mere liye muqarrar kar de, mere liye aasan kar de, phir usmein mere liye barkat de. Aur agar Tu jaanta hai ke yeh kaam mere deen, meri duniya aur mere anjaam ke liye bura hai, to use mujhse door kar de aur mujhe usse door kar de, aur mere liye bhalai muqarrar kar de jahan bhi ho, phir mujhe us par raazi kar de.',
    note: '‘Hadhal-amr’ (yeh kaam) ki jagah apne kaam ka naam lein.',
  },
  {
    id: 'dajjal-se-panaah',
    title: 'Salam se pehle — chaar cheezon se panaah',
    topics: ['prayer', 'protection'],
    when: 'Namaz mein, tashahhud ke baad aur salam se pehle',
    source: 'Sahih Muslim 588',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ، وَمِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ، وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
    transliteration:
      'Allahumma inni a’udhu bika min ‘adhabi jahannam, wa min ‘adhabil-qabr, wa min fitnatil-mahya wal-mamat, wa min sharri fitnatil-masihid-dajjal.',
    meaning:
      'Ae Allah! Main Jahannam ke azaab se, qabr ke azaab se, zindagi aur maut ke fitne se aur Masih ad-Dajjal ke fitne ki burai se Teri panaah maangta hoon.',
  },
  // ---- Wuzu — added 2026-11-23 ----
  {
    id: 'bismillah-wudu',
    title: 'Wuzu shuru karne se pehle',
    topics: ['wudu'],
    when: 'Wuzu shuru karte waqt',
    source: 'Sunan Abi Dawud 101',
    kind: 'dua',
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillah.',
    meaning: 'Allah ke naam se (shuru karta hoon).',
    note: 'Wuzu shuru karne se pehle ‘Bismillah’ kehna Sunnat hai — hadith mein hai ke jis wuzu mein Allah ka naam na liya jaye, woh (mukammal) wuzu nahi.',
  },
  {
    id: 'wudu-ke-baad-tawwabin',
    title: 'Wuzu ke baad — tauba karne walon mein',
    topics: ['wudu'],
    when: 'Wuzu mukammal karne ke baad',
    source: 'Jami’ at-Tirmidhi 55',
    kind: 'dua',
    arabic: 'اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ',
    transliteration: 'Allahummaj-‘alni minat-tawwabina waj-‘alni minal-mutatahhirin.',
    meaning:
      'Ae Allah! Mujhe tauba karne walon mein se bana de aur mujhe paaki ikhtiyar karne walon mein se bana de.',
  },
  {
    id: 'subhanakallahumma-wudu',
    title: 'Wuzu ke baad — paaki ki gawahi',
    topics: ['wudu'],
    when: 'Wuzu mukammal karne ke baad',
    source: 'Sunan an-Nasa’i, ‘Amal al-Yawm wal-Laylah 81',
    kind: 'dua',
    arabic:
      'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
    transliteration:
      'Subhanakallahumma wa bihamdika, ash-hadu an la ilaha illa anta, astaghfiruka wa atubu ilayk.',
    meaning:
      'Ae Allah! Tu paak hai aur tamam tareefein Tere liye hain. Main gawahi deta hoon ke Tere siwa koi ma’bood nahi. Main Tujhse maghfirat maangta hoon aur Teri taraf tauba karta hoon.',
    note: 'Wuzu ke baad yeh padhne par wuzu ka sawab (ek muhr ke saath) mehfooz kar diya jata hai.',
  },
  // ---- Azan — added 2026-11-23 ----
  {
    id: 'adhan-ke-baad',
    title: 'Azan ke baad',
    topics: ['adhan'],
    when: 'Azan ka jawab dene ke baad',
    source: 'Sahih al-Bukhari 614',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ',
    transliteration:
      'Allahumma Rabba hadhihid-da’watit-tammah, was-salatil-qa’imah, ati Muhammadan al-wasilata wal-fadilah, wab’athhu maqaman mahmudan alladhi wa’adtah.',
    meaning:
      'Ae Allah! Is mukammal da’wat aur qaim hone wali namaz ke Rab! Muhammad (ﷺ) ko Wasilah aur Fazilah ata farma, aur unhe us Maqam-e-Mahmood par pahuncha jiska Tune unse waada kiya hai.',
    note: 'Jo azan ke baad yeh dua padhe, uske liye Nabi (ﷺ) ki shafa’at wajib ho jati hai.',
  },
  {
    id: 'adhan-jawab',
    title: 'Azan ka jawab — Hayya alas-salah par',
    topics: ['adhan'],
    when: 'Azan sunte waqt',
    source: 'Sahih Muslim 385',
    kind: 'dua',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'La hawla wa la quwwata illa billah.',
    meaning: 'Buraai se bachne ki taaqat aur neki ki quwwat sirf Allah ki madad se hai.',
    note: 'Azan mein jab mu’adhdhin ‘Hayya alas-salah’ aur ‘Hayya alal-falah’ kahe, to yeh jawab dein; baaki kalimaat wahi dohraayein jo mu’adhdhin kahe.',
  },
  {
    id: 'adhan-ke-baad-darood',
    title: 'Azan ke baad — Nabi (ﷺ) par darood',
    topics: ['adhan', 'prayer'],
    when: 'Azan ka jawab dene ke baad',
    source: 'Sahih al-Bukhari 3370',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    transliteration:
      'Allahumma salli ‘ala Muhammadin wa ‘ala ali Muhammad, kama sallayta ‘ala Ibrahima wa ‘ala ali Ibrahim, innaka Hamidum-Majid. Allahumma barik ‘ala Muhammadin wa ‘ala ali Muhammad, kama barakta ‘ala Ibrahima wa ‘ala ali Ibrahim, innaka Hamidum-Majid.',
    meaning:
      'Ae Allah! Muhammad (ﷺ) par aur unki aal par rehmat nazil farma, jaise Tune Ibrahim (A) par aur unki aal par rehmat nazil farmayi. Beshak Tu tareef ke laiq aur buzurg hai. Ae Allah! Muhammad (ﷺ) par aur unki aal par barkat nazil farma, jaise Tune Ibrahim (A) par aur unki aal par barkat nazil farmayi. Beshak Tu tareef ke laiq aur buzurg hai.',
    note: 'Azan ka jawab dene ke baad Nabi (ﷺ) par darood padhein, phir azan ke baad ki dua padhein.',
  },
  // ---- Masjid — added 2026-11-23 ----
  {
    id: 'masjid-jate-waqt-noor',
    title: 'Masjid jaate waqt — noor ki dua',
    topics: ['mosque'],
    when: 'Masjid ki taraf jaate waqt',
    source: 'Sahih al-Bukhari 6316',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ اجْعَلْ فِي قَلْبِي نُورًا، وَفِي لِسَانِي نُورًا، وَفِي سَمْعِي نُورًا، وَفِي بَصَرِي نُورًا، وَمِنْ فَوْقِي نُورًا، وَمِنْ تَحْتِي نُورًا، وَعَنْ يَمِينِي نُورًا، وَعَنْ شِمَالِي نُورًا، وَمِنْ أَمَامِي نُورًا، وَمِنْ خَلْفِي نُورًا، وَاجْعَلْ فِي نَفْسِي نُورًا، وَأَعْظِمْ لِي نُورًا',
    transliteration:
      'Allahummaj-‘al fi qalbi nuran, wa fi lisani nuran, wa fi sam’i nuran, wa fi basari nuran, wa min fawqi nuran, wa min tahti nuran, wa ‘an yamini nuran, wa ‘an shimali nuran, wa min amami nuran, wa min khalfi nuran, waj-‘al fi nafsi nuran, wa a’zim li nuran.',
    meaning:
      'Ae Allah! Mere dil mein noor de, meri zubaan mein noor de, meri sama’at mein noor de, meri basarat mein noor de, mere upar noor de, mere neeche noor de, mere daayein noor de, mere baayein noor de, mere saamne noor de, mere peeche noor de, mere nafs mein noor de, aur mere liye noor ko azeem kar de.',
  },
  {
    id: 'masjid-dakhil',
    title: 'Masjid mein dakhil hote waqt',
    topics: ['mosque'],
    when: 'Masjid mein daayein paer se dakhil hote waqt',
    source: 'Sahih Muslim 713',
    kind: 'dua',
    arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Allahummaftah li abwaba rahmatik.',
    meaning: 'Ae Allah! Mere liye apni rehmat ke darwaze khol de.',
  },
  {
    id: 'masjid-se-nikalte',
    title: 'Masjid se nikalte waqt',
    topics: ['mosque'],
    when: 'Masjid se baayein paer se bahar nikalte waqt',
    source: 'Sahih Muslim 713',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
    transliteration: 'Allahumma inni as’aluka min fadlik.',
    meaning: 'Ae Allah! Main Tujhse Tere fazl (meherbani) ka sawal karta hoon.',
  },
  {
    id: 'masjid-dakhil-shaitan-se-panaah',
    title: 'Masjid mein dakhil hote waqt — shaitan se panaah',
    topics: ['mosque', 'protection'],
    when: 'Masjid mein dakhil hote waqt',
    source: 'Sunan Abi Dawud 466',
    kind: 'dua',
    arabic:
      'أَعُوذُ بِاللَّهِ الْعَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration:
      'A’udhu billahil-‘Azim, wa bi-wajhihil-karim, wa sultanihil-qadim, minash-shaytanir-rajim.',
    meaning:
      'Main Allah-e-Azeem ki, uske kareem chehre ki aur uski qadeem saltanat ki panaah maangta hoon, shaitan-e-mardood se.',
    note: 'Masjid mein dakhil hote waqt yeh padhne par shaitan kehta hai: ‘Aaj ke din yeh mujhse mehfooz ho gaya.’',
  },
  // ---- Khana — added 2026-11-23 ----
  {
    id: 'khane-ke-baad-2',
    title: 'Khane ke baad — khilaya, pilaya, Musalman banaya',
    topics: ['food'],
    when: 'Khana khatam karne ke baad',
    source: 'Sunan Abi Dawud 3850; Jami’ at-Tirmidhi 3457',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مِنَ الْمُسْلِمِينَ',
    transliteration: 'Alhamdu lillahil-ladhi at’amana wa saqana wa ja’alana minal-muslimin.',
    meaning:
      'Tamam tareefein Allah ke liye hain, jisne humein khilaya aur pilaya aur humein Musalmanon mein se banaya.',
  },
  {
    id: 'doodh-peene-ki-dua',
    title: 'Doodh peene par',
    topics: ['food'],
    when: 'Doodh peene se pehle',
    source: 'Jami’ at-Tirmidhi 3455; Sunan Abi Dawud 3730',
    kind: 'dua',
    arabic: 'اللَّهُمَّ بَارِكْ لَنَا فِيهِ وَزِدْنَا مِنْهُ',
    transliteration: 'Allahumma barik lana fihi wa zidna minhu.',
    meaning: 'Ae Allah! Ismein hamare liye barkat de aur humein isse zyada ata farma.',
  },
  {
    id: 'mehmaan-ki-dua',
    title: 'Mezban ke liye dua',
    topics: ['food', 'family'],
    when: 'Kisi ke ghar khana khane ke baad',
    source: 'Sahih Muslim 2042',
    kind: 'dua',
    arabic: 'اللَّهُمَّ بَارِكْ لَهُمْ فِيمَا رَزَقْتَهُمْ، وَاغْفِرْ لَهُمْ وَارْحَمْهُمْ',
    transliteration: 'Allahumma barik lahum fima razaqtahum, waghfir lahum warhamhum.',
    meaning:
      'Ae Allah! Jo rizq Tune unhe diya hai, usmein unke liye barkat de, unhe bakhsh de aur un par raham farma.',
  },
  {
    id: 'iftar-ki-dua',
    title: 'Iftar — roza kholte waqt',
    topics: ['food'],
    when: 'Roza kholte waqt (iftar)',
    source: 'Sunan Abi Dawud 2357',
    kind: 'dua',
    arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ',
    transliteration: 'Dhahabaz-zama’u wabtallatil-‘uruqu wa thabatal-ajru in sha Allah.',
    meaning: 'Pyaas chali gayi, ragein tar ho gayin, aur sawab sabit ho gaya, in sha Allah.',
  },
  {
    id: 'khana-khilane-wale',
    title: 'Khilane wale ke liye dua',
    topics: ['food'],
    when: 'Koi khilaye ya pilaye to uske liye',
    source: 'Sahih Muslim 2055',
    kind: 'dua',
    arabic: 'اللَّهُمَّ أَطْعِمْ مَنْ أَطْعَمَنِي وَاسْقِ مَنْ سَقَانِي',
    transliteration: 'Allahumma at’im man at’amani wasqi man saqani.',
    meaning: 'Ae Allah! Jisne mujhe khilaya, use khila; aur jisne mujhe pilaya, use pila.',
  },
  // ---- Neend — added 2026-11-23 ----
  {
    id: 'allahumma-qini-adhabak',
    title: 'Sone se pehle — azaab se panaah',
    topics: ['sleep'],
    when: 'Sone se pehle, teen baar',
    source: 'Jami’ at-Tirmidhi 3398; Sunan Abi Dawud 5045',
    kind: 'dua',
    arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
    transliteration: 'Allahumma qini ‘adhabaka yawma tab’athu ‘ibadak. (3 baar)',
    meaning:
      'Ae Allah! Us din apne azaab se mujhe bacha le, jis din Tu apne bandon ko (qabron se) uthayega.',
  },
  {
    id: 'neend-mein-dar',
    title: 'Neend mein darr ya ghabrahat',
    topics: ['sleep', 'protection'],
    when: 'Neend mein darr lage to',
    source: 'Sunan Abi Dawud 3893; Jami’ at-Tirmidhi 3528',
    kind: 'dua',
    arabic:
      'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ وَشَرِّ عِبَادِهِ وَمِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَنْ يَحْضُرُونِ',
    transliteration:
      'A’udhu bikalimatillah it-tammati min ghadabihi wa ‘iqabihi wa sharri ‘ibadihi wa min hamazatish-shayatini wa an yahdurun.',
    meaning:
      'Main Allah ke mukammal kalimaat ki panaah maangta hoon, uske gusse se, uske azaab se, uske bandon ki burai se, shayateen ke waswason se aur is se ke woh mere paas haazir hon.',
  },
  {
    id: 'bura-khwab',
    title: 'Bura khwab dekhein to',
    topics: ['sleep'],
    when: 'Bura khwab dekhne ke baad',
    source: 'Sahih al-Bukhari 7045',
    kind: 'dua',
    arabic: 'أَعُوذُ بِاللَّهِ مِنْ شَرِّهَا',
    transliteration: 'A’udhu billahi min sharriha.',
    meaning: 'Main Allah ki panaah maangta hoon is (bure khwab) ki burai se.',
    note: 'Bura khwab dekhein to baayein taraf teen baar halki si thook dein, Allah ki panaah maangein aur us khwab ke baare mein kisi ko na batayein — woh nuqsan nahi pahuncha sakta.',
  },
  {
    id: 'raat-ko-jaagne-par',
    title: 'Raat ko neend se jaag jayein to',
    topics: ['sleep', 'morning'],
    when: 'Raat ko neend se jaag jayein to',
    source: 'Sahih al-Bukhari 1154',
    kind: 'dua',
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ، اللَّهُمَّ اغْفِرْ لِي',
    transliteration:
      'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir, subhanallahi wal-hamdu lillahi wa la ilaha illallahu wallahu akbar, wa la hawla wa la quwwata illa billah, Allahummaghfir li.',
    meaning:
      'Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; baadshahat usi ki hai, tareef usi ki hai, aur woh har cheez par qadir hai. SubhanAllah, Alhamdulillah, La ilaha illallah, Allahu Akbar, aur buraai se bachne ki taaqat aur neki ki quwwat sirf Allah ki madad se hai. Ae Allah! Mujhe bakhsh de.',
    note: 'Raat ko jaag jayein to yeh padhein — phir jo dua maangein, qubool hoti hai, aur wuzu karke namaz padhein to qubool hoti hai.',
  },
  // ---- Safar — added 2026-11-23 ----
  {
    id: 'sawari-par',
    title: 'Sawari par sawaar hote waqt',
    topics: ['travel'],
    when: 'Kisi bhi sawari (gaadi, train, hawai jahaz) par sawaar hote waqt',
    source: 'Quran 43:13-14',
    kind: 'dua',
    arabic:
      'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
    transliteration:
      'Subhanalladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila rabbina lamunqalibun.',
    meaning:
      'Paak hai woh zaat jisne is (sawari) ko hamare liye musakhkhar kar diya, jabke hum use apne bas mein karne wale nahi the; aur beshak hum apne Rab ki taraf lautne wale hain.',
  },
  {
    id: 'safar-ki-dua',
    title: 'Safar ki dua',
    topics: ['travel'],
    when: 'Safar shuru karte waqt',
    source: 'Sahih Muslim 1342',
    kind: 'dua',
    arabic:
      'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ، اللَّهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى، اللَّهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا وَاطْوِ عَنَّا بُعْدَهُ، اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ وَالْخَلِيفَةُ فِي الْأَهْلِ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ وَكَآبَةِ الْمَنْظَرِ وَسُوءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ',
    transliteration:
      'Allahu Akbar, Allahu Akbar, Allahu Akbar, Subhanalladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila rabbina lamunqalibun. Allahumma inna nas’aluka fi safarina hadha al-birra wat-taqwa, wa minal-‘amali ma tarda, Allahumma hawwin ‘alayna safarana hadha watwi ‘anna bu’dah, Allahumma antas-sahibu fis-safari wal-khalifatu fil-ahl, Allahumma inni a’udhu bika min wa’tha’is-safari wa ka’abatil-manzari wa su’il-munqalabi fil-mali wal-ahl.',
    meaning:
      'Allah sabse bada hai (teen baar). Paak hai woh zaat jisne is (sawari) ko hamare liye musakhkhar kar diya… Ae Allah! Hum is safar mein Tujhse neki aur taqwa maangte hain, aur woh amal jo Tujhe pasand ho. Ae Allah! Hamara yeh safar hamare liye aasan kar de aur iski doori hamare liye samet de. Ae Allah! Tu hi safar mein (hamara) saathi hai aur ghar walon mein (hamara) khalifa hai. Ae Allah! Main safar ki mushkil, manzar ki udaasi aur maal-o-aulad mein bure palatne se Teri panaah maangta hoon.',
  },
  {
    id: 'safar-se-wapsi',
    title: 'Safar se wapas aate waqt',
    topics: ['travel'],
    when: 'Safar se wapas aate waqt',
    source: 'Sahih Muslim 1342',
    kind: 'dua',
    arabic: 'آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ',
    transliteration: 'Ayibuna ta’ibuna ‘abiduna li-rabbina hamidun.',
    meaning:
      'Hum lautne wale hain, tauba karne wale hain, apne Rab ki ibadat karne wale hain, apne Rab ki hamd karne wale hain.',
    note: 'Safar se wapas aate waqt safar ki dua ke saath yeh bhi padhein.',
  },
  {
    id: 'nayi-jagah',
    title: 'Safar mein nayi jagah par rukein to',
    topics: ['travel', 'protection'],
    when: 'Safar mein kisi nayi jagah par pahunchein ya rukhein to',
    source: 'Sahih Muslim 2708',
    kind: 'dua',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: 'A’udhu bikalimatillah it-tammati min sharri ma khalaq.',
    meaning:
      'Main Allah ke mukammal kalimaat ki panaah maangta hoon, uski har makhlooq ki burai se.',
    note: 'Jab tak wahan rahein, koi cheez nuqsan nahi pahuncha sakti.',
  },
  {
    id: 'safar-mein-chadhai',
    title: 'Safar mein chadhai aur utrai par',
    topics: ['travel'],
    when: 'Safar mein chadhai par ya utrai par',
    source: 'Sahih al-Bukhari 2993',
    kind: 'dua',
    arabic: 'اللَّهُ أَكْبَرُ — سُبْحَانَ اللَّهِ',
    transliteration: 'Chadhai (upar) chadhte waqt: Allahu Akbar. Utrai (neeche) utarte waqt: SubhanAllah.',
    meaning: 'Allahu Akbar — Allah sabse bada hai. SubhanAllah — Allah paak hai.',
    note: 'Safar mein chadhai par ‘Allahu Akbar’ aur utrai par ‘SubhanAllah’ kehna Sunnat hai.',
  },
  // ---- Mushkil / takleef — added 2026-11-23 ----
  {
    id: 'ya-hayyu-ya-qayyum',
    title: 'Ya Hayyu, Ya Qayyum — rehmat se madad maango',
    topics: ['distress', 'morning', 'evening'],
    when: 'Jab koi baat pareshan kare; subah-shaam bhi',
    source: 'Jami’ at-Tirmidhi 3524; Hisn al-Muslim #88',
    kind: 'dua',
    arabic:
      'يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
    transliteration:
      'Ya Hayyu ya Qayyum, bi-rahmatika astaghith, aslih li sha’ni kullahu, wa la takilni ila nafsi tarfata ‘ayn.',
    meaning:
      'Ae hamesha zinda rehne wale! Ae sab ko qaim rakhne wale! Main Teri rehmat ke zariye madad maangta hoon. Mere saare kaam sudhaar de, aur mujhe ek pal ke liye bhi mere nafs ke hawale na kar.',
    note: 'Nabi (ﷺ) jab kisi baat se pareshan hote, to yeh dua padhte the.',
  },
  {
    id: 'allah-allah-rabbi',
    title: 'Allah, Allah mera Rab hai',
    topics: ['distress', 'anxiety'],
    when: 'Pareshani ya gham mein',
    source: 'Sunan Abi Dawud 1525',
    kind: 'dua',
    arabic: 'اللَّهُ، اللَّهُ رَبِّي، لَا أُشْرِكُ بِهِ شَيْئًا',
    transliteration: 'Allahu, Allahu Rabbi, la ushriku bihi shay’a.',
    meaning: 'Allah, Allah mera Rab hai — main uske saath kisi ko shareek nahi karta.',
  },
  {
    id: 'rabbi-inni-maghloob',
    title: 'Nuh (A) ki dua — main haar gaya, Tu madad farma',
    topics: ['distress'],
    when: 'Jab sab taraf se mayoosi ho',
    source: 'Quran 54:10',
    kind: 'dua',
    arabic: 'رَبِّ إِنِّي مَغْلُوبٌ فَانْتَصِرْ',
    transliteration: 'Rabbi inni maghlubun fantasir.',
    meaning: 'Ae mere Rab! Main haar gaya hoon (kamzor pad gaya hoon), to Tu (meri) madad farma.',
    note: 'Hazrat Nuh (A) ne apni qaum se mayoos hokar yeh dua ki thi.',
  },
  {
    id: 'rabbi-inni-massaniyad-durr',
    title: 'Ayyub (A) ki dua — takleef mein',
    topics: ['distress', 'sickness'],
    when: 'Bimari ya kisi bhi takleef mein',
    source: 'Quran 21:83',
    kind: 'dua',
    arabic: 'أَنِّي مَسَّنِيَ الضُّرُّ وَأَنْتَ أَرْحَمُ الرَّاحِمِينَ',
    transliteration: 'Anni massaniyad-durru wa anta arhamur-rahimin.',
    meaning: 'Beshak mujhe takleef pahunchi hai, aur Tu sabse zyada raham karne wala hai.',
    note: 'Hazrat Ayyub (A) ki dua hai — yeh Quran ki ayat 21:83 ka hissa hai.',
  },
  {
    id: 'allahumma-la-sahla',
    title: 'Mushkil kaam aasan karne ki dua',
    topics: ['distress', 'knowledge'],
    when: 'Koi mushkil kaam ya imtihan ho to',
    source: 'Sahih Ibn Hibban 2427',
    kind: 'dua',
    arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
    transliteration:
      'Allahumma la sahla illa ma ja’altahu sahlan, wa anta taj’alul-hazna idha shi’ta sahlan.',
    meaning:
      'Ae Allah! Koi kaam aasan nahi, siwa uske jise Tu aasan kar de; aur Tu jab chahe mushkil ko aasan kar deta hai.',
  },
  // ---- Shukr — added 2026-11-23 ----
  {
    id: 'alhamdulillah-bini-matihi',
    title: 'Achhi khabar par — shukr',
    topics: ['gratitude'],
    when: 'Koi achhi khabar mile ya koi nek kaam poora ho to',
    source: 'Sunan Ibn Majah 3803',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
    transliteration: 'Alhamdu lillahil-ladhi bini’matihi tatimmus-salihat.',
    meaning: 'Tamam tareefein Allah ke liye hain, jiski ni’mat se nek kaam mukammal hote hain.',
  },
  {
    id: 'ni-amat-par-shukr',
    title: 'Subah — har ni’mat ka shukr',
    topics: ['gratitude', 'morning'],
    when: 'Subah ko',
    source: 'Sunan Abi Dawud 5073',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
    transliteration:
      'Allahumma ma asbaha bi min ni’matin aw bi-ahadin min khalqika faminka wahdaka la sharika lak, falakal-hamdu wa lakash-shukr.',
    meaning:
      'Ae Allah! Jo bhi ni’mat subah ko mujhe mili, ya Teri kisi makhlooq ko mili, woh sirf Teri taraf se hai, Tu akela hai, Tera koi shareek nahi — to tareef Teri hi hai aur shukr Tera hi hai.',
    note: 'Subah yeh padhne wala din bhar ka shukr ada kar deta hai; shaam ko ‘ma asbaha’ ki jagah ‘ma amsa’ kahein.',
  },
  {
    id: 'alhamdulillah-ala-kulli-hal',
    title: 'Har haal mein — Alhamdulillah',
    topics: ['gratitude'],
    when: 'Koi na-pasand cheez ho to',
    source: 'Sunan Ibn Majah 3803',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ عَلَى كُلِّ حَالٍ',
    transliteration: 'Alhamdu lillahi ‘ala kulli hal.',
    meaning: 'Har haal mein tamam tareefein Allah ke liye hain.',
  },
  {
    id: 'naya-kapda',
    title: 'Naya kapda pehenne par',
    topics: ['daily', 'gratitude'],
    when: 'Naya kapda pehli baar pehenne par',
    source: 'Sunan Abi Dawud 4020; Jami’ at-Tirmidhi 1767',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ لَكَ الْحَمْدُ أَنْتَ كَسَوْتَنِيهِ، أَسْأَلُكَ مِنْ خَيْرِهِ وَخَيْرِ مَا صُنِعَ لَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّهِ وَشَرِّ مَا صُنِعَ لَهُ',
    transliteration:
      'Allahumma lakal-hamdu anta kasawtanihi, as’aluka min khayrihi wa khayri ma suni’a lah, wa a’udhu bika min sharrihi wa sharri ma suni’a lah.',
    meaning:
      'Ae Allah! Tareef Teri hi hai, Tune mujhe yeh pehnaya. Main Tujhse iski bhalai aur jis kaam ke liye yeh banaya gaya uski bhalai maangta hoon, aur iski burai aur jis kaam ke liye yeh banaya gaya uski burai se Teri panaah maangta hoon.',
  },
  {
    id: 'hamdan-kathiran',
    title: 'Bahut zyada, paak aur barkat wali tareef',
    topics: ['gratitude', 'prayer'],
    when: 'Namaz mein ruku se uthte waqt',
    source: 'Sahih al-Bukhari 799',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ',
    transliteration: 'Alhamdu lillahi hamdan kathiran tayyiban mubarakan fih.',
    meaning: 'Tamam tareefein Allah ke liye hain — bahut zyada, paak aur barkat wali tareef.',
    note: 'Namaz mein ruku se uthte waqt ek sahabi ne yeh kaha tha, aur Nabi (ﷺ) ne farmaya ke farishte iska sawab likhne ke liye ek dusre se aage badhne lage.',
  },
  // ---- Hifazat — added 2026-11-23 ----
  {
    id: 'la-ilaha-illallahu-100',
    title: 'Din mein 100 baar — shaitan se hifazat',
    topics: ['protection', 'morning'],
    when: 'Din mein kabhi bhi, 100 baar',
    source: 'Sahih al-Bukhari 3293; Sahih Muslim 2691',
    kind: 'dua',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ‘ala kulli shay’in qadir. (100 baar)',
    meaning:
      'Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; baadshahat usi ki hai, tareef usi ki hai, aur woh har cheez par qadir hai.',
    note: 'Din mein 100 baar padhne wala us din shaitan se mehfooz rehta hai aur use 10 ghulamon ko aazad karne ke barabar sawab milta hai.',
  },
  {
    id: 'ruqyah-jibril',
    title: 'Ruqyah — Jibril (A) ki dua',
    topics: ['sickness', 'protection'],
    when: 'Bimari ya nazar se hifazat ke liye',
    source: 'Sahih Muslim 2186',
    kind: 'dua',
    arabic:
      'بِسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللَّهُ يَشْفِيكَ، بِسْمِ اللَّهِ أَرْقِيكَ',
    transliteration:
      'Bismillahi arqika, min kulli shay’in yu’dhika, min sharri kulli nafsin aw ‘ayni hasid, Allahu yashfika, Bismillahi arqika.',
    meaning:
      'Allah ke naam se main tum par ruqyah (dam) karta hoon — har us cheez se jo tumhe takleef de, har nafs ki burai se aur hasad karne wale ki nazar se. Allah tumhe shifa de; Allah ke naam se main tum par ruqyah karta hoon.',
    note: 'Hazrat Jibril (A) ne Nabi (ﷺ) ke liye yeh ruqyah ki thi.',
  },
  {
    id: 'nazar-se-panaah-bacchon',
    title: 'Bacchon ke liye — nazar se panaah',
    topics: ['protection', 'family'],
    when: 'Bacchon ke liye, kisi bhi waqt',
    source: 'Sahih al-Bukhari 3371',
    kind: 'dua',
    arabic: 'أُعِيذُكَ بِكَلِمَاتِ اللَّهِ التَّامَّةِ، مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    transliteration:
      'U’idhuka bikalimatillah it-tammati min kulli shaytanin wa hammah, wa min kulli ‘aynin lammah.',
    meaning:
      'Main tumhe Allah ke mukammal kalimaat ki panaah mein deta hoon — har shaitan se, har zehrele janwar se, aur har buri nazar se.',
    note: 'Nabi (ﷺ) apne nawason Hasan aur Husain (R) ke liye yeh dua padhte the; ek bacche ke liye ‘u’idhuka’, do ke liye ‘u’idhukuma’ kahein.',
  },
  {
    id: 'allahumma-inni-a-udhu-min-zawali',
    title: 'Ni’mat chhin jaane se panaah',
    topics: ['protection', 'gratitude'],
    when: 'Subah-shaam ya jab bhi darr ho',
    source: 'Sahih Muslim 2739',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ زَوَالِ نِعْمَتِكَ، وَتَحَوُّلِ عَافِيَتِكَ، وَفُجَاءَةِ نِقْمَتِكَ، وَجَمِيعِ سَخَطِكَ',
    transliteration:
      'Allahumma inni a’udhu bika min zawali ni’matik, wa tahawwuli ‘afiyatik, wa fuja’ati niqmatik, wa jami’i sakhatik.',
    meaning:
      'Ae Allah! Main Teri panaah maangta hoon Teri ni’mat ke chhin jaane se, Teri aafiyat ke badal jaane se, Tere achanak azaab se aur Tere har tarah ke ghusse se.',
  },
  {
    id: 'allahumma-inni-a-udhu-min-sharri-ma-amiltu',
    title: 'Apne kiye aur na kiye ki burai se panaah',
    topics: ['protection', 'daily'],
    when: 'Subah-shaam ya jab bhi dil chahe',
    source: 'Sahih Muslim 2716',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ مَا عَمِلْتُ وَمِنْ شَرِّ مَا لَمْ أَعْمَلْ',
    transliteration: 'Allahumma inni a’udhu bika min sharri ma ‘amiltu wa min sharri ma lam a’mal.',
    meaning:
      'Ae Allah! Main Teri panaah maangta hoon us burai se jo maine ki, aur us burai se jo maine nahi ki (lekin kar sakta hoon).',
  },
  // ---- Bimari — added 2026-11-23 ----
  {
    id: 'as-alullahal-azim',
    title: 'Bimar ke liye — saat baar shifa ki dua',
    topics: ['sickness'],
    when: 'Bimar ki ayadat par, saat baar',
    source: 'Sunan Abi Dawud 3106; Jami’ at-Tirmidhi 2083',
    kind: 'dua',
    arabic: 'أَسْأَلُ اللَّهَ الْعَظِيمَ، رَبَّ الْعَرْشِ الْعَظِيمِ، أَنْ يَشْفِيَكَ',
    transliteration: 'As’alullahal-‘Azima, Rabbal-‘Arshil-‘Azimi, an yashfiyak. (7 baar)',
    meaning: 'Main Allah-e-Azeem se, Azeem Arsh ke Rab se maangta hoon ke woh tumhe shifa de.',
  },
  {
    id: 'allahumma-rabban-nas',
    title: 'Bimar ke liye — Rabban-nas, shifa de',
    topics: ['sickness'],
    when: 'Bimar ki ayadat par, haath pherte hue',
    source: 'Sahih al-Bukhari 5675; Sahih Muslim 2191',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَأْسَ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا',
    transliteration:
      'Allahumma Rabban-nas, adhhibil-ba’s, ishfi antash-Shafi, la shifa’a illa shifa’uk, shifa’an la yughadiru saqama.',
    meaning:
      'Ae Allah, logon ke Rab! Takleef door kar de, shifa de — Tu hi Shifa dene wala hai. Teri shifa ke siwa koi shifa nahi, aisi shifa jo koi bimari baaki na chhode.',
  },
  {
    id: 'dard-par-haath',
    title: 'Dard wali jagah par haath rakh kar',
    topics: ['sickness'],
    when: 'Jism ke kisi hisse mein dard ho to',
    source: 'Sahih Muslim 2202',
    kind: 'dua',
    arabic:
      'بِسْمِ اللَّهِ، بِسْمِ اللَّهِ، بِسْمِ اللَّهِ، أَعُوذُ بِاللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
    transliteration:
      'Bismillah (3 baar), phir: A’udhu billahi wa qudratihi min sharri ma ajidu wa uhadhir (7 baar).',
    meaning:
      'Allah ke naam se (teen baar). Main Allah ki aur uski qudrat ki panaah maangta hoon us takleef ki burai se jo main mehsoos kar raha hoon aur jiska mujhe darr hai.',
    note: 'Jism ke jis hisse mein dard ho, wahan haath rakh kar yeh padhein.',
  },
  {
    id: 'la-ba-sa-tahurun',
    title: 'Bimar se — koi baat nahi, paaki hai',
    topics: ['sickness'],
    when: 'Bimar ki ayadat par',
    source: 'Sahih al-Bukhari 5656',
    kind: 'dua',
    arabic: 'لَا بَأْسَ، طَهُورٌ إِنْ شَاءَ اللَّهُ',
    transliteration: 'La ba’sa, tahurun in sha Allah.',
    meaning: 'Koi baat nahi, yeh (bimari) paak karne wali hai, in sha Allah.',
  },
  // ---- Maghfirat — added 2026-11-23 ----
  {
    id: 'astaghfirullah-100',
    title: 'Astaghfirullah — 100 baar',
    topics: ['forgiveness'],
    when: 'Din mein kabhi bhi',
    source: 'Sahih Muslim 2702',
    kind: 'dua',
    arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfirullaha wa atubu ilayh. (100 baar)',
    meaning: 'Main Allah se maghfirat maangta hoon aur uski taraf tauba karta hoon.',
    note: 'Nabi (ﷺ) din mein 100 se zyada baar istighfar karte the.',
  },
  {
    id: 'allahumma-innaka-afuwwun',
    title: 'Laylatul Qadr ki dua',
    topics: ['forgiveness'],
    when: 'Laylatul Qadr mein, aur jab bhi maafi chaahiye',
    source: 'Jami’ at-Tirmidhi 3513',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    transliteration: 'Allahumma innaka ‘afuwwun tuhibbul-‘afwa fa’fu ‘anni.',
    meaning: 'Ae Allah! Beshak Tu bahut maaf karne wala hai, maafi ko pasand karta hai — to mujhe maaf farma.',
  },
  {
    id: 'allahummaghfir-li-warhamni',
    title: 'Bakhsh de, raham farma, aafiyat de, rizq de',
    topics: ['forgiveness'],
    when: 'Namaz ke baad ya jab bhi dil chahe',
    source: 'Sahih Muslim 2696',
    kind: 'dua',
    arabic: 'اللَّهُمَّ اغْفِرْ لِي وَارْحَمْنِي وَعَافِنِي وَارْزُقْنِي',
    transliteration: 'Allahummaghfir li warhamni wa ‘afini warzuqni.',
    meaning: 'Ae Allah! Mujhe bakhsh de, mujh par raham farma, mujhe aafiyat de aur mujhe rizq de.',
  },
  {
    id: 'astaghfirullahal-hayy',
    title: 'Hamesha zinda rehne wale se maghfirat',
    topics: ['forgiveness'],
    when: 'Jab bhi tauba karni ho',
    source: 'Sunan Abi Dawud 1517; Jami’ at-Tirmidhi 3577',
    kind: 'dua',
    arabic: 'أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ',
    transliteration: 'Astaghfirullahal-ladhi la ilaha illa huwal-Hayyul-Qayyumu wa atubu ilayh.',
    meaning:
      'Main us Allah se maghfirat maangta hoon, jiske siwa koi ma’bood nahi — jo hamesha zinda hai aur sab ko qaim rakhne wala hai — aur main uski taraf tauba karta hoon.',
    note: 'Jo yeh padhe, uske gunah maaf kar diye jate hain, chahe woh jang se bhaaga ho.',
  },
  {
    id: 'rabbighfir-li-wa-tub',
    title: 'Mere Rab, bakhsh de aur tauba qubool farma',
    topics: ['forgiveness'],
    when: 'Ek baithak mein 100 baar (Nabi (ﷺ) ki Sunnat)',
    source: 'Sunan Abi Dawud 1516; Jami’ at-Tirmidhi 3434',
    kind: 'dua',
    arabic: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ',
    transliteration: 'Rabbighfir li wa tub ‘alayya, innaka antat-Tawwabur-Rahim. (100 baar)',
    meaning: 'Ae mere Rab! Mujhe bakhsh de aur meri tauba qubool farma. Beshak Tu hi tauba qubool karne wala, raham karne wala hai.',
  },
  {
    id: 'rabbana-atina',
    title: 'Duniya aur aakhirat ki bhalai',
    topics: ['forgiveness', 'daily'],
    when: 'Namaz mein, aur jab bhi dil chahe',
    source: 'Quran 2:201',
    kind: 'dua',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: 'Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina ‘adhaban-nar.',
    meaning: 'Ae hamare Rab! Humein duniya mein bhalai de, aakhirat mein bhi bhalai de, aur humein aag ke azaab se bacha le.',
  },
  {
    id: 'rabbana-zalamna',
    title: 'Adam (A) ki tauba',
    topics: ['forgiveness'],
    when: 'Galti ka ehsaas ho to',
    source: 'Quran 7:23',
    kind: 'dua',
    arabic: 'رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِنْ لَمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ',
    transliteration: 'Rabbana zalamna anfusana wa in lam taghfir lana wa tarhamna lanakunanna minal-khasirin.',
    meaning:
      'Ae hamare Rab! Humne apne nafs par zulm kiya, aur agar Tune humein na bakhsha aur hum par raham na farmaya, to hum zaroor nuksan uthane walon mein se ho jayenge.',
    note: 'Hazrat Adam (A) aur Hazrat Hawwa (A) ki tauba ki dua hai.',
  },
  // ---- Ilm — added 2026-11-23 ----
  {
    id: 'rabbi-zidni-ilma',
    title: 'Mera ilm badha de',
    topics: ['knowledge'],
    when: 'Padhai shuru karne se pehle, ya jab bhi dil chahe',
    source: 'Quran 20:114',
    kind: 'dua',
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: 'Rabbi zidni ‘ilma.',
    meaning: 'Ae mere Rab! Mera ilm badha de.',
  },
  {
    id: 'allahumma-infani',
    title: 'Jo seekha, usse faida de',
    topics: ['knowledge'],
    when: 'Padhai se pehle ya baad mein',
    source: 'Jami’ at-Tirmidhi 3599',
    kind: 'dua',
    arabic: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا',
    transliteration: 'Allahumma infa’ni bima ‘allamtani, wa ‘allimni ma yanfa’uni, wa zidni ‘ilma.',
    meaning: 'Ae Allah! Jo Tune mujhe sikhaya, usse mujhe faida pahuncha; aur mujhe woh sikha jo mujhe faida de; aur mera ilm badha de.',
  },
  {
    id: 'allahumma-inni-a-udhu-min-ilmin',
    title: 'Be-faida ilm se panaah',
    topics: ['knowledge'],
    when: 'Padhai se pehle, ya jab bhi dil chahe',
    source: 'Sahih Muslim 2722',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ، وَمِنْ قَلْبٍ لَا يَخْشَعُ، وَمِنْ نَفْسٍ لَا تَشْبَعُ، وَمِنْ دَعْوَةٍ لَا يُسْتَجَابُ لَهَا',
    transliteration:
      'Allahumma inni a’udhu bika min ‘ilmin la yanfa’, wa min qalbin la yakhsha’, wa min nafsin la tashba’, wa min da’watin la yustajabu laha.',
    meaning:
      'Ae Allah! Main Teri panaah maangta hoon us ilm se jo faida na de, us dil se jo na dare (khushu na rakhe), us nafs se jo kabhi na bhare, aur us dua se jo qubool na ho.',
  },
  {
    id: 'allahumma-inni-asaluka-huda',
    title: 'Hidayat, taqwa, paak-damani, be-niyazi',
    topics: ['knowledge', 'work'],
    when: 'Subah-shaam ya jab bhi dil chahe',
    source: 'Sahih Muslim 2721',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
    transliteration: 'Allahumma inni as’alukal-huda wat-tuqa wal-‘afafa wal-ghina.',
    meaning: 'Ae Allah! Main Tujhse hidayat, taqwa, paak-damani aur (dil ki) be-niyazi maangta hoon.',
  },
  // ---- Ghar / parivar — added 2026-11-23 ----
  {
    id: 'rabbana-hab-lana',
    title: 'Biwi-bacchon se aankhon ki thandak',
    topics: ['family'],
    when: 'Ghar walon ke liye, jab bhi dil chahe',
    source: 'Quran 25:74',
    kind: 'dua',
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    transliteration: 'Rabbana hab lana min azwajina wa dhurriyyatina qurrata a’yunin waj’alna lil-muttaqina imama.',
    meaning:
      'Ae hamare Rab! Humein hamari biwiyon aur hamari aulaad se aankhon ki thandak ata farma, aur humein muttaqiyon ka imam (rehnuma) bana de.',
  },
  {
    id: 'rabbi-hab-li-minas-salihin',
    title: 'Nek aulaad ke liye',
    topics: ['family'],
    when: 'Aulaad ke liye dua karte waqt',
    source: 'Quran 37:100',
    kind: 'dua',
    arabic: 'رَبِّ هَبْ لِي مِنَ الصَّالِحِينَ',
    transliteration: 'Rabbi hab li minas-salihin.',
    meaning: 'Ae mere Rab! Mujhe nek (aulaad) ata farma.',
    note: 'Hazrat Ibrahim (A) ki dua hai.',
  },
  {
    id: 'rabbi-awzi-ni',
    title: 'Shukr ki taufeeq — Sulaiman (A) ki dua',
    topics: ['family', 'gratitude'],
    when: 'Shukr ada karte waqt',
    source: 'Quran 27:19',
    kind: 'dua',
    arabic:
      'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَى وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَدْخِلْنِي بِرَحْمَتِكَ فِي عِبَادِكَ الصَّالِحِينَ',
    transliteration:
      'Rabbi awzi’ni an ashkura ni’matakallati an’amta ‘alayya wa ‘ala walidayya wa an a’mala salihan tardahu wa adkhilni bi-rahmatika fi ‘ibadikas-salihin.',
    meaning:
      'Ae mere Rab! Mujhe taufeeq de ke main Teri us ni’mat ka shukr ada karoon jo Tune mujh par aur mere walidain par ki, aur main woh nek amal karoon jo Tujhe pasand ho, aur mujhe apni rehmat se apne nek bandon mein dakhil kar de.',
    note: 'Hazrat Sulaiman (A) ki dua hai.',
  },
  {
    id: 'walidain-ke-liye',
    title: 'Walidain ke liye rehmat ki dua',
    topics: ['family'],
    when: 'Walidain ke liye, khaas taur par namaz ke baad',
    source: 'Quran 17:24',
    kind: 'dua',
    arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    transliteration: 'Rabbirhamhuma kama rabbayani saghira.',
    meaning: 'Ae mere Rab! Un (mere walidain) par raham farma, jaise unhone mujhe chhota sa paal-pos kar bada kiya.',
  },
  {
    id: 'rabbana-ghfir-li-waliwalidayya',
    title: 'Mere liye, walidain ke liye, mu’mineen ke liye',
    topics: ['family', 'forgiveness'],
    when: 'Namaz mein ya jab bhi dil chahe',
    source: 'Quran 14:41',
    kind: 'dua',
    arabic: 'رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ',
    transliteration: 'Rabbana-ghfir li wa liwalidayya wa lil-mu’minina yawma yaqumul-hisab.',
    meaning:
      'Ae hamare Rab! Mujhe bakhsh de, mere walidain ko bakhsh de, aur saare mu’mineen ko (bakhsh de) us din jab hisaab qaim hoga.',
  },
  {
    id: 'nikah-ki-dua',
    title: 'Naye dulha-dulhan ke liye mubarakbad',
    topics: ['family'],
    when: 'Shaadi par dulha-dulhan ko mubarakbad dete waqt',
    source: 'Sunan Abi Dawud 2130; Jami’ at-Tirmidhi 1091',
    kind: 'dua',
    arabic: 'بَارَكَ اللَّهُ لَكَ، وَبَارَكَ عَلَيْكَ، وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ',
    transliteration: 'Barakallahu lak, wa baraka ‘alayk, wa jama’a baynakuma fi khayr.',
    meaning: 'Allah tumhe barkat de, tum par barkat nazil kare, aur tum dono ko bhalai mein jama kare.',
  },
  {
    id: 'allahumma-aksir-mali',
    title: 'Maal aur aulaad mein barkat',
    topics: ['family', 'work'],
    when: 'Apne liye ya apne bacchon ke liye',
    source: 'Sahih al-Bukhari 6334; Sahih Muslim 660',
    kind: 'dua',
    arabic: 'اللَّهُمَّ أَكْثِرْ مَالِي وَوَلَدِي، وَبَارِكْ لِي فِيمَا أَعْطَيْتَنِي',
    transliteration: 'Allahumma aksir mali wa waladi, wa barik li fima a’taytani.',
    meaning: 'Ae Allah! Mera maal aur meri aulaad badha de, aur jo Tune mujhe diya hai usmein mere liye barkat de.',
    note: 'Nabi (ﷺ) ne Hazrat Anas (R) ke liye yeh dua ki thi.',
  },
  // ---- Kaam / rizq — added 2026-11-23 ----
  {
    id: 'allahumma-ikfini-bihalalika',
    title: 'Halal rizq se kaafi kar de',
    topics: ['work'],
    when: 'Qarz ya tangi mein, ya rozana',
    source: 'Jami’ at-Tirmidhi 3563',
    kind: 'dua',
    arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
    transliteration: 'Allahumma ikfini bihalalika ‘an haramika, wa aghnini bi-fadlika ‘amman siwak.',
    meaning:
      'Ae Allah! Apne halal (rizq) se mujhe apne haram se kaafi kar de, aur apne fazl se mujhe apne siwa sab se be-niyaz kar de.',
  },
  {
    id: 'qarz-se-panaah',
    title: 'Qarz ke bojh se panaah',
    topics: ['work', 'distress'],
    when: 'Qarz ho to, khaas taur par namaz mein',
    source: 'Sahih al-Bukhari 2397; Sahih Muslim 589',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْمَأْثَمِ وَالْمَغْرَمِ',
    transliteration: 'Allahumma inni a’udhu bika minal-ma’thami wal-maghram.',
    meaning: 'Ae Allah! Main gunah se aur qarz (ke bojh) se Teri panaah maangta hoon.',
  },
  {
    id: 'faqri-se-panaah',
    title: 'Faqri aur zillat se panaah',
    topics: ['work'],
    when: 'Subah-shaam ya jab bhi dil chahe',
    source: 'Sunan Abi Dawud 1546',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْفَقْرِ وَالْقِلَّةِ وَالذِّلَّةِ، وَأَعُوذُ بِكَ مِنْ أَنْ أَظْلِمَ أَوْ أُظْلَمَ',
    transliteration:
      'Allahumma inni a’udhu bika minal-faqri wal-qillati wadh-dhillah, wa a’udhu bika min an azlima aw uzlam.',
    meaning:
      'Ae Allah! Main faqri (mohtaji), kami aur zillat se Teri panaah maangta hoon, aur is se (bhi panaah maangta hoon) ke main kisi par zulm karoon ya mujh par zulm kiya jaye.',
  },
  {
    id: 'bazaar-ki-dua',
    title: 'Bazaar mein dakhil hote waqt',
    topics: ['work', 'daily'],
    when: 'Bazaar mein dakhil hote waqt',
    source: 'Jami’ at-Tirmidhi 3428',
    kind: 'dua',
    arabic:
      'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ حَيٌّ لَا يَمُوتُ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu, yuhyi wa yumit, wa huwa hayyun la yamut, bi-yadihil-khayr, wa huwa ‘ala kulli shay’in qadir.',
    meaning:
      'Allah ke siwa koi ma’bood nahi, woh akela hai, uska koi shareek nahi; baadshahat usi ki hai, tareef usi ki hai; woh zindagi deta hai aur maut deta hai, aur woh zinda hai, kabhi marega nahi; bhalai usi ke haath mein hai, aur woh har cheez par qadir hai.',
    note: 'Bazaar mein dakhil hote waqt padhein — iska sawab bahut bada hai.',
  },
  // ---- Baarish — added 2026-11-23 ----
  {
    id: 'baarish-par',
    title: 'Baarish par — faida dene wali bana de',
    topics: ['rain'],
    when: 'Baarish hone par',
    source: 'Sahih al-Bukhari 1032',
    kind: 'dua',
    arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا',
    transliteration: 'Allahumma sayyiban nafi’an.',
    meaning: 'Ae Allah! (Is baarish ko) faida dene wali baarish bana de.',
  },
  {
    id: 'baarish-ke-baad',
    title: 'Baarish ke baad',
    topics: ['rain'],
    when: 'Baarish rukne ke baad',
    source: 'Sahih al-Bukhari 846; Sahih Muslim 71',
    kind: 'dua',
    arabic: 'مُطِرْنَا بِفَضْلِ اللَّهِ وَرَحْمَتِهِ',
    transliteration: 'Mutirna bi-fadlillahi wa rahmatih.',
    meaning: 'Hum par Allah ke fazl aur uski rehmat se baarish hui.',
  },
  {
    id: 'zyada-baarish',
    title: 'Baarish bahut zyada ho to',
    topics: ['rain'],
    when: 'Baarish bahut zyada ho aur nuqsan ka darr ho to',
    source: 'Sahih al-Bukhari 1014',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ حَوَالَيْنَا وَلَا عَلَيْنَا، اللَّهُمَّ عَلَى الْآكَامِ وَالظِّرَابِ وَبُطُونِ الْأَوْدِيَةِ وَمَنَابِتِ الشَّجَرِ',
    transliteration:
      'Allahumma hawalayna wa la ‘alayna, Allahumma ‘alal-akami waz-zarabi wa butunil-awdiyati wa manabitis-shajar.',
    meaning:
      'Ae Allah! (Baarish) hamare aas-paas barsa, hum par na barsa. Ae Allah! Pahadiyon par, teelon par, wadiyon ke pet (andar) mein aur darakhton ke ugne ki jagahon par barsa.',
  },
  {
    id: 'garaj-par',
    title: 'Garaj (badal ki awaaz) par',
    topics: ['rain'],
    when: 'Badal garje to',
    source: 'Quran 13:13',
    kind: 'dua',
    arabic: 'سُبْحَانَ الَّذِي يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ وَالْمَلَائِكَةُ مِنْ خِيفَتِهِ',
    transliteration: 'Subhanalladhi yusabbihur-ra’du bi-hamdihi wal-mala’ikatu min khifatih.',
    meaning:
      'Paak hai woh zaat, jiski hamd ke saath garaj (badal) tasbeeh karta hai aur farishte uske darr se (tasbeeh karte hain).',
  },
  {
    id: 'hawa-chalne-par',
    title: 'Tez hawa chalne par',
    topics: ['rain'],
    when: 'Tez hawa ya aandhi chale to',
    source: 'Sahih Muslim 899',
    kind: 'dua',
    arabic:
      'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا فِيهَا وَخَيْرَ مَا أُرْسِلَتْ بِهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا فِيهَا وَشَرِّ مَا أُرْسِلَتْ بِهِ',
    transliteration:
      'Allahumma inni as’aluka khayraha wa khayra ma fiha wa khayra ma ursilat bih, wa a’udhu bika min sharriha wa sharri ma fiha wa sharri ma ursilat bih.',
    meaning:
      'Ae Allah! Main Tujhse is (hawa) ki bhalai, jo kuch ismein hai uski bhalai, aur jis (kaam) ke saath yeh bheji gayi hai uski bhalai maangta hoon; aur iski burai, jo kuch ismein hai uski burai, aur jis (kaam) ke saath yeh bheji gayi hai uski burai se Teri panaah maangta hoon.',
  },
  // ---- Rozana — added 2026-11-23 ----
  {
    id: 'chheenk',
    title: 'Chheenk aaye to',
    topics: ['daily'],
    when: 'Chheenk aane par',
    source: 'Sahih al-Bukhari 6224',
    kind: 'dua',
    arabic: 'الْحَمْدُ لِلَّهِ — يَرْحَمُكَ اللَّهُ',
    transliteration: 'Chheenkne wala kahe: Alhamdulillah. Sunne wala kahe: Yarhamukallah.',
    meaning:
      'Chheenkne wala ‘Alhamdulillah’ (tamam tareefein Allah ke liye hain) kahe, aur sunne wala jawab mein ‘Yarhamukallah’ (Allah tum par raham kare) kahe.',
    note: 'Phir chheenkne wala jawab de: ‘Yahdikumullahu wa yuslihu balakum’ (Allah tumhe hidayat de aur tumhara haal sudhaar de).',
  },
  {
    id: 'museebat-dekhkar',
    title: 'Kisi ko museebat mein dekhein to',
    topics: ['daily', 'protection'],
    when: 'Kisi ko bimari ya museebat mein dekhein to (dil mein padhein)',
    source: 'Jami’ at-Tirmidhi 3431',
    kind: 'dua',
    arabic:
      'الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي مِمَّا ابْتَلَاكَ بِهِ وَفَضَّلَنِي عَلَى كَثِيرٍ مِمَّنْ خَلَقَ تَفْضِيلًا',
    transliteration:
      'Alhamdu lillahil-ladhi ‘afani mimma ibtalaka bihi wa faddalani ‘ala kathirin mimman khalaqa tafdila.',
    meaning:
      'Tamam tareefein Allah ke liye hain, jisne mujhe us (museebat) se aafiyat di jis se usne tumhe aazmaya, aur mujhe apni bahut si makhlooq par fazilat di.',
    note: 'Woh museebat aap ko nahi pahunchegi.',
  },
  {
    id: 'ya-muqallibal-qulub',
    title: 'Dilon ko palatne wale — dil sabit rakh',
    topics: ['daily', 'anxiety'],
    when: 'Jab dil dagmagaye ya imaan ki fikr ho',
    source: 'Jami’ at-Tirmidhi 3522',
    kind: 'dua',
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ، ثَبِّتْ قَلْبِي عَلَى دِينِكَ',
    transliteration: 'Ya muqallibal-qulub, thabbit qalbi ‘ala dinik.',
    meaning: 'Ae dilon ko palatne wale! Mere dil ko apne deen par sabit rakh.',
  },
  {
    id: 'allahumma-musarrifal-qulub',
    title: 'Dilon ko ita’at ki taraf pher de',
    topics: ['daily'],
    when: 'Jab bhi dil chahe',
    source: 'Sahih Muslim 2654',
    kind: 'dua',
    arabic: 'اللَّهُمَّ مُصَرِّفَ الْقُلُوبِ، صَرِّفْ قُلُوبَنَا عَلَى طَاعَتِكَ',
    transliteration: 'Allahumma musarrifal-qulub, sarrif qulubana ‘ala ta’atik.',
    meaning: 'Ae dilon ko pherne wale Allah! Hamare dilon ko apni ita’at (farma-bardari) ki taraf pher de.',
  },
  {
    id: 'kafaratul-majlis',
    title: 'Majlis se uthne se pehle — kaffara',
    topics: ['daily'],
    when: 'Kisi baithak ya majlis se uthne se pehle',
    source: 'Jami’ at-Tirmidhi 3433; Sunan Abi Dawud 4859',
    kind: 'dua',
    arabic:
      'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
    transliteration:
      'Subhanakallahumma wa bihamdika, ash-hadu an la ilaha illa anta, astaghfiruka wa atubu ilayk.',
    meaning:
      'Ae Allah! Tu paak hai aur tamam tareefein Tere liye hain. Main gawahi deta hoon ke Tere siwa koi ma’bood nahi. Main Tujhse maghfirat maangta hoon aur Teri taraf tauba karta hoon.',
    note: 'Isse majlis mein hone wali ghaltiyon ka kaffara ho jata hai.',
  },
  {
    id: 'allahumma-inni-asaluka-hubbaka',
    title: 'Teri mohabbat maangta hoon',
    topics: ['daily'],
    when: 'Jab bhi dil chahe',
    source: 'Jami’ at-Tirmidhi 3490',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ حُبَّكَ، وَحُبَّ مَنْ يُحِبُّكَ، وَالْعَمَلَ الَّذِي يُبَلِّغُنِي حُبَّكَ',
    transliteration:
      'Allahumma inni as’aluka hubbak, wa hubba man yuhibbuka, wal-‘amala alladhi yuballighuni hubbak.',
    meaning:
      'Ae Allah! Main Tujhse Teri mohabbat maangta hoon, aur uski mohabbat jo Tujhse mohabbat karta hai, aur woh amal jo mujhe Teri mohabbat tak pahuncha de.',
  },
  {
    id: 'rabbana-la-tuzigh',
    title: 'Hamare dilon ko tedha na kar',
    topics: ['daily'],
    when: 'Hidayat par sabit rehne ke liye',
    source: 'Quran 3:8',
    kind: 'dua',
    arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً، إِنَّكَ أَنْتَ الْوَهَّابُ',
    transliteration:
      'Rabbana la tuzigh qulubana ba’da idh hadaytana wa hab lana min ladunka rahmah, innaka antal-Wahhab.',
    meaning:
      'Ae hamare Rab! Hamare dilon ko tedha na kar, uske baad ke Tune humein hidayat di, aur humein apne paas se rehmat ata farma. Beshak Tu hi bahut dene wala hai.',
  },
  {
    id: 'la-hawla-wa-la-quwwata',
    title: 'La hawla wa la quwwata illa billah',
    topics: ['daily'],
    when: 'Jab bhi dil chahe; mushkil mein',
    source: 'Sahih al-Bukhari 4205; Sahih Muslim 2704',
    kind: 'dua',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'La hawla wa la quwwata illa billah.',
    meaning: 'Buraai se bachne ki taaqat aur neki ki quwwat sirf Allah ki madad se hai.',
    note: 'Yeh Jannat ke khazanon mein se ek khazana hai.',
  },
  {
    id: 'chand-dekhna',
    title: 'Naya chaand dekhein to',
    topics: ['daily'],
    when: 'Naya chaand dekhne par',
    source: 'Jami’ at-Tirmidhi 3451',
    kind: 'dua',
    arabic:
      'اللَّهُ أَكْبَرُ، اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْأَمْنِ وَالْإِيمَانِ، وَالسَّلَامَةِ وَالْإِسْلَامِ، وَالتَّوْفِيقِ لِمَا تُحِبُّ رَبَّنَا وَتَرْضَى، رَبُّنَا وَرَبُّكَ اللَّهُ',
    transliteration:
      'Allahu Akbar, Allahumma ahillahu ‘alayna bil-amni wal-iman, was-salamati wal-Islam, wa tawfiqi lima tuhibbu Rabbana wa tarda, Rabbuna wa Rabbukallah.',
    meaning:
      'Allah sabse bada hai. Ae Allah! Is (naye) chaand ko hum par aman aur imaan, salamati aur Islam ke saath tulu farma, aur us (kaam) ki taufeeq ke saath jo Tu pasand karta hai aur jisse Tu raazi hota hai, ae hamare Rab! Hamara aur tumhara (chaand ka) Rab Allah hai.',
  },
  {
    id: 'qabar-ziyarat',
    title: 'Qabristan jaayein to',
    topics: ['daily'],
    when: 'Qabristan mein dakhil hote waqt',
    source: 'Sahih Muslim 975',
    kind: 'dua',
    arabic:
      'السَّلَامُ عَلَيْكُمْ أَهْلَ الدِّيَارِ مِنَ الْمُؤْمِنِينَ وَالْمُسْلِمِينَ، وَإِنَّا إِنْ شَاءَ اللَّهُ بِكُمْ لَاحِقُونَ، أَسْأَلُ اللَّهَ لَنَا وَلَكُمُ الْعَافِيَةَ',
    transliteration:
      'Assalamu ‘alaykum ahla ad-diyari minal-mu’minina wal-muslimin, wa inna in sha Allahu bikum lahiqun, as’alullaha lana wa lakumul-‘afiyah.',
    meaning:
      'Tum par salam ho, ae (is) jagah ke rehne walo, mu’mineen aur muslimeen! Aur beshak hum bhi, in sha Allah, tumse milne wale hain. Main Allah se hamare liye aur tumhare liye aafiyat maangta hoon.',
  },
  {
    id: 'allahumma-inni-asaluka-jannah',
    title: 'Jannat maango, aag se panaah maango',
    topics: ['daily', 'forgiveness'],
    when: 'Din mein, teen baar',
    source: 'Jami’ at-Tirmidhi 2572',
    kind: 'dua',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَأَعُوذُ بِكَ مِنَ النَّارِ',
    transliteration: 'Allahumma inni as’alukal-jannata wa a’udhu bika minan-nar. (3 baar)',
    meaning: 'Ae Allah! Main Tujhse Jannat maangta hoon aur aag (Jahannam) se Teri panaah maangta hoon.',
    note: 'Jo teen baar Jannat maange, Jannat kehti hai: ‘Ae Allah! Use Jannat mein dakhil kar de’; aur jo teen baar aag se panaah maange, aag kehti hai: ‘Ae Allah! Use aag se bacha le.’',
  },
];

/** Pure helper used by the route (and unit-tested): filter by topic. */
export function filterDuasByTopic(duas: Dua[], topic: DuaTopic): Dua[] {
  return duas.filter((dua) => dua.topics.includes(topic));
}

export function isDuaTopic(value: string): value is DuaTopic {
  return DUA_TOPICS.some((topic) => topic.id === value);
}
