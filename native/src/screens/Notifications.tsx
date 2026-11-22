/**
 * Notifications — rebuilt to the approved preview (§23 in the preview file).
 * SETTINGS-ONLY screen, no inbox. One card with 4 labelled switches:
 * Missed-namaz Quran teaching, Study reminders, Dost aur challenge,
 * Sleep reminders. Quiet-hours card shows the REAL quiet hours from
 * the server settings (falling back to the profile sleep window when
 * none are set). A dark sample-notification card, honestly labelled
 * as a sample.
 *
 * SYSTEM NOTIFICATIONS (added 2026-11-22): the top card is the
 * prayer-alert master switch. When it is ON, real local notifications
 * are scheduled in the Android notification bar (see
 * src/lib/prayerNotifications.ts) — they arrive even when the app is
 * closed. Turning it on asks for OS permission first, then schedules
 * today's alerts from the real prayer times; turning it off cancels
 * them. The permission status is shown honestly, and the note under
 * the card says what actually happened (how many alerts were set,
 * or why none were).
 *
 * Saving: prayer/study/friend+challenge/sleep map to the server's
 * /api/notifications/settings categories and are saved on every
 * toggle. The missed-prayer teaching has NO server option, so it is
 * saved on the phone (AsyncStorage) with an honest note — never
 * claimed as server-synced.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, PillButton, Switch } from '../components/ui';
import {
  getNotificationSettings,
  getProfile,
  updateNotificationSettings,
  type NotificationCategories,
  type NotificationSettings,
} from '../lib/apiSocial';
import { formatTime12h } from '../lib/apiCore';
import {
  cancelPrayerNotifications,
  getNotificationPermissionStatus,
  refreshPrayerNotifications,
  requestNotificationPermission,
  setPrayerNotificationsEnabled,
  type PermissionStatus,
  type RefreshResult,
} from '../lib/prayerNotifications';

const MISSED_KEY = '@ahdora/notif/missedTeaching';

export default function NotificationsScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [missedTeaching, setMissedTeaching] = useState(true);
  const [sleepFallback, setSleepFallback] = useState<{ start: string; end: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [permStatus, setPermStatus] = useState<PermissionStatus>('undetermined');
  const [schedNote, setSchedNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [prefs, missedRaw, { profile }, perm] = await Promise.all([
        getNotificationSettings(),
        AsyncStorage.getItem(MISSED_KEY),
        getProfile(),
        getNotificationPermissionStatus(),
      ]);
      setSettings(prefs);
      setPermStatus(perm);
      if (missedRaw !== null) setMissedTeaching(missedRaw === 'true');
      const start = typeof profile?.sleepStartTime === 'string' ? profile.sleepStartTime : null;
      const end = typeof profile?.sleepEndTime === 'string' ? profile.sleepEndTime : null;
      setSleepFallback(start && end ? { start, end } : null);
      // Keep the on-phone system-alert flag in step with the server:
      // if prayer reminders were switched off elsewhere, stale local
      // alerts must not keep firing.
      await setPrayerNotificationsEnabled(prefs.categories.prayer);
      if (!prefs.categories.prayer) {
        void cancelPrayerNotifications();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  function noteFor(result: RefreshResult): string {
    if (result.status === 'ok') {
      return result.scheduled > 0
        ? s.ntSchedOk.replace('{n}', String(result.scheduled))
        : s.ntSchedNone;
    }
    if (result.status === 'no-times') return s.ntSchedNoTimes;
    if (result.status === 'no-permission') return s.ntSchedNoPerm;
    return '';
  }

  async function requestPermission() {
    const granted = await requestNotificationPermission();
    const status = granted ? 'granted' : await getNotificationPermissionStatus();
    setPermStatus(status);
    if (granted && settings?.categories.prayer) {
      setSchedNote(noteFor(await refreshPrayerNotifications()));
    }
  }

  async function togglePrayerSystem(value: boolean) {
    if (!settings || saving) return;
    const prev = settings.categories.prayer;
    setSettings({ ...settings, categories: { ...settings.categories, prayer: value } });
    setSaving(true);
    try {
      await updateNotificationSettings({ categories: { ...settings.categories, prayer: value } });
      await setPrayerNotificationsEnabled(value);
      if (!value) {
        await cancelPrayerNotifications();
        setSchedNote('');
        return;
      }
      let status = permStatus;
      if (status !== 'granted') {
        const granted = await requestNotificationPermission();
        status = granted ? 'granted' : await getNotificationPermissionStatus();
        setPermStatus(status);
      }
      if (status !== 'granted') {
        setSchedNote(s.ntSchedNoPerm);
        return;
      }
      setSchedNote(noteFor(await refreshPrayerNotifications()));
    } catch (e) {
      setSettings((cur) =>
        cur ? { ...cur, categories: { ...cur.categories, prayer: prev } } : cur,
      );
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(key: keyof NotificationCategories, value: boolean) {
    if (!settings || saving) return;
    const prev = settings.categories[key];
    setSettings({ ...settings, categories: { ...settings.categories, [key]: value } });
    setSaving(true);
    try {
      await updateNotificationSettings({ categories: { ...settings.categories, [key]: value } });
    } catch (e) {
      setSettings((cur) =>
        cur ? { ...cur, categories: { ...cur.categories, [key]: prev } } : cur,
      );
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function toggleFriendChallenge(value: boolean) {
    if (!settings || saving) return;
    const prevFriend = settings.categories.friend;
    const prevChallenge = settings.categories.challenge;
    setSettings({
      ...settings,
      categories: { ...settings.categories, friend: value, challenge: value },
    });
    setSaving(true);
    try {
      await updateNotificationSettings({
        categories: { ...settings.categories, friend: value, challenge: value },
      });
    } catch (e) {
      setSettings((cur) =>
        cur
          ? { ...cur, categories: { ...cur.categories, friend: prevFriend, challenge: prevChallenge } }
          : cur,
      );
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function toggleMissedTeaching(value: boolean) {
    setMissedTeaching(value);
    try {
      await AsyncStorage.setItem(MISSED_KEY, value ? 'true' : 'false');
    } catch {
      // Kept in memory for this session; the note below stays honest.
    }
  }

  const quietText = settings
    ? settings.quietHoursStart && settings.quietHoursEnd
      ? `${formatTime12h(settings.quietHoursStart)} – ${formatTime12h(settings.quietHoursEnd)} · ${
          lang === 'hi'
            ? 'Is dauraan sirf namaz wali khabar aayegi.'
            : 'Only prayer alerts come through in this window.'
        }`
      : sleepFallback
        ? `${formatTime12h(sleepFallback.start)} – ${formatTime12h(sleepFallback.end)} · ${
            lang === 'hi' ? '(sleep schedule se)' : '(from your sleep schedule)'
          }`
        : s.ntQuietNotSet
    : '';

  const row = (title: string, sub: string, value: boolean, onChange: (v: boolean) => void, last = false) => (
    <View style={[styles.switchRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{title}</Text>
        <Text style={styles.switchSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={saving} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.ntTitle}</Text>
      <Text style={T.sub}>{s.ntSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && !settings ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : settings ? (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}

          <Card>
            <Text style={T.cardTitle}>{s.ntSysT}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.ntSysS}</Text>
            <Text
              style={[
                styles.permLine,
                permStatus === 'granted' ? styles.permOn : styles.permOff,
              ]}
            >
              {permStatus === 'granted' ? s.ntPermOn : s.ntPermOff}
            </Text>
            {permStatus !== 'granted' ? (
              <View style={{ marginTop: 10 }}>
                <PillButton label={s.ntPermBtn} small onPress={() => void requestPermission()} />
              </View>
            ) : null}
            {row(s.ntPrayerT, s.ntPrayerS, settings.categories.prayer, (v) => void togglePrayerSystem(v), true)}
          </Card>
          {schedNote ? <Text style={styles.note}>{schedNote}</Text> : null}

          <Card>
            {row(s.ntMissedT, s.ntMissedS, missedTeaching, (v) => void toggleMissedTeaching(v))}
            {row(s.ntStudyT, s.ntStudyS, settings.categories.study, (v) => void toggleCategory('study', v))}
            {row(
              s.ntFriendT,
              s.ntFriendS,
              settings.categories.friend && settings.categories.challenge,
              (v) => void toggleFriendChallenge(v),
            )}
            {row(s.ntSleepT, s.ntSleepS, settings.categories.sleep, (v) => void toggleCategory('sleep', v), true)}
          </Card>
          <Text style={styles.note}>{s.ntSavedLocal}</Text>

          <Card>
            <Text style={T.cardTitle}>{s.ntQuiet}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>{quietText}</Text>
          </Card>

          <Card>
            <Text style={T.cardTitle}>{s.ntSampleH}</Text>
            <View style={styles.sampleCard}>
              <Text style={styles.sampleApp}>AHDORA</Text>
              <Text style={styles.sampleBody}>{s.ntSampleBody}</Text>
            </View>
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  switchText: { flex: 1 },
  switchLabel: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  switchSub: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 2 },
  permLine: { fontFamily: 'PlusJakartaSans', fontSize: 13.5, fontWeight: '700', marginTop: 10 },
  permOn: { color: C.teal700 },
  permOff: { color: C.red },
  note: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 12 },
  sampleCard: { backgroundColor: C.teal900, borderRadius: 20, padding: 14, marginTop: 10 },
  sampleApp: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '800', color: C.white },
  sampleBody: { fontFamily: 'PlusJakartaSans', fontSize: 14, color: C.white, lineHeight: 22, marginTop: 5 },
});
