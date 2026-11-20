import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { fetchDuas, type Dua, type DuaTopic } from '../lib/quranApi';

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

/**
 * Duas screen — two sections, both verified only.
 *
 * 1. The four curated Qur'anic duas below are kept exactly as they
 *    were (Arabic, transliteration, Hinglish meaning, exact surah /
 *    para / page reference). They are NOT served from the API.
 * 2. "Rozana duas" comes from GET /api/duas (static verified data
 *    in api/src/lib/duasData.ts): sleep duas — including what to
 *    read when sleep doesn't come — plus morning, daily and wudu
 *    duas, each with Arabic + transliteration + Hinglish meaning +
 *    exact hadith source. No "reviewed" claim anywhere.
 *
 * The optional onOpenSurah prop opens a surah in the Quran browser
 * (wired by the parent: the Guidance tab's onOpenSurah). Without
 * it, the Quran-reference cards show the reference as plain text.
 */
export default function QuranDuas({
  onOpenSurah,
}: {
  onOpenSurah?: (surahNumber: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [dailyDuas, setDailyDuas] = useState<Dua[]>([]);
  const [duaTopics, setDuaTopics] = useState<{ id: DuaTopic; label: string; hinglish: string }[]>([]);
  const [duaSource, setDuaSource] = useState('');
  const [duaTopic, setDuaTopic] = useState<DuaTopic | ''>('');
  const [duaQuery, setDuaQuery] = useState('');
  const [duaLoading, setDuaLoading] = useState(true);
  const [duaError, setDuaError] = useState('');
  const [expandedDua, setExpandedDua] = useState<string | null>(null);

  async function loadDuas(topic: DuaTopic | '') {
    setDuaLoading(true);
    setDuaError('');
    try {
      const result = await fetchDuas(topic || undefined);
      setDailyDuas(result.duas);
      setDuaTopics(result.topics);
      setDuaSource(result.source);
      setExpandedDua(result.duas[0]?.id ?? null);
    } catch (err) {
      setDuaError(err instanceof Error ? err.message : 'Duas could not be loaded.');
    } finally {
      setDuaLoading(false);
    }
  }

  useEffect(() => {
    loadDuas('');
    // Load once; topic changes call loadDuas directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickTopic(topic: DuaTopic | '') {
    setDuaTopic(topic);
    loadDuas(topic);
  }

  const visibleDuas = duaQuery.trim()
    ? dailyDuas.filter((dua) =>
        `${dua.title} ${dua.when} ${dua.source} ${dua.kind === 'dua' ? dua.meaning : dua.practice}`
          .toLowerCase()
          .includes(duaQuery.trim().toLowerCase()),
      )
    : dailyDuas;

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

      <div className="dua-section-heading">
        <div>
          <span className="eyebrow">ROZANA DUAS · VERIFIED HADITH SOURCE</span>
          <h2>Rozana duas</h2>
          <p>
            Neend, subah, roz-marra ke kaam aur wuzu ki duas — har dua ke saath Arabic,
            Hinglish pronunciation, Hinglish meaning aur exact hadith source.
          </p>
          {duaSource && <p className="quran-source-line">{duaSource}</p>}
        </div>
        <BookOpen size={22} />
      </div>

      <div className="quran-toolbar">
        <div className="guidance-tabs" role="tablist" aria-label="Dua topics">
          <button
            type="button"
            role="tab"
            aria-selected={duaTopic === ''}
            className={duaTopic === '' ? 'selected' : ''}
            onClick={() => pickTopic('')}
          >
            Sabhi
          </button>
          {duaTopics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              role="tab"
              aria-selected={duaTopic === topic.id}
              className={duaTopic === topic.id ? 'selected' : ''}
              onClick={() => pickTopic(topic.id)}
            >
              {topic.label}
            </button>
          ))}
        </div>
        <label className="quran-search">
          <Search size={16} />
          <input
            className="form-input"
            value={duaQuery}
            onChange={(event) => setDuaQuery(event.target.value)}
            placeholder="Dua khojein — naam, waqt ya source…"
          />
        </label>
      </div>

      {duaLoading ? (
        <p className="empty-note">Duas load ho rahi hain…</p>
      ) : duaError ? (
        <div>
          <p className="form-error">{duaError}</p>
          <button className="outline-button" onClick={() => loadDuas(duaTopic)}>
            Dobara koshish karein · Retry
          </button>
        </div>
      ) : visibleDuas.length === 0 ? (
        <p className="empty-note">
          {duaQuery.trim() ? 'Is khoj se koi dua nahi mili.' : 'Is topic mein abhi koi dua nahi hai.'}
        </p>
      ) : (
        <div className="dua-list">
          {visibleDuas.map((dua) => (
            <article className="panel dua-card" key={dua.id}>
              <button
                className="dua-card-toggle"
                onClick={() => setExpandedDua(expandedDua === dua.id ? null : dua.id)}
                aria-expanded={expandedDua === dua.id}
              >
                <div>
                  <span className="eyebrow">{dua.when}</span>
                  <h3>{dua.title}</h3>
                  <p>Source: {dua.source}</p>
                </div>
                {expandedDua === dua.id ? <ChevronUp /> : <ChevronDown />}
              </button>

              {expandedDua === dua.id && (
                <div className="dua-content">
                  <div className="dua-reference">
                    <span>Source · Hawala</span>
                    <strong>{dua.source}</strong>
                    <small>{dua.kind === 'dua' ? 'Dua · Hadith se' : 'Qur’ani amal · Hadith se'}</small>
                  </div>

                  {dua.kind === 'dua' ? (
                    <>
                      <h4>Arabic</h4>
                      <p className="dua-arabic" dir="rtl" lang="ar">{dua.arabic}</p>

                      <h4>Hinglish pronunciation</h4>
                      <p className="dua-transliteration">{dua.transliteration}</p>

                      <h4>Meaning in Hinglish</h4>
                      <p className="dua-meaning">{dua.meaning}</p>
                    </>
                  ) : (
                    <>
                      <h4>Kya padhein</h4>
                      <p className="dua-meaning">{dua.practice}</p>
                      <div className="dua-reference">
                        <span>Qur’an reference</span>
                        <strong>
                          Surah {dua.quranSurahName} ·{' '}
                          {dua.quranAyahStart === dua.quranAyahEnd
                            ? `Ayah ${dua.quranAyahStart}`
                            : `Ayah ${dua.quranAyahStart}–${dua.quranAyahEnd}`}
                        </strong>
                      </div>
                      {onOpenSurah ? (
                        <button
                          className="outline-button"
                          onClick={() => onOpenSurah(dua.quranSurah)}
                        >
                          Qur’an browser mein padhein · Surah {dua.quranSurah}
                        </button>
                      ) : (
                        <p className="empty-note">
                          Poori ayat Qur’an browser mein Surah {dua.quranSurah} mein padhein.
                        </p>
                      )}
                    </>
                  )}

                  {dua.note && <p className="dua-meaning">{dua.note}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="dua-disclaimer">
        Arabic is the original Qur'anic text. Transliteration is only a reading aid.
        Page numbers refer to the Madani Mushaf edition. Translation and pronunciation
        require scholarly review before public release.
      </p>
      <p className="dua-disclaimer">
        Rozana duas ke saath unka exact hadith source diya gaya hai — koi dua apni taraf se
        nahi banayi gayi, aur kisi dua par "reviewed" ka daawa nahi kiya gaya. Qur’ani amal
        wale card mein ayat ka poora text copy nahi kiya gaya; woh verified Qur’an browser
        mein padhein.
      </p>
    </section>
  );
}