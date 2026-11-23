/**
 * Focus — rebuilt to the approved preview (§17 in the preview file).
 * HUGE plain "25:00" (64px) centred on the ICE background (no dark
 * card), "Pomodoro · <subject>" under it, preset chips 15 / 25 / 50,
 * Start (flex 2) + Reset (flex 1) row, real stat grid (today's focus
 * minutes + sessions this week, both from the server).
 *
 * Server is the source of truth: POST /api/study/pomodoro/start,
 * GET /api/study/pomodoro/active, pause/resume/complete/abandon.
 * The countdown ticks locally from the server's remainingMs.
 * No local-only fallback, no Finish/Abandon controls, no done card —
 * on completion the session is completed on the server and a short
 * "saved" note is shown.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Chip, PillButton } from '../components/ui';
import {
  listSubjects,
  pomodoroAbandon,
  pomodoroActive,
  pomodoroComplete,
  pomodoroPause,
  pomodoroResume,
  pomodoroStart,
  studyStats,
  type PomodoroSession,
} from '../lib/apiSocial';
import { syncStudyBlockFromSession } from '../lib/appBlock';

const PRESETS = [15, 25, 50];

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type HistorySession = { completedAt: string | null; focusMinutesEarned: number; status: string };

async function sessionsThisWeek(): Promise<number> {
  const response = await apiFetch('/api/study/pomodoro/history?limit=50');
  const data = (await response.json().catch(() => ({}))) as {
    sessions?: HistorySession[];
  };
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sessions.filter(
    (sess) =>
      sess.status === 'completed' &&
      sess.completedAt &&
      new Date(sess.completedAt).getTime() >= weekAgo,
  ).length;
}

export default function FocusScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [remainingMs, setRemainingMs] = useState(25 * 60_000);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [todayFocus, setTodayFocus] = useState<number | null>(null);
  const [weekSessions, setWeekSessions] = useState<number | null>(null);
  const [savedNote, setSavedNote] = useState('');
  const [busy, setBusy] = useState(false);
  const completedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [active, subjects, stats, weekCount] = await Promise.all([
        pomodoroActive(),
        listSubjects(),
        studyStats(),
        sessionsThisWeek(),
      ]);
      setSession(active);
      if (active) {
        setRemainingMs(active.remainingMs);
        setSelectedMinutes(active.plannedMinutes);
      }
      // Mirror the server session into the native blocker: a running
      // session blocks the picked apps (study blocking), any other
      // state clears it. Covers the app being reopened mid-session.
      void syncStudyBlockFromSession(
        active ? { status: active.status, remainingMs: active.remainingMs } : null,
      );
      if (subjects.length > 0) {
        setSubjectName(subjects[0].name);
        setSubjectId(subjects[0].id);
      }
      setTodayFocus(stats.todayFocusMinutes);
      setWeekSessions(weekCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  const running = Boolean(session && session.status === 'running');

  // Tick once a second while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Countdown hit zero — complete on the server.
  useEffect(() => {
    if (!session || session.status !== 'running' || remainingMs > 0 || completedRef.current) {
      return;
    }
    completedRef.current = true;
    void pomodoroComplete(session.id)
      .then((done) => {
        setSession(null);
        setRemainingMs(selectedMinutes * 60_000);
        setSavedNote(s.focusSaved.replace('{n}', String(done.focusMinutesEarned)));
        setTodayFocus((prev) => (prev === null ? done.focusMinutesEarned : prev + done.focusMinutesEarned));
        setWeekSessions((prev) => (prev === null ? 1 : prev + 1));
        // Session over — the study block lifts at once.
        void syncStudyBlockFromSession(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : s.errorGeneric);
      })
      .finally(() => {
        completedRef.current = false;
      });
  }, [remainingMs, session, selectedMinutes, s.focusSaved, s.errorGeneric]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    setSavedNote('');
    try {
      const created = await pomodoroStart(selectedMinutes, subjectId);
      setSession(created);
      setRemainingMs(created.remainingMs);
      // Study blocking starts with the session.
      void syncStudyBlockFromSession({
        status: created.status,
        remainingMs: created.remainingMs,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!session || busy) return;
    setBusy(true);
    try {
      const updated = await pomodoroPause(session.id);
      setSession(updated);
      setRemainingMs(updated.remainingMs);
      // Paused = not studying right now — the block lifts.
      void syncStudyBlockFromSession({
        status: updated.status,
        remainingMs: updated.remainingMs,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!session || busy) return;
    setBusy(true);
    try {
      const updated = await pomodoroResume(session.id);
      setSession(updated);
      setRemainingMs(updated.remainingMs);
      // Back to studying — the block resumes.
      void syncStudyBlockFromSession({
        status: updated.status,
        remainingMs: updated.remainingMs,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    if (!session) {
      setRemainingMs(selectedMinutes * 60_000);
      setSavedNote('');
      return;
    }
    setBusy(true);
    try {
      await pomodoroAbandon(session.id);
      setSession(null);
      setRemainingMs(selectedMinutes * 60_000);
      setSavedNote('');
      // Session abandoned — the study block lifts at once.
      void syncStudyBlockFromSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  function pickPreset(minutes: number) {
    if (session) return;
    setSelectedMinutes(minutes);
    setRemainingMs(minutes * 60_000);
    setSavedNote('');
  }

  const modeLine = subjectName ? `Pomodoro · ${subjectName}` : 'Pomodoro';
  const startLabel = !session
    ? s.focusStart
    : session.status === 'paused'
      ? s.focusResume
      : s.focusPause;
  const onStartPress = !session ? start : session.status === 'paused' ? resume : pause;

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.focusTitle}</Text>
      <Text style={T.sub}>{s.focusSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && !session ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}
          {savedNote ? <Text style={styles.savedNote}>{savedNote}</Text> : null}

          {/* Huge plain timer on the ice background — no dark card */}
          <View style={styles.timerWrap}>
            <Text style={styles.timer}>{formatMs(session ? remainingMs : selectedMinutes * 60_000)}</Text>
            <Text style={T.sub}>{modeLine}</Text>
          </View>

          <View style={styles.presets}>
            {PRESETS.map((m) => (
              <Chip
                key={m}
                label={`${m} min`}
                selected={selectedMinutes === m}
                onPress={() => pickPreset(m)}
              />
            ))}
          </View>

          <View style={styles.btnRow}>
            <View style={{ flex: 2 }}>
              <PillButton label={startLabel} onPress={() => void onStartPress()} busy={busy} block />
            </View>
            <View style={{ flex: 1 }}>
              <PillButton label={s.focusReset} variant="ghost" onPress={() => void reset()} disabled={busy} block />
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{todayFocus === null ? '—' : `${todayFocus} min`}</Text>
              <Text style={styles.statLabel}>{s.focusToday}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{weekSessions === null ? '—' : String(weekSessions)}</Text>
              <Text style={styles.statLabel}>{s.focusSessions}</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  timerWrap: { alignItems: 'center', marginTop: 20 },
  timer: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2,
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  savedNote: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 13,
    fontWeight: '700',
    color: C.teal500,
    textAlign: 'center',
    marginTop: 12,
  },
  statGrid: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 14 },
  stat: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 14,
  },
  statValue: { fontFamily: 'PlusJakartaSans', fontSize: 23, fontWeight: '800', color: C.ink },
  statLabel: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, fontWeight: '600', marginTop: 2 },
});
