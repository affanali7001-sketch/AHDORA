/**
 * Dashboard — rebuilt to the approved preview (§6): title + sub, a
 * 2×2 stat grid with REAL values, the next-prayer card (with the
 * "Namaz ke time badlo" button INSIDE it), the challenge card with a
 * real progress bar, and the sleep card. No greeting block, no
 * today's-salah list, no points card. All data is live; where there
 * is no data yet, an honest empty state is shown — never a fake
 * number, never a percentage, and the configured sleep schedule is
 * never presented as actual sleep.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Chip, EmptyState, PillButton, ProgressBar } from '../components/ui';
import {
  fetchPrayerTimes,
  fetchSalahDay,
  fetchTomorrowFajr,
  formatTime12h,
  loadProfileWithCompletion,
  minutesUntilTomorrow,
  PRAYER_NAMES,
  todayKey,
  type PrayerRecord,
  type PrayerTimesResponse,
  type ProfileForm,
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

/** Preview wording: "1 ghanta 12 minute baaki" / "1 hour 12 minutes left". */
function longCountdown(mins: number, lang: AppLanguage): string {
  if (mins <= 0) return lang === 'hi' ? 'Abhi ka waqt hai' : 'Right now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (lang === 'hi') return h > 0 ? `${h} ghanta ${m} minute baaki` : `${m} minute baaki`;
  return h > 0
    ? `${h} hour${h > 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''} left`
    : `${m} minute${m !== 1 ? 's' : ''} left`;
}

export default function DashboardScreen({ lang, user, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  // Tomorrow's Fajr, only when every prayer today is done — the
  // server returns nextPrayer null after Isha, and showing "No
  // prayer times yet" then is wrong (the times did load).
  const [tomorrowFajr, setTomorrowFajr] = useState<string | null>(null);
  const [day, setDay] = useState<PrayerRecord | null>(null);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [challenge, setChallenge] = useState<ChallengeParticipation | null>(null);
  const [profile, setProfile] = useState<ProfileForm | null>(null);
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
      loadProfileWithCompletion(user?.name ?? ''),
    ]).then(([timesResult, dayResult, statsResult, challengesResult, profileResult]) => {
      if (!active) return;
      if (timesResult.status === 'fulfilled') {
        setTimes(timesResult.value);
        // All of today's prayers done (after Isha) → the next real
        // prayer is tomorrow's Fajr, not "no times".
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
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value.profile);
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
  }, [s.loadFailed, user?.name]);

  useEffect(load, [load]);

  const prayedCount = day
    ? PRAYER_NAMES.filter((name) => day[name].status === 'prayed').length
    : null;
  const next = times?.nextPrayer ?? (tomorrowFajr ? { name: 'Fajr' as const, time: tomorrowFajr } : null);
  const isTomorrow = times?.nextPrayer == null && tomorrowFajr !== null;
  const countdown = next
    ? isTomorrow
      ? minutesUntilTomorrow(next.time)
      : minutesUntil(next.time)
    : null;

  const sleepSchedule =
    profile && profile.sleepStartTime && profile.sleepEndTime
      ? `${formatTime12h(profile.sleepStartTime)} – ${formatTime12h(profile.sleepEndTime)}`
      : '';

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.dashTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{s.dashSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : (
        <View>
          {/* 2×2 stat grid — real values only */}
          <View style={styles.statGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {prayedCount !== null ? `${prayedCount} / 5` : '—'}
              </Text>
              <Text style={styles.statLabel}>{s.dashSalah}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {stats ? `${stats.todayFocusMinutes} min` : '—'}
              </Text>
              <Text style={styles.statLabel}>{s.dashStudy}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {stats ? `${stats.todayFocusMinutes} min` : '—'}
              </Text>
              <Text style={styles.statLabel}>{s.dashFocus}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {challenge ? `🔥 ${challenge.streak}` : '—'}
              </Text>
              <Text style={styles.statLabel}>{s.dashStreak}</Text>
            </View>
          </View>

          {/* Next prayer — edit button lives INSIDE this card */}
          {next && countdown !== null ? (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={T.cardTitle}>
                  {s.dashNextPrayer}
                  {isTomorrow ? ` · ${s.tomorrowTag}` : ''}
                </Text>
                <Chip
                  label={`${next.name} · ${formatTime12h(next.time)}`}
                  tone="peach"
                />
              </View>
              <Text style={[T.cardBody, { marginTop: 8 }]}>
                {longCountdown(countdown, lang)}. {s.dashReminderNote}
              </Text>
              <View style={{ marginTop: 12 }}>
                <PillButton
                  label={s.dashEditTimes}
                  variant="peach"
                  small
                  onPress={() => goTo('prayer')}
                />
              </View>
            </Card>
          ) : (
            <EmptyState title={s.dashNextPrayer} body={s.noPrayerToday} />
          )}

          {/* Challenge */}
          <Card>
            <Text style={T.cardTitle}>{s.dashChallenge}</Text>
            {challenge ? (
              <View>
                <Text style={[T.cardBody, { marginTop: 6 }]}>
                  {challenge.challenge.title} · Day {challenge.currentDay} /{' '}
                  {challenge.totalDays}
                </Text>
                {challenge.totalDays > 0 ? (
                  <View style={{ marginTop: 10 }}>
                    <ProgressBar
                      value={challenge.completedDays}
                      max={challenge.totalDays}
                    />
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={[T.cardBody, { marginTop: 6 }]}>{s.dashNoChallenge}</Text>
            )}
            <View style={{ marginTop: 10 }}>
              <PillButton
                label={s.dashChBtn}
                variant="ghost"
                small
                onPress={() => goTo('challenges')}
              />
            </View>
          </Card>

          {/* Sleep — schedule is shown as a schedule, never as actual sleep */}
          <Card>
            <Text style={T.cardTitle}>{s.dashSleep}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>
              {s.dashSleepNoRecord}
              {sleepSchedule ? ` · Schedule: ${sleepSchedule}` : ''}
            </Text>
          </Card>
        </View>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 14,
  },
  statValue: {
    fontFamily: F.sans,
    fontSize: 23,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: C.muted,
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
