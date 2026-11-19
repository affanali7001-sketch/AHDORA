import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { refreshChallengeProgress, userTimezone } from '../lib/challengeProgress.js';
import { awardBadge, awardPoints, POINT_VALUES } from '../lib/points.js';
import { dateKeyInTimezone } from '../lib/timezone.js';
import { Profile } from '../models/Profile.js';
import { StudySubject, subjectColours } from '../models/StudySubject.js';
import { StudyTask, taskPriorities, taskStatuses } from '../models/StudyTask.js';
import { PomodoroSession, pomodoroModes } from '../models/PomodoroSession.js';

export const studyRouter = Router();

studyRouter.use(requireAuth);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Server-local YYYY-MM-DD, same convention as the Salah routes. */
function todayKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateKeyOf(value: Date | null | undefined): string | null {
  if (!value) return null;
  return todayKey(new Date(value));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalDate = z.union([dateSchema, z.null()]).optional();
const optionalTime = z.union([timeSchema, z.null()]).optional();
const optionalObjectId = z.union([z.string().refine(isObjectId, 'Invalid id'), z.null()]).optional();

type SubjectDoc = {
  _id: mongoose.Types.ObjectId;
  name: string;
  label: string;
  colour: string;
  createdAt: Date;
  updatedAt: Date;
};

type TaskDoc = {
  _id: mongoose.Types.ObjectId;
  title: string;
  subjectId: mongoose.Types.ObjectId | null;
  description: string;
  priority: string;
  dueDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PomodoroDoc = {
  _id: mongoose.Types.ObjectId;
  mode: string;
  plannedMinutes: number;
  startedAt: Date;
  pausedAt: Date | null;
  pausedTotalMs: number;
  status: string;
  completedAt: Date | null;
  focusMinutesEarned: number;
  taskId: mongoose.Types.ObjectId | null;
  subjectId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeSubject(doc: SubjectDoc) {
  return {
    id: String(doc._id),
    name: doc.name,
    label: doc.label,
    colour: doc.colour,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeTask(doc: TaskDoc) {
  return {
    id: String(doc._id),
    title: doc.title,
    subjectId: doc.subjectId ? String(doc.subjectId) : null,
    description: doc.description,
    priority: doc.priority,
    dueDate: doc.dueDate,
    startTime: doc.startTime,
    durationMinutes: doc.durationMinutes,
    status: doc.status,
    completedAt: doc.completedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Milliseconds of the session that have actually run (pauses excluded).
 * The server is the source of truth: startedAt + pausedTotalMs (+ the
 * current pause, if paused) is all the client needs to resume correctly.
 */
function elapsedMs(doc: PomodoroDoc, now: Date): number {
  const currentPause =
    doc.status === 'paused' && doc.pausedAt
      ? now.getTime() - new Date(doc.pausedAt).getTime()
      : 0;
  return Math.max(
    0,
    now.getTime() - new Date(doc.startedAt).getTime() - doc.pausedTotalMs - currentPause,
  );
}

function serializePomodoro(doc: PomodoroDoc, now = new Date()) {
  const elapsed = elapsedMs(doc, now);
  const finished = doc.status === 'completed' || doc.status === 'abandoned';
  return {
    id: String(doc._id),
    mode: doc.mode,
    plannedMinutes: doc.plannedMinutes,
    startedAt: doc.startedAt,
    pausedAt: doc.pausedAt,
    pausedTotalMs: doc.pausedTotalMs,
    status: doc.status,
    completedAt: doc.completedAt,
    focusMinutesEarned: doc.focusMinutesEarned,
    taskId: doc.taskId ? String(doc.taskId) : null,
    subjectId: doc.subjectId ? String(doc.subjectId) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    // Derived from server time so a refresh / logout / device change
    // re-fetches the session and the timer simply continues.
    // Finished sessions always report 0 remaining.
    elapsedMs: elapsed,
    remainingMs: finished ? 0 : Math.max(0, doc.plannedMinutes * 60_000 - elapsed),
  };
}

/** Order: due date first (unscheduled last), then start time (unset last). */
function compareTasks(a: TaskDoc, b: TaskDoc): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.startTime !== b.startTime) {
    if (a.startTime === null) return 1;
    if (b.startTime === null) return -1;
    return a.startTime < b.startTime ? -1 : 1;
  }
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/**
 * Streak rule (also shown in the UI): a day counts when a focus session
 * finishes OR a task is completed. Consecutive days ending today — or
 * yesterday, if today has no activity yet.
 */
async function computeStreak(userId: string): Promise<number> {
  const sessions = await PomodoroSession.find({
    userId,
    status: 'completed',
    mode: 'focus',
    completedAt: { $ne: null },
  }).select('completedAt').lean();
  const tasks = await StudyTask.find({
    userId,
    status: 'Completed',
    completedAt: { $ne: null },
  }).select('completedAt').lean();

  const activeDays = new Set<string>();
  for (const s of sessions) activeDays.add(dateKeyOf(s.completedAt) ?? '');
  for (const t of tasks) activeDays.add(dateKeyOf(t.completedAt) ?? '');
  activeDays.delete('');

  const today = todayKey();
  if (activeDays.size === 0) return 0;

  let cursor = new Date();
  if (!activeDays.has(today)) cursor.setDate(cursor.getDate() - 1);
  if (!activeDays.has(todayKey(cursor))) return 0;

  let streak = 0;
  while (activeDays.has(todayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Server-side rewards for real study events. Points and badges are only
 * ever awarded here — never from a client request — and each award is
 * idempotent, so retries can never double-award. A failure here must
 * never break the task/session response itself.
 */
async function onTaskCompleted(userId: string, taskId: string, completedAt: Date): Promise<void> {
  try {
    await awardPoints(userId, POINT_VALUES.task_completed, 'task_completed', 'StudyTask', taskId);
    const streak = await computeStreak(userId);
    if (streak >= 7) await awardBadge(userId, 'study-streak-7');
    const timezone = await userTimezone(userId);
    await refreshChallengeProgress(userId, dateKeyInTimezone(timezone, completedAt));
  } catch {
    // Rewards must never break the study response.
  }
}

async function onFocusSessionCompleted(
  userId: string,
  sessionId: string,
  completedAt: Date,
): Promise<void> {
  try {
    await awardPoints(
      userId,
      POINT_VALUES.focus_session_completed,
      'focus_session_completed',
      'PomodoroSession',
      sessionId,
    );
    await awardBadge(userId, 'first-focus');
    const streak = await computeStreak(userId);
    if (streak >= 7) await awardBadge(userId, 'study-streak-7');
    const timezone = await userTimezone(userId);
    await refreshChallengeProgress(userId, dateKeyInTimezone(timezone, completedAt));
  } catch {
    // Rewards must never break the Pomodoro response.
  }
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  label: z.string().trim().max(40).optional(),
  colour: z.enum(subjectColours).optional(),
}).strict();

studyRouter.get('/subjects', async (req, res, next) => {
  try {
    const subjects = await StudySubject.find({ userId: req.authUser!.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ subjects: subjects.map(serializeSubject) });
  } catch (error) {
    next(error);
  }
});

studyRouter.post('/subjects', async (req, res, next) => {
  try {
    const parsed = subjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid subject details' });
      return;
    }
    const subject = await StudySubject.create({
      userId: req.authUser!.id,
      name: parsed.data.name,
      label: parsed.data.label ?? '',
      colour: parsed.data.colour ?? 'mint',
    });
    res.status(201).json({ subject: serializeSubject(subject.toObject() as SubjectDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.put('/subjects/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid subject id' });
      return;
    }
    const parsed = subjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid subject details' });
      return;
    }
    const subject = await StudySubject.findOneAndUpdate(
      { _id: req.params.id, userId: req.authUser!.id },
      {
        name: parsed.data.name,
        label: parsed.data.label ?? '',
        colour: parsed.data.colour ?? 'mint',
      },
      { new: true, runValidators: true },
    ).lean();
    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    res.json({ subject: serializeSubject(subject as SubjectDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.delete('/subjects/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid subject id' });
      return;
    }
    const subject = await StudySubject.findOneAndDelete({
      _id: req.params.id,
      userId: req.authUser!.id,
    }).lean();
    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }
    // Deleting a subject unlinks its tasks (subjectId -> null) instead of
    // deleting them; the tasks keep their other details.
    await StudyTask.updateMany(
      { userId: req.authUser!.id, subjectId: subject._id },
      { $set: { subjectId: null } },
    );
    res.json({ message: 'Subject deleted. Its tasks are now unassigned.' });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

const taskSchema = z.object({
  title: z.string().trim().min(1).max(140),
  subjectId: optionalObjectId,
  description: z.string().trim().max(1000).optional(),
  priority: z.enum(taskPriorities).optional(),
  dueDate: optionalDate,
  startTime: optionalTime,
  durationMinutes: z.union([z.number().int().min(1).max(480), z.null()]).optional(),
  status: z.enum(taskStatuses).optional(),
}).strict();

async function subjectBelongsToUser(userId: string, subjectId: string | null | undefined): Promise<boolean> {
  if (!subjectId) return true;
  const subject = await StudySubject.findOne({ _id: subjectId, userId }).select('_id').lean();
  return Boolean(subject);
}

studyRouter.get('/tasks', async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { userId: req.authUser!.id };
    if (typeof req.query.status === 'string' && (taskStatuses as readonly string[]).includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (typeof req.query.subjectId === 'string' && isObjectId(req.query.subjectId)) {
      filter.subjectId = req.query.subjectId;
    }
    if (typeof req.query.dueDate === 'string' && dateSchema.safeParse(req.query.dueDate).success) {
      filter.dueDate = req.query.dueDate;
    }
    const tasks = (await StudyTask.find(filter).lean()) as unknown as TaskDoc[];
    tasks.sort(compareTasks);
    res.json({ tasks: tasks.map((t) => serializeTask(t as TaskDoc)) });
  } catch (error) {
    next(error);
  }
});

studyRouter.post('/tasks', async (req, res, next) => {
  try {
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid task details' });
      return;
    }
    if (!(await subjectBelongsToUser(req.authUser!.id, parsed.data.subjectId))) {
      res.status(400).json({ error: 'Subject not found' });
      return;
    }
    const data = parsed.data;
    const task = await StudyTask.create({
      userId: req.authUser!.id,
      title: data.title,
      subjectId: data.subjectId ?? null,
      description: data.description ?? '',
      priority: data.priority ?? 'Medium',
      dueDate: data.dueDate ?? null,
      startTime: data.startTime ?? null,
      durationMinutes: data.durationMinutes ?? null,
      status: data.status ?? 'Pending',
      completedAt: data.status === 'Completed' ? new Date() : null,
    });
    if (data.status === 'Completed') {
      void onTaskCompleted(req.authUser!.id, String(task._id), new Date());
    }
    res.status(201).json({ task: serializeTask(task.toObject() as TaskDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.get('/tasks/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid task id' });
      return;
    }
    const task = await StudyTask.findOne({ _id: req.params.id, userId: req.authUser!.id }).lean();
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ task: serializeTask(task as TaskDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.put('/tasks/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid task id' });
      return;
    }
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid task details' });
      return;
    }
    if (!(await subjectBelongsToUser(req.authUser!.id, parsed.data.subjectId))) {
      res.status(400).json({ error: 'Subject not found' });
      return;
    }
    const data = parsed.data;
    const existing = await StudyTask.findOne({ _id: req.params.id, userId: req.authUser!.id }).lean();
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const completedAt =
      data.status === 'Completed'
        ? (existing.completedAt ?? new Date())
        : null;
    const task = await StudyTask.findOneAndUpdate(
      { _id: req.params.id, userId: req.authUser!.id },
      {
        title: data.title,
        subjectId: data.subjectId ?? null,
        description: data.description ?? '',
        priority: data.priority ?? 'Medium',
        dueDate: data.dueDate ?? null,
        startTime: data.startTime ?? null,
        durationMinutes: data.durationMinutes ?? null,
        status: data.status ?? existing.status,
        completedAt,
      },
      { new: true, runValidators: true },
    ).lean();
    if (task && data.status === 'Completed' && existing.status !== 'Completed') {
      void onTaskCompleted(req.authUser!.id, String(task._id), task.completedAt ?? new Date());
    }
    res.json({ task: serializeTask(task as TaskDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.patch('/tasks/:id/status', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid task id' });
      return;
    }
    const parsed = z.object({ status: z.enum(taskStatuses) }).strict().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid task status' });
      return;
    }
    const existing = await StudyTask.findOne({ _id: req.params.id, userId: req.authUser!.id }).lean();
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const completedAt =
      parsed.data.status === 'Completed'
        ? (existing.completedAt ?? new Date())
        : null;
    const task = await StudyTask.findOneAndUpdate(
      { _id: req.params.id, userId: req.authUser!.id },
      { status: parsed.data.status, completedAt },
      { new: true, runValidators: true },
    ).lean();
    if (task && parsed.data.status === 'Completed' && existing.status !== 'Completed') {
      void onTaskCompleted(req.authUser!.id, String(task._id), task.completedAt ?? new Date());
    }
    res.json({ task: serializeTask(task as TaskDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.delete('/tasks/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid task id' });
      return;
    }
    const task = await StudyTask.findOneAndDelete({ _id: req.params.id, userId: req.authUser!.id }).lean();
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Today + stats                                                       */
/* ------------------------------------------------------------------ */

studyRouter.get('/today', async (req, res, next) => {
  try {
    const today = todayKey();
    const profile = await Profile.findOne({ userId: req.authUser!.id }).lean();
    const tasks = await StudyTask.find({ userId: req.authUser!.id }).lean();
    const todaysTasks = (tasks as TaskDoc[]).filter((task) => {
      if (task.status === 'Completed') return dateKeyOf(task.completedAt) === today;
      return task.dueDate === null || task.dueDate <= today;
    });
    todaysTasks.sort(compareTasks);
    res.json({
      date: today,
      tasks: todaysTasks.map(serializeTask),
      schedule: {
        collegeStartTime: profile?.collegeStartTime ?? '',
        collegeEndTime: profile?.collegeEndTime ?? '',
        collegeDays: profile?.collegeDays ?? [],
        weeklyOffDays: profile?.weeklyOffDays ?? [],
        weekendSchedule: profile?.weekendSchedule ?? '',
        studyStartTime: profile?.studyStartTime ?? '',
        studyEndTime: profile?.studyEndTime ?? '',
        dailyStudyTarget: profile?.dailyStudyTarget ?? '',
        dailyStudyHours: profile?.dailyStudyHours ?? '',
        studyBreakMinutes: profile?.studyBreakMinutes ?? '',
        preferredStudyDays: profile?.preferredStudyDays ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
});

studyRouter.get('/stats', async (req, res, next) => {
  try {
    const today = startOfDay(new Date());
    const weekStart = startOfDay(new Date());
    weekStart.setDate(weekStart.getDate() - 6);

    const [todaySessions, weekSessions, tasksCompletedToday, allTasks, subjects] = await Promise.all([
      PomodoroSession.find({
        userId: req.authUser!.id,
        status: 'completed',
        mode: 'focus',
        completedAt: { $gte: today },
      }).select('focusMinutesEarned subjectId').lean(),
      PomodoroSession.find({
        userId: req.authUser!.id,
        status: 'completed',
        mode: 'focus',
        completedAt: { $gte: weekStart },
      }).select('focusMinutesEarned subjectId').lean(),
      StudyTask.countDocuments({
        userId: req.authUser!.id,
        status: 'Completed',
        completedAt: { $gte: today },
      }),
      StudyTask.find({ userId: req.authUser!.id }).select('subjectId status').lean(),
      StudySubject.find({ userId: req.authUser!.id }).sort({ createdAt: 1 }).lean(),
    ]);

    const todayFocusMinutes = todaySessions.reduce((sum, s) => sum + (s.focusMinutesEarned ?? 0), 0);
    const weekFocusMinutes = weekSessions.reduce((sum, s) => sum + (s.focusMinutesEarned ?? 0), 0);
    const streak = await computeStreak(req.authUser!.id);

    const weekFocusBySubject = new Map<string, number>();
    for (const s of weekSessions) {
      if (!s.subjectId) continue;
      const key = String(s.subjectId);
      weekFocusBySubject.set(key, (weekFocusBySubject.get(key) ?? 0) + (s.focusMinutesEarned ?? 0));
    }

    const subjectBreakdown = (subjects as SubjectDoc[]).map((subject) => {
      const subjectTasks = allTasks.filter((t) => String(t.subjectId ?? '') === String(subject._id));
      return {
        subjectId: String(subject._id),
        name: subject.name,
        label: subject.label,
        colour: subject.colour,
        tasksDone: subjectTasks.filter((t) => t.status === 'Completed').length,
        tasksTotal: subjectTasks.length,
        focusMinutesWeek: weekFocusBySubject.get(String(subject._id)) ?? 0,
      };
    });

    res.json({
      todayFocusMinutes,
      tasksCompletedToday,
      weekFocusMinutes,
      streak,
      subjectBreakdown,
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Pomodoro                                                            */
/* ------------------------------------------------------------------ */

const pomodoroStartSchema = z.object({
  mode: z.enum(pomodoroModes),
  plannedMinutes: z.number().int().min(1).max(180),
  taskId: optionalObjectId,
  subjectId: optionalObjectId,
}).strict();

studyRouter.post('/pomodoro/start', async (req, res, next) => {
  try {
    const parsed = pomodoroStartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid Pomodoro session details' });
      return;
    }
    const existing = await PomodoroSession.findOne({
      userId: req.authUser!.id,
      status: { $in: ['active', 'paused'] as const },
    }).lean();
    if (existing) {
      res.status(409).json({ error: 'A focus timer is already running. Pause or finish it first.' });
      return;
    }
    if (parsed.data.taskId) {
      const task = await StudyTask.findOne({ _id: parsed.data.taskId, userId: req.authUser!.id }).select('_id').lean();
      if (!task) {
        res.status(400).json({ error: 'Task not found' });
        return;
      }
    }
    if (!(await subjectBelongsToUser(req.authUser!.id, parsed.data.subjectId))) {
      res.status(400).json({ error: 'Subject not found' });
      return;
    }
    const session = await PomodoroSession.create({
      userId: req.authUser!.id,
      mode: parsed.data.mode,
      plannedMinutes: parsed.data.plannedMinutes,
      startedAt: new Date(),
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'active',
      taskId: parsed.data.taskId ?? null,
      subjectId: parsed.data.subjectId ?? null,
    });
    res.status(201).json({ session: serializePomodoro(session.toObject() as PomodoroDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.get('/pomodoro/active', async (req, res, next) => {
  try {
    const session = await PomodoroSession.findOne({
      userId: req.authUser!.id,
      status: { $in: ['active', 'paused'] as const },
    }).sort({ startedAt: -1 }).lean();
    res.json({ session: session ? serializePomodoro(session as PomodoroDoc) : null });
  } catch (error) {
    next(error);
  }
});

studyRouter.get('/pomodoro/history', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const filter = {
      userId: req.authUser!.id,
      status: { $in: ['completed', 'abandoned'] as const },
    };
    const total = await PomodoroSession.countDocuments(filter);
    const sessions = await PomodoroSession.find(filter)
      .sort({ completedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json({
      sessions: sessions.map((s) => serializePomodoro(s as PomodoroDoc)),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

async function findActiveSession(
  req: { authUser?: { id: string }; params: { id: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<PomodoroDoc | null> {
  if (!isObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return null;
  }
  const session = await PomodoroSession.findOne({
    _id: req.params.id,
    userId: req.authUser!.id,
  }).lean();
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  return session as PomodoroDoc;
}

studyRouter.post('/pomodoro/:id/pause', async (req, res, next) => {
  try {
    const session = await findActiveSession(req, res);
    if (!session) return;
    if (session.status !== 'active') {
      res.status(409).json({ error: 'Only a running session can be paused' });
      return;
    }
    const updated = await PomodoroSession.findOneAndUpdate(
      { _id: session._id, userId: req.authUser!.id, status: 'active' },
      { status: 'paused', pausedAt: new Date() },
      { new: true, runValidators: true },
    ).lean();
    res.json({ session: serializePomodoro(updated as PomodoroDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.post('/pomodoro/:id/resume', async (req, res, next) => {
  try {
    const session = await findActiveSession(req, res);
    if (!session) return;
    if (session.status !== 'paused' || !session.pausedAt) {
      res.status(409).json({ error: 'Only a paused session can be resumed' });
      return;
    }
    const pauseMs = Date.now() - new Date(session.pausedAt).getTime();
    const updated = await PomodoroSession.findOneAndUpdate(
      { _id: session._id, userId: req.authUser!.id, status: 'paused' },
      {
        status: 'active',
        pausedAt: null,
        $inc: { pausedTotalMs: Math.max(0, pauseMs) },
      },
      { new: true, runValidators: true },
    ).lean();
    res.json({ session: serializePomodoro(updated as PomodoroDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.post('/pomodoro/:id/complete', async (req, res, next) => {
  try {
    const session = await findActiveSession(req, res);
    if (!session) return;
    if (session.status !== 'active' && session.status !== 'paused') {
      res.status(409).json({ error: 'Only a running or paused session can be completed' });
      return;
    }
    const now = new Date();
    const earned =
      session.mode === 'focus' ? Math.floor(elapsedMs(session, now) / 60_000) : 0;
    const updated = await PomodoroSession.findOneAndUpdate(
      { _id: session._id, userId: req.authUser!.id, status: { $in: ['active', 'paused'] as const } },
      {
        status: 'completed',
        completedAt: now,
        pausedAt: null,
        focusMinutesEarned: earned,
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      res.status(409).json({ error: 'Session was already finished' });
      return;
    }
    if (updated.mode === 'focus') {
      void onFocusSessionCompleted(
        req.authUser!.id,
        String(updated._id),
        updated.completedAt ?? now,
      );
    }
    res.json({ session: serializePomodoro(updated as PomodoroDoc) });
  } catch (error) {
    next(error);
  }
});

studyRouter.post('/pomodoro/:id/abandon', async (req, res, next) => {
  try {
    const session = await findActiveSession(req, res);
    if (!session) return;
    if (session.status !== 'active' && session.status !== 'paused') {
      res.status(409).json({ error: 'Only a running or paused session can be abandoned' });
      return;
    }
    // Abandoned sessions stay in history as `abandoned` with 0 minutes earned.
    const updated = await PomodoroSession.findOneAndUpdate(
      { _id: session._id, userId: req.authUser!.id, status: { $in: ['active', 'paused'] as const } },
      {
        status: 'abandoned',
        completedAt: new Date(),
        pausedAt: null,
        focusMinutesEarned: 0,
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      res.status(409).json({ error: 'Session was already finished' });
      return;
    }
    res.json({ session: serializePomodoro(updated as PomodoroDoc) });
  } catch (error) {
    next(error);
  }
});
