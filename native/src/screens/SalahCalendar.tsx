/**
 * Salah Calendar — monthly prayer record from GET /api/salah/calendar/:month.
 * Tap a day to see its five prayers and mark them (never for a future
 * date). Month summary shows a real on-time % only once a prayer is
 * actually recorded — never a fake %. Includes the entry point to the
 * prayer-time editor (goes to the Prayer screen).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, S, T } from '../lib/theme';
import { Card, EmptyState, PillButton, SectionTitle } from '../components/ui';
import {
  fetchSalahCalendar,
  monthKey,
  todayKey,
  updateSalahStatus,
  PRAYER_NAMES,
  type PrayerName,
  type PrayerRecord,
  type SalahStatus,
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

export default function SalahCalendarScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const today = todayKey();
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const month = monthKey(monthDate);
  const [records, setRecords] = useState<Record<string, PrayerRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [saving, setSaving] = useState<PrayerName | null>(null);

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

  const year = monthDate.getFullYear();
  const monthNumber = monthDate.getMonth();
  const firstWeekday = new Date(year, monthNumber, 1).getDay();
  const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTitle = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const totals = useMemo(() => {
    const result = { prayed: 0, qaza: 0, missed: 0 };
    for (const [date, record] of Object.entries(records)) {
      if (!date.startsWith(month)) continue;
      for (const name of PRAYER_NAMES) {
        const status = record[name].status;
        if (status === 'prayed') result.prayed++;
        else if (status === 'qaza') result.qaza++;
        else if (status === 'missed') result.missed++;
      }
    }
    return result;
  }, [records, month]);

  const recorded = totals.prayed + totals.qaza + totals.missed;
  const onTimePct = recorded > 0 ? Math.round((totals.prayed / recorded) * 100) : null;

  const selected = records[selectedDate];
  const selectedIsFuture = selectedDate > today;

  function moveMonth(direction: number) {
    const next = new Date(year, monthNumber + direction, 1);
    setMonthDate(next);
    setSelectedDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`);
  }

  async function mark(prayer: PrayerName, status: SalahStatus) {
    if (saving || status === 'pending' || selectedIsFuture) return;
    setSaving(prayer);
    setError('');
    try {
      const updated = await updateSalahStatus(selectedDate, prayer, status);
      setRecords((prev) => ({ ...prev, [selectedDate]: updated }));
    } catch (e) {
      setError(e instanceof Error ? e.message : s.statusSaveFailed);
    } finally {
      setSaving(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.eyebrow}>{s.calTitle}</Text>
      <Text style={[T.title, { marginTop: 6 }]}>{s.calTitle}</Text>
      <Text style={[T.sub, { marginBottom: 18 }]}>{s.calSub}</Text>

      <View style={styles.monthNav}>
        <Pressable onPress={() => moveMonth(-1)} style={styles.monthBtn} accessibilityRole="button">
          <Text style={styles.monthBtnText}>←</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthTitle}</Text>
        <Pressable onPress={() => moveMonth(1)} style={styles.monthBtn} accessibilityRole="button">
          <Text style={styles.monthBtnText}>→</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : (
        <Card>
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
                return <View key={`blank-${index}`} style={styles.cell} />;
              }
              const date = `${year}-${String(monthNumber + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const status = dayStatus(records[date]);
              const isSelected = date === selectedDate;
              const isToday = date === today;
              return (
                <Pressable
                  key={date}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.cell,
                    status === 'all' && styles.cellAll,
                    status === 'some' && styles.cellSome,
                    status === 'missed' && styles.cellMissed,
                    isSelected && styles.cellSelected,
                    isToday && styles.cellToday,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.cellText,
                      (status === 'all' || isSelected) && styles.cellTextOn,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[T.note, { marginTop: 12 }]}>{s.calSelectDay}</Text>
        </Card>
      )}

      {/* Month summary — real numbers only */}
      <SectionTitle title={s.calThisMonth} />
      {recorded > 0 ? (
        <Card>
          <View style={styles.summaryRow}>
            <SummaryCell label={s.calPrayed} value={totals.prayed} color={C.teal2} />
            <SummaryCell label={s.calQaza} value={totals.qaza} color={C.peachDeep} />
            <SummaryCell label={s.calMissed} value={totals.missed} color={C.red} />
          </View>
          {onTimePct !== null ? (
            <Text style={[T.cardBody, { marginTop: 10 }]}>
              {onTimePct}% {s.calOnTime} · {recorded} {s.calRecorded}
            </Text>
          ) : null}
        </Card>
      ) : (
        <EmptyState title={s.calThisMonth} body={s.calNoRecords} />
      )}

      {/* Selected day detail */}
      <SectionTitle title={selectedDate} />
      {selected ? (
        <Card>
          {PRAYER_NAMES.map((name) => {
            const entry = selected[name];
            return (
              <View key={name} style={styles.dayRow}>
                <Text style={styles.dayPrayer}>{name}</Text>
                <View style={styles.markRow}>
                  {(['prayed', 'missed', 'qaza'] as SalahStatus[]).map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => mark(name, status)}
                      disabled={saving === name || selectedIsFuture}
                      style={[
                        styles.markBtn,
                        entry.status === status && styles.markBtnOn,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: entry.status === status }}
                    >
                      <Text
                        style={[
                          styles.markBtnText,
                          entry.status === status && styles.markBtnTextOn,
                        ]}
                      >
                        {status === 'prayed'
                          ? s.statusPrayed
                          : status === 'missed'
                            ? s.statusMissed
                            : s.statusQaza}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
          {selectedIsFuture ? <Text style={T.error}>{s.futureCannotMark}</Text> : null}
        </Card>
      ) : (
        <EmptyState title={selectedDate} body={s.calNoRecords} />
      )}

      <PillButton label={s.dashEditTimes} variant="peach" onPress={() => goTo('prayer')} />

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { fontSize: 18, fontWeight: '800', color: C.teal },
  monthTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellText: { fontSize: 14, fontWeight: '700', color: C.ink },
  cellTextOn: { color: C.white },
  cellAll: { backgroundColor: C.teal2 },
  cellSome: { backgroundColor: C.peach },
  cellMissed: { backgroundColor: '#FBE3E3' },
  cellSelected: { backgroundColor: C.teal950 },
  cellToday: { borderWidth: 2, borderColor: C.teal },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryCell: { alignItems: 'center' },
  summaryValue: { fontSize: 26, fontWeight: '800' },
  summaryLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dayPrayer: { fontSize: 15, fontWeight: '700', color: C.ink, width: 70 },
  markRow: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'flex-end' },
  markBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  markBtnOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  markBtnText: { fontSize: 12, fontWeight: '800', color: C.teal },
  markBtnTextOn: { color: C.white },
});
