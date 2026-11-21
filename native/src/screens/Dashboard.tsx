/**
 * Dashboard — the post-login landing.
 * Real aggregated data only: today's prayer times + today's salah
 * statuses + the server-side rewards summary. Where there is no data,
 * an honest empty state is shown — never a fake stat.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, EmptyState, PillButton, SectionTitle } from '../components/ui';
import {
  fetchPrayerTimes,
  fetchRewardsSummary,
  fetchSalahDay,
  formatTime12h,
  PRAYER_NAMES,
  todayKey,
  type PrayerRecord,
  type PrayerTimesResponse,
  type RewardsSummary,
} from '../lib/apiCore';

export default function DashboardScreen({ lang, user, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [day, setDay] = useState<PrayerRecord | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      fetchPrayerTimes(),
      fetchSalahDay(todayKey()),
      fetchRewardsSummary(),
    ]).then(([timesResult, dayResult, rewardsResult]) => {
      if (!active) return;
      if (timesResult.status === 'fulfilled') setTimes(timesResult.value);
      if (dayResult.status === 'fulfilled') setDay(dayResult.value);
      if (rewardsResult.status === 'fulfilled') setRewards(rewardsResult.value);
      if (
        timesResult.status === 'rejected' &&
        dayResult.status === 'rejected' &&
        rewardsResult.status === 'rejected'
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

  const prayedCount = day
    ? PRAYER_NAMES.filter((name) => day[name].status === 'prayed').length
    : 0;
  const recordedCount = day
    ? PRAYER_NAMES.filter((name) => day[name].status !== 'pending').length
    : 0;
  const next = times?.nextPrayer ?? null;

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.eyebrow}>{s.dashTitle}</Text>
      <Text style={[T.title, { marginTop: 6 }]}>{s.dashboardHello}</Text>
      <Text style={[T.title, { color: C.teal }]}>{user?.name ?? ''}</Text>
      <Text style={[T.sub, { marginBottom: 18 }]}>{s.dashSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : (
        <View>
          {/* Next prayer */}
          {next ? (
            <Card>
              <Text style={T.cardTitle}>{s.dashNextPrayer}</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.teal900, marginTop: 6 }}>
                {next.name} · {formatTime12h(next.time)}
              </Text>
              {times?.city ? (
                <Text style={[T.cardBody, { marginTop: 4 }]}>{times.city}</Text>
              ) : null}
            </Card>
          ) : (
            <EmptyState title={s.dashNextPrayer} body={s.noPrayerToday} />
          )}

          {/* Today's salah */}
          <SectionTitle title={s.dashTodaySalah} />
          {day && recordedCount > 0 ? (
            <Card>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>
                {prayedCount}/5 {s.dashPrayedOf}
              </Text>
              <View style={{ marginTop: 10 }}>
                {PRAYER_NAMES.map((name) => {
                  const entry = day[name];
                  const time = times?.perPrayer?.[name]?.time ?? times?.timings?.[name] ?? '';
                  return (
                    <View
                      key={name}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>
                        {name}
                        {time ? ` · ${formatTime12h(time)}` : ''}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '700',
                          color:
                            entry.status === 'prayed'
                              ? C.teal2
                              : entry.status === 'missed'
                                ? C.red
                                : entry.status === 'qaza'
                                  ? C.peachDeep
                                  : C.muted,
                        }}
                      >
                        {entry.status === 'prayed'
                          ? s.statusPrayed
                          : entry.status === 'missed'
                            ? s.statusMissed
                            : entry.status === 'qaza'
                              ? s.statusQaza
                              : s.statusPending}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={{ marginTop: 12 }}>
                <PillButton label={s.dashViewCalendar} variant="ghost" onPress={() => goTo('salahCalendar')} />
              </View>
            </Card>
          ) : (
            <View>
              <EmptyState title={s.dashTodaySalah} body={s.dashNoSalahYet} />
              <PillButton label={s.dashMarkNow} onPress={() => goTo('prayer')} />
            </View>
          )}

          {/* Points & badges */}
          <SectionTitle title={s.dashPoints} />
          {rewards && (rewards.total > 0 || rewards.badges.length > 0 || rewards.recent.length > 0) ? (
            <Card>
              <Text style={{ fontSize: 28, fontWeight: '800', color: C.teal900 }}>
                {rewards.total}
              </Text>
              <Text style={T.cardBody}>
                {s.dashBadges}: {rewards.badges.length}
              </Text>
              {rewards.badges.length > 0 ? (
                <View style={{ marginTop: 10 }}>
                  {rewards.badges.slice(0, 3).map((badge) => (
                    <Text key={badge.badgeId} style={[T.cardBody, { marginTop: 2 }]}>
                      • {badge.title}
                    </Text>
                  ))}
                </View>
              ) : null}
              {rewards.recent.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={T.label}>{s.dashRecentPoints}</Text>
                  {rewards.recent.slice(0, 5).map((tx) => (
                    <View
                      key={tx.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: C.muted }}>{tx.reason}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: C.teal }}>
                        +{tx.amount}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : (
            <EmptyState title={s.dashPoints} body={s.dashNoPointsYet} />
          )}

          <View style={{ marginTop: 8 }}>
            <PillButton label={s.dashEditTimes} variant="peach" onPress={() => goTo('prayer')} />
          </View>
        </View>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}
