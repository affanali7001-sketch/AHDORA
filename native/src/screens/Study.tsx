/**
 * Study — rebuilt to the approved preview (§16 in the preview file).
 * Title "Study Planner", subject chips (tappable, "+ Subject jodo" adds
 * a real subject via the API), one "Aaj ke tasks" card with a small
 * Done button per row, real stat grid (today's focus minutes + study
 * streak from /api/study/stats), full-width teal button to Focus.
 * Real subjects/tasks API only; honest empty states, no fake numbers.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Chip, Input, PillButton } from '../components/ui';
import {
  createSubject,
  discoverPeople,
  listFriends,
  listSubjects,
  listTasks,
  setTaskStatus,
  studyStats,
  type PublicUser,
  type StudyStats,
  type StudySubject,
  type StudyTask,
} from '../lib/apiSocial';
import { setChallengeUserTarget } from '../lib/navTarget';

function cap(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default function StudyScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [challengeQuery, setChallengeQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subs, tks, st, frs, disc] = await Promise.all([
        listSubjects(),
        listTasks(),
        studyStats(),
        listFriends().catch(() => [] as PublicUser[]),
        discoverPeople(50).catch(() => [] as PublicUser[]),
      ]);
      setSubjects(subs);
      setTasks(tks);
      setStats(st);
      // Challenge card shows EVERYONE (friends + new people), not
      // just friends — a non-friend gets a request first, then an
      // invite (see Challenges). Dedupe by id.
      const seen = new Set<string>();
      const merged: PublicUser[] = [];
      for (const u of [...frs, ...disc]) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          merged.push(u);
        }
      }
      setAllUsers(merged);
      if (subs.length > 0) setSelectedId((prev) => prev ?? subs[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSubject() {
    const name = newSubject.trim();
    if (!name || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await createSubject(name);
      setSubjects((prev) => [...prev, created]);
      setSelectedId(created.id);
      setNewSubject('');
      setAddingSubject(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: StudyTask) {
    if (busyTaskId) return;
    const next = task.status === 'Completed' ? 'Pending' : 'Completed';
    setBusyTaskId(task.id);
    try {
      const updated = await setTaskStatus(task.id, next);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyTaskId(null);
    }
  }

  const subjectName = (id: string | null) =>
    subjects.find((sub) => sub.id === id)?.name ?? null;
  const visibleTasks = selectedId ? tasks.filter((t) => t.subjectId === selectedId) : tasks;
  const todayTasks = visibleTasks;

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.studyTitle}</Text>
      <Text style={T.sub}>{s.studySub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && subjects.length === 0 && tasks.length === 0 ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}

          {/* Subject chips */}
          <View style={styles.chips}>
            {subjects.map((sub) => (
              <Chip
                key={sub.id}
                label={sub.name}
                selected={selectedId === sub.id}
                onPress={() => setSelectedId(sub.id)}
              />
            ))}
            <Chip
              label={`+ ${s.studyAdd}`}
              tone="peach"
              onPress={() => setAddingSubject((v) => !v)}
            />
          </View>
          {addingSubject ? (
            <View style={styles.addRow}>
              <Input
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder={s.studyAddNamePh}
                editable={!busy}
                onSubmitEditing={() => void addSubject()}
                style={{ flex: 1 }}
              />
              <PillButton label={s.studyAdd} small onPress={() => void addSubject()} busy={busy} />
              <PillButton
                label={s.studyAddCancel}
                small
                variant="ghost"
                onPress={() => {
                  setAddingSubject(false);
                  setNewSubject('');
                }}
              />
            </View>
          ) : null}
          {subjects.length === 0 && !addingSubject ? (
            <Text style={styles.note}>{s.studyNoSubjects}</Text>
          ) : null}

          {/* Today's tasks — one card, small Done button per row */}
          <Card>
            <Text style={T.cardTitle}>{s.studyToday}</Text>
            {todayTasks.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 8 }]}>{s.studyNoTasks}</Text>
            ) : (
              todayTasks.map((task) => {
                const done = task.status === 'Completed';
                const subName = subjectName(task.subjectId);
                const metaParts: string[] = [];
                if (subName) metaParts.push(subName);
                if (task.dueDate) metaParts.push(task.dueDate);
                metaParts.push(`${cap(task.priority)} priority`);
                if (task.durationMinutes) metaParts.push(`${task.durationMinutes} min`);
                return (
                  <View key={task.id} style={styles.taskRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, done && styles.taskDone]}>{task.title}</Text>
                      <Text style={styles.taskMeta}>{metaParts.join(' · ')}</Text>
                    </View>
                    <PillButton
                      label={s.taskDone}
                      small
                      variant={done ? 'ghost' : 'primary'}
                      onPress={() => void toggleTask(task)}
                      disabled={busyTaskId === task.id}
                    />
                  </View>
                );
              })
            )}
          </Card>

          {/* Real stats */}
          <View style={styles.statGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stats ? `${stats.todayFocusMinutes} min` : '—'}</Text>
              <Text style={styles.statLabel}>{s.studyTodayMin}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>🔥 {stats ? stats.streak : '—'}</Text>
              <Text style={styles.statLabel}>{s.studyStreak}</Text>
            </View>
          </View>

          {/* Challenge a friend — study together. Everyone is listed
              (friends + new people), with a name search. The Challenge
              button opens Challenges with that person pre-selected. */}
          <Card>
            <Text style={T.cardTitle}>{s.studyChallengeTitle}</Text>
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.studyChallengeBody}</Text>
            <View style={{ marginTop: 10 }}>
              <Input
                value={challengeQuery}
                onChangeText={setChallengeQuery}
                placeholder={s.chInviteSearchPh}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            {(() => {
              const q = challengeQuery.trim().toLowerCase();
              const rows = allUsers.filter((u) => !q || u.name.toLowerCase().includes(q));
              if (rows.length === 0) {
                return (
                  <Text style={[T.cardBody, { marginTop: 8 }]}>{s.studyNoFriendsCh}</Text>
                );
              }
              return rows.slice(0, 5).map((f) => (
                <View key={f.id} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>{f.initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{f.name}</Text>
                    <Text style={styles.taskMeta}>
                      ⭐ {typeof f.points === 'number' ? f.points : 0} {s.frPoints}
                    </Text>
                  </View>
                  <PillButton
                    label={s.frChallenge}
                    small
                    onPress={() => {
                      setChallengeUserTarget({ id: f.id, name: f.name });
                      goTo('challenges');
                    }}
                  />
                </View>
              ));
            })()}
            <View style={{ marginTop: 12 }}>
              <PillButton
                label={allUsers.length === 0 ? s.frTitle : s.studyChallengeBtn}
                variant="peach"
                block
                onPress={() => goTo(allUsers.length === 0 ? 'friends' : 'challenges')}
              />
            </View>
          </Card>

          <PillButton label={s.studyFocusBtn} block onPress={() => goTo('focus')} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  note: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  taskTitle: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  taskDone: { textDecorationLine: 'line-through', color: C.muted },
  taskMeta: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, marginTop: 2 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  friendAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.teal700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: { fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '800', color: C.white },
  friendName: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
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
