/**
 * Focus — a REAL Pomodoro timer.
 *
 * Server is the source of truth: POST /api/study/pomodoro/start,
 * GET /api/study/pomodoro/active, POST .../pause, .../resume,
 * .../complete, .../abandon. The countdown ticks locally from the
 * server's remainingMs so it keeps running across refreshes; pausing
 * and finishing write back to the server (focus minutes are earned
 * server-side from real elapsed time, never the planned minutes).
 *
 * If the server cannot be reached, the timer still runs locally and
 * says so honestly — the session is NOT saved in that case.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import {
  pomodoroAbandon,
  pomodoroActive,
  pomodoroComplete,
  pomodoroPause,
  pomodoroResume,
  pomodoroStart,
  type PomodoroSession,
} from '../lib/apiSocial';

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

const DURATIONS = [15, 25, 45, 60];

const STR = {
  en: {
    back: '← Back',
    title: 'Focus',
    sub: 'A real Pomodoro timer. Finished sessions are saved to your account.',
    choose: 'Choose your focus time',
    min: 'min',
    start: 'Start focus',
    pause: 'Pause',
    resume: 'Resume',
    finish: 'Finish now',
    abandon: 'Abandon',
    paused: 'Paused',
    running: 'Focusing…',
    doneTitle: 'Session complete',
    doneBody: 'Your focus minutes were saved to your account.',
    localOnly: 'Server se connect nahi ho paya — ye timer sirf is phone par chal raha hai, session save nahi hoga.',
    loading: 'Checking for an active timer…',
    retry: 'Retry',
    earned: 'Focus minutes earned',
    alreadyRunning: 'A focus timer is already running. Pause or finish it first.',
  },
  hi: {
    back: '← Wapas',
    title: 'Focus',
    sub: 'Asli Pomodoro timer. Poori hui sessions aapke account par save hoti hain.',
    choose: 'Apna focus time chuno',
    min: 'min',
    start: 'Focus shuru karo',
    pause: 'Pause',
    resume: 'Resume',
    finish: 'Abhi khatam karo',
    abandon: 'Chhod do',
    paused: 'Paused hai',
    running: 'Focus chal raha hai…',
    doneTitle: 'Session poori hui',
    doneBody: 'Aapke focus minutes aapke account par save ho gaye.',
    localOnly: 'Server se connect nahi ho paya — ye timer sirf is phone par chal raha hai, session save nahi hoga.',
    loading: 'Active timer check ho raha hai…',
    retry: 'Dobara try karo',
    earned: 'Focus minutes mile',
    alreadyRunning: 'Ek focus timer pehle se chal raha hai. Pehle use pause ya finish karo.',
  },
} as const;

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function FocusScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [busy, setBusy] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [finished, setFinished] = useState<{ earned: number } | null>(null);
  // Local-only fallback: end time when the server is unreachable.
  const localEndRef = useRef<number | null>(null);
  const localPausedRef = useRef<number | null>(null);

  const loadActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await pomodoroActive();
      setSession(active);
      if (active) {
        setRemainingMs(active.remainingMs);
        setSelectedMinutes(active.plannedMinutes);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  // Tick the countdown once a second while a session is running.
  const running = Boolean(session && session.status === 'running');
  useEffect(() => {
    if (!running && localEndRef.current === null) return;
    if (session?.status === 'paused') return;
    const id = setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, session?.status, session?.id]);

  // When the countdown hits zero, finish the session on the server.
  useEffect(() => {
    if (!session || session.status !== 'running' || remainingMs > 0) return;
    if (localOnly) {
      setSession(null);
      localEndRef.current = null;
      setFinished({ earned: 0 });
      return;
    }
    let cancelled = false;
    void pomodoroComplete(session.id)
      .then((done) => {
        if (cancelled) return;
        setSession(null);
        setFinished({ earned: done.focusMinutesEarned });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [remainingMs, session, localOnly]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFinished(null);
    try {
      const created = await pomodoroStart(selectedMinutes);
      setSession(created);
      setRemainingMs(created.remainingMs);
      setLocalOnly(false);
    } catch (e) {
      // Server unreachable / already-running: if it is a transport
      // failure, fall back to a local-only timer and say so.
      const message = e instanceof Error ? e.message : '';
      if (message.includes('Connection slow') || message.includes('internet')) {
        localEndRef.current = Date.now() + selectedMinutes * 60_000;
        setRemainingMs(selectedMinutes * 60_000);
        setSession({
          id: 'local',
          mode: 'focus',
          plannedMinutes: selectedMinutes,
          startedAt: new Date().toISOString(),
          pausedAt: null,
          pausedTotalMs: 0,
          status: 'running',
          completedAt: null,
          focusMinutesEarned: 0,
          taskId: null,
          subjectId: null,
          elapsedMs: 0,
          remainingMs: selectedMinutes * 60_000,
        });
        setLocalOnly(true);
      } else {
        setError(message || s.alreadyRunning);
      }
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!session || busy) return;
    if (localOnly) {
      localPausedRef.current = remainingMs;
      setSession({ ...session, status: 'paused' });
      return;
    }
    setBusy(true);
    try {
      const updated = await pomodoroPause(session.id);
      setSession(updated);
      setRemainingMs(updated.remainingMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!session || busy) return;
    if (localOnly) {
      setSession({ ...session, status: 'running' });
      return;
    }
    setBusy(true);
    try {
      const updated = await pomodoroResume(session.id);
      setSession(updated);
      setRemainingMs(updated.remainingMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function finishNow() {
    if (!session || busy) return;
    if (localOnly) {
      setSession(null);
      localEndRef.current = null;
      setFinished({ earned: 0 });
      return;
    }
    setBusy(true);
    try {
      const done = await pomodoroComplete(session.id);
      setSession(null);
      setFinished({ earned: done.focusMinutesEarned });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function abandon() {
    if (!session || busy) return;
    if (localOnly) {
      setSession(null);
      localEndRef.current = null;
      setRemainingMs(0);
      return;
    }
    setBusy(true);
    try {
      await pomodoroAbandon(session.id);
      setSession(null);
      setRemainingMs(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.sub}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.note}>{s.loading}</Text>
        </View>
      ) : error && !session ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void loadActive()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {localOnly ? <Text style={styles.warn}>{s.localOnly}</Text> : null}

          {finished ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>{s.doneTitle}</Text>
              <Text style={styles.doneBody}>{s.doneBody}</Text>
              {finished.earned > 0 ? (
                <Text style={styles.earned}>
                  {s.earned}: {finished.earned} min
                </Text>
              ) : null}
              <Pressable
                onPress={() => setFinished(null)}
                style={styles.primaryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>{s.start}</Text>
              </Pressable>
            </View>
          ) : session ? (
            <View style={styles.timerCard}>
              <Text style={styles.status}>
                {session.status === 'paused' ? s.paused : s.running}
              </Text>
              <Text style={styles.timer}>{formatMs(remainingMs)}</Text>
              <Text style={styles.note}>
                {session.plannedMinutes} {s.min} · {session.mode}
              </Text>
              <View style={styles.btnRow}>
                {session.status === 'paused' ? (
                  <Pressable
                    onPress={() => void resume()}
                    style={[styles.primaryBtn, styles.flexBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>{s.resume}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void pause()}
                    style={[styles.primaryBtn, styles.flexBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>{s.pause}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => void finishNow()}
                  style={[styles.peachBtn, styles.flexBtn, busy && styles.btnDisabled]}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={styles.peachBtnText}>{s.finish}</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => void abandon()} disabled={busy} accessibilityRole="button">
                <Text style={styles.abandon}>{s.abandon}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{s.choose}</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setSelectedMinutes(m)}
                    style={[styles.durationBtn, selectedMinutes === m && styles.durationBtnOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedMinutes === m }}
                  >
                    <Text
                      style={[styles.durationText, selectedMinutes === m && styles.durationTextOn]}
                    >
                      {m} {s.min}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => void start()}
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>{s.start}</Text>
                )}
              </Pressable>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 20, lineHeight: 20 },
  center: { alignItems: 'center', paddingVertical: 40 },
  note: { fontSize: 13, color: C.muted, marginTop: 10, textAlign: 'center' },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  warn: {
    fontSize: 13,
    color: C.peachDeep,
    backgroundColor: C.peach2,
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 12 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  durationBtn: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  durationBtnOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  durationText: { fontSize: 15, fontWeight: '700', color: C.ink },
  durationTextOn: { color: C.white },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '800' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peachBtnText: { color: C.peachDeep, fontSize: 17, fontWeight: '800' },
  flexBtn: { flex: 1 },
  btnDisabled: { opacity: 0.6 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  timerCard: {
    backgroundColor: C.teal950,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
  },
  status: { color: C.peach, fontSize: 14, fontWeight: '700' },
  timer: { color: C.white, fontSize: 64, fontWeight: '800', letterSpacing: 1, marginVertical: 8 },
  abandon: { color: C.red, fontSize: 14, fontWeight: '700', marginTop: 18 },
  doneCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 22,
  },
  doneTitle: { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 8 },
  doneBody: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 8 },
  earned: { fontSize: 15, fontWeight: '700', color: C.teal, marginBottom: 16 },
});
