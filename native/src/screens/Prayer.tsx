/**
 * Prayer — rebuilt to the approved preview (§7): title + real
 * city · Asr method, ONE white card with 6 rows (Fajr, Sunrise,
 * Dhuhr, Asr, Maghrib, Isha) — plus an OPTIONAL Tahajjud row at the
 * bottom, shown only when the user set a Tahajjud time in
 * onboarding/Profile (it has no status button: it is not one of
 * the five prayers and is never counted or auto-marked).
 *
 * After the times load, today's system prayer alerts are refreshed
 * (fire-and-forget, only when the user switched them on in the
 * Notifications screen — see src/lib/prayerNotifications.ts). It
 * never blocks this screen and never fails it.
 *
 * Below the card, a small source line shows where today's times came
 * from — straight from the /api/prayer/times response: `source`
 * ('aladhan' or 'manual'), `method` (the user's saved calculation
 * method name), the Asr method from the profile, and the city. When
 * Aladhan failed and the times are the user's own manual times, the
 * method is NOT shown as the producer and the server's own notice is
 * shown instead. No accuracy claims anywhere.
 *
 * MIHRAB-STYLE ADDITIONS (2026-11-23):
 * - Hijri date under the title, from the same /api/prayer/times
 *   response (`hijri`: day-month-year + month name + year) — reused,
 *   never invented.
 * - Next-prayer countdown card (Mihrab-style: big name + time left,
 *   ticking every 30 s); after Isha it counts to tomorrow's Fajr,
 *   like Dashboard/Home already do.
 * - Calculation-method picker: the five methods the server actually
 *   maps (see src/lib/prayerMethods.ts). Changing it saves to the
 *   profile and re-fetches today's times. The source stays AlAdhan.
 * - Adhan sound: on/off + a voice picker (3 real AlAdhan CDN voices)
 *   with in-app preview; the adhan plays when a prayer alert arrives
 *   while the app is open (see src/lib/adhanAudio.ts for the honest
 *   closed-app limit). A Journal button opens the prayer journal.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, EmptyState, PillButton, StatusPill, Switch, type PrayerStatus } from '../components/ui';
import {
  fetchPrayerTimes,
  fetchSalahDay,
  fetchTomorrowFajr,
  formatTime12h,
  loadProfileWithCompletion,
  minutesUntil,
  minutesUntilTomorrow,
  nextPrayerWithTahajjud,
  PRAYER_NAMES,
  savePrayerCalculationMethod,
  todayKey,
  updateSalahStatus,
  type PrayerName,
  type PrayerRecord,
  type PrayerTimesResponse,
  type SalahStatus,
} from '../lib/apiCore';
import { canonicalPrayerMethod, DEFAULT_PRAYER_METHOD, PRAYER_METHODS } from '../lib/prayerMethods';
import {
  ADHAN_VOICES,
  getAdhanPrefs,
  getAdhanPreviewState,
  playAdhanPreview,
  setAdhanEnabled,
  setAdhanVoiceId,
  subscribeAdhanPreview,
  type AdhanPrefs,
} from '../lib/adhanAudio';
import {
  isPrayerNotificationsEnabled,
  schedulePrayerNotifications,
} from '../lib/prayerNotifications';

const CYCLE: Record<'prayed' | 'missed' | 'qaza', SalahStatus> = {
  prayed: 'missed',
  missed: 'qaza',
  qaza: 'prayed',
};

function statusToPill(status: SalahStatus): PrayerStatus {
  if (status === 'prayed') return 'prayed';
  if (status === 'missed') return 'missed';
  if (status === 'qaza') return 'qaza';
  return 'not-yet';
}

type Row = { name: string; time: string; prayer: PrayerName | null; optional?: boolean };

/**
 * Source-line strings — kept local to this screen (strings.ts untouched).
 * 'AlAdhan' and 'Method'/'Asr' are used as-is in Hinglish, matching how
 * the rest of the app already shows the Asr method ('Hanafi'/'Shafi').
 */
const SOURCE_STRINGS = {
  en: {
    source: 'Source',
    method: 'Method',
    asr: 'Asr',
    aladhan: 'AlAdhan',
    manualTimes: 'Your manual times',
  },
  hi: {
    source: 'Source',
    method: 'Method',
    asr: 'Asr',
    aladhan: 'AlAdhan',
    manualTimes: 'Aapke manual time',
  },
} as const;

/** "24-06-1447" + month name + year → "24 Jumādá al-ākhirah 1447 AH". */
function formatHijri(hijri: PrayerTimesResponse['hijri']): string {
  if (!hijri || !hijri.date || !hijri.month || !hijri.year) return '';
  const day = hijri.date.split('-')[0] ?? '';
  if (!day) return '';
  return `${day} ${hijri.month} ${hijri.year} AH`;
}

/** "1 ghanta 12 minute baaki" / "1 hour 12 min left" from minutes. */
function formatCountdown(
  mins: number,
  s: ReturnType<typeof stringsFor>,
): string {
  if (mins <= 0) return s.countdownNow;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) {
    return s.countdownHM
      .replace('{h}', String(h))
      .replace('{s}', h > 1 ? 's' : '')
      .replace('{m}', String(m));
  }
  return s.countdownM.replace('{m}', String(m));
}

export default function PrayerScreen({ lang, user, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const today = todayKey();
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [day, setDay] = useState<PrayerRecord | null>(null);
  const [asrMethod, setAsrMethod] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<PrayerName | null>(null);
  // Countdown clock (ticks every 30 s) + tomorrow's Fajr for the
  // after-Isha case (server returns nextPrayer null then).
  const [now, setNow] = useState(() => new Date());
  const [tomorrowFajr, setTomorrowFajr] = useState<string | null>(null);
  // Calculation method: the saved value, coerced to the offered list
  // (an old 'Muslim World League (MWL)' / long ISNA string maps to
  // its canonical server key — see prayerMethods.ts).
  const [method, setMethod] = useState(DEFAULT_PRAYER_METHOD);
  const [onboardingState, setOnboardingState] = useState({
    completed: false,
    skipped: false,
    step: 0,
  });
  const [methodSaving, setMethodSaving] = useState(false);
  const [methodNote, setMethodNote] = useState('');
  // Adhan sound prefs (device-level) + preview Play/Stop state.
  const [adhanPrefs, setAdhanPrefs] = useState<AdhanPrefs>({
    enabled: false,
    voiceId: ADHAN_VOICES[0].id,
  });
  const [adhanPreview, setAdhanPreview] = useState(getAdhanPreviewState());

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      fetchPrayerTimes(today),
      fetchSalahDay(today),
      loadProfileWithCompletion(user?.name ?? ''),
    ]).then(([timesResult, dayResult, profileResult]) => {
      if (!active) return;
      if (timesResult.status === 'fulfilled') {
        const loaded = timesResult.value;
        setTimes(loaded);
        // After Isha the next real prayer is tomorrow's Fajr.
        if (loaded.nextPrayer === null) {
          void fetchTomorrowFajr().then((fajr) => {
            if (active) setTomorrowFajr(fajr);
          });
        } else {
          setTomorrowFajr(null);
        }
        // Keep today's system prayer alerts scheduled whenever this
        // screen loads (fire-and-forget; the helpers never throw).
        // Tahajjud alerts are on whenever a Tahajjud time is set —
        // it has no per-prayer reminder toggle; clearing the time
        // stops them.
        void (async () => {
          if (!(await isPrayerNotificationsEnabled())) return;
          const enabled: { [key: string]: boolean } = {};
          for (const prayer of PRAYER_NAMES) {
            enabled[prayer] = loaded.perPrayer[prayer]?.reminder ?? true;
          }
          enabled.Tahajjud = Boolean(loaded.tahajjud?.time);
          await schedulePrayerNotifications(loaded, enabled);
        })();
      }
      if (dayResult.status === 'fulfilled') setDay(dayResult.value);
      if (profileResult.status === 'fulfilled') {
        const saved = profileResult.value.profile;
        if (saved?.asrMethod) {
          setAsrMethod(saved.asrMethod);
        }
        if (saved) {
          setMethod(canonicalPrayerMethod(saved.calculationMethod));
        }
        setOnboardingState({
          completed: profileResult.value.onboardingCompleted,
          skipped: profileResult.value.onboardingSkipped,
          step: profileResult.value.onboardingStep,
        });
      }
      if (timesResult.status === 'rejected' && dayResult.status === 'rejected') {
        setError(s.loadFailed);
      } else if (timesResult.status === 'rejected') {
        setError(
          timesResult.reason instanceof Error ? timesResult.reason.message : s.loadFailed,
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [s.loadFailed, today, user?.name]);

  useEffect(load, [load]);

  // Countdown clock: re-render every 30 s so the time-left text
  // stays live without re-fetching the times.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Adhan prefs (device-level) + preview Play/Stop state.
  useEffect(() => {
    void getAdhanPrefs().then(setAdhanPrefs);
    return subscribeAdhanPreview(setAdhanPreview);
  }, []);

  async function changeMethod(next: string) {
    if (methodSaving || next === method) return;
    const prev = method;
    setMethod(next);
    setMethodNote('');
    setMethodSaving(true);
    try {
      await savePrayerCalculationMethod(next, onboardingState);
      setMethodNote(s.methodSaved);
      // Times depend on the method — re-fetch (the server cache is
      // keyed per method, so the new times come straight away).
      load();
    } catch {
      setMethod(prev);
      setMethodNote(s.methodSaveFailed);
    } finally {
      setMethodSaving(false);
    }
  }

  async function toggleAdhan(value: boolean) {
    setAdhanPrefs((cur) => ({ ...cur, enabled: value }));
    await setAdhanEnabled(value);
  }

  async function pickAdhanVoice(id: string) {
    setAdhanPrefs((cur) => ({ ...cur, voiceId: id }));
    await setAdhanVoiceId(id);
  }

  async function cycleStatus(prayer: PrayerName) {
    if (saving) return;
    const current = day?.[prayer].status ?? 'pending';
    const nextStatus: SalahStatus =
      current === 'pending' ? 'prayed' : CYCLE[current];
    setSaving(prayer);
    setError('');
    try {
      const updated = await updateSalahStatus(today, prayer, nextStatus);
      setDay(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.statusSaveFailed);
    } finally {
      setSaving(null);
    }
  }

  function statusLabel(prayer: PrayerName): string {
    const entry = day?.[prayer];
    if (!entry) return s.statusPending;
    if (entry.status === 'prayed') return s.statusPrayed;
    if (entry.status === 'missed') return s.statusMissed;
    if (entry.status === 'qaza') return s.statusQaza;
    return s.statusPending;
  }

  const rows: Row[] = times
    ? [
        { name: 'Fajr', time: times.perPrayer.Fajr?.time ?? times.timings.Fajr ?? '', prayer: 'Fajr' },
        { name: 'Sunrise', time: times.timings.Sunrise ?? '', prayer: null },
        { name: 'Dhuhr', time: times.perPrayer.Dhuhr?.time ?? times.timings.Dhuhr ?? '', prayer: 'Dhuhr' },
        { name: 'Asr', time: times.perPrayer.Asr?.time ?? times.timings.Asr ?? '', prayer: 'Asr' },
        { name: 'Maghrib', time: times.perPrayer.Maghrib?.time ?? times.timings.Maghrib ?? '', prayer: 'Maghrib' },
        { name: 'Isha', time: times.perPrayer.Isha?.time ?? times.timings.Isha ?? '', prayer: 'Isha' },
        // Optional Tahajjud: only when the user set a time. No status
        // pill — it is not one of the five prayers.
        ...(times.tahajjud?.time
          ? [{ name: 'Tahajjud', time: times.tahajjud.time, prayer: null, optional: true } as Row]
          : []),
      ]
    : [];

  const subParts = [times?.city, asrMethod].filter(Boolean);
  const sub = subParts.length > 0 ? subParts.join(' · ') : s.prayerSub;

  // Honest source line, built ONLY from values the app actually has:
  // - times.source / times.method / times.city: from GET /api/prayer/times
  //   (server: source is 'aladhan' normally, 'manual' when Aladhan failed
  //   and the user's own manual times are served instead; method is the
  //   user's saved prayerCalculationMethod, default
  //   'University of Islamic Sciences, Karachi').
  // - asrMethod: from the saved profile ('Hanafi' / 'Shafi').
  // The method is shown only when Aladhan produced the times — with
  // manual times it did not, so it is left out rather than mislabelled.
  // Any value that is missing is omitted, never invented.
  const src = SOURCE_STRINGS[lang];
  const sourceParts: string[] = [];
  if (times) {
    const sourceLabel =
      times.source === 'manual'
        ? src.manualTimes
        : times.source === 'aladhan'
          ? src.aladhan
          : times.source;
    sourceParts.push(`${src.source}: ${sourceLabel}`);
    if (times.source === 'aladhan' && times.method) {
      sourceParts.push(`${src.method}: ${times.method}`);
    }
    if (asrMethod) sourceParts.push(`${src.asr}: ${asrMethod}`);
    if (times.city) sourceParts.push(times.city);
  }
  const sourceLine = sourceParts.join(' · ');

  // Next prayer + countdown. The effective next prayer includes an
  // optional set Tahajjud (today, or tomorrow's when past Isha) —
  // the server's nextPrayer alone never includes it.
  const next = times ? nextPrayerWithTahajjud(times, tomorrowFajr, now) : null;
  const isTomorrow = next?.isTomorrow ?? false;
  const countdownMins = next
    ? isTomorrow
      ? minutesUntilTomorrow(next.time, now)
      : minutesUntil(next.time, now)
    : null;
  const hijriLine = times ? formatHijri(times.hijri) : '';

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.namazTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{sub}</Text>

      {hijriLine ? (
        <Text style={[T.note, { marginBottom: 12, textAlign: 'left' }]}>
          {s.hijriLabel}: {hijriLine}
        </Text>
      ) : null}

      {times && next && countdownMins !== null ? (
        <Card>
          <Text style={T.cardTitle}>
            {s.dashNextPrayer}
            {isTomorrow ? ` · ${s.tomorrowTag}` : ''}
            {next.isTahajjud ? ` · ${s.tahajjudOptional}` : ''}
          </Text>
          <Text style={styles.countdownName}>
            {next.name} · {formatTime12h(next.time)}
          </Text>
          <Text style={styles.countdownMins}>{formatCountdown(countdownMins, s)}</Text>
        </Card>
      ) : null}

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : times ? (
        <View>
          <Card>
            {rows.map((row, index) => {
              const isNext =
                next !== null &&
                ((row.prayer !== null && next.name === row.prayer && !next.isTahajjud) ||
                  (row.optional === true && next.isTahajjud));
              const isLast = index === rows.length - 1;
              return (
                <View
                  key={row.name}
                  style={[
                    styles.row,
                    !isLast && !isNext && styles.rowBorder,
                    isNext && styles.rowNext,
                  ]}
                >
                  <Text style={[styles.rowName, isNext && styles.rowNextText]}>
                    {row.name}
                    {row.optional ? ` · ${s.tahajjudOptional}` : ''}
                    {isNext ? ` · ${s.nextTag}` : ''}
                  </Text>
                  <Text style={[styles.rowTime, isNext && styles.rowNextText]}>
                    {formatTime12h(row.time)}
                  </Text>
                  {row.prayer === null ? (
                    <Text style={styles.rowDash}>—</Text>
                  ) : saving === row.prayer ? (
                    <ActivityIndicator color={C.teal} />
                  ) : (
                    <StatusPill
                      state={statusToPill(day?.[row.prayer].status ?? 'pending')}
                      label={statusLabel(row.prayer)}
                      onPress={() => void cycleStatus(row.prayer as PrayerName)}
                    />
                  )}
                </View>
              );
            })}
          </Card>

          <Text style={[T.note, { marginBottom: 16, textAlign: 'left' }]}>
            {s.namazHint}
          </Text>

          {sourceLine ? (
            <Text style={[T.note, { marginBottom: 16, textAlign: 'left' }]}>
              {sourceLine}
            </Text>
          ) : null}
          {times.notice ? (
            <Text style={[T.note, { marginBottom: 16, textAlign: 'left' }]}>
              {times.notice}
            </Text>
          ) : null}

          <PillButton
            label={s.dashEditTimes}
            variant="peach"
            block
            onPress={() => goTo('onboarding')}
          />
          <PillButton
            label={s.namazCal}
            variant="ghost"
            block
            onPress={() => goTo('salahCalendar')}
          />
          <PillButton
            label={s.journalOpen}
            variant="ghost"
            block
            onPress={() => goTo('prayerJournal')}
          />
        </View>
      ) : (
        <EmptyState title={s.namazTitle} body={s.loadFailed} />
      )}

      {!loading ? (
        <View>
          <Card>
            <Text style={T.cardTitle}>{s.methodTitle}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.methodSub}</Text>
            {PRAYER_METHODS.map((m) => {
              const selected = method === m.value;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => void changeMethod(m.value)}
                  disabled={methodSaving}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.methodRow, selected && styles.methodRowSelected]}
                >
                  <Text style={[styles.methodDot, selected && styles.methodDotSelected]}>
                    {selected ? '●' : '○'}
                  </Text>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                </Pressable>
              );
            })}
            <Text style={[T.note, { marginTop: 8, textAlign: 'left' }]}>{s.methodNote}</Text>
            {methodSaving ? (
              <ActivityIndicator color={C.teal} style={{ marginTop: 8 }} />
            ) : null}
            {methodNote ? <Text style={T.note}>{methodNote}</Text> : null}
          </Card>

          <Card>
            <View style={styles.adhanHead}>
              <View style={{ flex: 1 }}>
                <Text style={T.cardTitle}>{s.adhanTitle}</Text>
                <Text style={[T.cardBody, { marginTop: 6 }]}>{s.adhanSub}</Text>
              </View>
              <Switch value={adhanPrefs.enabled} onValueChange={(v) => void toggleAdhan(v)} />
            </View>
            {adhanPrefs.enabled ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.voiceLabel}>{s.adhanVoiceT}</Text>
                {ADHAN_VOICES.map((voice) => {
                  const selected = adhanPrefs.voiceId === voice.id;
                  const playing = adhanPreview.playing && adhanPreview.voiceId === voice.id;
                  return (
                    <View key={voice.id} style={styles.voiceRow}>
                      <Pressable
                        onPress={() => void pickAdhanVoice(voice.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={styles.voiceNameWrap}
                      >
                        <Text style={[styles.voiceName, selected && styles.voiceNameSelected]}>
                          {selected ? '● ' : '○ '}
                          {voice.name}
                        </Text>
                      </Pressable>
                      <PillButton
                        label={playing ? s.adhanStop : s.adhanPlay}
                        small
                        variant={playing ? 'peach' : 'ghost'}
                        onPress={() => playAdhanPreview(voice.id)}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text style={[T.note, { marginTop: 8, textAlign: 'left' }]}>{s.adhanNote}</Text>
          </Card>
        </View>
      ) : null}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowNext: {
    backgroundColor: C.peach,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  rowNextText: { color: C.peachInk },
  rowName: {
    flex: 1,
    fontFamily: F.sans,
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  rowTime: {
    fontFamily: F.sans,
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  rowDash: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  countdownName: {
    fontFamily: F.sans,
    fontSize: 22,
    fontWeight: '800',
    color: C.ink,
    marginTop: 8,
  },
  countdownMins: {
    fontFamily: F.sans,
    fontSize: 17,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 4,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  methodRowSelected: {
    backgroundColor: C.peach,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  methodDot: {
    fontFamily: F.sans,
    fontSize: 15,
    color: C.muted,
  },
  methodDotSelected: { color: C.teal700 },
  methodLabel: {
    flex: 1,
    fontFamily: F.sans,
    fontSize: 14.5,
    fontWeight: '700',
    color: C.ink,
  },
  adhanHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  voiceLabel: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 4,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  voiceNameWrap: { flex: 1 },
  voiceName: {
    fontFamily: F.sans,
    fontSize: 14.5,
    fontWeight: '600',
    color: C.ink,
  },
  voiceNameSelected: { color: C.teal700, fontWeight: '800' },
});
