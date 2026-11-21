import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  BedDouble,
  BookOpen,
  ChevronRight,
  Clock3,
  GraduationCap,
  Heart,
  MapPin,
  Moon,
  Settings,
  Target,
  Trophy,
} from 'lucide-react';
import type { Page } from '../App';
import { countdownTo, formatTime12h } from '../App';
import type { PrayerTimesResponse } from '../lib/prayerApi';
import type { UserProfile } from '../types/profile';
import type { AppLanguage, BilingualText } from '../lib/language';
import { pickText } from '../lib/language';
import { stringsFor } from '../lib/strings';

/**
 * Phase 14 — Home screen (preview #1). The tile-grid home, reached
 * from the pill nav Home button. The post-login landing is the
 * Dashboard (preview #4, Phase 15); this grid is the second stop.
 * Dark teal gradient, location row, date card (tap → Dashboard),
 * next-prayer banner, 11-tile feature grid, Ar-Ra'd 13:28 ayah card.
 * All data is live: prayer times from fetchPrayerTimes, location from
 * the user's profile. No status bar (the preview's 9:30 is decorative
 * — a fake live clock is never shown).
 *
 * Phase 16:
 * - The Salah tile opens the monthly Salah calendar
 *   ('salah-calendar' route): that route had NO entry point anywhere
 *   in the app — no goTo('salah-calendar') call existed — so the
 *   calendar was unreachable at every width, not hidden by a
 *   responsive rule (see the tile comment below). The Prayer times
 *   tile still opens the daily Prayer Times screen ('deen').
 * - The Analytics tile opens the real Analytics screen (preview #17,
 *   inline in App.tsx, Din/Hafta/Mahina on real per-period data).
 * - The ayah card shows both translations, primary following the
 *   selected language via pickText (language.ts).
 */

/** Ar-Ra'd 13:28 — the two meanings the Home ayah card has shown
 * since Phase 14, byte-for-byte (Hinglish short line as approved in
 * preview #1; English line as already shown with the "EN:" tag).
 * They are card copy, not a new translation: the verified full
 * Hinglish meaning lives untouched in
 * src/lib/curatedQuranMeanings.ts (13:28) — "Jo log imaan laaye aur
 * jinke dil Allah ke zikr se sukoon paate hain. Sun lo, Allah ke zikr
 * hi se dilon ko sukoon milta hai." Nothing here is invented.
 * pickText makes the primary line follow the selected language. */
const AYAH_MEANING: BilingualText = {
  hi: 'Sun lo, Allah ke zikr hi se dilon ko sukoon milta hai.',
  en: 'Verily, in the remembrance of Allah do hearts find rest.',
};

export function NextPrayerBanner({
  prayerTimes,
  prayerStatus,
  prayerError,
  now,
  language,
}: {
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  now: Date;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const nextPrayer = prayerTimes?.nextPrayer ?? null;
  const countdown = nextPrayer ? countdownTo(nextPrayer.time, now, language) : '';
  return (
    <div className="home-nextp">
      <div>
        <small>{s.home.nextPrayer}</small>
        {prayerStatus === 'loading' || prayerStatus === 'idle' ? (
          <b>{s.home.nextPrayerLoading}</b>
        ) : prayerStatus === 'no-city' ? (
          <b>{s.home.nextPrayerNoCity}</b>
        ) : prayerStatus === 'error' || !prayerTimes ? (
          <b>{prayerError || s.home.nextPrayerError}</b>
        ) : nextPrayer ? (
          <b>{nextPrayer.name} — {formatTime12h(nextPrayer.time)}</b>
        ) : (
          <b>{s.home.nextPrayerAllDone}</b>
        )}
      </div>
      {nextPrayer && countdown ? <div className="home-nextp-cd">{countdown}</div> : null}
    </div>
  );
}

function TasbeehIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="17" cy="7.5" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
      <circle cx="17" cy="16.5" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
      <circle cx="7" cy="16.5" r="1.6" />
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="7" cy="7.5" r="1.6" />
    </svg>
  );
}

function MosqueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c.5 1.5 3.8 2.7 3.8 5.5H8.2C8.2 5.7 11.5 4.5 12 3z" />
      <path d="M5.5 20v-7h13v7M3.5 20h17M10.2 20v-3a1.8 1.8 0 0 1 3.6 0v3" />
    </svg>
  );
}

export default function Home({
  profile,
  prayerTimes,
  prayerStatus,
  prayerError,
  guestMode,
  onNavigate,
  onOpenGuidance,
  language,
}: {
  profile: UserProfile;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  guestMode: boolean;
  onNavigate: (page: Page) => void;
  onOpenGuidance: (tab: 'quran' | 'duas' | 'hijri' | 'mosques') => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  // Phase 16 (#4): the ayah's primary translation follows the
  // selected language; the other language stays as the secondary
  // line. Arabic is untouched.
  const ayah = pickText(AYAH_MEANING, language);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const today = new Date();
  const weekday = today.toLocaleDateString('en-IN', { weekday: 'long' });
  const gregorian = today.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hijri = prayerTimes?.hijri;
  const hijriLine =
    hijri?.date && hijri.month && hijri.year
      ? `${hijri.date} ${hijri.month} ${hijri.year} · ${weekday}`
      : null;
  const city = profile.city?.trim() || '';
  const stateCountry = [profile.state?.trim(), profile.country?.trim() || 'India']
    .filter(Boolean)
    .join(', ');
  const fajr = prayerTimes?.timings.Fajr;
  const maghrib = prayerTimes?.timings.Maghrib;

  const tiles: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
  }[] = [
    { label: s.home.tiles.quran, icon: <BookOpen size={25} strokeWidth={1.8} />, onClick: () => onOpenGuidance('quran') },
    { label: s.home.tiles.duas, icon: <Heart size={25} strokeWidth={1.8} />, onClick: () => onOpenGuidance('duas') },
    { label: s.home.tiles.study, icon: <GraduationCap size={25} strokeWidth={1.8} />, onClick: () => onNavigate('study') },
    // Phase 16 (#2): the Salah tile opens the monthly Salah calendar.
    // Before this, BOTH the Salah tile and the Prayer times tile went
    // to 'deen', and no code anywhere called goTo('salah-calendar') —
    // the calendar route existed but was unreachable at every width
    // (no media query or conditional render hid it; there was simply
    // no link). The Prayer times tile below still opens 'deen'.
    { label: s.home.tiles.salah, icon: <Moon size={25} strokeWidth={1.8} />, onClick: () => onNavigate('salah-calendar') },
    { label: s.home.tiles.tasbeeh, icon: <TasbeehIcon />, onClick: () => onNavigate('tasbeeh') },
    { label: s.home.tiles.prayerTime, icon: <Clock3 size={25} strokeWidth={1.8} />, onClick: () => onNavigate('deen') },
    { label: s.home.tiles.mosque, icon: <MosqueIcon />, onClick: () => onOpenGuidance('mosques') },
    { label: s.home.tiles.challenges, icon: <Trophy size={25} strokeWidth={1.8} />, onClick: () => onNavigate('challenges') },
    { label: s.home.tiles.focus, icon: <Target size={25} strokeWidth={1.8} />, onClick: () => onNavigate('focus') },
    { label: s.home.tiles.sleep, icon: <BedDouble size={25} strokeWidth={1.8} />, onClick: () => onNavigate('sleep') },
    // Phase 16 (#5): Analytics (preview #17) had a route and a real
    // screen but no entry point anywhere in the app. The tile label
    // comes from the existing strings system (s.analytics.title —
    // 'Analytics' in both languages).
    { label: s.analytics.title, icon: <BarChart3 size={25} strokeWidth={1.8} />, onClick: () => onNavigate('analytics') },
  ];

  return (
    <div className="home-screen">
      {guestMode && <span className="home-guest-badge">{s.home.guestBadge}</span>}
      <div className="home-locrow">
        <div className="home-loc">
          <MapPin size={20} strokeWidth={1.8} />
          <span>
            <b>{city || s.home.cityFallback}</b>
            <br />
            {stateCountry || s.home.locationFallback}
          </span>
        </div>
        <button
          type="button"
          className="home-iconbtn"
          onClick={() => onNavigate('profile')}
          aria-label={s.home.profileSettings}
        >
          <Settings size={19} strokeWidth={1.8} />
        </button>
      </div>

      <button
        type="button"
        className="home-datecard"
        onClick={() => onNavigate('dashboard')}
        aria-label={s.home.todayAtAGlance}
      >
        <div className="home-datecard-copy">
          <div className="home-d1">{gregorian}</div>
          <div className="home-d2">{hijriLine ?? weekday}</div>
          <div className="home-times">
            <div>
              Fajr<b>{fajr ? formatTime12h(fajr) : '—'}</b>
            </div>
            <div>
              Maghrib<b>{maghrib ? formatTime12h(maghrib) : '—'}</b>
            </div>
          </div>
          <span className="home-datecard-link">
            {s.home.todayAtAGlanceLink} <ChevronRight size={14} />
          </span>
        </div>
        <div className="home-mosque-art" aria-hidden="true">
          <MosqueIcon />
        </div>
      </button>

      <NextPrayerBanner
        prayerTimes={prayerTimes}
        prayerStatus={prayerStatus}
        prayerError={prayerError}
        now={now}
        language={language}
      />

      <div className="home-grid">
        {tiles.map((tile) => (
          <button type="button" className="home-tile" key={tile.label} onClick={tile.onClick}>
            <span className="home-tile-ic">{tile.icon}</span>
            {tile.label}
          </button>
        ))}
      </div>

      <div className="home-ayah">
        <div className="home-ayah-ar">اَلَا بِذِكْرِ اللّٰهِ تَطْمَىِٕنُّ الْقُلُوْبُ</div>
        <p>
          <b>{s.home.ayahLabel}</b> &ldquo;{ayah.primary}&rdquo;
        </p>
        <p>
          <b>{language === 'en' ? 'Hinglish:' : 'EN:'}</b> &ldquo;{ayah.secondary}&rdquo;
        </p>
      </div>
    </div>
  );
}
