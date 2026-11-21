/**
 * Verified Hinglish meanings for the 4 curated Qur'anic verses only.
 *
 * HONEST LIMIT: there is NO verified full-Qur'an Hinglish translation
 * upstream (AlQuran Cloud serves Arabic + en.transliteration + the
 * en.sahih English translation). These four meanings are copied
 * byte-for-byte from the curated verses in `QuranDuas.tsx` — they are
 * the only verified Hinglish meanings in the app. The Qur'an reader
 * shows a "Hinglish tarjuma" line ONLY for these ayahs (matched on the
 * first ayah of each curated range); every other ayah shows Hinglish
 * transliteration + English translation, and nothing is invented.
 *
 * Never add a meaning here without a verified source.
 */

export interface CuratedQuranMeaning {
  surah: number;
  /** First ayah of the curated range (e.g. 97 for 23:97–98). */
  ayah: number;
  reference: string;
  meaning: string;
}

export const CURATED_QURAN_MEANINGS: CuratedQuranMeaning[] = [
  {
    surah: 23,
    ayah: 97,
    reference: '23:97–98',
    meaning:
      'Ae mere Rab! Main shaitanon ke waswason se Teri panaah maangta hoon. Aur Ae mere Rab! Main Teri panaah maangta hoon is baat se ki woh mere paas aayein.',
  },
  {
    surah: 2,
    ayah: 286,
    reference: '2:286',
    meaning:
      'Ae hamare Rab! Agar hum bhool jaayein ya galti kar baithein toh humein na pakad. Hum par aisa bojh na daal jiski hum mein taaqat nahi. Humein maaf kar, humein bakhsh de aur hum par raham farma.',
  },
  {
    surah: 20,
    ayah: 25,
    reference: '20:25–28',
    meaning:
      'Ae mere Rab! Mera seena khol de, mera kaam mere liye aasaan kar de, meri zubaan ki girah khol de, taaki log meri baat samajh sakein.',
  },
  {
    surah: 13,
    ayah: 28,
    reference: '13:28',
    meaning:
      'Jo log imaan laaye aur jinke dil Allah ke zikr se sukoon paate hain. Sun lo, Allah ke zikr hi se dilon ko sukoon milta hai.',
  },
];

export function curatedHinglishMeaning(
  surah: number,
  ayah: number,
): CuratedQuranMeaning | undefined {
  return CURATED_QURAN_MEANINGS.find(
    (entry) => entry.surah === surah && entry.ayah === ayah,
  );
}
