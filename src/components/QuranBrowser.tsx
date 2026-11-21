import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Pause,
  Play,
  Search,
  Target,
} from 'lucide-react';
import { curatedHinglishMeaning } from '../lib/curatedQuranMeanings';
import {
  addBookmark,
  deleteBookmark,
  fetchBookmarks,
  fetchQuranHistory,
  fetchSurah,
  fetchSurahList,
  recordRead,
  searchQuran,
  setDailyTarget,
  type AyahSearchMatch,
  type QuranBookmark,
  type QuranHistory,
  type SurahDetail,
  type SurahMeta,
} from '../lib/quranApi';

/**
 * Quran browser. Arabic (Tanzil Uthmani), transliteration and the
 * Saheeh International translation come from the verified upstream
 * via the backend — the source is shown on every ayah card. Audio
 * streams from EveryAyah with the reciter credited. Bookmarks,
 * history and the daily target are per-user; guests can read but
 * are told to sign in to track.
 *
 * Layout (preview #8, dark): single-column .srow surah list,
 * "PADHNA JAARI RAKHO" continue-reading card on top fed ONLY by
 * the existing reading-history state — hidden when there is no
 * history, never filled with an invented last-read position.
 */
export default function QuranBrowser({
  onNotify,
  guestMode,
  initialSurah,
  onInitialSurahOpened,
}: {
  onNotify: (message: string) => void;
  guestMode: boolean;
  initialSurah?: number | null;
  onInitialSurahOpened?: () => void;
}) {
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [ayahMatches, setAyahMatches] = useState<AyahSearchMatch[]>([]);
  const [ayahSearchError, setAyahSearchError] = useState('');
  const [selected, setSelected] = useState<SurahDetail | null>(null);
  const [readingSurah, setReadingSurah] = useState(false);
  const [reciter, setReciter] = useState('');
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [history, setHistory] = useState<QuranHistory | null>(null);
  const [targetInput, setTargetInput] = useState('10');
  const [showBookmarks, setShowBookmarks] = useState(false);
  // Hinglish transliteration is the point of this screen for many
  // readers, so it is on by default and can be hidden — never the
  // other way round. Both toggles do real work (they re-render the
  // ayah list); Arabic is always shown.
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  // Hinglish tarjuma exists ONLY for the 4 curated verses (see
  // curatedQuranMeanings.ts) — there is no verified full-Qur'an
  // Hinglish translation upstream, so this toggle shows a line only
  // on those ayahs and nothing is invented for the rest.
  const [showHinglishMeaning, setShowHinglishMeaning] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSurahList();
      setSurahs(data.surahs);
      setSource(data.source);
      if (!guestMode) {
        const [marks, hist] = await Promise.all([fetchBookmarks(), fetchQuranHistory()]);
        setBookmarks(marks.bookmarks);
        setHistory(hist);
        setTargetInput(String(hist.dailyTarget));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Surah list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [guestMode]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (initialSurah) {
      openSurah(initialSurah);
      onInitialSurahOpened?.();
    }
    // Open the requested surah once when it is set from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSurah]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  async function openSurah(number: number) {
    setReadingSurah(true);
    setError('');
    setPlayingAyah(null);
    audioRef.current?.pause();
    try {
      const detail = await fetchSurah(number, reciter || undefined);
      setSelected(detail);
      setReciter(detail.audio.reciter.id);
      if (!guestMode) {
        await recordRead(number, 1).catch(() => undefined);
        fetchQuranHistory().then(setHistory).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Surah could not be loaded.');
    } finally {
      setReadingSurah(false);
    }
  }

  async function runSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setAyahMatches([]);
      setAyahSearchError('');
      return;
    }
    setSearching(true);
    try {
      const result = await searchQuran(value.trim());
      setAyahMatches(result.ayahs);
      setAyahSearchError(result.ayahSearchError ?? '');
    } catch {
      setAyahMatches([]);
      setAyahSearchError('Search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  }

  /**
   * Play one ayah. The primary URL is EveryAyah; if it fails to
   * load in this browser/network (play() rejects, or the media
   * element fires an error later — previously unhandled, so the
   * UI sat on the Pause icon in silence), the same reciter's
   * AlQuran Cloud CDN URL is tried once before telling the user.
   * The playing state is set only after play() actually resolves,
   * so a failed attempt never flashes the Pause icon.
   */
  function playAyah(ayah: { numberInSurah: number; audioUrl: string; audioFallbackUrl: string }) {
    if (!selected) return;
    const ayahNumber = ayah.numberInSurah;
    if (playingAyah === ayahNumber) {
      audioRef.current?.pause();
      setPlayingAyah(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio();
    audioRef.current = audio;
    let triedFallback = false;

    const fail = () => {
      onNotify('Audio could not be played. Check your connection and try again.');
      setPlayingAyah(null);
    };
    const trySrc = (src: string) => {
      audio.src = src;
      audio.load();
      return audio.play();
    };
    const tryFallbackOrFail = () => {
      if (!triedFallback && ayah.audioFallbackUrl) {
        triedFallback = true;
        trySrc(ayah.audioFallbackUrl)
          .then(() => setPlayingAyah(ayahNumber))
          .catch(fail);
      } else {
        fail();
      }
    };

    audio.onended = () => setPlayingAyah(null);
    // A load/decode failure after play() resolved (e.g. the
    // stream drops mid-ayah) must also fall back, not hang. The
    // ref check ignores errors from an element the user has
    // already moved away from (paused / switched ayah).
    audio.onerror = () => {
      if (audioRef.current !== audio) return;
      if (!triedFallback) tryFallbackOrFail();
      else fail();
    };
    trySrc(ayah.audioUrl)
      .then(() => setPlayingAyah(ayahNumber))
      .catch(tryFallbackOrFail);
    if (!guestMode) {
      recordRead(selected.surah.number, ayahNumber).catch(() => undefined);
    }
  }

  async function toggleBookmark(surahNumber: number, ayahNumber: number) {
    if (guestMode) {
      onNotify('Sign in to save bookmarks.');
      return;
    }
    const existing = bookmarks.find(
      (item) => item.surahNumber === surahNumber && item.ayahNumber === ayahNumber,
    );
    try {
      if (existing) {
        await deleteBookmark(existing.id);
        setBookmarks((prev) => prev.filter((item) => item.id !== existing.id));
        onNotify('Bookmark removed.');
      } else {
        const result = await addBookmark(surahNumber, ayahNumber);
        setBookmarks((prev) => [result.bookmark, ...prev]);
        onNotify('Bookmark saved.');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Bookmark could not be saved.');
    }
  }

  function toggleBookmarksPanel() {
    if (guestMode) {
      onNotify('Sign in to save bookmarks.');
      return;
    }
    setShowBookmarks((value) => !value);
  }

  async function saveTarget() {
    const value = Number(targetInput);
    if (!Number.isInteger(value) || value < 0 || value > 500) {
      onNotify('Daily target must be 0–500 ayahs.');
      return;
    }
    try {
      const result = await setDailyTarget(value);
      setHistory((prev) =>
        prev ? { ...prev, dailyTarget: result.dailyTarget } : prev,
      );
      onNotify('Daily reading target saved.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Target could not be saved.');
    }
  }

  const filteredSurahs = query.trim()
    ? surahs.filter(
        (surah) =>
          surah.englishName.toLowerCase().includes(query.trim().toLowerCase()) ||
          surah.englishNameTranslation.toLowerCase().includes(query.trim().toLowerCase()) ||
          String(surah.number) === query.trim(),
      )
    : surahs;

  if (selected) {
    const isBookmarked = (ayahNumber: number) =>
      bookmarks.some(
        (item) => item.surahNumber === selected.surah.number && item.ayahNumber === ayahNumber,
      );
    return (
      <section className="sc-quran">
        <button
          className="text-button"
          onClick={() => {
            setSelected(null);
            setPlayingAyah(null);
            audioRef.current?.pause();
            loadMeta();
          }}
        >
          <ArrowLeft size={15} /> Back to all surahs · Saari surahein
        </button>

        <div className="quran-reader-head">
          <div>
            <span className="eyebrow">
              SURAH {selected.surah.number} · {selected.surah.revelationType}
            </span>
            <h3>
              {selected.surah.englishName} · {selected.surah.name}
            </h3>
            <p>
              {selected.surah.englishNameTranslation} · {selected.surah.numberOfAyahs} ayahs
            </p>
          </div>
          <label className="field-label">
            Reciter · Qari
            <select
              className="form-input"
              value={reciter}
              onChange={async (event) => {
                const next = event.target.value;
                setReciter(next);
                setPlayingAyah(null);
                audioRef.current?.pause();
                try {
                  const detail = await fetchSurah(selected.surah.number, next);
                  setSelected(detail);
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : 'Reciter could not be changed.');
                }
              }}
            >
              {selected.audio.reciters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="quran-source-line">
          Source: {selected.source} · Translation: {selected.translation.name} (
          {selected.translation.edition}) · Transliteration (Hinglish): {selected.transliteration.edition} ·
          Audio: {selected.audio.reciter.name} via {selected.audio.source}
        </p>

        <div className="quran-toolbar">
          <button
            className="outline-button"
            aria-pressed={showTransliteration}
            onClick={() => setShowTransliteration((value) => !value)}
          >
            Hinglish transliteration: {showTransliteration ? 'On · Dikhao' : 'Off · Chhupao'}
          </button>
          <button
            className="outline-button"
            aria-pressed={showTranslation}
            onClick={() => setShowTranslation((value) => !value)}
          >
            English tarjuma: {showTranslation ? 'On · Dikhao' : 'Off · Chhupao'}
          </button>
          <button
            className="outline-button"
            aria-pressed={showHinglishMeaning}
            onClick={() => setShowHinglishMeaning((value) => !value)}
          >
            Hinglish tarjuma: {showHinglishMeaning ? 'On · Dikhao' : 'Off · Chhupao'}
          </button>
        </div>

        <p className="quran-source-line">
          Hinglish tarjuma sirf curated aayaton (13:28, 2:286, 20:25–28, 23:97–98) ke liye
          dikhta hai — poore Qur'an ka verified Hinglish tarjuma abhi available nahi hai,
          isliye baaki aayaton par sirf transliteration + English tarjuma hai.
        </p>

        <div>
          {selected.surah.ayahs.map((ayah) => (
            <article className="ayah-card" key={ayah.numberInSurah}>
              <div className="quran-ayah-top">
                <span className="quran-ayah-number">{ayah.numberInSurah}</span>
                <div className="quran-ayah-actions">
                  <button
                    className="icon-button"
                    aria-label={playingAyah === ayah.numberInSurah ? 'Pause audio' : 'Play audio'}
                    onClick={() => playAyah(ayah)}
                  >
                    {playingAyah === ayah.numberInSurah ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={isBookmarked(ayah.numberInSurah) ? 'Remove bookmark' : 'Bookmark ayah'}
                    onClick={() => toggleBookmark(selected.surah.number, ayah.numberInSurah)}
                  >
                    {isBookmarked(ayah.numberInSurah) ? (
                      <BookmarkCheck size={16} />
                    ) : (
                      <Bookmark size={16} />
                    )}
                  </button>
                </div>
              </div>
              <p className="quran-arabic" dir="rtl" lang="ar">
                {ayah.text}
              </p>
              {showTransliteration && ayah.transliteration && (
                <p className="quran-transliteration">
                  <span className="eyebrow">HINGLISH MEIN PADHEIN · </span>
                  {ayah.transliteration}
                </p>
              )}
              {showTranslation && ayah.translation && (
                <p className="quran-translation">
                  <span className="eyebrow">TARJUMA · ENGLISH · </span>
                  {ayah.translation}
                </p>
              )}
              {showHinglishMeaning &&
                (() => {
                  const curated = curatedHinglishMeaning(
                    selected.surah.number,
                    ayah.numberInSurah,
                  );
                  return curated ? (
                    <p className="quran-translation">
                      <span className="eyebrow">TARJUMA · HINGLISH · </span>
                      {curated.meaning}
                    </p>
                  ) : null;
                })()}
              {ayah.sajda && <span className="quran-sajda">Sajda ayah · Sajda wali ayat</span>}
              <div className="chiprow">
                <span className="mchip">Source: {selected.source}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Continue-reading card: fed ONLY by the existing reading-history
  // state. No history (guest, or nothing read yet) → the card is
  // hidden entirely, never filled with an invented surah/ayah.
  const lastRead = !guestMode && history && history.history.length > 0
    ? history.history[0]
    : null;
  const lastReadMeta = lastRead
    ? surahs.find((surah) => surah.number === lastRead.surahNumber)
    : undefined;
  const lastReadPct = lastRead && lastReadMeta
    ? Math.min(100, Math.round((lastRead.lastAyahNumber / lastReadMeta.numberOfAyahs) * 100))
    : null;

  return (
    <section className="sc-quran">
      <div className="quran-browser-head">
        <div>
          <span className="eyebrow">QUR'AN · VERIFIED TEXT</span>
          <h3>Read the Qur'an · Qur'an padhein</h3>
          <p>Arabic ke saath Hinglish transliteration aur English tarjuma — verified source se, kuch bhi banaya hua nahi.</p>
          {source && <p className="quran-source-line">Source: {source}</p>}
        </div>
        <button
          className="iconbtn"
          aria-label="Bookmarks"
          aria-pressed={showBookmarks}
          onClick={toggleBookmarksPanel}
        >
          <Bookmark size={18} />
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <label className="searchbar">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => runSearch(event.target.value)}
          placeholder="Surah dhoondo — naam ya number…"
          aria-label="Search surahs"
        />
      </label>

      {lastRead && (
        <div className="acard sc-continue">
          <div className="sc-eyebrow-peach">PADHNA JAARI RAKHO</div>
          <div className="sc-continue-title">
            Surah {lastReadMeta ? lastReadMeta.englishName : lastRead.surahNumber}
          </div>
          <p className="mut">
            Ayah {lastRead.lastAyahNumber} par ruke the · aaj {history?.ayahsOpenedToday ?? 0} / {history?.dailyTarget ?? 0} ayahs
          </p>
          {lastReadPct !== null && (
            <div className="prog"><i style={{ width: `${lastReadPct}%` }} /></div>
          )}
          <button className="sbtn pk" onClick={() => openSurah(lastRead.surahNumber)}>
            Aage padho →
          </button>
        </div>
      )}

      {showBookmarks && !guestMode && (
        <div className="acard quran-bookmarks">
          <h4>Your bookmarks ({bookmarks.length})</h4>
          {bookmarks.length === 0 ? (
            <p className="empty-note">No bookmarks yet. Open a surah and tap the bookmark icon on any ayah.</p>
          ) : (
            <ul>
              {bookmarks.map((item) => (
                <li key={item.id}>
                  <button
                    className="text-button"
                    onClick={() => openSurah(item.surahNumber)}
                  >
                    Surah {item.surahNumber} · Ayah {item.ayahNumber}
                  </button>
                  {item.note && <span> — {item.note}</span>}
                  <button
                    className="text-button danger-text"
                    onClick={() => toggleBookmark(item.surahNumber, item.ayahNumber)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!guestMode && history && (
        <div className="acard quran-progress">
          <div>
            <span className="eyebrow">READING TODAY · AAJ KI READING · {history.date}</span>
            <h4>
              {history.ayahsOpenedToday} of {history.dailyTarget} ayahs opened
            </h4>
            <p className="mut">
              {history.history.length === 0
                ? 'No reading recorded yet today.'
                : `Last read: Surah ${history.history[0]?.surahNumber}, Ayah ${history.history[0]?.lastAyahNumber}.`}
            </p>
          </div>
          <label className="field-label">
            <Target size={14} /> Roz ka target (ayahs) · Daily target
            <span className="quran-target-row">
              <input
                className="form-input"
                inputMode="numeric"
                value={targetInput}
                onChange={(event) => setTargetInput(event.target.value)}
              />
              <button className="outline-button" onClick={saveTarget}>
                Save
              </button>
            </span>
          </label>
        </div>
      )}
      {guestMode && (
        <p className="empty-note">Sign in to save bookmarks, track reading history and set a daily target.</p>
      )}

      {searching && <p className="empty-note">Searching…</p>}
      {ayahSearchError && <p className="form-error">{ayahSearchError}</p>}
      {ayahMatches.length > 0 && (
        <div className="acard quran-search-results">
          <h4>Ayah matches · Tarjume mein mile</h4>
          <ul>
            {ayahMatches.slice(0, 10).map((match) => (
              <li key={match.number}>
                <button className="text-button" onClick={() => openSurah(match.surah.number)}>
                  Surah {match.surah.englishName} ({match.surah.number})
                </button>
                <p>“{match.text}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading || readingSurah ? (
        <p className="empty-note">Loading…</p>
      ) : filteredSurahs.length === 0 ? (
        <p className="empty-note">
          {query.trim() ? 'No surah matches that search.' : 'No surahs could be loaded.'}
        </p>
      ) : (
        <div className="acard sc-surah-list">
          {filteredSurahs.map((surah) => (
            <button key={surah.number} className="srow" onClick={() => openSurah(surah.number)}>
              <span className="snum2">{surah.number}</span>
              <div>
                {surah.englishName}
                <small>
                  {surah.revelationType === 'Meccan'
                    ? 'Makki'
                    : surah.revelationType === 'Medinan'
                      ? 'Madani'
                      : surah.revelationType}
                  {' · '}
                  {surah.numberOfAyahs} Aayaat
                </small>
              </div>
              <span className="sar">{surah.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="acard">
        <p className="mut">
          Har surah khulne par Arabic text ke saath Hinglish transliteration, <b style={{ color: '#fff' }}>Hinglish tarjuma aur English translation — dono</b>, aur audio (EveryAyah) milega — source hamesha dikhega. Quran ke tarjume hamesha dono bhashaon me hain; baaki jagah ke tarjume sirf Hinglish me.
        </p>
      </div>
    </section>
  );
}
