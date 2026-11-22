/**
 * Prayer — rebuilt to the approved preview (§7): title + real
 * city · Asr method, ONE white card with 6 rows (Fajr, Sunrise,
 * Dhuhr, Asr, Maghrib, Isha). Sunrise is displayed with no status
 * button. Each prayer row has ONE small status pill that cycles on
 * tap: Not yet → Prayed → Missed → Qaza → Prayed. (The server
 * rejects a reset to "pending", so the cycle wraps from Qaza back
 * to Prayed — exactly as the preview hint describes.) The next
 * prayer row is highlighted peach with the "Agli" tag. The
 * "Namaz ke time badlo" button goes to Onboarding (per preview),
 * not to an inline editor.
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
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, EmptyState, PillButton, StatusPill, type PrayerStatus } from '../components/ui';
import {
  fetchPrayerTimes,
  fetchSalahDay,
  formatTime12h,
  loadProfileWithCompletion,
  PRAYER_NAMES,
  todayKey,
  updateSalahStatus,
  type PrayerName,
  type PrayerRecord,
  type PrayerTimesResponse,
  type SalahStatus,
} from '../lib/apiCore';
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

type Row = { name: string; time: string; prayer: PrayerName | null };

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

export default function PrayerScreen({ lang, user, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const today = todayKey();
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [day, setDay] = useState<PrayerRecord | null>(null);
  const [asrMethod, setAsrMethod] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<PrayerName | null>(null);

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
        // Keep today's system prayer alerts scheduled whenever this
        // screen loads (fire-and-forget; the helpers never throw).
        void (async () => {
          if (!(await isPrayerNotificationsEnabled())) return;
          const enabled: { [key: string]: boolean } = {};
          for (const prayer of PRAYER_NAMES) {
            enabled[prayer] = loaded.perPrayer[prayer]?.reminder ?? true;
          }
          await schedulePrayerNotifications(loaded, enabled);
        })();
      }
      if (dayResult.status === 'fulfilled') setDay(dayResult.value);
      if (
        profileResult.status === 'fulfilled' &&
        profileResult.value.profile?.asrMethod
      ) {
        setAsrMethod(profileResult.value.profile.asrMethod);
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

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.namazTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{sub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : times ? (
        <View>
          <Card>
            {rows.map((row, index) => {
              const isNext = row.prayer !== null && times.nextPrayer?.name === row.prayer;
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
        </View>
      ) : (
        <EmptyState title={s.namazTitle} body={s.loadFailed} />
      )}

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
});
