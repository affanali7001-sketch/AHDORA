/**
 * Home — the landing after login: dark teal header, location + date
 * card, next-prayer banner, a prominent Quran Book card (mushaf-style
 * mini page + real today's reading progress), then the tile grid.
 * All data is live; tiles that lead to not-yet-built screens simply
 * navigate there (the shell shows an honest placeholder for them).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenId, ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, S, T } from '../lib/theme';
import { Card, EmptyState, PillButton, ProgressBar, SectionTitle } from '../components/ui';
import {
  fetchPrayerTimes,
  fetchQuranHistory,
  formatTime12h,
  loadProfileWithCompletion,
  type PrayerTimesResponse,
  type QuranHistory,
} from '../lib/apiCore';

type Tile = { id: ScreenId; title: string; sub: string };

export default function HomeScreen({ lang, user, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [city, setCity] = useState('');
  const [quran, setQuran] = useState<QuranHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      fetchPrayerTimes(),
      fetchQuranHistory(),
      loadProfileWithCompletion(user?.name ?? ''),
    ]).then(([timesResult, quranResult, profileResult]) => {
      if (!active) return;
      if (timesResult.status === 'fulfilled') setTimes(timesResult.value);
      if (quranResult.status === 'fulfilled') setQuran(quranResult.value);
      if (profileResult.status === 'fulfilled' && profileResult.value.profile) {
        setCity(profileResult.value.profile.city);
      }
      if (timesResult.status === 'rejected' && quranResult.status === 'rejected') {
        setError(s.loadFailed);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [s.loadFailed, user?.name]);

  useEffect(load, [load]);

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const tiles: Tile[] = [
    { id: 'prayer', title: s.tilePrayer, sub: s.tilePrayerSub },
    { id: 'salahCalendar', title: s.tileCalendar, sub: s.tileCalendarSub },
    { id: 'quran', title: s.navQuran, sub: s.quranBookSub },
    { id: 'study', title: s.tileStudy, sub: s.tileStudySub },
    { id: 'focus', title: s.tileFocus, sub: s.tileFocusSub },
    { id: 'challenges', title: s.tileChallenges, sub: s.tileChallengesSub },
    { id: 'friends', title: s.tileFriends, sub: s.tileFriendsSub },
    { id: 'tasbeeh', title: s.tileTasbeeh, sub: s.tileTasbeehSub },
    { id: 'duas', title: s.tileDuas, sub: s.tileDuasSub },
    { id: 'lifeAyahs', title: s.tileLifeAyahs, sub: s.tileLifeAyahsSub },
    { id: 'hijri', title: s.tileHijri, sub: s.tileHijriSub },
    { id: 'mosque', title: s.tileMosque, sub: s.tileMosqueSub },
    { id: 'sleep', title: s.tileSleep, sub: s.tileSleepSub },
    { id: 'appBlock', title: s.tileAppBlock, sub: s.tileAppBlockSub },
    { id: 'analytics', title: s.tileAnalytics, sub: s.tileAnalyticsSub },
    { id: 'notifications', title: s.tileNotifications, sub: s.tileNotificationsSub },
  ];

  const next = times?.nextPrayer ?? null;
  const hijriDate = times?.hijri?.date
    ? `${times.hijri.date} ${times.hijri.month ?? ''} ${times.hijri.year ?? ''}`.trim()
    : '';

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      {/* Dark teal header */}
      <View style={styles.header}>
        <Text style={styles.headerSalam}>{s.homeGreeting}</Text>
        <Text style={styles.headerName}>{user?.name ?? ''}</Text>
        <Text style={styles.headerDate}>{todayLabel}</Text>
        {hijriDate ? <Text style={styles.headerHijri}>{hijriDate}</Text> : null}
      </View>

      {/* Location + date card */}
      <Card>
        <Text style={T.cardTitle}>{city || s.homeLocationUnknown}</Text>
        <Text style={T.cardBody}>
          {s.homeDateLine}: {todayLabel}
        </Text>
        {times?.method ? (
          <Text style={[T.cardBody, { marginTop: 4 }]}>{times.method}</Text>
        ) : null}
      </Card>

      {/* Next-prayer banner */}
      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />
      ) : next ? (
        <View style={styles.nextBanner}>
          <Text style={styles.nextLabel}>{s.nextPrayer}</Text>
          <Text style={styles.nextName}>{next.name}</Text>
          <Text style={styles.nextTime}>{formatTime12h(next.time)}</Text>
          <PillButton
            label={`${s.tilePrayer} →`}
            variant="dark"
            onPress={() => goTo('prayer')}
          />
        </View>
      ) : (
        <EmptyState title={s.nextPrayer} body={s.noPrayerToday} />
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}

      {/* Quran Book card — prominent, no hunting */}
      <SectionTitle title={s.quranBookTitle} sub={s.quranBookSub} />
      <Pressable onPress={() => goTo('quran')} accessibilityRole="button">
        <View style={styles.mushaf}>
          <View style={styles.mushafInner}>
            <Text style={styles.mushafSurah}>Al-Fatihah · 1</Text>
            <Text style={styles.mushafArabic}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            <Text style={styles.mushafPage}>Page 1 / 604</Text>
          </View>
        </View>
      </Pressable>
      <Card>
        <Text style={T.cardTitle}>{s.quranTodayRead}</Text>
        {quran ? (
          <View>
            <Text style={[T.cardBody, { marginTop: 4 }]}>
              {quran.ayahsOpenedToday} {s.ayahsReadToday} · {s.ofTarget} {quran.dailyTarget}{' '}
              {s.targetAyahs}
            </Text>
            <View style={{ marginTop: 10 }}>
              <ProgressBar value={quran.ayahsOpenedToday} max={quran.dailyTarget} />
            </View>
          </View>
        ) : (
          <Text style={[T.cardBody, { marginTop: 4 }]}>{s.noReadingYet}</Text>
        )}
        <View style={{ marginTop: 14 }}>
          <PillButton
            label={quran && quran.ayahsOpenedToday > 0 ? s.continueReading : s.startReading}
            onPress={() => goTo('quran')}
          />
        </View>
      </Card>

      {/* Tile grid */}
      <SectionTitle title={s.homeTilesTitle} />
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.id}
            style={styles.tile}
            onPress={() => goTo(tile.id)}
            accessibilityRole="button"
          >
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileSub}>{tile.sub}</Text>
            <Text style={styles.tileArrow}>→</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.teal950,
    borderRadius: S.radius,
    padding: 20,
    marginBottom: S.gap,
  },
  headerSalam: { fontSize: 14, color: C.peach, fontWeight: '700' },
  headerName: { fontSize: 24, fontWeight: '800', color: C.white, marginTop: 4 },
  headerDate: { fontSize: 13, color: '#B9CFC9', marginTop: 6 },
  headerHijri: { fontSize: 13, color: '#B9CFC9', marginTop: 2 },
  nextBanner: {
    backgroundColor: C.teal,
    borderRadius: S.radius,
    padding: 20,
    marginBottom: S.gap,
  },
  nextLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: C.peach2 },
  nextName: { fontSize: 26, fontWeight: '800', color: C.white, marginTop: 6 },
  nextTime: { fontSize: 18, color: C.peach2, marginTop: 2, marginBottom: 14 },
  mushaf: {
    backgroundColor: C.teal900,
    borderRadius: S.radius,
    padding: 6,
    marginBottom: S.gap,
  },
  mushafInner: {
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 20,
    backgroundColor: C.white,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  mushafSurah: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: C.teal },
  mushafArabic: {
    fontSize: 22,
    color: C.ink,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 36,
  },
  mushafPage: { fontSize: 12, color: C.muted, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: C.white,
    borderRadius: S.radiusSm,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 12,
  },
  tileTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  tileSub: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 16 },
  tileArrow: { fontSize: 16, color: C.teal2, fontWeight: '800', marginTop: 8 },
});
