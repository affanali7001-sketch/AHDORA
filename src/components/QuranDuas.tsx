import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { fetchDuas, type Dua, type DuaTopic } from '../lib/quranApi';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';

/**
 * The 4 verified Qur'anic duas (Hissa 1). English lines are taken
 * verbatim from the approved preview (ahdora-new-ui-preview #9);
 * they are the English rendering of these verses — Quran verses
 * always show Hinglish + English, all other translations stay
 * Hinglish-only (Phase 13 rule).
 */
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
    english: 'My Lord, I seek refuge in You from the whisperings of the devils.',
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
    english: 'Our Lord, do not hold us accountable if we forget or make a mistake.',
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
    english: 'My Lord, expand for me my chest and ease for me my task.',
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
    english: 'Verily, in the remembrance of Allah do hearts find rest.',
    category: 'Sukoon aur zikr',
    type: 'Ayat, dua nahi',
  },
];

/**
 * Duas screen — two sections, both verified only (preview #9).
 *
 * 1. HISSA 1 — the four curated Qur'anic duas above, kept exactly
 *    as they were (Arabic, transliteration, Hinglish meaning, exact
 *    surah / para / page reference) plus their English line. They
 *    are NOT served from the API.
 * 2. HISSA 2 — "Rozana duas" from GET /api/duas (static verified
 *    data in api/src/lib/duasData.ts): sleep duas — including what
 *    to read when sleep doesn't come — plus morning, daily and wudu
 *    duas, and the anxiety / overthinking categories, each with
 *    Arabic + transliteration + Hinglish meaning + exact hadith
 *    source. No "reviewed" claim anywhere. English is NOT shown
 *    here — Hinglish-only, per the Phase 13 rule.
 *
 * The optional onOpenSurah prop opens a surah in the Quran browser
 * (wired by the parent: the Guidance tab's onOpenSurah). Without
 * it, the Quran-reference cards show the reference as plain text.
 */
export default function QuranDuas({
  onOpenSurah,
  language,
}: {
  onOpenSurah?: (surahNumber: number) => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
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
      setDuaError(err instanceof Error ? err.message : s.duas.loadFailed);
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

  // Hissa 2 grouping (preview #9 .catlab headings). The backend
  // serves 'anxiety' and 'overthinking' topics too, but the
  // frontend DuaTopic type only lists the original four — the
  // string cast below reads the runtime values without changing
  // the shared API type. A dua is shown under its first matching
  // preview category; anything else (subah / roz-marra / wuzu)
  // falls under "Rozana duas" so no verified dua is ever hidden.
  const categoryGroups = [
    { id: 'anxiety', title: s.duas.groupAnxiety, sub: s.duas.groupAnxietySub },
    { id: 'overthinking', title: s.duas.groupOverthinking, sub: s.duas.groupOverthinkingSub },
    { id: 'sleep', title: s.duas.groupSleep, sub: s.duas.groupSleepSub },
    { id: 'rozana', title: s.duas.groupDaily, sub: s.duas.groupDailySub },
  ] as const;

  function groupOf(dua: Dua): string {
    const topics = dua.topics as readonly string[];
    for (const group of categoryGroups) {
      if (group.id !== 'rozana' && topics.includes(group.id)) return group.id;
    }
    return 'rozana';
  }

  const groupedDuas = categoryGroups
    .map((group) => ({
      ...group,
      duas: visibleDuas.filter((dua) => groupOf(dua) === group.id),
    }))
    .filter((group) => group.duas.length > 0);

  return (
    <section className="sc-duas">
      <div className="sc-head">
        <span className="eyebrow">{s.duas.eyebrow}</span>
        <h3>{s.duas.title}</h3>
        <p>{s.duas.intro}</p>
      </div>

      <div className="partlab">{s.duas.part1}</div>

      {duas.map((dua) => (
        <article className="acard" key={dua.reference}>
          <h5>{dua.title}</h5>
          <p className="mut">
            Surah {dua.surah} · {dua.reference} · Para {dua.para} · {dua.type}
          </p>
          <div className="arab" dir="rtl" lang="ar">{dua.arabic}</div>
          <p className="mut"><i>{dua.transliteration}</i></p>
          <p className="sc-meaning">&ldquo;{dua.meaning}&rdquo;</p>
          <p className="en-tr"><b>EN</b>&ldquo;{dua.english}&rdquo;</p>
          <div className="chiprow">
            <span className="mchip">{dua.surah} {dua.reference}</span>
            <span className="mchip">Para {dua.para}</span>
            <span className="mchip">Page {dua.pages}</span>
          </div>
        </article>
      ))}

      <div className="partlab">{s.duas.part2}</div>
      {duaSource && <p className="quran-source-line">{duaSource}</p>}

      <div className="sc-toolbar">
        <div className="sc-tabs" role="tablist" aria-label="Dua topics">
          <button
            type="button"
            role="tab"
            aria-selected={duaTopic === ''}
            className={duaTopic === '' ? 'sc-tab selected' : 'sc-tab'}
            onClick={() => pickTopic('')}
          >
            {s.duas.all}
          </button>
          {duaTopics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              role="tab"
              aria-selected={duaTopic === topic.id}
              className={duaTopic === topic.id ? 'sc-tab selected' : 'sc-tab'}
              onClick={() => pickTopic(topic.id)}
            >
              {topic.label}
            </button>
          ))}
        </div>
        <label className="searchbar">
          <Search size={16} />
          <input
            value={duaQuery}
            onChange={(event) => setDuaQuery(event.target.value)}
            placeholder={s.duas.searchPlaceholder}
            aria-label={s.duas.searchAria}
          />
        </label>
      </div>

      {duaLoading ? (
        <p className="empty-note">{s.duas.loading}</p>
      ) : duaError ? (
        <div>
          <p className="form-error">{duaError}</p>
          <button className="outline-button" onClick={() => loadDuas(duaTopic)}>
            {s.duas.retry}
          </button>
        </div>
      ) : visibleDuas.length === 0 ? (
        <p className="empty-note">
          {duaQuery.trim() ? '{s.duas.noSearchMatch}' : '{s.duas.noTopicDuas}'}
        </p>
      ) : (
        groupedDuas.map((group) => (
          <div key={group.id}>
            <div className="catlab">
              {group.title} <span>· {group.sub}</span>
            </div>
            {group.duas.map((dua) => (
              <article className="acard" key={dua.id}>
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
                      <span>{s.duas.sourceLabel}</span>
                      <strong>{dua.source}</strong>
                      <small>{dua.kind === 'dua' ? s.duas.duaFromHadith : s.duas.quranPractice}</small>
                    </div>

                    {dua.kind === 'dua' ? (
                      <>
                        <h4>{s.duas.arabic}</h4>
                        <p className="arab" dir="rtl" lang="ar">{dua.arabic}</p>

                        <h4>{s.duas.hinglishPronunciation}</h4>
                        <p className="dua-transliteration">{dua.transliteration}</p>

                        <h4>{s.duas.meaningHinglish}</h4>
                        <p className="dua-meaning">{dua.meaning}</p>
                      </>
                    ) : (
                      <>
                        <h4>{s.duas.whatToRead}</h4>
                        <p className="dua-meaning">{dua.practice}</p>
                        <div className="dua-reference">
                          <span>{s.duas.quranReference}</span>
                          <strong>
                            Surah {dua.quranSurahName} ·{' '}
                            {dua.quranAyahStart === dua.quranAyahEnd
                              ? s.duas.ayahSingle(dua.quranAyahStart)
                              : s.duas.ayahRange(dua.quranAyahStart, dua.quranAyahEnd)}
                          </strong>
                        </div>
                        {onOpenSurah ? (
                          <button
                            className="outline-button"
                            onClick={() => onOpenSurah(dua.quranSurah)}
                          >
                            {s.duas.readInQuran(dua.quranSurah)}
                          </button>
                        ) : (
                          <p className="empty-note">
                            {s.duas.readFullAyah(dua.quranSurah)}
                          </p>
                        )}
                      </>
                    )}

                    {dua.note && <p className="dua-meaning">{dua.note}</p>}
                    <div className="chiprow">
                      <span className="mchip">{dua.source}</span>
                      <span className="mchip">{dua.kind === 'dua' ? s.duas.hadithChip : s.duas.quranHadithChip}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ))
      )}

      <div className="acard">
        <p className="mut">
          {s.duas.footer}
        </p>
      </div>
      <p className="dua-disclaimer">
        Arabic is the original Qur'anic text. Transliteration is only a reading aid.
        Page numbers refer to the Madani Mushaf edition. Translation and pronunciation
        require scholarly review before public release.
      </p>
      <p className="dua-disclaimer">
        {s.duas.disclaimerDaily}
      </p>
      <p className="dua-disclaimer">
        {s.duas.disclaimerWeak}
      </p>
      <p className="dua-disclaimer" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <BookOpen size={15} style={{ flex: 'none', marginTop: '2px' }} />
        <span>
          {s.duas.disclaimerSeparate}
        </span>
      </p>
    </section>
  );
}
