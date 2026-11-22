/**
 * Fasting — Ramadan + voluntary Sunnah fast log.
 *
 * Every fast date comes from the real Hijri calendar (see
 * src/lib/fasting.ts): Mondays, Thursdays, Ayyam al-Bidh (13/14/15),
 * Arafah (9 Dhul-Hijjah), Ashura (10 Muharram), the Six of Shawwal
 * (2–7 Shawwal — 1 Shawwal is Eid, no fast that day) and every day
 * of Ramadan. Nothing is hardcoded or invented.
 *
 * The user marks each fast kept / missed (today + the last 7 days
 * are loggable; future fasts only show a countdown). An optional
 * note rides on a logged entry. The log lives in AsyncStorage per
 * user, and the summary counts stored entries only — 0 when nothing
 * has been logged. The reminder toggle schedules a local
 * notification at 19:00 the evening before each upcoming fast
 * (same expo-notifications pattern as the prayer alerts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import {
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  PillButton,
  ProgressBar,
  SectionTitle,
  Switch,
  TealHead,
} from '../components/ui';
import {
  cancelFastingReminders,
  clearFastEntry,
  fetchUpcomingFasts,
  isFastingRemindersEnabled,
  loadFastingLog,
  localDateKey,
  refreshFastingReminders,
  requestFastingReminderPermission,
  saveFastEntry,
  saveFastNote,
  setFastingRemindersEnabled,
  summarizeFastingLog,
  type FastingLog,
  type FastKind,
  type FastStatus,
  type UpcomingFast,
} from '../lib/fasting';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    ramadanStarts: string;
    ramadanToday: string;
    ramadanIn: (n: number) => string;
    summaryTitle: string;
    keptTotal: (n: number) => string;
    keptThisMonth: (n: number) => string;
    totalLogged: (n: number) => string;
    logTitle: string;
    logSub: string;
    upcomingTitle: string;
    upcomingSub: string;
    historyTitle: string;
    historySub: string;
    reminderTitle: string;
    reminderSub: string;
    reminderOff: string;
    reminderDenied: string;
    reminderScheduled: (n: number) => string;
    reminderNone: string;
    kept: string;
    missed: string;
    clear: string;
    noteLabel: string;
    notePlaceholder: string;
    saveNote: string;
    noteSaved: string;
    loading: string;
    loadFailed: string;
    retry: string;
    noUpcoming: string;
    noHistory: string;
    noLoggable: string;
    today: string;
    tomorrow: string;
    daysLeft: (n: number) => string;
    daysAgo: (n: number) => string;
    yesterday: string;
    shawwalNote: string;
    sourceNote: string;
    kindLabels: Record<FastKind, string>;
  }
> = {
  en: {
    title: 'Fasting',
    subtitle: 'Ramadan and Sunnah fasts — Mondays, Thursdays, Ayyam al-Bidh, Arafah, Ashura and the Six of Shawwal. Dates come from the live Hijri calendar.',
    ramadanStarts: 'Ramadan starts',
    ramadanToday: 'Ramadan is on today',
    ramadanIn: (n) => (n === 1 ? 'tomorrow' : `in ${n} days`),
    summaryTitle: 'Your fasts',
    keptTotal: (n) => `${n} kept in total`,
    keptThisMonth: (n) => `${n} kept this month`,
    totalLogged: (n) => `${n} fasts logged`,
    logTitle: 'Mark your fast',
    logSub: 'Today and the last 7 days — tap Kept or Missed. Tap a row to add a note.',
    upcomingTitle: 'Upcoming fasts',
    upcomingSub: 'The next Sunnah and Ramadan fasts, with Hijri and Gregorian dates.',
    historyTitle: 'Log history',
    historySub: 'Every fast you marked — only what you actually recorded.',
    reminderTitle: 'Evening-before reminder',
    reminderSub: 'A notification at 7 pm the evening before each upcoming fast, so you can plan sehri.',
    reminderOff: 'Reminders off.',
    reminderDenied: 'Notification permission is off — turn it on in the phone settings to get reminders.',
    reminderScheduled: (n) =>
      n === 1 ? 'Reminder set for the next fast.' : `Reminders set for the next ${n} fasts.`,
    reminderNone: 'Reminders on, but no upcoming fast was found to remind you about.',
    kept: 'Kept',
    missed: 'Missed',
    clear: 'Clear entry',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. kept with family, felt easy',
    saveNote: 'Save note',
    noteSaved: 'Note saved.',
    loading: 'Loading the Hijri calendar…',
    loadFailed: 'Fasting dates load nahi ho paye.',
    retry: 'Retry',
    noUpcoming: 'No upcoming fasts found. Check your internet and retry.',
    noHistory: 'No fasts logged yet. Mark today’s fast above when you keep or miss one.',
    noLoggable: 'No fast in the last 7 days — the next one will appear here when it comes.',
    today: 'Today',
    tomorrow: 'Tomorrow',
    daysLeft: (n) => `in ${n} days`,
    daysAgo: (n) => `${n} days ago`,
    yesterday: 'Yesterday',
    shawwalNote: '1 Shawwal is Eid-ul-Fitr — no fast that day. The six Shawwal fasts are 2–7 Shawwal.',
    sourceNote: 'Dates from the live Hijri calendar (Aladhan, Umm al-Qura) — the same source as the Islamic Calendar.',
    kindLabels: {
      ramadan: 'Ramadan fast',
      monday: 'Monday fast',
      thursday: 'Thursday fast',
      ayyam: 'Ayyam al-Bidh',
      arafah: 'Day of Arafah',
      ashura: 'Day of Ashura',
      shawwal: 'Six of Shawwal',
    },
  },
  hi: {
    title: 'Roza',
    subtitle: 'Ramzan aur Sunnat roze — Peer, Jumerat, Ayyam al-Bidh, Arafah, Ashura aur Shawwal ke 6 roze. Tareekhen live Hijri calendar se aati hain.',
    ramadanStarts: 'Ramzan shuru hoga',
    ramadanToday: 'Aaj Ramzan ka roza hai',
    ramadanIn: (n) => (n === 1 ? 'kal' : `${n} din mein`),
    summaryTitle: 'Tumhare roze',
    keptTotal: (n) => `Kul ${n} roze rakhe`,
    keptThisMonth: (n) => `Is mahine ${n} roze rakhe`,
    totalLogged: (n) => `${n} roze darj hain`,
    logTitle: 'Apna roza darj karo',
    logSub: 'Aaj aur pichhle 7 din — Kept ya Missed dabao. Note likhne ke liye row par dabao.',
    upcomingTitle: 'Aane wale roze',
    upcomingSub: 'Agli Sunnat aur Ramzan ke roze, Hijri aur Gregorian tareekh ke saath.',
    historyTitle: 'Roze ka hisaab',
    historySub: 'Jo roze tumne darj kiye — sirf wahi, jo tumne asal mein record kiya.',
    reminderTitle: 'Ek shaam pehle yaad dilaao',
    reminderSub: 'Har aane wale roze se ek shaam pehle 7 baje notification, taaki sehri plan kar sako.',
    reminderOff: 'Reminder band hai.',
    reminderDenied: 'Notification ki permission band hai — reminder ke liye phone ki settings mein on karo.',
    reminderScheduled: (n) =>
      n === 1 ? 'Agle roze ka reminder lag gaya.' : `Agle ${n} rozon ke reminder lag gaye.`,
    reminderNone: 'Reminder on hai, par koi aane wala roza nahi mila.',
    kept: 'Rakha',
    missed: 'Chhoot gaya',
    clear: 'Entry hatao',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. ghar walon ke saath rakha, aasan raha',
    saveNote: 'Note save karo',
    noteSaved: 'Note save ho gaya.',
    loading: 'Hijri calendar load ho raha hai…',
    loadFailed: 'Roze ki tareekhen load nahi ho payin.',
    retry: 'Dobara try karo',
    noUpcoming: 'Koi aane wala roza nahi mila. Internet check karke dobara try karo.',
    noHistory: 'Abhi koi roza darj nahi hai. Aaj ka roza upar se mark karo jab rakho ya chhoote.',
    noLoggable: 'Pichhle 7 din mein koi roza nahi tha — agla roza aate hi yahan dikhega.',
    today: 'Aaj',
    tomorrow: 'Kal',
    daysLeft: (n) => `${n} din mein`,
    daysAgo: (n) => `${n} din pehle`,
    yesterday: 'Kal',
    shawwalNote: '1 Shawwal Eid-ul-Fitr hai — us din roza nahi. Shawwal ke 6 roze 2–7 Shawwal hain.',
    sourceNote: 'Tareekhen live Hijri calendar (Aladhan, Umm al-Qura) se hain — Islamic Calendar wali hi source.',
    kindLabels: {
      ramadan: 'Ramzan ka roza',
      monday: 'Peer ka roza',
      thursday: 'Jumerat ka roza',
      ayyam: 'Ayyam al-Bidh',
      arafah: 'Arafah ka roza',
      ashura: 'Ashura ka roza',
      shawwal: 'Shawwal ke 6 roze',
    },
  },
};

const EN_GREG_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "23 Nov 2026" from an ISO date. */
function gregShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${EN_GREG_MONTHS[(m ?? 1) - 1] ?? ''} ${y}`;
}

function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return EN_WEEKDAYS[new Date(y, (m ?? 1) - 1, d).getDay()] ?? '';
}

export default function FastingScreen({ lang, user }: ScreenProps) {
  const s = STRINGS[lang];
  const uid = user?.id ?? 'anon';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upcoming, setUpcoming] = useState<UpcomingFast[]>([]);
  const [log, setLog] = useState<FastingLog>({});
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteMsg, setNoteMsg] = useState('');

  const todayIso = localDateKey();
  const summary = useMemo(() => summarizeFastingLog(log, todayIso), [log, todayIso]);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchUpcomingFasts(), loadFastingLog(uid), isFastingRemindersEnabled()])
      .then(([f, l, e]) => {
        if (!active) return;
        setUpcoming(f);
        setLog(l);
        setReminderEnabled(e);
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
  }, [uid, s.loadFailed]);

  useEffect(load, [load]);

  // Loggable: today + the last 7 days, today first. Future fasts
  // are not markable — a fast that has not happened cannot be kept.
  const loggable = useMemo(
    () =>
      upcoming
        .filter((f) => f.daysUntil <= 0)
        .sort((a, b) => (a.gregorianDate < b.gregorianDate ? 1 : -1)),
    [upcoming],
  );
  const future = useMemo(
    () => upcoming.filter((f) => f.daysUntil > 0).slice(0, 10),
    [upcoming],
  );
  const nextRamadan = useMemo(
    () => upcoming.find((f) => f.kind === 'ramadan' && f.daysUntil >= 0) ?? null,
    [upcoming],
  );
  const history = useMemo(
    () =>
      Object.entries(log).sort(([a], [b]) => (a < b ? 1 : -1)),
    [log],
  );

  async function reloadLog(): Promise<void> {
    setLog(await loadFastingLog(uid));
  }

  async function markFast(fast: UpcomingFast, status: FastStatus): Promise<void> {
    await saveFastEntry(uid, fast.gregorianDate, status, fast.kind);
    await reloadLog();
  }

  function selectRow(fast: UpcomingFast): void {
    setNoteMsg('');
    if (selectedDate === fast.gregorianDate) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate(fast.gregorianDate);
    setNoteDraft(log[fast.gregorianDate]?.note ?? '');
  }

  async function saveNote(): Promise<void> {
    if (!selectedDate) return;
    const ok = await saveFastNote(uid, selectedDate, noteDraft.trim());
    if (ok) {
      setNoteMsg(s.noteSaved);
      await reloadLog();
    }
  }

  async function clearEntry(date: string): Promise<void> {
    await clearFastEntry(uid, date);
    setSelectedDate(null);
    await reloadLog();
  }

  async function toggleReminder(on: boolean): Promise<void> {
    setReminderBusy(true);
    setReminderMsg('');
    try {
      if (!on) {
        await cancelFastingReminders();
        await setFastingRemindersEnabled(false);
        setReminderEnabled(false);
        setReminderMsg(s.reminderOff);
        return;
      }
      const granted = await requestFastingReminderPermission();
      if (!granted) {
        setReminderMsg(s.reminderDenied);
        return;
      }
      await setFastingRemindersEnabled(true);
      setReminderEnabled(true);
      const res = await refreshFastingReminders(lang);
      setReminderMsg(
        res.status === 'ok' ? s.reminderScheduled(res.scheduled) : s.reminderNone,
      );
    } finally {
      setReminderBusy(false);
    }
  }

  function countdownLabel(daysUntil: number): string {
    if (daysUntil === 0) return s.today;
    if (daysUntil === 1) return s.tomorrow;
    if (daysUntil > 1) return s.daysLeft(daysUntil);
    if (daysUntil === -1) return s.yesterday;
    return s.daysAgo(-daysUntil);
  }

  function kindTone(kind: FastKind): 'teal' | 'peach' {
    return kind === 'ramadan' || kind === 'arafah' || kind === 'ashura' || kind === 'shawwal'
      ? 'peach'
      : 'teal';
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.title}</Text>
      <Text style={T.sub}>{s.subtitle}</Text>

      {loading && upcoming.length === 0 ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : error && upcoming.length === 0 ? (
        <View>
          <EmptyState title={s.title} body={error} />
          <PillButton label={s.retry} onPress={load} />
        </View>
      ) : (
        <View>
          {/* Ramadan hero — the next Ramadan day 1 (or today, in Ramadan). */}
          {nextRamadan ? (
            <TealHead style={{ marginTop: 14, marginBottom: 4 }}>
              <Text style={styles.heroLabel}>
                {nextRamadan.daysUntil === 0 ? s.ramadanToday : s.ramadanStarts}
              </Text>
              <Text style={styles.heroDate}>
                {gregShort(nextRamadan.gregorianDate)}
                {' · '}
                {nextRamadan.hijriDay} {nextRamadan.hijriMonthName} {nextRamadan.hijriYear}
              </Text>
              <Text style={styles.heroCount}>
                {nextRamadan.daysUntil === 0 ? s.today : s.ramadanIn(nextRamadan.daysUntil)}
              </Text>
            </TealHead>
          ) : null}

          {/* Real summary — counts stored entries only. */}
          <Card>
            <Text style={T.cardTitle}>{s.summaryTitle}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{summary.kept}</Text>
                <Text style={styles.summaryLabel}>{s.keptTotal(summary.kept)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{summary.keptThisMonth}</Text>
                <Text style={styles.summaryLabel}>{s.keptThisMonth(summary.keptThisMonth)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryNum}>{summary.totalLogged}</Text>
                <Text style={styles.summaryLabel}>{s.totalLogged(summary.totalLogged)}</Text>
              </View>
            </View>
            {summary.totalLogged > 0 ? (
              <ProgressBar value={summary.kept} max={summary.totalLogged} />
            ) : null}
            <Text style={[T.cardBody, { marginTop: 8 }]}>{s.shawwalNote}</Text>
          </Card>

          {/* Evening-before reminder toggle. */}
          <Card>
            <View style={styles.reminderRow}>
              <View style={{ flex: 1 }}>
                <Text style={T.cardTitle}>{s.reminderTitle}</Text>
                <Text style={[T.cardBody, { marginTop: 4 }]}>{s.reminderSub}</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(v) => void toggleReminder(v)}
                disabled={reminderBusy}
              />
            </View>
            {reminderBusy ? (
              <ActivityIndicator color={C.teal} style={{ marginTop: 10 }} />
            ) : null}
            {reminderMsg ? <Text style={[T.cardBody, { marginTop: 8 }]}>{reminderMsg}</Text> : null}
          </Card>

          {/* Mark your fast — today + last 7 days. */}
          <SectionTitle title={s.logTitle} sub={s.logSub} />
          {loggable.length === 0 ? (
            <EmptyState title={s.logTitle} body={s.noLoggable} />
          ) : (
            loggable.map((fast) => {
              const entry = log[fast.gregorianDate];
              const selected = selectedDate === fast.gregorianDate;
              return (
                <Card key={fast.gregorianDate}>
                  <Pressable onPress={() => selectRow(fast)} accessibilityRole="button">
                    <View style={styles.fastRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fastDate}>
                          {weekdayShort(fast.gregorianDate)}, {gregShort(fast.gregorianDate)}
                        </Text>
                        <Text style={styles.fastHijri}>
                          {fast.hijriDay} {fast.hijriMonthName} {fast.hijriYear}
                        </Text>
                        <View style={styles.chipRow}>
                          <Chip label={s.kindLabels[fast.kind]} tone={kindTone(fast.kind)} />
                          <Chip label={countdownLabel(fast.daysUntil)} tone="muted" />
                          {entry ? (
                            <Chip
                              label={entry.status === 'kept' ? s.kept : s.missed}
                              tone={entry.status === 'kept' ? 'teal' : 'red'}
                            />
                          ) : null}
                        </View>
                        {entry?.note ? (
                          <Text style={styles.entryNote}>{entry.note}</Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.markRow}>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label={s.kept}
                        variant={entry?.status === 'kept' ? 'primary' : 'soft'}
                        small
                        block
                        onPress={() => void markFast(fast, 'kept')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label={s.missed}
                        variant={entry?.status === 'missed' ? 'primary' : 'soft'}
                        small
                        block
                        onPress={() => void markFast(fast, 'missed')}
                      />
                    </View>
                  </View>
                  {selected && entry ? (
                    <View>
                      <Field label={s.noteLabel}>
                        <Input
                          value={noteDraft}
                          onChangeText={setNoteDraft}
                          placeholder={s.notePlaceholder}
                          maxLength={200}
                        />
                      </Field>
                      <View style={styles.markRow}>
                        <View style={{ flex: 1 }}>
                          <PillButton
                            label={s.saveNote}
                            variant="peach"
                            small
                            block
                            onPress={() => void saveNote()}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PillButton
                            label={s.clear}
                            variant="ghost"
                            small
                            block
                            onPress={() => void clearEntry(fast.gregorianDate)}
                          />
                        </View>
                      </View>
                      {noteMsg ? <Text style={T.note}>{noteMsg}</Text> : null}
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}

          {/* Upcoming fasts — countdown only, not markable yet. */}
          <SectionTitle title={s.upcomingTitle} sub={s.upcomingSub} />
          {future.length === 0 ? (
            <EmptyState title={s.upcomingTitle} body={s.noUpcoming} />
          ) : (
            future.map((fast) => (
              <Card key={fast.gregorianDate}>
                <View style={styles.fastRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fastDate}>
                      {weekdayShort(fast.gregorianDate)}, {gregShort(fast.gregorianDate)}
                    </Text>
                    <Text style={styles.fastHijri}>
                      {fast.hijriDay} {fast.hijriMonthName} {fast.hijriYear}
                    </Text>
                  </View>
                  <Chip label={countdownLabel(fast.daysUntil)} tone="peach" />
                </View>
                <View style={styles.chipRow}>
                  <Chip label={s.kindLabels[fast.kind]} tone={kindTone(fast.kind)} />
                </View>
              </Card>
            ))
          )}

          {/* History — stored entries only. */}
          <SectionTitle title={s.historyTitle} sub={s.historySub} />
          {history.length === 0 ? (
            <EmptyState title={s.historyTitle} body={s.noHistory} />
          ) : (
            history.slice(0, 30).map(([date, entry]) => (
              <Card key={date}>
                <View style={styles.fastRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fastDate}>
                      {weekdayShort(date)}, {gregShort(date)}
                    </Text>
                    <Text style={styles.fastHijri}>{s.kindLabels[entry.kind]}</Text>
                    {entry.note ? <Text style={styles.entryNote}>{entry.note}</Text> : null}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      entry.status === 'kept' ? styles.statusKept : styles.statusMissed,
                    ]}
                  >
                    <Text
                      style={
                        entry.status === 'kept' ? styles.statusKeptText : styles.statusMissedText
                      }
                    >
                      {entry.status === 'kept' ? s.kept : s.missed}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}

          <Text style={T.note}>{s.sourceNote}</Text>
        </View>
      )}
      {loading && upcoming.length > 0 ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />
      ) : null}
      {error && upcoming.length > 0 ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  heroLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: C.navInactive,
  },
  heroDate: {
    fontFamily: F.sans,
    fontSize: 19,
    fontWeight: '800',
    color: C.white,
    marginTop: 6,
  },
  heroCount: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '700',
    color: C.peach,
    marginTop: 4,
  },
  summaryRow: { flexDirection: 'row', marginTop: 12, marginBottom: 10 },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryNum: {
    fontFamily: F.sans,
    fontSize: 26,
    fontWeight: '800',
    color: C.teal900,
  },
  summaryLabel: {
    fontFamily: F.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: C.muted,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fastRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  fastDate: { fontFamily: F.sans, fontSize: 15, fontWeight: '800', color: C.ink },
  fastHijri: { fontFamily: F.sans, fontSize: 13.5, color: C.muted, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  entryNote: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    fontStyle: 'italic',
    marginTop: 6,
  },
  markRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusKept: { backgroundColor: C.teal500, borderColor: C.teal500 },
  statusMissed: { backgroundColor: C.missedBg, borderColor: C.missedBorder },
  statusKeptText: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.white },
  statusMissedText: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.red },
});
