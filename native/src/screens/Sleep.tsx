/**
 * Sleep — rebuilt to the approved preview (§18 in the preview file).
 * Deep-green header card with the REAL schedule (from /api/profile),
 * "Kal raat" card that NEVER shows the schedule as real sleep (no
 * health data is connected, so an honest empty state is shown),
 * two switches (bedtime block + 5-minute warning), and a ghost
 * button to App Block.
 *
 * REAL behaviour (no demo anywhere on this screen):
 * - The bedtime-block switch writes straight into the native
 *   blocker config (sleep_block_enabled, master blocking on), and
 *   the sleep window is re-synced to the native side every time
 *   this screen opens — so the Accessibility Service enforces the
 *   schedule the user actually saved, even when the app is closed.
 * - The warning switches drive REAL scheduled local notifications
 *   (see src/lib/prayerNotifications.ts): one at the sleep time
 *   itself and, when the 5-minute warning is on, one 5 minutes
 *   before it — today + tomorrow. The card below shows the real
 *   next warning time, or honestly says none is scheduled (and why:
 *   no sleep time / switches off / permission missing). The test
 *   button fires a REAL notification through the real sleep
 *   channel right now — never a fake in-app banner.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, PillButton, Switch, TealHead } from '../components/ui';
import { getProfile } from '../lib/apiSocial';
import { formatTime12h } from '../lib/apiCore';
import {
  isAppBlockAvailable,
  loadAppBlockConfig,
  saveAppBlockConfig,
  syncScheduleFromServer,
} from '../lib/appBlock';
import {
  getNotificationPermissionStatus,
  refreshSleepWarnings,
  requestNotificationPermission,
  sendSleepTestNotification,
  SLEEP_BLOCK_KEY,
  SLEEP_WARN_KEY,
  type PermissionStatus,
  type SleepWarningState,
} from '../lib/prayerNotifications';

function durationLabel(start: string, end: string, lang: 'en' | 'hi'): string {
  const parse = (value: string) => {
    const parts = value.split(':').map(Number);
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin === null || endMin === null) return '';
  let diff = endMin - startMin;
  if (diff <= 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (lang === 'hi') {
    return minutes === 0 ? `${hours} ghante` : `${hours} ghante ${minutes} minute`;
  }
  return minutes === 0 ? `${hours} hours` : `${hours} hours ${minutes} minutes`;
}

function toHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function SleepScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sleepStart, setSleepStart] = useState<string | null>(null);
  const [sleepEnd, setSleepEnd] = useState<string | null>(null);
  const [blockApps, setBlockApps] = useState(false);
  const [warnFirst, setWarnFirst] = useState(true);
  const [permStatus, setPermStatus] = useState<PermissionStatus>('undetermined');
  const [warnState, setWarnState] = useState<SleepWarningState | null>(null);
  const [syncMsg, setSyncMsg] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  const applyWarnings = useCallback(
    async (start: string | null, warn: boolean, block: boolean) => {
      const state = await refreshSleepWarnings(start, warn, block);
      setWarnState(state);
      return state;
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSyncMsg('');
    try {
      const [{ profile }, blockRaw, warnRaw, perm] = await Promise.all([
        getProfile(),
        AsyncStorage.getItem(SLEEP_BLOCK_KEY),
        AsyncStorage.getItem(SLEEP_WARN_KEY),
        getNotificationPermissionStatus(),
      ]);
      const start =
        typeof profile?.sleepStartTime === 'string'
          ? profile.sleepStartTime
          : typeof profile?.sleepTime === 'string'
            ? profile.sleepTime
            : null;
      const end = typeof profile?.sleepEndTime === 'string' ? profile.sleepEndTime : null;
      const block = blockRaw === 'true';
      const warn = warnRaw !== 'false';
      setSleepStart(start);
      setSleepEnd(end);
      setBlockApps(block);
      setWarnFirst(warn);
      setPermStatus(perm);
      // Push the saved sleep window to the native blocker every time
      // this screen opens, so a sleep time changed in Onboarding or
      // Profile reaches the service without a visit to App Block.
      // (No-op in Expo Go; a failure here never blocks the screen.)
      await syncScheduleFromServer();
      await applyWarnings(start, warn, block);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [applyWarnings, s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Bedtime block: save the flag AND push it into the native config. */
  async function setBlock(value: boolean) {
    setBlockApps(value);
    setSyncMsg('');
    try {
      await AsyncStorage.setItem(SLEEP_BLOCK_KEY, value ? 'true' : 'false');
    } catch {
      // Saved in memory for this session; the note below stays honest.
    }
    try {
      if (isAppBlockAvailable()) {
        const cfg = await loadAppBlockConfig();
        if (cfg) {
          cfg.sleep_block_enabled = value;
          // The service only enforces when the master switch is on.
          if (value) cfg.blocking_enabled = true;
          const ok = await saveAppBlockConfig(cfg);
          if (ok) {
            await syncScheduleFromServer(cfg);
          } else {
            setSyncMsg(s.sleepBlockSyncFailed);
          }
        }
      }
    } catch {
      setSyncMsg(s.sleepBlockSyncFailed);
    }
    await applyWarnings(sleepStart, warnFirst, value);
  }

  async function setWarn(value: boolean) {
    setWarnFirst(value);
    try {
      await AsyncStorage.setItem(SLEEP_WARN_KEY, value ? 'true' : 'false');
    } catch {
      // Saved in memory for this session; the note below stays honest.
    }
    await applyWarnings(sleepStart, value, blockApps);
  }

  async function askPermission() {
    const granted = await requestNotificationPermission();
    const status = granted ? 'granted' : await getNotificationPermissionStatus();
    setPermStatus(status);
    if (granted) {
      await applyWarnings(sleepStart, warnFirst, blockApps);
    }
  }

  async function sendTest() {
    if (testBusy) return;
    setTestBusy(true);
    setTestMsg('');
    try {
      const ok = await sendSleepTestNotification();
      setTestMsg(ok ? s.sleepWarnTestSent : s.sleepWarnTestFailed);
      if (!ok) setPermStatus(await getNotificationPermissionStatus());
    } finally {
      setTestBusy(false);
    }
  }

  const hasSchedule = sleepStart !== null && sleepEnd !== null;
  const scheduleLine = hasSchedule
    ? `${formatTime12h(sleepStart!)} → ${formatTime12h(sleepEnd!)}`
    : '—';
  const dur = hasSchedule ? durationLabel(sleepStart!, sleepEnd!, lang) : '';

  // The warning card shows the REAL scheduled state — never a demo.
  let warnLine = '';
  let warnDetail = '';
  if (!hasSchedule) {
    warnLine = s.sleepWarnNoTime;
  } else if (permStatus !== 'granted') {
    warnLine = s.sleepWarnNoPerm;
  } else if (warnState?.status === 'disabled') {
    warnLine = s.sleepWarnOff;
  } else if (warnState?.status === 'ok' && warnState.nextWarning) {
    warnLine = s.sleepWarnNext
      .replace('{t}', formatTime12h(toHHmm(warnState.nextWarning)))
      .replace('{day}', isToday(warnState.nextWarning) ? s.today : s.tomorrowTag);
    warnDetail = s.sleepWarnDetail
      .replace('{w}', warnState.nextEarly ? formatTime12h(toHHmm(warnState.nextEarly)) : '—')
      .replace('{s}', warnState.nextAtTime ? formatTime12h(toHHmm(warnState.nextAtTime)) : '—');
  } else {
    warnLine = s.sleepWarnNone;
  }

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.sleepTitle}</Text>
      <Text style={T.sub}>{s.sleepSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && !hasSchedule ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}

          {/* Dark-teal header card: real schedule */}
          <TealHead style={{ marginTop: 14 }}>
            <Text style={styles.headLabel}>{s.sleepSched}</Text>
            <Text style={styles.headTime}>{scheduleLine}</Text>
            {dur ? <Text style={styles.headSub}>{dur}</Text> : null}
          </TealHead>
          {!hasSchedule ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.note}>{s.sleepNotSet}</Text>
              <PillButton label={s.sleepSetBtn} variant="peach" onPress={() => goTo('onboarding')} />
            </View>
          ) : null}

          {/* Last night — real sleep only, never the schedule */}
          <Card>
            <Text style={T.cardTitle}>{s.sleepLast}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.sleepNoActual}</Text>
          </Card>

          {/* Blocking settings */}
          <Card>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>{s.sleepBlockT}</Text>
                <Text style={styles.switchSub}>{s.sleepBlockS}</Text>
              </View>
              <Switch value={blockApps} onValueChange={(v) => void setBlock(v)} />
            </View>
            <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>{s.sleepWarnT}</Text>
                <Text style={styles.switchSub}>{s.sleepWarnS}</Text>
              </View>
              <Switch value={warnFirst} onValueChange={(v) => void setWarn(v)} />
            </View>
          </Card>
          {syncMsg ? <Text style={T.error}>{syncMsg}</Text> : null}

          {/* Real warning state — what is actually scheduled, or why not */}
          <Card>
            <Text style={T.cardTitle}>{s.sleepWarnT}</Text>
            <Text style={[styles.warnLine, { marginTop: 6 }]}>{warnLine}</Text>
            {warnDetail ? <Text style={[T.cardBody, { marginTop: 4 }]}>{warnDetail}</Text> : null}
            {hasSchedule && permStatus !== 'granted' ? (
              <View style={{ marginTop: 10 }}>
                <PillButton label={s.sleepWarnPermBtn} small onPress={() => void askPermission()} />
              </View>
            ) : null}
            <View style={{ marginTop: 10 }}>
              <PillButton
                label={s.sleepWarnTest}
                small
                variant="ghost"
                block
                onPress={() => void sendTest()}
                busy={testBusy}
                disabled={testBusy}
              />
            </View>
            {testMsg ? <Text style={styles.testMsg}>{testMsg}</Text> : null}
          </Card>
          <Text style={styles.note}>{s.sleepWarnNote}</Text>
          <Text style={styles.note}>{s.sleepPhoneNote}</Text>

          <PillButton label={s.sleepShield} variant="ghost" block onPress={() => goTo('appBlock')} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headLabel: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, fontWeight: '700', color: C.navInactive },
  headTime: { fontFamily: 'PlusJakartaSans', fontSize: 26, fontWeight: '800', color: C.white, marginTop: 4 },
  headSub: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.navInactive, marginTop: 4, lineHeight: 19 },
  note: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 12 },
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
  warnLine: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink, lineHeight: 21 },
  testMsg: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '700', color: C.teal700, marginTop: 10 },
});
