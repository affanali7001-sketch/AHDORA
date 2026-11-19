export type StudySubject = {
  id: string;
  name: string;
  label: string;
  colour: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';

export type StudyTask = {
  id: string;
  title: string;
  subjectId: string | null;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PomodoroMode = 'focus' | 'break';
export type PomodoroStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export type PomodoroSession = {
  id: string;
  mode: PomodoroMode;
  plannedMinutes: number;
  startedAt: string;
  pausedAt: string | null;
  pausedTotalMs: number;
  status: PomodoroStatus;
  completedAt: string | null;
  focusMinutesEarned: number;
  taskId: string | null;
  subjectId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Derived server-side from startedAt + pausedTotalMs; 0 once finished. */
  elapsedMs: number;
  remainingMs: number;
};

export type StudySchedule = {
  collegeStartTime: string;
  collegeEndTime: string;
  collegeDays: string[];
  weeklyOffDays: string[];
  weekendSchedule: string;
  studyStartTime: string;
  studyEndTime: string;
  dailyStudyTarget: string;
  dailyStudyHours: string;
  studyBreakMinutes: string;
  preferredStudyDays: string[];
};

export type TodayResponse = {
  date: string;
  tasks: StudyTask[];
  schedule: StudySchedule;
};

export type SubjectBreakdown = {
  subjectId: string;
  name: string;
  label: string;
  colour: string;
  tasksDone: number;
  tasksTotal: number;
  focusMinutesWeek: number;
};

export type StudyStats = {
  todayFocusMinutes: number;
  tasksCompletedToday: number;
  weekFocusMinutes: number;
  streak: number;
  subjectBreakdown: SubjectBreakdown[];
};

export type PomodoroHistoryResponse = {
  sessions: PomodoroSession[];
  page: number;
  limit: number;
  total: number;
};

export type SubjectInput = {
  name: string;
  label?: string;
  colour?: string;
};

export type TaskInput = {
  title: string;
  subjectId?: string | null;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  status?: TaskStatus;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Study request failed. Please try again.',
    );
  }

  return data as T;
}

/* Subjects */

export async function fetchSubjects(): Promise<StudySubject[]> {
  const result = await request<{ subjects: StudySubject[] }>('/api/study/subjects');
  return result.subjects ?? [];
}

export async function createSubject(input: SubjectInput): Promise<StudySubject> {
  const result = await request<{ subject: StudySubject }>('/api/study/subjects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.subject;
}

export async function updateSubject(id: string, input: SubjectInput): Promise<StudySubject> {
  const result = await request<{ subject: StudySubject }>(`/api/study/subjects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return result.subject;
}

export async function deleteSubject(id: string): Promise<void> {
  await request(`/api/study/subjects/${id}`, { method: 'DELETE' });
}

/* Tasks */

export async function fetchTasks(): Promise<StudyTask[]> {
  const result = await request<{ tasks: StudyTask[] }>('/api/study/tasks');
  return result.tasks ?? [];
}

export async function createTask(input: TaskInput): Promise<StudyTask> {
  const result = await request<{ task: StudyTask }>('/api/study/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.task;
}

export async function updateTask(id: string, input: TaskInput): Promise<StudyTask> {
  const result = await request<{ task: StudyTask }>(`/api/study/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return result.task;
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<StudyTask> {
  const result = await request<{ task: StudyTask }>(`/api/study/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return result.task;
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/api/study/tasks/${id}`, { method: 'DELETE' });
}

/* Today + stats */

export async function fetchToday(): Promise<TodayResponse> {
  return request<TodayResponse>('/api/study/today');
}

export async function fetchStudyStats(): Promise<StudyStats> {
  return request<StudyStats>('/api/study/stats');
}

/* Pomodoro — the server is the source of truth for the timer. */

export async function startPomodoro(input: {
  mode: PomodoroMode;
  plannedMinutes: number;
  taskId?: string | null;
  subjectId?: string | null;
}): Promise<PomodoroSession> {
  const result = await request<{ session: PomodoroSession }>('/api/study/pomodoro/start', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.session;
}

export async function fetchActivePomodoro(): Promise<PomodoroSession | null> {
  const result = await request<{ session: PomodoroSession | null }>('/api/study/pomodoro/active');
  return result.session;
}

export async function pausePomodoro(id: string): Promise<PomodoroSession> {
  const result = await request<{ session: PomodoroSession }>(`/api/study/pomodoro/${id}/pause`, {
    method: 'POST',
  });
  return result.session;
}

export async function resumePomodoro(id: string): Promise<PomodoroSession> {
  const result = await request<{ session: PomodoroSession }>(`/api/study/pomodoro/${id}/resume`, {
    method: 'POST',
  });
  return result.session;
}

export async function completePomodoro(id: string): Promise<PomodoroSession> {
  const result = await request<{ session: PomodoroSession }>(`/api/study/pomodoro/${id}/complete`, {
    method: 'POST',
  });
  return result.session;
}

export async function abandonPomodoro(id: string): Promise<PomodoroSession> {
  const result = await request<{ session: PomodoroSession }>(`/api/study/pomodoro/${id}/abandon`, {
    method: 'POST',
  });
  return result.session;
}

export async function fetchPomodoroHistory(page = 1, limit = 20): Promise<PomodoroHistoryResponse> {
  return request<PomodoroHistoryResponse>(
    `/api/study/pomodoro/history?page=${page}&limit=${limit}`,
  );
}
