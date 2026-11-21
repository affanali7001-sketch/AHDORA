/**
 * Study — subjects + tasks from the live API.
 * GET/POST /api/study/subjects, GET/POST /api/study/tasks,
 * PATCH /api/study/tasks/:id/status. Honest empty states; no fake data.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import {
  createSubject,
  createTask,
  listSubjects,
  listTasks,
  setTaskStatus,
  type StudySubject,
  type StudyTask,
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

const STR = {
  en: {
    back: '← Back',
    title: 'Study',
    sub: 'Your subjects and tasks, saved on your account.',
    subjects: 'Subjects',
    noSubjects: 'No subjects yet. Add your first subject below.',
    addSubject: 'Add subject',
    subjectPlaceholder: 'e.g. Mathematics',
    tasks: 'Tasks',
    noTasks: 'No tasks yet. Add one below — it will be saved to your account.',
    addTask: 'Add task',
    taskPlaceholder: 'e.g. Revise Chapter 4',
    due: 'Due',
    noDue: 'No due date',
    done: 'Done',
    markDone: 'Mark done',
    reopen: 'Reopen',
    loading: 'Loading your study data…',
    retry: 'Retry',
    priority: 'Priority',
  },
  hi: {
    back: '← Wapas',
    title: 'Study',
    sub: 'Aapke subjects aur tasks, aapke account par saved.',
    subjects: 'Subjects',
    noSubjects: 'Abhi koi subject nahi hai. Neeche apna pehla subject add karo.',
    addSubject: 'Subject add karo',
    subjectPlaceholder: 'jaise Mathematics',
    tasks: 'Tasks',
    noTasks: 'Abhi koi task nahi hai. Neeche ek add karo — ye aapke account par save hoga.',
    addTask: 'Task add karo',
    taskPlaceholder: 'jaise Chapter 4 revise karo',
    due: 'Due',
    noDue: 'Koi due date nahi',
    done: 'Ho gaya',
    markDone: 'Done karo',
    reopen: 'Wapas kholo',
    loading: 'Aapka study data load ho raha hai…',
    retry: 'Dobara try karo',
    priority: 'Priority',
  },
} as const;

export default function StudyScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newTask, setNewTask] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subs, tks] = await Promise.all([listSubjects(), listTasks()]);
      setSubjects(subs);
      setTasks(tks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSubject() {
    const name = newSubject.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createSubject(name);
      setSubjects((prev) => [...prev, created]);
      setNewSubject('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createTask({ title });
      setTasks((prev) => [created, ...prev]);
      setNewTask('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: StudyTask) {
    const next = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      const updated = await setTaskStatus(task.id, next);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    }
  }

  const subjectName = (id: string | null) =>
    subjects.find((sub) => sub.id === id)?.name ?? null;

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
      ) : error && subjects.length === 0 && tasks.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.sectionTitle}>{s.subjects}</Text>
          {subjects.length === 0 ? (
            <Text style={styles.empty}>{s.noSubjects}</Text>
          ) : (
            <View style={styles.chipRow}>
              {subjects.map((sub) => (
                <View key={sub.id} style={styles.chip}>
                  <Text style={styles.chipText}>{sub.name}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder={s.subjectPlaceholder}
              placeholderTextColor={C.muted}
              editable={!busy}
              onSubmitEditing={() => void addSubject()}
            />
            <Pressable
              onPress={() => void addSubject()}
              style={[styles.addBtn, busy && styles.btnDisabled]}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.addBtnText}>{s.addSubject}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>{s.tasks}</Text>
          {tasks.length === 0 ? (
            <Text style={styles.empty}>{s.noTasks}</Text>
          ) : (
            tasks.map((task) => {
              const done = task.status === 'Completed';
              const subName = subjectName(task.subjectId);
              return (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskTop}>
                    <Text style={[styles.taskTitle, done && styles.taskDone]}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      {subName ? `${subName} · ` : ''}
                      {s.priority}: {task.priority}
                    </Text>
                    <Text style={styles.taskMeta}>
                      {s.due}: {task.dueDate ?? s.noDue}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void toggleTask(task)}
                    style={[styles.taskBtn, done && styles.taskBtnDone]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.taskBtnText, done && styles.taskBtnTextDone]}>
                      {done ? s.done : s.markDone}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newTask}
              onChangeText={setNewTask}
              placeholder={s.taskPlaceholder}
              placeholderTextColor={C.muted}
              editable={!busy}
              onSubmitEditing={() => void addTask()}
            />
            <Pressable
              onPress={() => void addTask()}
              style={[styles.addBtn, busy && styles.btnDisabled]}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.addBtnText}>{s.addTask}</Text>
            </Pressable>
          </View>
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
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 8, marginBottom: 10 },
  empty: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: {
    backgroundColor: C.peach2,
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { color: C.peachDeep, fontSize: 14, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
  },
  addBtn: {
    backgroundColor: C.teal,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  taskCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 10,
  },
  taskTop: { marginBottom: 10 },
  taskTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  taskDone: { textDecorationLine: 'line-through', color: C.muted },
  taskMeta: { fontSize: 13, color: C.muted, marginTop: 4 },
  taskBtn: {
    backgroundColor: C.peach2,
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
  },
  taskBtnDone: { backgroundColor: C.teal, borderColor: C.teal },
  taskBtnText: { color: C.peachDeep, fontSize: 14, fontWeight: '800' },
  taskBtnTextDone: { color: C.white },
});
