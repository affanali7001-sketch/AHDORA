/**
 * API clients for the growth & social screens (friends, challenges,
 * rewards, notifications, study, salah, profile).
 *
 * All calls go through apiFetch from ./api — same CSRF + manual cookie
 * jar as the verified login client. Response shapes were read from the
 * live web repo (~/workspace/ahdora/repo/api/src/routes/*); nothing
 * here invents an endpoint. Every function throws an Error carrying
 * the server's message (or the network message) on failure.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, serverErrorMessage } from './api';

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const err = (data as { error?: unknown }).error;
    if (typeof err === 'string' && err.length > 0) return err;
  }
  return fallback;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const data = await parseJson<T>(response);
  if (!response.ok) {
    // No error text from the server (e.g. a Heroku 500 with an HTML
    // body) now reports the real HTTP status instead of the bare
    // "Request failed. Please try again." that hid the cause.
    throw new Error(errorMessage(data, serverErrorMessage(response.status)));
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

/** The ONLY shape in which another user is ever exposed: id + name + initial (+ total points where the server provides it). */
export type PublicUser = { id: string; name: string; initial: string; points?: number };

export type FriendRequestItem = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  direction: 'incoming' | 'outgoing';
  other: PublicUser | null;
  createdAt: string;
};

export type ChallengeTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  durationDays: number;
  rules: string[];
  requirement: string;
  auto: boolean;
  joined: boolean;
};

export type ChallengeParticipation = {
  id: string;
  challengeId: string;
  challenge: {
    id: string;
    title: string;
    description: string;
    category: string;
    durationDays: number;
    kind: string;
    templateId: string | null;
    rules: string[];
  };
  status: string;
  joinedAt: string;
  completedAt: string | null;
  leftAt: string | null;
  completedDays: number;
  totalDays: number;
  currentDay: number;
  streak: number;
  pointsEarned: number;
  todayCompleted: boolean;
  leaveRule: string;
};

export type ChallengeInvite = {
  id: string;
  challengeId: string;
  challenge: { id: string; title: string; category: string; durationDays: number } | null;
  fromUserId: string;
  toUserId: string;
  status: string;
  direction: 'incoming' | 'outgoing';
  other: PublicUser | null;
  createdAt: string;
};

export type RewardsSummary = {
  total: number;
  badges: { badgeId: string; title: string; description: string; awardedAt: string }[];
  recent: { id: string; amount: number; reason: string; createdAt: string }[];
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  refType: string;
  refId: string;
  read: boolean;
  createdAt: string;
};

export type NotificationCategories = {
  prayer: boolean;
  study: boolean;
  sleep: boolean;
  challenge: boolean;
  friend: boolean;
  system: boolean;
};

export type NotificationSettings = {
  categories: NotificationCategories;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type StudySubject = {
  id: string;
  name: string;
  label: string;
  colour: string;
};

export type StudyTask = {
  id: string;
  title: string;
  subjectId: string | null;
  description: string;
  priority: string;
  dueDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  status: string;
  completedAt: string | null;
};

export type StudyStats = {
  todayFocusMinutes: number;
  tasksCompletedToday: number;
  weekFocusMinutes: number;
  streak: number;
  subjectBreakdown: {
    subjectId: string;
    name: string;
    label: string;
    colour: string;
    tasksDone: number;
    tasksTotal: number;
    focusMinutesWeek: number;
  }[];
};

export type PomodoroSession = {
  id: string;
  mode: string;
  plannedMinutes: number;
  startedAt: string;
  pausedAt: string | null;
  pausedTotalMs: number;
  status: string;
  completedAt: string | null;
  focusMinutesEarned: number;
  taskId: string | null;
  subjectId: string | null;
  elapsedMs: number;
  remainingMs: number;
};

export type ProfileData = {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  sleepTime?: string;
  sleepStartTime?: string;
  sleepEndTime?: string;
  sleepReminder?: boolean;
  dailyStudyTarget?: string;
  dailyStudyHours?: string;
  [key: string]: unknown;
};

export type SalahCalendarDay = {
  date: string;
  // The server returns prayers as an OBJECT keyed by prayer name
  // ({ Fajr: { status, ... }, Dhuhr: {...}, ... }), NOT an array.
  // (The old array type here crashed Analytics: d.prayers.filter on an
  // object is "undefined is not a function".)
  prayers: Record<string, { status: string; updatedAt: string | null; wasMissed: boolean }>;
};

/* ------------------------------------------------------------------ */
/* Friends                                                             */
/* ------------------------------------------------------------------ */

export async function discoverPeople(limit = 10): Promise<PublicUser[]> {
  const data = await call<{ users: PublicUser[] }>(`/api/friends/discover?limit=${limit}`);
  return data.users ?? [];
}

export async function searchPeople(query: string): Promise<PublicUser[]> {
  const data = await call<{ users: PublicUser[] }>(
    `/api/friends/search?q=${encodeURIComponent(query)}`,
  );
  return data.users ?? [];
}

export async function listFriends(): Promise<(PublicUser & { since: string })[]> {
  const data = await call<{ friends: (PublicUser & { since: string })[] }>('/api/friends');
  return data.friends ?? [];
}

export async function listFriendRequests(): Promise<{
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}> {
  const data = await call<{ incoming: FriendRequestItem[]; outgoing: FriendRequestItem[] }>(
    '/api/friends/requests',
  );
  return { incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] };
}

export async function sendFriendRequest(toUserId: string): Promise<FriendRequestItem> {
  const data = await call<{ request: FriendRequestItem }>('/api/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ toUserId }),
  });
  return data.request;
}

export async function acceptFriendRequest(id: string): Promise<void> {
  await call(`/api/friends/requests/${encodeURIComponent(id)}/accept`, { method: 'POST' });
}

export async function rejectFriendRequest(id: string): Promise<void> {
  await call(`/api/friends/requests/${encodeURIComponent(id)}/reject`, { method: 'POST' });
}

export async function cancelFriendRequest(id: string): Promise<void> {
  await call(`/api/friends/requests/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export async function removeFriend(friendId: string): Promise<void> {
  await call(`/api/friends/${encodeURIComponent(friendId)}`, { method: 'DELETE' });
}

export async function listChallengeInvites(): Promise<{
  incoming: ChallengeInvite[];
  outgoing: ChallengeInvite[];
}> {
  const data = await call<{ incoming: ChallengeInvite[]; outgoing: ChallengeInvite[] }>(
    '/api/friends/invites',
  );
  return { incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] };
}

export async function acceptChallengeInvite(id: string): Promise<void> {
  await call(`/api/friends/invites/${encodeURIComponent(id)}/accept`, { method: 'POST' });
}

export async function declineChallengeInvite(id: string): Promise<void> {
  await call(`/api/friends/invites/${encodeURIComponent(id)}/decline`, { method: 'POST' });
}

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

export async function listChallengeTemplates(): Promise<ChallengeTemplate[]> {
  const data = await call<{ templates: ChallengeTemplate[] }>('/api/challenges/templates');
  return data.templates ?? [];
}

export async function myChallenges(): Promise<{
  active: ChallengeParticipation[];
  history: ChallengeParticipation[];
}> {
  const data = await call<{ active: ChallengeParticipation[]; history: ChallengeParticipation[] }>(
    '/api/challenges/mine',
  );
  return { active: data.active ?? [], history: data.history ?? [] };
}

export async function joinTemplate(templateId: string): Promise<ChallengeParticipation> {
  const data = await call<{ participation: ChallengeParticipation }>(
    `/api/challenges/templates/${encodeURIComponent(templateId)}/join`,
    { method: 'POST' },
  );
  return data.participation;
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  await call(`/api/challenges/${encodeURIComponent(challengeId)}/leave`, { method: 'POST' });
}

export async function checkInChallenge(
  challengeId: string,
): Promise<{ newlyCompleted: boolean; challengeCompleted: boolean; message: string }> {
  const data = await call<{
    newlyCompleted: boolean;
    challengeCompleted: boolean;
    message: string;
  }>(`/api/challenges/${encodeURIComponent(challengeId)}/check-in`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return data;
}

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

export async function rewardsSummary(): Promise<RewardsSummary> {
  return call<RewardsSummary>('/api/rewards/summary');
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export async function listNotifications(
  page = 1,
): Promise<{ notifications: AppNotification[]; total: number; unread: number }> {
  const data = await call<{
    notifications: AppNotification[];
    total: number;
    unread: number;
  }>(`/api/notifications?page=${page}&limit=20`);
  return {
    notifications: data.notifications ?? [],
    total: data.total ?? 0,
    unread: data.unread ?? 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await call(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await call('/api/notifications/read-all', { method: 'POST' });
}

export async function deleteNotification(id: string): Promise<void> {
  await call(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const data = await call<{ settings: NotificationSettings }>('/api/notifications/settings');
  return data.settings;
}

export async function updateNotificationSettings(
  settings: Partial<NotificationSettings> & {
    categories?: Partial<NotificationCategories>;
  },
): Promise<void> {
  await call('/api/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/* ------------------------------------------------------------------ */
/* Study + Pomodoro                                                    */
/* ------------------------------------------------------------------ */

export async function listSubjects(): Promise<StudySubject[]> {
  const data = await call<{ subjects: StudySubject[] }>('/api/study/subjects');
  return data.subjects ?? [];
}

export async function createSubject(name: string): Promise<StudySubject> {
  const data = await call<{ subject: StudySubject }>('/api/study/subjects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.subject;
}

/**
 * Delete a subject for real (server-side, per-user). The server
 * unlinks the subject's tasks (subjectId -> null) instead of
 * deleting them — the tasks stay, just unassigned.
 */
export async function deleteSubject(id: string): Promise<void> {
  await call(`/api/study/subjects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listTasks(): Promise<StudyTask[]> {
  const data = await call<{ tasks: StudyTask[] }>('/api/study/tasks');
  return data.tasks ?? [];
}

export async function createTask(input: {
  title: string;
  subjectId?: string | null;
  priority?: string;
  dueDate?: string | null;
}): Promise<StudyTask> {
  const data = await call<{ task: StudyTask }>('/api/study/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.task;
}

export async function setTaskStatus(id: string, status: string): Promise<StudyTask> {
  const data = await call<{ task: StudyTask }>(`/api/study/tasks/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return data.task;
}

export async function studyStats(): Promise<StudyStats> {
  return call<StudyStats>('/api/study/stats');
}

export async function pomodoroStart(
  plannedMinutes: number,
  subjectId?: string | null,
): Promise<PomodoroSession> {
  const data = await call<{ session: PomodoroSession }>('/api/study/pomodoro/start', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'focus',
      plannedMinutes,
      subjectId: subjectId ?? null,
      taskId: null,
    }),
  });
  return data.session;
}

export async function pomodoroActive(): Promise<PomodoroSession | null> {
  const data = await call<{ session: PomodoroSession | null }>('/api/study/pomodoro/active');
  return data.session;
}

export async function pomodoroPause(id: string): Promise<PomodoroSession> {
  const data = await call<{ session: PomodoroSession }>(
    `/api/study/pomodoro/${encodeURIComponent(id)}/pause`,
    { method: 'POST' },
  );
  return data.session;
}

export async function pomodoroResume(id: string): Promise<PomodoroSession> {
  const data = await call<{ session: PomodoroSession }>(
    `/api/study/pomodoro/${encodeURIComponent(id)}/resume`,
    { method: 'POST' },
  );
  return data.session;
}

export async function pomodoroComplete(id: string): Promise<PomodoroSession> {
  const data = await call<{ session: PomodoroSession }>(
    `/api/study/pomodoro/${encodeURIComponent(id)}/complete`,
    { method: 'POST' },
  );
  return data.session;
}

export async function pomodoroAbandon(id: string): Promise<PomodoroSession> {
  const data = await call<{ session: PomodoroSession }>(
    `/api/study/pomodoro/${encodeURIComponent(id)}/abandon`,
    { method: 'POST' },
  );
  return data.session;
}

/* ------------------------------------------------------------------ */
/* Salah + profile (for Analytics / Sleep / Profile)                   */
/* ------------------------------------------------------------------ */

export async function getProfile(): Promise<{
  profile: ProfileData | null;
  onboarding: { status: string; step: number; completed: boolean; skipped: boolean };
}> {
  const result = await call<{
    profile: ProfileData | null;
    onboarding: { status: string; step: number; completed: boolean; skipped: boolean };
  }>('/api/profile');
  // Cache the last good copy on the device: when the server call
  // fails (slow network / transient 500 — the intermittent
  // "Request failed" on Run #48), the Profile and Sleep screens
  // show this saved copy with a "refresh failed" note instead of
  // a blank error screen. A cache write never breaks the call.
  void cacheProfile(result).catch(() => undefined);
  return result;
}

/** Last successfully fetched profile, for the offline fallback. */
const PROFILE_CACHE_KEY = '@ahdora/profile/cache';

async function cacheProfile(result: {
  profile: ProfileData | null;
  onboarding: { status: string; step: number; completed: boolean; skipped: boolean };
}): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(result));
  } catch {
    // Cache is best-effort only.
  }
}

/**
 * The saved profile copy, or null when nothing was ever fetched
 * successfully. Callers show it with a "refresh failed" note —
 * never as if it were fresh server data.
 */
export async function loadCachedProfile(): Promise<{
  profile: ProfileData | null;
  onboarding: { status: string; step: number; completed: boolean; skipped: boolean };
} | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as {
      profile?: unknown;
      onboarding?: { status: string; step: number; completed: boolean; skipped: boolean };
    };
    if (!p.onboarding || typeof p.onboarding !== 'object') return null;
    return {
      profile: (p.profile ?? null) as ProfileData | null,
      onboarding: p.onboarding,
    };
  } catch {
    return null;
  }
}

export async function salahCalendar(
  month: string,
): Promise<{ days: SalahCalendarDay[]; totals: Record<string, number> }> {
  const data = await call<{ days: SalahCalendarDay[]; totals: Record<string, number> }>(
    `/api/salah/calendar/${encodeURIComponent(month)}`,
  );
  return { days: data.days ?? [], totals: data.totals ?? {} };
}

/* ------------------------------------------------------------------ */
/* Support & feedback (Profile → Support & Feedback). The server      */
/* endpoint is real (repo api/src/routes/feedback.ts): POST creates    */
/* one row (status 'open'), GET lists only the caller's own rows,     */
/* newest first. Subject 3–140 chars, message 3–2000 chars.           */
/* ------------------------------------------------------------------ */

export type FeedbackType = 'feedback' | 'complaint';

export type FeedbackItem = {
  id: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export async function submitFeedback(input: {
  type: FeedbackType;
  subject: string;
  message: string;
}): Promise<FeedbackItem> {
  const data = await call<{ feedback: FeedbackItem }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.feedback;
}

export async function listFeedback(): Promise<FeedbackItem[]> {
  const data = await call<{ feedback: FeedbackItem[] }>('/api/feedback?limit=20');
  return data.feedback ?? [];
}
