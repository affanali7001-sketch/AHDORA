import { apiFetch } from './http.js';
export type Badge = {
  badgeId: string;
  title: string;
  description: string;
  awardedAt: string;
};

export type PointTransaction = {
  id: string;
  amount: number;
  reason:
    | 'focus_session_completed'
    | 'task_completed'
    | 'challenge_day_completed'
    | 'challenge_completed';
  createdAt: string;
};

export type RewardsSummary = {
  total: number;
  badges: Badge[];
  recent: PointTransaction[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
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
        : 'Rewards request failed. Please try again.',
    );
  }

  return data as T;
}

export async function fetchRewardsSummary(): Promise<RewardsSummary> {
  return request<RewardsSummary>('/api/rewards/summary');
}

export async function fetchPointsHistory(
  page = 1,
  limit = 20,
): Promise<{
  transactions: (PointTransaction & { refType: string })[];
  page: number;
  limit: number;
  total: number;
}> {
  return request(`/api/rewards/history?page=${page}&limit=${limit}`);
}
