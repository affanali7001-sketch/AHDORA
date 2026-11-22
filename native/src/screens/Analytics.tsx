/**
 * Analytics — rebuilt to the approved preview (§22 in the preview file).
 * Title "Analytics", period chips Daily / Weekly / Monthly that REALLY
 * switch the reporting period. A 7-bar chart (Mon–Sun, real focus
 * minutes per day from completed Pomodoro sessions — the max day is
 * peach). Stat grid: prayers in the period, study total, focus total,
 * sleep average — ALL real; sleep has no real data source, so it
 * honestly shows "—" with a note instead of a fake number. No
 * percentages anywhere. No sections list.
 *
 * Data: /api/study/stats (today/week focus minutes), /api/salah/
 * calendar/:month (per-day prayer statuses + month totals),
 * /api/study/pomodoro/history (completed sessions with completedAt +
 * focusMinutesEarned, for the per-day chart and the monthly total).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Chip, EmptyState, PillButton } from '../components/ui';
import {
  salahCalendar,
  studyStats,
  type SalahCalendarDay,
  type StudyStats,
} from '../lib/apiSocial';

type Period = 'daily' | 'weekly' | 'monthly';
const PERIODS: Period[] = ['daily', 'weekly', 'monthly'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type HistorySession = { completedAt: string | null; focusMinutesEarned: number; status: string };

async function fetchHistory(): Promise<HistorySession[]> {
  const response = await apiFetch('/api/study/pomodoro/history?limit=50');
  const data = (await response.json().catch(() => ({}))) as {
    sessions?: HistorySession[];
    total?: number;
  };
  return Array.isArray(data.sessions) ? data.sessions : [];
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Monday of the current week (local time). */
function mondayOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - offset);
  return d;
}

export default function AnalyticsScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [period, setPeriod] = useState<Period>('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [days, setDays] = useState<SalahCalendarDay[]>([]);
  const [monthTotals, setMonthTotals] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistorySession[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [st, cal, hist] = await Promise.all([
        studyStats(),
        salahCalendar(monthKey(new Date())),
        fetchHistory(),
      ]);
      setStats(st);
      setDays(cal.days);
      setMonthTotals(cal.totals);
      setHistory(hist);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  // --- 7-bar chart: Mon–Sun focus minutes this week ---
  const weekBars = useMemo(() => {
    const monday = mondayOfWeek(new Date());
    const bars = [0, 0, 0, 0, 0, 0, 0];
    for (const sess of history) {
      if (sess.status !== 'completed' || !sess.completedAt) continue;
      const d = new Date(sess.completedAt);
      const idx = Math.floor((d.getTime() - monday.getTime()) / 86_400_000);
      if (idx >= 0 && idx < 7) bars[idx] += sess.focusMinutesEarned ?? 0;
    }
    return bars;
  }, [history]);

  // --- Stat grid values per period ---
  const now = new Date();
  const today = dayKey(now);
  const monday = mondayOfWeek(now);
  const weekKeys = new Set(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return dayKey(d);
    }),
  );
  const prayedIn = (keys: Set<string>) =>
    days
      .filter((d) => keys.has(d.date))
      .reduce(
        (sum, d) =>
          sum +
          Object.values(d.prayers ?? {}).filter((p) => p && p.status === 'prayed').length,
        0,
      );
  const monthFocus = history
    .filter(
      (sess) =>
        sess.status === 'completed' &&
        sess.completedAt &&
        sess.completedAt.slice(0, 7) === monthKey(now),
    )
    .reduce((sum, sess) => sum + (sess.focusMinutesEarned ?? 0), 0);

  const prayed = period === 'daily' ? prayedIn(new Set([today])) : period === 'weekly' ? prayedIn(weekKeys) : monthTotals.prayed ?? 0;
  const prayedTotal = period === 'daily' ? 5 : period === 'weekly' ? 35 : (monthTotals.prayed ?? 0) + (monthTotals.qaza ?? 0) + (monthTotals.missed ?? 0) + (monthTotals.pending ?? 0);
  const focusMinutes = period === 'daily' ? stats?.todayFocusMinutes ?? null : period === 'weekly' ? stats?.weekFocusMinutes ?? null : monthFocus;
  const hasData =
    prayed > 0 || (focusMinutes !== null && focusMinutes > 0) || weekBars.some((v) => v > 0);

  const maxBar = Math.max(...weekBars, 1);

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.anTitle}</Text>
      <Text style={T.sub}>{s.anSub}</Text>

      <View style={styles.chips}>
        {PERIODS.map((p) => (
          <Chip
            key={p}
            label={p === 'daily' ? s.anDaily : p === 'weekly' ? s.anWeekly : s.anMonthly}
            selected={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && !stats && days.length === 0 ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}
          {!hasData ? (
            <EmptyState title={s.anTitle} body={s.anNoData} />
          ) : (
            <>
              {/* 7-bar chart */}
              <Card>
                <Text style={T.cardTitle}>{s.anStudy}</Text>
                <View style={styles.chart}>
                  {weekBars.map((value, i) => (
                    <View key={i} style={styles.barCol}>
                      <Text style={styles.barValue}>{value}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${Math.max(4, (value / maxBar) * 100)}%`,
                              backgroundColor: value === maxBar && value > 0 ? C.peachMid : C.teal500,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{DAY_LABELS[i]}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              {/* Stat grid */}
              <View style={styles.statGrid}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {prayed} / {prayedTotal}
                  </Text>
                  <Text style={styles.statLabel}>{s.anSalah}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{focusMinutes === null ? '—' : `${focusMinutes} min`}</Text>
                  <Text style={styles.statLabel}>{s.anStudyTot}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{focusMinutes === null ? '—' : `${focusMinutes} min`}</Text>
                  <Text style={styles.statLabel}>{s.anFocusTot}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>—</Text>
                  <Text style={styles.statLabel}>{s.anSleepAvg}</Text>
                </View>
              </View>
              <Text style={styles.note}>{s.anSleepNoData}</Text>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14, height: 150 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontFamily: 'PlusJakartaSans', fontSize: 10.5, fontWeight: '800', color: C.ink, marginBottom: 4 },
  barTrack: { width: '70%', height: 100, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 5 },
  barLabel: { fontFamily: 'PlusJakartaSans', fontSize: 10.5, fontWeight: '700', color: C.muted, marginTop: 6 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2, marginBottom: 14 },
  stat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 14,
  },
  statValue: { fontFamily: 'PlusJakartaSans', fontSize: 23, fontWeight: '800', color: C.ink },
  statLabel: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, fontWeight: '600', marginTop: 2 },
  note: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 12 },
});
