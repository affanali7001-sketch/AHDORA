/**
 * Salah Calendar — rebuilt to the approved preview (§8): title +
 * real current month, a 7-column grid where each cell shows the day
 * number plus a coloured dot (teal = all 5 prayers, peach = some)
 * or a 😢 emoji on a missed day; today’s cell is deep green. Below,
 * a legend card with the real month counts — full-prayer days and
 * Qaza pending. No month arrows (current month only), no tap-a-day
 * detail panel, no percentage anywhere, no bottom edit button.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card } from '../components/ui';
import {
  fetchSalahCalendar,
  monthKey,
  todayKey,
  PRAYER_NAMES,
  type PrayerRecord,
} from '../lib/apiCore';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayStatus(record: PrayerRecord | undefined): 'all' | 'some' | 'missed' | 'none' {
  if (!record) return 'none';
  const statuses = PRAYER_NAMES.map((name) => record[name].status);
  if (statuses.every((status) => status === 'prayed')) return 'all';
  if (statuses.some((status) => status === 'missed')) return 'missed';
  if (statuses.some((status) => status !== 'pending')) return 'some';
  return 'none';
}

export default function SalahCalendarScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const today = todayKey();
  const now = new Date();
  const month = monthKey(now);
  const [records, setRecords] = useState<Record<string, PrayerRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchSalahCalendar(month)
      .then((data) => {
        if (active) setRecords(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : s.calLoadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, s.calLoadFailed]);

  useEffect(load, [load]);

  const year = now.getFullYear();
  const monthNumber = now.getMonth();
  const firstWeekday = new Date(year, monthNumber, 1).getDay();
  const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTitle = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const counts = useMemo(() => {
    let fullDays = 0;
    let qazaPending = 0;
    for (const [date, record] of Object.entries(records)) {
      if (!date.startsWith(month)) continue;
      if (dayStatus(record) === 'all') fullDays++;
      for (const name of PRAYER_NAMES) {
        if (record[name].status === 'qaza') qazaPending++;
      }
    }
    return { fullDays, qazaPending };
  }, [records, month]);

  const statLine = s.calMonthStatLive
    .replace('{full}', String(counts.fullDays))
    .replace('{qaza}', String(counts.qazaPending));

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.calTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{monthTitle}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : (
        <View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((dayNum, index) => {
              if (dayNum === null) {
                return <View key={`blank-${index}`} style={styles.cellEmpty} />;
              }
              const date = `${year}-${String(monthNumber + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const status = dayStatus(records[date]);
              const isToday = date === today;
              return (
                <View
                  key={date}
                  style={[styles.cell, isToday && styles.cellToday]}
                  accessibilityLabel={`${date}${status !== 'none' ? ` — ${status}` : ''}`}
                >
                  <Text style={[styles.cellText, isToday && styles.cellTextToday]}>
                    {dayNum}
                  </Text>
                  {status === 'missed' ? (
                    <Text style={styles.cellEmoji}>😢</Text>
                  ) : status === 'all' || status === 'some' ? (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isToday
                            ? C.white
                            : status === 'all'
                              ? C.teal500
                              : C.peachMid,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          <Card>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: C.teal500 }]} />
              <Text style={styles.legendText}>{s.calLegFull}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: C.peachMid }]} />
              <Text style={styles.legendText}>{s.calLegPart}</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={styles.cellEmoji}>😢</Text>
              <Text style={styles.legendText}>{s.calLegMiss}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={T.cardBody}>{statLine}</Text>
          </Card>
        </View>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 14 },
  cell: {
    width: '13.4%',
    flexGrow: 1,
    aspectRatio: 1 / 1.08,
    borderRadius: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 2,
  },
  cellEmpty: {
    width: '13.4%',
    flexGrow: 1,
    aspectRatio: 1 / 1.08,
  },
  cellToday: { backgroundColor: C.teal700, borderColor: C.teal700 },
  cellText: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  cellTextToday: { color: C.white },
  cellEmoji: { fontSize: 13, lineHeight: 15 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  legendText: {
    fontFamily: F.sans,
    fontSize: 13.5,
    color: C.ink,
    lineHeight: 19,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
});
