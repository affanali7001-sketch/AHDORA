/**
 * Islamic Calendar — THE one calendar (user request 2026-11-22):
 * Hijri date and Islamic date are the same thing, so there is ONE
 * calendar, called "Islamic Calendar". It holds everything the old
 * Hijri screen had (next big day hero + countdown, year-browsable
 * big days 2026–2050) AND the month grid — so Ramadan, Eid,
 * Bakrid and every other big day live in the same place as the
 * month view. The old Hijri screen/route is retired.
 *
 * Order (user request 2026-11-22): the MONTH GRID — the Hijri
 * calendar itself — is FIRST at the top, and the big days live
 * BELOW it. Every cell is bilingual: the Hijri day in Urdu
 * numerals (big) AND in English numerals (clearly visible),
 * plus the Gregorian date.
 *
 * BILINGUAL (user correction 2026-11-22): every line is shown in
 * Urdu AND in English/Hinglish, so a reader who does not know
 * Urdu can still read it. Hijri month names, dates and numbers in
 * Urdu numerals (۰۱۲۳۴۵۶۷۸۹) — and the same dates in English
 * numerals (0123456789) with English/Hinglish month and day names
 * right below. Same live Aladhan data (GET /api/hijri/month and
 * GET /api/hijri/events), so the dates are real, never invented —
 * only the rendering is Urdu + English.
 *
 * Any date, any year, any month (user request 2026-11-22): tap the
 * month header to jump straight to a year + month (phone-calendar
 * style), or step with Prev/Next. Today is dark teal, Juma has a
 * peach border, days with a special day get a peach dot, and the
 * month's special days are listed below the grid with Urdu +
 * English names.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Chip, EmptyState, PillButton } from '../components/ui';
import {
  fetchHijriEvents,
  fetchHijriMonth,
  fetchHijriToday,
  type HijriDay,
  type HijriEvent,
  type HijriEventsResponse,
  type HijriMonth,
  type HijriToday,
} from '../lib/apiWorship';

/** Eastern Arabic (Urdu) numerals. */
const URDU_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function urduNum(value: number | string): string {
  return String(value).replace(/\d/g, (d) => URDU_DIGITS[Number(d)]);
}

/** Hijri months in Urdu, by month number (1 = Muharram). */
const URDU_HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربیع الأول',
  'ربیع الثانی',
  'جمادی الأول',
  'جمادی الثانی',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدہ',
  'ذو الحجہ',
];

/** Gregorian months in Urdu. */
const URDU_GREG_MONTHS = [
  'جنوری',
  'فروری',
  'مارچ',
  'اپریل',
  'مئی',
  'جون',
  'جولائی',
  'اگست',
  'ستمبر',
  'اکتوبر',
  'نومبر',
  'دسمبر',
];

/** Gregorian months in English (for the non-Urdu reader). */
const EN_GREG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Weekdays in Urdu, Sunday first (matches the grid's getDay()). */
const URDU_WEEKDAYS = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

/** Weekdays in English, Sunday first. */
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Big-day names in English + Hinglish (same as the Hijri screen). */
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

/** Big-day names in Urdu, by event key. */
const URDU_EVENT_NAMES: Record<string, string> = {
  ramadan: 'رمضان',
  'eid-fitr': 'عید الفطر',
  'eid-adha': 'عید الاضحیٰ',
  qadr: 'شب قدر',
  arafah: 'یوم عرفہ',
  'new-year': 'اسلامی نیا سال',
  ashura: 'عاشورہ',
  mawlid: 'عید میلاد النبی',
  miraj: 'شب معراج',
  barat: 'شب برات',
};

/** Same matching as the server's matcher, returning the event key. */
function holidayKey(holiday: string): string | null {
  const h = holiday.toLowerCase();
  if (h.includes('fitr')) return 'eid-fitr';
  if (h.includes('adha')) return 'eid-adha';
  if (h.includes('qadr')) return 'qadr';
  if (h.includes('arafa')) return 'arafah';
  if (h.includes('islamic new year')) return 'new-year';
  if (h.includes('ashura')) return 'ashura';
  if (h.includes("prophet's birthday") || h.includes('mawlid')) return 'mawlid';
  if (h.includes("mi'raj") || h.includes('miraj') || h.includes('isra')) return 'miraj';
  if (h.includes("bara'at") || h.includes('baraat')) return 'barat';
  if (h.includes('ramadan')) return 'ramadan';
  return null;
}

/** Urdu names for the big days (same matching as the server's matcher). */
function urduHolidayName(holiday: string): string {
  const h = holiday.toLowerCase();
  if (h.includes('fitr')) return 'عید الفطر';
  if (h.includes('adha')) return 'عید الاضحیٰ';
  if (h.includes('qadr')) return 'شب قدر';
  if (h.includes('arafa')) return 'یوم عرفہ';
  if (h.includes('islamic new year')) return 'اسلامی نیا سال';
  if (h.includes('ashura')) return 'عاشورہ';
  if (h.includes("prophet's birthday") || h.includes('mawlid')) return 'عید میلاد النبی';
  if (h.includes("mi'raj") || h.includes('miraj') || h.includes('isra')) return 'شب معراج';
  if (h.includes("bara'at") || h.includes('baraat')) return 'شب برات';
  if (h.includes('ramadan')) return 'رمضان';
  return holiday;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** "26 Feb 2028" from an ISO date — short, readable in a list. */
function gregShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${EN_GREG_MONTHS[(m ?? 1) - 1]?.slice(0, 3) ?? ''} ${y}`;
}

/** Years offered in the big-days chips and the jump picker. */
const BIG_DAY_YEARS: number[] = [];
for (let y = 2026; y <= 2050; y += 1) BIG_DAY_YEARS.push(y);
const JUMP_YEARS: number[] = [];
for (let y = 2020; y <= 2060; y += 1) JUMP_YEARS.push(y);

export default function IslamicCalendarScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [today, setToday] = useState<HijriToday | null>(null);
  const [monthData, setMonthData] = useState<HijriMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Big days (merged from the old Hijri screen).
  const [eventsData, setEventsData] = useState<HijriEventsResponse | null>(null);
  const [eventYear, setEventYear] = useState<number | null>(null);
  const [yearEvents, setYearEvents] = useState<HijriEvent[] | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  // Jump picker (tap the month header).
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpYear, setJumpYear] = useState(view.year);
  const [jumpMonth, setJumpMonth] = useState(view.month);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchHijriToday(), fetchHijriMonth(view.year, view.month)])
      .then(([t, m]) => {
        if (!active) return;
        setToday(t);
        setMonthData(m);
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
  }, [view.year, view.month, s.loadFailed]);

  useEffect(load, [load]);

  // Next big day (hero). Loads once; a failure only hides the hero.
  useEffect(() => {
    let active = true;
    fetchHijriEvents()
      .then((data) => {
        if (!active) return;
        setEventsData(data);
        const first = data.events[0];
        if (first) {
          const y = Number(first.gregorianDate.slice(0, 4));
          if (Number.isFinite(y)) setEventYear(y);
        }
      })
      .catch(() => {
        // Hero + year list stay hidden; the month grid still works.
      });
    return () => {
      active = false;
    };
  }, []);

  // Big days for the picked year.
  useEffect(() => {
    if (eventYear === null) return;
    let active = true;
    setYearLoading(true);
    fetchHijriEvents(eventYear)
      .then((data) => {
        if (active) setYearEvents(data.events);
      })
      .catch(() => {
        if (active) setYearEvents(null);
      })
      .finally(() => {
        if (active) setYearLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventYear]);

  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth() + 1;

  // Hijri month(s) in this Gregorian month, in Urdu (e.g. "جمادی الثانی – رجب ۱۴۴۸").
  const hijriHeader = useMemo(() => {
    if (!monthData) return '';
    const seen: string[] = [];
    for (const d of monthData.days) {
      const name = URDU_HIJRI_MONTHS[d.hijri.month.number - 1] ?? d.hijri.month.en;
      const label = `${name} ${urduNum(d.hijri.year)}`;
      if (!seen.includes(label)) seen.push(label);
    }
    return seen.join(' – ');
  }, [monthData]);

  const gregHeader = `${URDU_GREG_MONTHS[view.month - 1]} ${urduNum(view.year)}`;
  const gregHeaderEn = `${EN_GREG_MONTHS[view.month - 1]} ${view.year}`;

  // English Hijri month(s) in this Gregorian month, for the non-Urdu reader.
  const hijriHeaderEn = useMemo(() => {
    if (!monthData) return '';
    const seen: string[] = [];
    for (const d of monthData.days) {
      const label = `${d.hijri.month.en} ${d.hijri.year}`;
      if (!seen.includes(label)) seen.push(label);
    }
    return seen.join(' – ');
  }, [monthData]);

  // Special days in this month, each with its Urdu AND its
  // English/Hinglish name and dates — a reader who does not know
  // Urdu must still understand the day.
  const monthEvents = useMemo(() => {
    if (!monthData) return [];
    const seen = new Set<string>();
    const out: {
      key: string;
      name: string;
      nameEn: string;
      hijriDate: string;
      hijriDateEn: string;
      gregDate: string;
      gregDateEn: string;
    }[] = [];
    for (const d of monthData.days) {
      for (const holiday of d.hijri.holidays) {
        const key = `${holiday}|${d.gregorian.date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const hijriMonth = URDU_HIJRI_MONTHS[d.hijri.month.number - 1] ?? d.hijri.month.en;
        const [y, m, day] = d.gregorian.date.split('-').map(Number);
        const eventKey = holidayKey(holiday);
        out.push({
          key,
          name: urduHolidayName(holiday),
          nameEn: eventKey && EVENT_NAMES[eventKey] ? EVENT_NAMES[eventKey][lang] : holiday,
          hijriDate: `${urduNum(d.hijri.day)} ${hijriMonth} ${urduNum(d.hijri.year)}`,
          hijriDateEn: `${d.hijri.day} ${d.hijri.month.en} ${d.hijri.year}`,
          gregDate: `${urduNum(day)} ${URDU_GREG_MONTHS[(m ?? 1) - 1]} ${urduNum(y)}`,
          gregDateEn: `${day} ${EN_GREG_MONTHS[(m ?? 1) - 1]} ${y}`,
        });
      }
    }
    return out;
  }, [monthData, lang]);

  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay();
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayByIso = useMemo(() => {
    const map = new Map<string, HijriDay>();
    if (monthData) {
      for (const d of monthData.days) map.set(d.gregorian.date, d);
    }
    return map;
  }, [monthData]);

  const todayIso = today?.gregorian.date ?? '';

  const goMonth = (delta: number) => setView((v) => shiftMonth(v.year, v.month, delta));
  const goToday = () => setView({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const openJump = () => {
    setJumpYear(view.year);
    setJumpMonth(view.month);
    setJumpOpen(true);
  };

  // --- Big days (hero + year list) ---
  const nextEvent = eventsData?.events[0] ?? null;
  const shownEvents = yearEvents ?? eventsData?.events ?? [];
  const countdownText = (daysUntil: number): string => {
    if (daysUntil < 0) return s.hijriPast;
    if (daysUntil === 0) return s.hijriTodayEvent;
    if (daysUntil === 1) return s.hijriTomorrow;
    return s.hijriDaysLeft.replace('{n}', String(daysUntil));
  };

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.islamicCalTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{s.islamicCalSub}</Text>

      {/* Month grid FIRST at the top (user request 2026-11-22):
          this Hijri/Islamic calendar grid IS the calendar —
          the big days live below it. */}
      {loading && !monthData ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : error && !monthData ? (
        <View>
          <EmptyState title={s.islamicCalTitle} body={error} />
          <PillButton label={s.retry} onPress={load} />
        </View>
      ) : monthData ? (
        <View>
          <Card>
            {/* Tap the header to jump to any year + month. */}
            <Pressable onPress={openJump} accessibilityRole="button" accessibilityLabel={s.icJumpTitle}>
              <Text style={styles.hijriHeader}>{hijriHeader}</Text>
              <Text style={styles.gregHeader}>{gregHeader}</Text>
              <Text style={styles.headerEn}>
                {hijriHeaderEn} · {gregHeaderEn}
              </Text>
              <Text style={styles.jumpHint}>▼ {s.icJumpTitle}</Text>
            </Pressable>
            <View style={styles.weekRow}>
              {URDU_WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekDay}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.weekRowEn}>
              {EN_WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekDayEn}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((dayNum, index) => {
                if (dayNum === null) {
                  return <View key={`blank-${index}`} style={styles.cellEmpty} />;
                }
                const iso = `${view.year}-${String(view.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const hijriDay = dayByIso.get(iso);
                const isToday = iso === todayIso;
                const isJuma = new Date(view.year, view.month - 1, dayNum).getDay() === 5;
                const hasEvent = (hijriDay?.hijri.holidays.length ?? 0) > 0;
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
                      {hijriDay ? urduNum(hijriDay.hijri.day) : ''}
                    </Text>
                    {/* English Hijri day, clearly visible (user request
                        2026-11-22): the cell must read bilingual at a
                        glance, not all-Urdu — Urdu numeral big above,
                        English numeral right below it. */}
                    <Text style={[styles.hijriNumEn, isToday && styles.textToday]}>
                      {hijriDay ? String(hijriDay.hijri.day) : ''}
                    </Text>
                    <Text style={[styles.gregNum, isToday && styles.gregToday]}>
                      {urduNum(dayNum)}
                    </Text>
                    <Text style={[styles.gregNumEn, isToday && styles.gregToday]}>
                      {`${EN_GREG_MONTHS[view.month - 1]?.slice(0, 3)} ${dayNum}`}
                    </Text>
                    {hasEvent && !isToday ? <View style={styles.eventDot} /> : null}
                  </View>
                );
              })}
            </View>
            <Text style={[T.cardBody, { marginTop: 12 }]}>{s.hijriLiveNote}</Text>
          </Card>

          <View style={styles.navRow}>
            <Pressable onPress={() => goMonth(-1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>← {lang === 'hi' ? 'Pichhla' : 'Previous'}</Text>
            </Pressable>
            {!isCurrentMonth ? (
              <Pressable onPress={goToday} style={[styles.navBtn, styles.navBtnToday]}>
                <Text style={[styles.navBtnText, styles.navBtnTodayText]}>
                  آج · {lang === 'hi' ? 'Aaj' : 'Today'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => goMonth(1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>{lang === 'hi' ? 'Agla' : 'Next'} →</Text>
            </Pressable>
          </View>

          {monthEvents.length > 0 ? (
            <Card>
              <Text style={T.cardTitle}>{s.hijriEvents}</Text>
              <View style={{ marginTop: 8 }}>
                {monthEvents.map((event) => (
                  <View key={event.key} style={styles.eventRow}>
                    <Text style={styles.eventName}>{event.name}</Text>
                    <Text style={styles.eventNameEn}>{event.nameEn}</Text>
                    <Text style={styles.eventDetail}>
                      {event.hijriDate} · {event.gregDate}
                    </Text>
                    <Text style={styles.eventDetailEn}>
                      {event.hijriDateEn} · {event.gregDateEn}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}

      {/* Next big day — hero (from the old Hijri screen). */}
      {nextEvent ? (
        <Card>
          <Text style={styles.heroLabel}>{s.hijriBigDays}</Text>
          <Text style={styles.heroNameUr}>
            {URDU_EVENT_NAMES[nextEvent.key] ?? nextEvent.label}
          </Text>
          <Text style={styles.heroName}>
            {EVENT_NAMES[nextEvent.key]?.[lang] ?? nextEvent.label}
          </Text>
          <Text style={styles.heroDate}>
            {nextEvent.hijriDay} {nextEvent.hijriMonth} {nextEvent.hijriYear} ·{' '}
            {gregShort(nextEvent.gregorianDate)}
          </Text>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <Chip label={countdownText(nextEvent.daysUntil)} tone="peach" />
          </View>
        </Card>
      ) : null}

      {/* Big days for any year (2026–2050). */}
      {eventsData ? (
        <Card>
          <Text style={T.cardTitle}>
            {eventYear ? s.hijriYearEvents.replace('{n}', String(eventYear)) : s.hijriBigDays}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearRow}>
            {BIG_DAY_YEARS.map((y) => (
              <Chip
                key={y}
                label={String(y)}
                selected={eventYear === y}
                onPress={() => setEventYear(y)}
              />
            ))}
          </ScrollView>
          {yearLoading ? (
            <ActivityIndicator color={C.teal700} style={{ marginVertical: 12 }} />
          ) : shownEvents.length === 0 ? (
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.hijriNoEvents}</Text>
          ) : (
            shownEvents.map((event) => (
              <View key={`${event.key}|${event.gregorianDate}`} style={styles.bigRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigNameUr}>
                    {URDU_EVENT_NAMES[event.key] ?? event.label}
                  </Text>
                  <Text style={styles.bigName}>
                    {EVENT_NAMES[event.key]?.[lang] ?? event.label}
                  </Text>
                  <Text style={styles.bigDate}>
                    {event.hijriDay} {event.hijriMonth} {event.hijriYear} ·{' '}
                    {gregShort(event.gregorianDate)}
                  </Text>
                </View>
                <Chip label={countdownText(event.daysUntil)} tone="peach" />
              </View>
            ))
          )}
        </Card>
      ) : null}

      {loading && monthData ? <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} /> : null}
      {error && monthData ? <Text style={T.error}>{error}</Text> : null}

      {/* Jump to any year + month (phone-calendar style). */}
      <Modal visible={jumpOpen} transparent animationType="slide" onRequestClose={() => setJumpOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={T.cardTitle}>{s.icJumpTitle}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.icJumpYear}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearRow}>
              {JUMP_YEARS.map((y) => (
                <Chip
                  key={y}
                  label={String(y)}
                  selected={jumpYear === y}
                  onPress={() => setJumpYear(y)}
                />
              ))}
            </ScrollView>
            <Text style={[T.cardBody, { marginTop: 10 }]}>{s.icJumpMonth}</Text>
            <View style={styles.monthGrid}>
              {EN_GREG_MONTHS.map((name, i) => (
                <Pressable
                  key={name}
                  onPress={() => setJumpMonth(i + 1)}
                  style={[styles.monthBtn, jumpMonth === i + 1 && styles.monthBtnSel]}
                >
                  <Text style={[styles.monthBtnUr, jumpMonth === i + 1 && styles.monthBtnSelText]}>
                    {URDU_GREG_MONTHS[i]}
                  </Text>
                  <Text style={[styles.monthBtnEn, jumpMonth === i + 1 && styles.monthBtnSelText]}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={s.icJumpGo}
                  block
                  onPress={() => {
                    setView({ year: jumpYear, month: jumpMonth });
                    setJumpOpen(false);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={s.icJumpCancel}
                  variant="ghost"
                  block
                  onPress={() => setJumpOpen(false)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroLabel: { fontFamily: F.sans, fontSize: 12.5, fontWeight: '800', color: C.muted },
  heroNameUr: {
    fontFamily: F.arabic,
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'right',
    marginTop: 6,
  },
  heroName: { fontFamily: F.sans, fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 2 },
  heroDate: { fontFamily: F.sans, fontSize: 13.5, color: C.muted, marginTop: 4 },
  yearRow: { marginTop: 10, marginBottom: 4 },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  bigNameUr: { fontFamily: F.arabic, fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'right' },
  bigName: { fontFamily: F.sans, fontSize: 14, fontWeight: '800', color: C.ink, marginTop: 1 },
  bigDate: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 2 },
  hijriHeader: {
    fontFamily: F.arabic,
    fontSize: 20,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'right',
  },
  gregHeader: {
    fontFamily: F.arabic,
    fontSize: 14,
    color: C.muted,
    textAlign: 'right',
    marginTop: 2,
  },
  headerEn: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  jumpHint: {
    fontFamily: F.sans,
    fontSize: 12,
    fontWeight: '700',
    color: C.teal700,
    textAlign: 'right',
    marginTop: 6,
  },
  weekRow: { flexDirection: 'row', marginTop: 12, marginBottom: 0 },
  weekRowEn: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.arabic,
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
    paddingVertical: 2,
  },
  weekDayEn: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.sans,
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    paddingVertical: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: {
    width: '13.4%',
    flexGrow: 1,
    aspectRatio: 1 / 1.9, // tall enough for 4 number lines + event dot
    borderRadius: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingVertical: 2,
  },
  cellEmpty: {
    width: '13.4%',
    flexGrow: 1,
    aspectRatio: 1 / 1.9,
  },
  cellJuma: { borderColor: C.peachMid, backgroundColor: C.peach2 },
  cellToday: { backgroundColor: C.teal700, borderColor: C.teal700 },
  hijriNum: {
    fontFamily: F.arabic,
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  /* English Hijri day — same number as hijriNum, in English
   * numerals, clearly visible (not a tiny footnote). */
  hijriNumEn: {
    fontFamily: F.sans,
    fontSize: 12,
    fontWeight: '800',
    color: C.ink,
  },
  gregNum: {
    fontFamily: F.arabic,
    fontSize: 10,
    fontWeight: '600',
    color: C.muted,
  },
  gregNumEn: {
    fontFamily: F.sans,
    fontSize: 9.5,
    fontWeight: '600',
    color: C.muted,
  },
  textToday: { color: C.white },
  gregToday: { color: C.navInactive },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.peachMid,
    marginTop: 1,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 14,
  },
  navBtn: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navBtnText: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: C.teal700,
  },
  navBtnToday: {
    flex: 0,
    paddingHorizontal: 18,
    backgroundColor: C.teal700,
    borderColor: C.teal700,
  },
  navBtnTodayText: {
    fontFamily: F.arabic,
    fontSize: 15,
    color: C.white,
  },
  eventRow: { paddingVertical: 6 },
  eventName: {
    fontFamily: F.arabic,
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'right',
  },
  eventNameEn: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'right',
    marginTop: 1,
  },
  eventDetail: {
    fontFamily: F.arabic,
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
    textAlign: 'right',
  },
  eventDetailEn: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.muted,
    marginTop: 1,
    textAlign: 'right',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.ice,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  monthBtn: {
    width: '31%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  monthBtnSel: { backgroundColor: C.teal700, borderColor: C.teal700 },
  monthBtnUr: { fontFamily: F.arabic, fontSize: 15, fontWeight: '700', color: C.ink },
  monthBtnEn: { fontFamily: F.sans, fontSize: 11.5, fontWeight: '700', color: C.muted, marginTop: 1 },
  monthBtnSelText: { color: C.white },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
