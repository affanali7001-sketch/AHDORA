import { useEffect, useState, type ReactNode } from 'react';
import {
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

/**
 * Phase 14 — Home screen (preview #1). The post-login landing.
 * Dark teal gradient, location row, date card (tap → Dashboard),
 * next-prayer banner, 10-tile feature grid, Ar-Ra'd 13:28 ayah card.
 * All data is live: prayer times from fetchPrayerTimes, location from
 * the user's profile. No status bar (the preview's 9:30 is decorative
 * — a fake live clock is never shown).
 */

export function NextPrayerBanner({
  prayerTimes,
  prayerStatus,
  prayerError,
  now,
}: {
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  now: Date;
}) {
  const nextPrayer = prayerTimes?.nextPrayer ?? null;
  const countdown = nextPrayer ? countdownTo(nextPrayer.time, now) : '';
  return (
    <div className="home-nextp">
      <div>
        <small>AGLI NAMAZ</small>
        {prayerStatus === 'loading' || prayerStatus === 'idle' ? (
          <b>Prayer times load ho rahe hain…</b>
        ) : prayerStatus === 'no-city' ? (
          <b>Apna sheher Profile me bharo</b>
        ) : prayerStatus === 'error' || !prayerTimes ? (
          <b>{prayerError || 'Prayer times load nahi ho paye.'}</b>
        ) : nextPrayer ? (
          <b>{nextPrayer.name} — {formatTime12h(nextPrayer.time)}</b>
        ) : (
          <b>Aaj ki saari namazein guzar gayin</b>
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
}: {
  profile: UserProfile;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  guestMode: boolean;
  onNavigate: (page: Page) => void;
  onOpenGuidance: (tab: 'quran' | 'duas' | 'hijri' | 'mosques') => void;
}) {
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
    { label: 'Quran', icon: <BookOpen size={25} strokeWidth={1.8} />, onClick: () => onOpenGuidance('quran') },
    { label: 'Duas', icon: <Heart size={25} strokeWidth={1.8} />, onClick: () => onOpenGuidance('duas') },
    { label: 'Study', icon: <GraduationCap size={25} strokeWidth={1.8} />, onClick: () => onNavigate('study') },
    { label: 'Salah', icon: <Moon size={25} strokeWidth={1.8} />, onClick: () => onNavigate('deen') },
    { label: 'Tasbeeh', icon: <TasbeehIcon />, onClick: () => onNavigate('tasbeeh') },
    { label: 'Prayer Time', icon: <Clock3 size={25} strokeWidth={1.8} />, onClick: () => onNavigate('deen') },
    { label: 'Mosque', icon: <MosqueIcon />, onClick: () => onOpenGuidance('mosques') },
    { label: 'Challenges', icon: <Trophy size={25} strokeWidth={1.8} />, onClick: () => onNavigate('challenges') },
    { label: 'Focus', icon: <Target size={25} strokeWidth={1.8} />, onClick: () => onNavigate('focus') },
    { label: 'Sleep', icon: <BedDouble size={25} strokeWidth={1.8} />, onClick: () => onNavigate('sleep') },
  ];

  return (
    <div className="home-screen">
      {guestMode && <span className="home-guest-badge">GUEST PREVIEW</span>}
      <div className="home-locrow">
        <div className="home-loc">
          <MapPin size={20} strokeWidth={1.8} />
          <span>
            <b>{city || 'Apna sheher'}</b>
            <br />
            {stateCountry || 'Profile me location bharo'}
          </span>
        </div>
        <button
          type="button"
          className="home-iconbtn"
          onClick={() => onNavigate('profile')}
          aria-label="Profile aur settings"
        >
          <Settings size={19} strokeWidth={1.8} />
        </button>
      </div>

      <button
        type="button"
        className="home-datecard"
        onClick={() => onNavigate('dashboard')}
        aria-label="Aaj ka haal dekho"
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
            Aaj ka haal <ChevronRight size={14} />
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
          <b>Aaj ki ayat — Ar-Ra&apos;d 13:28:</b> &ldquo;Sun lo, Allah ke zikr se hi dilon ko
          sukoon milta hai.&rdquo;
        </p>
        <p>
          <b>EN:</b> &ldquo;Verily, in the remembrance of Allah do hearts find rest.&rdquo;
        </p>
      </div>
    </div>
  );
}
