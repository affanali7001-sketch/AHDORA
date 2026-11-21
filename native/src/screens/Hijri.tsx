/**
 * Hijri calendar — real Aladhan data (Umm al-Qura) via the live
 * API (/api/hijri/today + /api/hijri/month). The Hijri date is
 * shown exactly as it runs. There are NO +1/+2 day manual
 * adjustment controls anywhere on this screen — if the user's
 * saved profile carries an offset, the API applies it and the
 * screen only reports it honestly.
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
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import {
  fetchHijriMonth,
  fetchHijriToday,
  type HijriMonth,
  type HijriToday,
} from '../lib/apiWorship';

/** Ice White / Deep Teal / Soft Peach — the AHDORA palette. No gold. */
const C = {
  ice: '#F5F7F6',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#687A75',
  teal950: '#06231F',
  teal900: '#0A352F',
  teal: '#0B4F4A',
  teal2: '#0F766E',
  peach: '#FFD9BE',
  peach2: '#FFF1E3',
  peachDeep: '#B45309',
  red: '#E11D2E',
  line: '#E6ECE9',
};

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    today: string;
    gregorian: string;
    hijriMonths: string;
    loading: string;
    loadFailed: string;
    retry: string;
    source: string;
    convention: string;
    adjustmentNote: string;
    prev: string;
    next: string;
    weekdays: string[];
    months: string[];
  }
> = {
  en: {
    title: 'Hijri Calendar',
    subtitle: 'The real Hijri date, as it runs.',
    today: 'Today',
    gregorian: 'Gregorian',
    hijriMonths: 'Hijri months in view',
    loading: 'Loading calendar…',
    loadFailed: 'Hijri calendar load nahi ho paya.',
    retry: 'Dobara try karo',
    source: 'Source',
    convention: 'Convention',
    adjustmentNote:
      'Your saved profile applies a day adjustment of {n} day(s) to this calendar.',
    prev: '← Prev',
    next: 'Next →',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
  },
  hi: {
    title: 'Hijri Calendar',
    subtitle: 'Asli Hijri tareekh, jaise chal rahi hai.',
    today: 'Aaj',
    gregorian: 'Gregorian',
    hijriMonths: 'Is mahine ke Hijri mahine',
    loading: 'Calendar load ho raha hai…',
    loadFailed: 'Hijri calendar load nahi ho paya.',
    retry: 'Dobara try karo',
    source: 'Source',
    convention: 'Convention',
    adjustmentNote:
      'Aapki saved profile is calendar par {n} din ka adjustment lagati hai.',
    prev: '← Pichla',
    next: 'Agla →',
    weekdays: ['Rav', 'Som', 'Man', 'Budh', 'Guru', 'Shukr', 'Shani'],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
  },
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export default function HijriScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [today, setToday] = useState<HijriToday | null>(null);
  const [monthData, setMonthData] = useState<HijriMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const [t, md] = await Promise.all([fetchHijriToday(), fetchHijriMonth(y, m)]);
      setToday(t);
      setMonthData(md);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.loadFailed);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(year, month);
  }, [year, month, load]);

  function shiftMonth(delta: number): void {
    let y = year;
    let m = month + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  // Build the Gregorian month grid: leading blanks + days.
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const dayByIso = new Map<string, HijriMonth['days'][number]>();
  if (monthData) {
    for (const d of monthData.days) dayByIso.set(d.gregorian.date, d);
  }
  const todayIso = today?.gregorian.date ?? '';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.subtitle}</Text>

      {loading && !today ? (
        <ActivityIndicator color={C.teal} size="large" style={styles.loader} />
      ) : error && !today ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => void load(year, month)}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : today ? (
        <>
          <View style={styles.todayCard}>
            <Text style={styles.todayLabel}>{s.today}</Text>
            <Text style={styles.hijriArabic}>{today.hijri.month.ar}</Text>
            <Text style={styles.hijriBig}>
              {today.hijri.day} {today.hijri.month.en} {today.hijri.year}
            </Text>
            <Text style={styles.gregLine}>
              {s.gregorian}: {today.gregorian.date}
            </Text>
            {today.hijri.holidays.length > 0 ? (
              <Text style={styles.holiday}>{today.hijri.holidays.join(' · ')}</Text>
            ) : null}
          </View>

          <View style={styles.navRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              style={styles.navBtn}
              accessibilityRole="button"
            >
              <Text style={styles.navBtnText}>{s.prev}</Text>
            </Pressable>
            <Text style={styles.monthTitle}>
              {s.months[month - 1]} {year}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              style={styles.navBtn}
              accessibilityRole="button"
            >
              <Text style={styles.navBtnText}>{s.next}</Text>
            </Pressable>
          </View>

          {monthData ? (
            <>
              <View style={styles.weekRow}>
                {s.weekdays.map((w) => (
                  <Text key={w} style={styles.weekCell}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((iso, i) => {
                  if (!iso) return <View key={`blank-${i}`} style={styles.dayCell} />;
                  const day = dayByIso.get(iso);
                  const dNum = Number(iso.slice(-2));
                  const isToday = iso === todayIso;
                  return (
                    <View
                      key={iso}
                      style={[styles.dayCell, isToday && styles.dayCellToday]}
                    >
                      <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                        {dNum}
                      </Text>
                      {day ? (
                        <Text style={[styles.hijriNum, isToday && styles.hijriNumToday]}>
                          {day.hijri.day}
                        </Text>
                      ) : null}
                      {day && day.hijri.holidays.length > 0 ? (
                        <View style={styles.holidayDot} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.hijriMonthsLine}>
                {s.hijriMonths}: {monthData.hijriMonths.join(' · ')}
              </Text>
              {monthData.adjustmentDays !== 0 ? (
                <Text style={styles.note}>
                  {s.adjustmentNote.replace('{n}', String(monthData.adjustmentDays))}
                </Text>
              ) : null}
            </>
          ) : null}

          <Text style={styles.sourceLine}>
            {s.source}: {today.source}
          </Text>
          <Text style={styles.sourceLine}>
            {s.convention}: {today.convention}
          </Text>
        </>
      ) : null}
      {loading && today ? <ActivityIndicator color={C.teal} style={styles.loader} /> : null}
      {error && today ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 18 },
  loader: { marginVertical: 40 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  todayCard: {
    backgroundColor: C.teal950,
    borderRadius: 26,
    padding: 22,
    marginBottom: 18,
    alignItems: 'center',
  },
  todayLabel: { color: C.peach, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  hijriArabic: { color: C.white, fontSize: 30, marginTop: 8 },
  hijriBig: { color: C.white, fontSize: 20, fontWeight: '800', marginTop: 6 },
  gregLine: { color: '#B8CFCB', fontSize: 13, marginTop: 8 },
  holiday: { color: C.peach, fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  navBtnText: { color: C.teal, fontSize: 14, fontWeight: '800' },
  monthTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dayCellToday: { backgroundColor: C.teal },
  dayNum: { fontSize: 15, fontWeight: '700', color: C.ink },
  dayNumToday: { color: C.white },
  hijriNum: { fontSize: 11, color: C.muted },
  hijriNumToday: { color: C.peach },
  holidayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.peachDeep, marginTop: 2 },
  hijriMonthsLine: { fontSize: 13, color: C.muted, marginTop: 12, textAlign: 'center' },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    backgroundColor: C.peach2,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  sourceLine: { fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 17 },
});
