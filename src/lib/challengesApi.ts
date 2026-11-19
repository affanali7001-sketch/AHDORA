export type ChallengeCategory =
  | 'prayers'
  | 'quran'
  | 'study'
  | 'focus'
  | 'sleep'
  | 'discipline';

export type ChallengeTemplate = {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  durationDays: number;
  rules: string[];
  requirement: string;
  auto: boolean;
  joined: boolean;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  durationDays: number;
  kind: 'template' | 'custom';
  templateId: string | null;
  rules: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChallengeParticipation = {
  id: string;
  challengeId: string;
  challenge: Challenge;
  status: 'active' | 'completed' | 'left';
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

export type ChallengeDayProgress = {
  date: string;
  dayNumber: number;
  completed: boolean;
  source: 'salah' | 'study-task' | 'focus-session' | 'self-reported';
};

export type ChallengeDetail = {
  challenge: Challenge;
  participation: ChallengeParticipation | null;
  history: ChallengeParticipation[];
  progress: ChallengeDayProgress[];
  currentDay: number;
  todayCompleted: boolean;
  leaveRule: string;
};

export type ChallengeInput = {
  title: string;
  description?: string;
  category: ChallengeCategory;
  durationDays: number;
  rules: string[];
  consent: true;
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
        : 'Challenge request failed. Please try again.',
    );
  }

  return data as T;
}

export async function fetchTemplates(): Promise<ChallengeTemplate[]> {
  const result = await request<{ templates: ChallengeTemplate[] }>('/api/challenges/templates');
  return result.templates ?? [];
}

export async function fetchMyChallenges(): Promise<{
  active: ChallengeParticipation[];
  history: ChallengeParticipation[];
}> {
  return request<{ active: ChallengeParticipation[]; history: ChallengeParticipation[] }>(
    '/api/challenges/mine',
  );
}

export async function fetchChallengeDetail(id: string): Promise<ChallengeDetail> {
  return request<ChallengeDetail>(`/api/challenges/${id}`);
}

export async function createChallenge(input: ChallengeInput): Promise<{
  challenge: Challenge;
  participation: ChallengeParticipation;
}> {
  return request<{ challenge: Challenge; participation: ChallengeParticipation }>(
    '/api/challenges',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function joinChallenge(id: string): Promise<ChallengeParticipation> {
  const result = await request<{ participation: ChallengeParticipation }>(
    `/api/challenges/${id}/join`,
    { method: 'POST', body: JSON.stringify({ consent: true }) },
  );
  return result.participation;
}

export async function joinTemplate(templateId: string): Promise<{
  challenge: Challenge;
  participation: ChallengeParticipation;
}> {
  return request<{ challenge: Challenge; participation: ChallengeParticipation }>(
    `/api/challenges/templates/${templateId}/join`,
    { method: 'POST', body: JSON.stringify({ consent: true }) },
  );
}

export async function leaveChallenge(id: string): Promise<{
  message: string;
  participation: ChallengeParticipation;
}> {
  return request<{ message: string; participation: ChallengeParticipation }>(
    `/api/challenges/${id}/leave`,
    { method: 'POST' },
  );
}

export async function checkInChallenge(
  id: string,
  date?: string,
): Promise<{
  newlyCompleted: boolean;
  challengeCompleted: boolean;
  message: string;
  participation: ChallengeParticipation;
}> {
  return request(`/api/challenges/${id}/check-in`, {
    method: 'POST',
    body: JSON.stringify(date ? { date } : {}),
  });
}
