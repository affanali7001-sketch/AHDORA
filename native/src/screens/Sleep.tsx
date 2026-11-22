/**
 * Sleep — rebuilt to the approved preview (§18 in the preview file).
 * Dark-teal header card with the REAL schedule (from /api/profile),
 * "Kal raat" card that NEVER shows the schedule as real sleep (no
 * health data is connected, so an honest empty state is shown),
 * two switches (bedtime block + 5-minute warning) saved on the phone
 * with an honest note, a peach demo button that shows the dark
 * warning notification banner, and a ghost button to App Block.
 * This screen only owns the settings UI + warning demo — real
 * blocking lives in AppBlock.tsx (another worker's job).
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, PillButton, Switch, TealHead } from '../components/ui';
import { getProfile } from '../lib/apiSocial';
import { formatTime12h } from '../lib/apiCore';

const BLOCK_KEY = '@ahdora/sleep/blockApps';
const WARN_KEY = '@ahdora/sleep/warn5min';

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

export default function SleepScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sleepStart, setSleepStart] = useState<string | null>(null);
  const [sleepEnd, setSleepEnd] = useState<string | null>(null);
  const [blockApps, setBlockApps] = useState(false);
  const [warnFirst, setWarnFirst] = useState(true);
  const [showWarning, setShowWarning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ profile }, blockRaw, warnRaw] = await Promise.all([
        getProfile(),
        AsyncStorage.getItem(BLOCK_KEY),
        AsyncStorage.getItem(WARN_KEY),
      ]);
      const start =
        typeof profile?.sleepStartTime === 'string'
          ? profile.sleepStartTime
          : typeof profile?.sleepTime === 'string'
            ? profile.sleepTime
            : null;
      setSleepStart(start);
      setSleepEnd(typeof profile?.sleepEndTime === 'string' ? profile.sleepEndTime : null);
      if (blockRaw !== null) setBlockApps(blockRaw === 'true');
      if (warnRaw !== null) setWarnFirst(warnRaw === 'true');
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setBlock(value: boolean) {
    setBlockApps(value);
    try {
      await AsyncStorage.setItem(BLOCK_KEY, value ? 'true' : 'false');
    } catch {
      // Saved in memory for this session; the note below stays honest.
    }
  }

  async function setWarn(value: boolean) {
    setWarnFirst(value);
    try {
      await AsyncStorage.setItem(WARN_KEY, value ? 'true' : 'false');
    } catch {
      // Saved in memory for this session; the note below stays honest.
    }
  }

  const hasSchedule = sleepStart !== null && sleepEnd !== null;
  const scheduleLine = hasSchedule
    ? `${formatTime12h(sleepStart!)} → ${formatTime12h(sleepEnd!)}`
    : '—';
  const dur = hasSchedule ? durationLabel(sleepStart!, sleepEnd!, lang) : '';

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
            <PillButton
              label={s.sleepWarnDemo}
              small
              variant="peach"
              block
              onPress={() => setShowWarning((v) => !v)}
            />
            {showWarning ? (
              <Pressable onPress={() => setShowWarning(false)} accessibilityRole="button">
                <View style={styles.notifCard}>
                  <View style={styles.notifHead}>
                    <Text style={styles.notifApp}>AHDORA · {s.notifNow}</Text>
                  </View>
                  <Text style={styles.notifBody}>{s.notifBody}</Text>
                </View>
              </Pressable>
            ) : null}
          </Card>
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
  notifCard: {
    backgroundColor: 'rgba(20,26,24,0.96)',
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
  },
  notifHead: { flexDirection: 'row', justifyContent: 'space-between' },
  notifApp: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '800', color: C.white },
  notifBody: { fontFamily: 'PlusJakartaSans', fontSize: 14, color: C.white, lineHeight: 21, marginTop: 6 },
});
