/**
 * Hijri Calendar — rebuilt to the approved preview (§9): title +
 * sub (the no-adjustment promise), one card with the real current
 * Hijri month + peach tag showing the Gregorian range it spans,
 * Hinglish weekday headers, and a grid where the HIJRI day is big
 * and the Gregorian date ("Nov 21") is small. Juma (Friday) cells
 * have a peach border/background; today’s cell is dark teal.
 *
 * Big days (user request 2026-11-22): a dark hero card at the top
 * shows the NEXT big day — Ramadan, Eid-ul-Fitr, Eid-ul-Adha
 * (Bakrid), Shab-e-Qadr, Arafah and the rest — with a days-left
 * countdown, from GET /api/hijri/events, which scans 14 months of
 * real Aladhan calendar data. The list card below it shows the
 * following big days with their countdowns. The old month-based
 * list (current month + next 2) is kept ONLY as a fallback when
 * /events fails — it could never show Ramadan/Eid/Bakrid, because
 * they sit months ahead. No "Today" card, no Prev/Next month
 * buttons, and NO day-adjustment display anywhere: the live data
 * is shown exactly as it runs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, EmptyState, PillButton } from '../components/ui';
import {
  fetchHijriEvents,
  fetchHijriMonth,
  fetchHijriToday,
  type HijriDay,
  type HijriEventsResponse,
  type HijriMonth,
  type HijriToday,
} from '../lib/apiWorship';

/** Localised names for the key days — the server returns a stable key, the UI names it. */
const EVENT_NAMES: Record<string, { en: string; hi: string }> = {
  ramadan: { en: 'Ramadan', hi: 'Ramzan' },
  'eid-fitr': { en: 'Eid-ul-Fitr', hi: 'Eid-ul-Fitr' },
  'eid-adha': { en: 'Eid-ul-Adha (Bakrid)', hi: 'Bakrid (Eid-ul-Adha)' },
  qadr: { en: 'Laylat-ul-Qadr (Shab-e-Qadr)', hi: 'Shab-e-Qadr' },
  arafah: { en: 'Day of Arafah', hi: 'Arafah ka din' },
  'new-year': { en: 'Islamic New Year', hi: 'Islami Naya Saal' },
  ashura: { en: 'Day of Ashura', hi: 'Ashura' },
  mawlid: { en: "Prophet's Birthday (Mawlid)", hi: 'Eid-e-Milad' },
  miraj: { en: 'Isra and Mi’raj (Shab-e-Miraj)', hi: 'Shab-e-Miraj' },
  barat: { en: "Laylat al-Bara'at (Shab-e-Barat)", hi: 'Shab-e-Barat' },
};

type DisplayEvent = {
  key: string;
  name: string;
  hijriDate: string;
  gregorianDate: string;
  daysUntil: number;
};

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1) + delta) % 12;
  const m = ((total % 12) + 12) % 12;
  const y = Math.floor((year * 12 + (month - 1) + delta) / 12);
  return { year: y, month: m + 1 };
}

function monthShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short' });
}

function gregShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HijriScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [today, setToday] = useState<HijriToday | null>(null);
  const [months, setMonths] = useState<HijriMonth[]>([]);
  const [eventsData, setEventsData] = useState<HijriEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    const m1 = shiftMonth(year, month, 1);
    const m2 = shiftMonth(year, month, 2);
    Promise.all([
      fetchHijriToday(),
      fetchHijriMonth(year, month),
      fetchHijriMonth(m1.year, m1.month),
      fetchHijriMonth(m2.year, m2.month),
      // The events call must never break the calendar: a failure
      // falls back to the month-based list below.
      fetchHijriEvents().catch(() => null),
    ])
      .then(([t, cur, next1, next2, events]) => {
        if (!active) return;
        setToday(t);
        setMonths([cur, next1, next2]);
        if (events) setEventsData(events);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : s.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, month, s.loadFailed]);

  useEffect(load, [load]);

  const currentMonth = months[0] ?? null;

  const dayByIso = useMemo(() => {
    const map = new Map<string, HijriDay>();
    if (currentMonth) {
      for (const d of currentMonth.days) map.set(d.gregorian.date, d);
    }
    return map;
  }, [currentMonth]);

  // Gregorian range spanned by the current Hijri month (e.g. "Nov – Dec 2025").
  const gregRange = useMemo(() => {
    if (!today) return '';
    const name = today.hijri.month.en;
    const y = today.hijri.year;
    const dates: Date[] = [];
    for (const md of months) {
      for (const d of md.days) {
        if (d.hijri.month.en === name && d.hijri.year === y) {
          const [yy, mm, dd] = d.gregorian.date.split('-').map(Number);
          dates.push(new Date(yy, (mm ?? 1) - 1, dd ?? 1));
        }
      }
    }
    if (dates.length === 0) return '';
    dates.sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (!first || !last) return '';
    if (
      first.getMonth() === last.getMonth() &&
      first.getFullYear() === last.getFullYear()
    ) {
      return `${monthShort(first)} ${first.getFullYear()}`;
    }
    if (first.getFullYear() === last.getFullYear()) {
      return `${monthShort(first)} – ${monthShort(last)} ${last.getFullYear()}`;
    }
    return `${monthShort(first)} ${first.getFullYear()} – ${monthShort(last)} ${last.getFullYear()}`;
  }, [months, today]);

  const todayIso = today?.gregorian.date ?? '';

  // Big days, in order. Preferred source: /api/hijri/events (14
  // months of real Aladhan markers). Fallback: the holidays in the
  // loaded months (current + next 2) — it can only see a few months
  // ahead, so Ramadan/Eid/Bakrid may be missing from it.
  const displayEvents: DisplayEvent[] = useMemo(() => {
    if (eventsData) {
      return eventsData.events.map((event) => ({
        key: event.key,
        name: EVENT_NAMES[event.key]?.[lang] ?? event.label,
        hijriDate: `${event.hijriDay} ${event.hijriMonth} ${event.hijriYear}`,
        gregorianDate: gregShort(event.gregorianDate),
        daysUntil: event.daysUntil,
      }));
    }
    const seen = new Set<string>();
    const out: DisplayEvent[] = [];
    for (const md of months) {
      for (const d of md.days) {
        for (const holiday of d.hijri.holidays) {
          const key = `${holiday}|${d.gregorian.date}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            key,
            name: holiday,
            hijriDate: `${d.hijri.day} ${d.hijri.month.en} ${d.hijri.year}`,
            gregorianDate: gregShort(d.gregorian.date),
            daysUntil: todayIso
              ? Math.round((Date.parse(d.gregorian.date) - Date.parse(todayIso)) / 86400000)
              : 0,
          });
        }
      }
    }
    return out.slice(0, 5);
  }, [eventsData, months, lang, todayIso]);

  const nextEvent = displayEvents[0] ?? null;
  const followingEvents = displayEvents.slice(1);

  const countdownText = (daysUntil: number): string => {
    if (daysUntil <= 0) return s.hijriTodayEvent;
    if (daysUntil === 1) return s.hijriTomorrow;
    return s.hijriDaysLeft.replace('{n}', String(daysUntil));
  };

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = [s.dSun, s.dMon, s.dTue, s.dWed, s.dThu, s.dFri, s.dSat];
  const headerMonth = today ? `${today.hijri.month.en} ${today.hijri.year}` : '';

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.hijriTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{s.hijriSub}</Text>

      {nextEvent ? (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{s.hijriBigDays}</Text>
          <Text style={styles.heroName}>{nextEvent.name}</Text>
          <Text style={styles.heroDate}>
            {nextEvent.hijriDate} · {nextEvent.gregorianDate}
          </Text>
          <View style={styles.heroCount}>
            <Text style={styles.heroCountText}>{countdownText(nextEvent.daysUntil)}</Text>
          </View>
        </View>
      ) : null}

      {loading && !today ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : error && !today ? (
        <View>
          <EmptyState title={s.hijriTitle} body={error} />
          <PillButton label={s.retry} onPress={load} />
        </View>
      ) : today && currentMonth ? (
        <View>
          <Card>
            <View style={styles.headerRow}>
              <Text style={styles.headerMonth}>{headerMonth}</Text>
              {gregRange ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{gregRange}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.weekRow}>
              {weekdays.map((day) => (
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
                const iso = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const hijriDay = dayByIso.get(iso);
                const isToday = iso === todayIso;
                const isJuma = new Date(year, month - 1, dayNum).getDay() === 5;
                return (
                  <View
                    key={iso}
                    style={[
                      styles.cell,
                      isJuma && !isToday && styles.cellJuma,
                      isToday && styles.cellToday,
                    ]}
                  >
                    <Text style={[styles.hijriNum, isToday && styles.textToday]}>
                      {hijriDay ? hijriDay.hijri.day : ''}
                    </Text>
                    <Text style={[styles.gregNum, isToday && styles.gregToday]}>
                      {monthShort(new Date(year, month - 1, dayNum))} {dayNum}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[T.cardBody, { marginTop: 12 }]}>{s.hijriLiveNote}</Text>
          </Card>

          {displayEvents.length > 1 ? (
            <Card>
              <Text style={T.cardTitle}>{s.hijriEvents}</Text>
              <View style={{ marginTop: 8 }}>
                {followingEvents.map((event) => (
                  <View key={`${event.key}|${event.gregorianDate}`} style={styles.eventRow}>
                    <View style={styles.eventLeft}>
                      <Text style={styles.eventLabel}>{event.name}</Text>
                      <Text style={styles.eventDetail}>
                        {event.hijriDate} · {event.gregorianDate}
                      </Text>
                    </View>
                    <View style={styles.eventPill}>
                      <Text style={styles.eventPillText}>
                        {countdownText(event.daysUntil)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : displayEvents.length === 0 ? (
            <Card>
              <Text style={T.cardTitle}>{s.hijriEvents}</Text>
              <Text style={[T.cardBody, { marginTop: 6 }]}>{s.hijriNoEvents}</Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      {loading && today ? <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} /> : null}
      {error && today ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: C.teal900,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  heroLabel: {
    fontFamily: F.sans,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.navInactive,
  },
  heroName: {
    fontFamily: F.sans,
    fontSize: 24,
    fontWeight: '800',
    color: C.white,
    marginTop: 6,
  },
  heroDate: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: C.navInactive,
    marginTop: 4,
  },
  heroCount: {
    alignSelf: 'flex-start',
    backgroundColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
  },
  heroCountText: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '800',
    color: C.peachInk,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMonth: {
    fontFamily: F.sans,
    fontSize: 15.5,
    fontWeight: '800',
    color: C.ink,
    flex: 1,
  },
  tag: {
    backgroundColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: C.peachInk,
  },
  weekRow: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
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
  cellJuma: { borderColor: C.peachMid, backgroundColor: C.peach2 },
  cellToday: { backgroundColor: C.teal700, borderColor: C.teal700 },
  hijriNum: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  gregNum: {
    fontFamily: F.sans,
    fontSize: 9.5,
    fontWeight: '600',
    color: C.muted,
  },
  textToday: { color: C.white },
  gregToday: { color: C.navInactive },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  eventLeft: { flex: 1 },
  eventLabel: {
    fontFamily: F.sans,
    fontSize: 14.5,
    fontWeight: '700',
    color: C.ink,
  },
  eventDetail: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  eventPill: {
    backgroundColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eventPillText: {
    fontFamily: F.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: C.peachInk,
  },
});
