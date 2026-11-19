import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const duas = [
  {
    title: 'Shaitani waswason se panaah',
    surah: 'Al-Mu’minun',
    reference: '23:97–98',
    para: 18,
    pages: '348',
    arabic: 'وَقُل رَّبِّ أَعُوذُ بِكَ مِنْ هَمَزَٰتِ ٱلشَّيَـٰطِينِ ۝ وَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ',
    transliteration: "Wa qul rabbi a'oodhu bika min hamazaatish-shayaateen. Wa a'oodhu bika rabbi an yahduroon.",
    meaning: 'Ae mere Rab! Main shaitanon ke waswason se Teri panaah maangta hoon. Aur Ae mere Rab! Main Teri panaah maangta hoon is baat se ki woh mere paas aayein.',
    category: 'Waswase aur panaah',
    type: 'Dua',
  },
  {
    title: 'Mushkil aur bojh ke waqt',
    surah: 'Al-Baqarah',
    reference: '2:286',
    para: 3,
    pages: '49',
    arabic: 'رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ ۖ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ',
    transliteration: "Rabbana la tu'aakhidhna in naseena aw akhta'na. Rabbana wa la tahmil 'alayna isran kama hamaltahu 'alal-lazeena min qablina. Rabbana wa la tuhammilna ma la taqata lana bih. Wa'fu 'anna, waghfir lana, warhamna.",
    meaning: 'Ae hamare Rab! Agar hum bhool jaayein ya galti kar baithein toh humein na pakad. Hum par aisa bojh na daal jiski hum mein taaqat nahi. Humein maaf kar, humein bakhsh de aur hum par raham farma.',
    category: 'Maafi aur aasani',
    type: 'Selected dua portion',
  },
  {
    title: 'Dil khulne aur kaam aasaan hone ki dua',
    surah: 'Taha',
    reference: '20:25–28',
    para: 16,
    pages: '313',
    arabic: 'قَالَ رَبِّ ٱشْرَحْ لِى صَدْرِى ۝ وَيَسِّرْ لِىٓ أَمْرِى ۝ وَٱحْلُلْ عُقْدَةًۭ مِّن لِّسَانِى ۝ يَفْقَهُوا۟ قَوْلِى',
    transliteration: "Qaala rabbish-rah lee sadree. Wa yassir lee amree. Wahlul 'uqdatan min lisaanee. Yafqahoo qawlee.",
    meaning: 'Ae mere Rab! Mera seena khol de, mera kaam mere liye aasaan kar de, meri zubaan ki girah khol de, taaki log meri baat samajh sakein.',
    category: 'Aasani aur ilm',
    type: 'Dua',
  },
  {
    title: 'Dil ka sukoon',
    surah: 'Ar-Ra’d',
    reference: '13:28',
    para: 13,
    pages: '252',
    arabic: 'ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    transliteration: "Allazeena aamanoo wa tatma'innu quloobuhum bizikrillaah. Alaa bizikrillaahi tatma'innul-quloob.",
    meaning: 'Jo log imaan laaye aur jinke dil Allah ke zikr se sukoon paate hain. Sun lo, Allah ke zikr hi se dilon ko sukoon milta hai.',
    category: 'Sukoon aur zikr',
    type: 'Ayat, dua nahi',
  },
];

export default function QuranDuas() {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <section className="quran-duas-section">
      <div className="dua-section-heading">
        <div>
          <span className="eyebrow">QUR'AN ONLY · VERIFIED REFERENCES</span>
          <h2>Qur'anic duas & guidance</h2>
          <p>Arabic text, Hinglish pronunciation, meaning and exact references.</p>
        </div>
        <BookOpen size={22} />
      </div>

      <div className="dua-list">
        {duas.map((dua, index) => (
          <article className="panel dua-card" key={dua.reference}>
            <button
              className="dua-card-toggle"
              onClick={() => setExpanded(expanded === index ? null : index)}
              aria-expanded={expanded === index}
            >
              <div>
                <span className="eyebrow">{dua.category}</span>
                <h3>{dua.title}</h3>
                <p>Surah {dua.surah} · {dua.reference} · Para {dua.para}</p>
              </div>
              {expanded === index ? <ChevronUp /> : <ChevronDown />}
            </button>

            {expanded === index && (
              <div className="dua-content">
                <div className="dua-reference">
                  <span>Qur'an reference</span>
                  <strong>Surah {dua.surah}, {dua.reference}</strong>
                  <span>Para {dua.para} · Madani Mushaf page {dua.pages}</span>
                  <small>{dua.type}</small>
                </div>

                <h4>Arabic</h4>
                <p className="dua-arabic" dir="rtl" lang="ar">{dua.arabic}</p>

                <h4>Hinglish pronunciation</h4>
                <p className="dua-transliteration">{dua.transliteration}</p>

                <h4>Meaning in Hinglish</h4>
                <p className="dua-meaning">{dua.meaning}</p>
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="dua-disclaimer">
        Arabic is the original Qur'anic text. Transliteration is only a reading aid.
        Page numbers refer to the Madani Mushaf edition. Translation and pronunciation
        require scholarly review before public release.
      </p>
    </section>
  );
}