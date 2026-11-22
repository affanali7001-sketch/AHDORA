/**
 * Home — rebuilt to the approved preview (§5): dark-teal gradient
 * header (TealHead) with Arabic salam, the real user's name, the real
 * date + live Hijri date, and a translucent next-prayer card with a
 * real countdown; then the 12 preview tiles (icon + label only, no
 * subtitle, no arrow); then the "Aaj ek nazar me" card with REAL
 * values. All data is live; where there is no data yet, an honest
 * empty state is shown — never a fake number.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenId, ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Chip, EmptyState, PillButton, TealHead, Tile, TileGrid } from '../components/ui';
import {
  fetchPrayerTimes,
  fetchSalahDay,
  fetchTomorrowFajr,
  formatTime12h,
  minutesUntilTomorrow,
  PRAYER_NAMES,
  todayKey,
  type PrayerRecord,
  type PrayerTimesResponse,
} from '../lib/apiCore';
import {
  myChallenges,
  studyStats,
  type ChallengeParticipation,
  type StudyStats,
} from '../lib/apiSocial';

/** Minutes from now until an HH:mm time today (null when unparsable). */
function minutesUntil(timeHHmm: string, now = new Date()): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeHHmm.trim());
  if (!match) return null;
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/** Preview tag format: "1h 12m" / "45m". */
function shortCountdown(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type HomeTile = { id: ScreenId; label: string; icon: string; peach?: boolean };

export default function HomeScreen({ lang, user, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  // Tomorrow's Fajr, only when every prayer today is done — the
  // server returns nextPrayer null after Isha, and showing "No
  // prayer times yet" then is wrong (the times did load). Set from
  // the tomorrow fetch in load(); null means not applicable.
  const [tomorrowFajr, setTomorrowFajr] = useState<string | null>(null);
  const [day, setDay] = useState<PrayerRecord | null>(null);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [challenge, setChallenge] = useState<ChallengeParticipation | null>(null);
  const [challengeLoaded, setChallengeLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      fetchPrayerTimes(),
      fetchSalahDay(todayKey()),
      studyStats(),
      myChallenges(),
    ]).then(([timesResult, dayResult, statsResult, challengesResult]) => {
      if (!active) return;
      if (timesResult.status === 'fulfilled') {
        setTimes(timesResult.value);
        // All of today's prayers done (after Isha) → the next real
        // prayer is tomorrow's Fajr, not "no times". Fetch it so
        // the card keeps showing a time + countdown.
        if (timesResult.value.nextPrayer === null) {
          void fetchTomorrowFajr().then((fajr) => {
            if (active) setTomorrowFajr(fajr);
          });
        } else {
          setTomorrowFajr(null);
        }
      }
      if (dayResult.status === 'fulfilled') setDay(dayResult.value);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (challengesResult.status === 'fulfilled') {
        setChallenge(challengesResult.value.active[0] ?? null);
      }
      setChallengeLoaded(true);
      if (
        timesResult.status === 'rejected' &&
        dayResult.status === 'rejected' &&
        statsResult.status === 'rejected' &&
        challengesResult.status === 'rejected'
      ) {
        setError(s.loadFailed);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [s.loadFailed]);

  useEffect(load, [load]);

  const now = new Date();
  const dateLine = now
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace(', ', ' · ');
  const hijriDate = times?.hijri?.month
    ? `${times.hijri.month} ${times.hijri.year ?? ''}`.trim()
    : '';

  const next = times?.nextPrayer ?? (tomorrowFajr ? { name: 'Fajr' as const, time: tomorrowFajr } : null);
  const isTomorrow = times?.nextPrayer == null && tomorrowFajr !== null;
  const countdown = next
    ? isTomorrow
      ? minutesUntilTomorrow(next.time)
      : minutesUntil(next.time)
    : null;

  const prayedCount = day
    ? PRAYER_NAMES.filter((name) => day[name].status === 'prayed').length
    : null;

  const tiles: HomeTile[] = [
    { id: 'dashboard', label: s.navDashboard, icon: '🏠' },
    { id: 'prayer', label: s.tilePrayer, icon: '🕌' },
    { id: 'quran', label: s.quranBookTitle, icon: '📖', peach: true },
    { id: 'para', label: s.paraBookTitle, icon: '📖' },
    { id: 'lifeAyahs', label: s.tileLifeAyahs, icon: '✨' },
    { id: 'duas', label: s.tileDuas, icon: '🤲' },
    { id: 'tasbeeh', label: s.tileTasbeeh, icon: '📿', peach: true },
    { id: 'hifz', label: s.tileHifz, icon: '🧠' },
    { id: 'khatmah', label: s.tileKhatmah, icon: '📖', peach: true },
    { id: 'qibla', label: s.tileQibla, icon: '🧭' },
    { id: 'fasting', label: s.tileFasting, icon: '🌙', peach: true },
    { id: 'study', label: s.tileStudy, icon: '📚' },
    { id: 'focus', label: s.tileFocus, icon: '⏱️' },
    { id: 'sleep', label: s.tileSleep, icon: '😴' },
    { id: 'challenges', label: s.tileChallenges, icon: '🏆', peach: true },
    { id: 'salahCalendar', label: s.calTile, icon: '📅' },
    { id: 'islamic-calendar', label: s.tileIslamicCal, icon: '🕌', peach: true },
    { id: 'analytics', label: s.tileAnalytics, icon: '📈' },
  ];

  const summaryParts: string[] = [];
  if (prayedCount !== null) summaryParts.push(`Namaz ${prayedCount}/5`);
  if (stats) summaryParts.push(`Study ${stats.todayFocusMinutes} min`);
  if (challenge) summaryParts.push(`Challenge Day ${challenge.currentDay}`);
  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(' · ')} ${s.homeTodayDetail}`
      : s.homeEmpty;

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      {/* AHDORA + search bar on a WHITE bar above the teal header
          (user request 2026-11-22): the brand sits on white, in dark
          teal — NOT inside the green where the salam is. */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>AHDORA</Text>
        <Pressable
          onPress={() => goTo('search')}
          style={styles.searchBtn}
          accessibilityRole="button"
          accessibilityLabel={s.searchTitle}
        >
          <Text style={styles.searchIcon}>🔍</Text>
        </Pressable>
      </View>
      {/* Extra top padding (+10px over the default 20) so the salam
          and the rest of the header sit a bit lower (user request). */}
      <TealHead style={styles.tealHeadPad}>
        <Text style={styles.arabic}>{s.salamArabic}</Text>
        <Text style={styles.greeting}>
          {s.homeGreeting} {user?.name ?? ''}
        </Text>
        <Text style={styles.dateLine}>
          {dateLine}
          {hijriDate ? ` · ${hijriDate}` : ''}
        </Text>
        {loading ? (
          <ActivityIndicator color={C.white} style={{ marginTop: 16 }} />
        ) : next && countdown !== null ? (
          <View style={styles.nextCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>
                {s.nextPrayer}
                {isTomorrow ? ` · ${s.tomorrowTag}` : ''}
              </Text>
              <Text style={styles.nextName}>
                {next.name} · {formatTime12h(next.time)}
              </Text>
            </View>
            <Chip label={shortCountdown(countdown)} tone="peach" />
          </View>
        ) : (
          <Text style={[styles.dateLine, { marginTop: 14 }]}>{s.noPrayerToday}</Text>
        )}
      </TealHead>

      <TileGrid>
        {tiles.map((tile) => (
          <Tile
            key={tile.id}
            label={tile.label}
            peach={tile.peach}
            onPress={() => goTo(tile.id)}
            icon={
              <Text style={[styles.tileIcon, tile.peach && styles.tileIconPeach]}>
                {tile.icon}
              </Text>
            }
          />
        ))}
      </TileGrid>

      {error && !times && !day && !stats && !challengeLoaded ? (
        <View style={{ marginTop: 14 }}>
          <EmptyState title={s.homeToday} body={error} />
        </View>
      ) : (
        <Card>
          <Text style={T.cardTitle}>{s.homeToday}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>{summary}</Text>
          <View style={{ marginTop: 12 }}>
            <PillButton
              label={s.homeDashBtn}
              variant="ghost"
              small
              onPress={() => goTo('dashboard')}
            />
          </View>
        </Card>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  tealHeadPad: { paddingTop: 30 },
  brand: {
    fontFamily: F.sans,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: C.teal900,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: { fontSize: 18, color: C.white },
  arabic: {
    fontFamily: F.arabic,
    fontSize: 27,
    lineHeight: 40,
    color: C.white,
  },
  greeting: {
    fontFamily: F.sans,
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    marginTop: 6,
    lineHeight: 27,
  },
  dateLine: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.navInactive,
    marginTop: 4,
    lineHeight: 18,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
  },
  nextLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.navInactive,
  },
  nextName: {
    fontFamily: F.sans,
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    marginTop: 2,
  },
  tileIcon: { fontSize: 22, color: C.teal700 },
  tileIconPeach: { color: C.peachInk },
});
