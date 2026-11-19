import { apiFetch } from './http.js';
/**
 * Friends + challenge invites API client.
 *
 * Privacy note: the server only ever returns another user as
 * { id, name, initial } and shared challenge progress as
 * { challenge name, current day / total, completed days, progress,
 * points earned }. There is no call here that can fetch another
 * user's tasks, Salah records, study stats, profile, or points.
 */

export type PublicUser = {
  id: string;
  name: string;
  initial: string;
};

export type Friend = PublicUser & {
  since: string;
};

export type FriendRequestItem = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  direction: 'incoming' | 'outgoing';
  other: PublicUser | null;
  createdAt: string;
  updatedAt: string;
};

export type ChallengeInvite = {
  id: string;
  challengeId: string;
  challenge: {
    id: string;
    title: string;
    category: string;
    durationDays: number;
  } | null;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  direction: 'incoming' | 'outgoing';
  other: PublicUser | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedProgress = {
  currentDay: number;
  totalDays: number;
  completedDays: number;
  pointsEarned: number;
  status: string;
};

export type SharedChallenge = {
  challengeId: string;
  challengeTitle: string;
  category: string;
  mine: SharedProgress;
  friend: SharedProgress;
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
        : 'Friends request failed. Please try again.',
    );
  }

  return data as T;
}

export async function searchUsers(query: string): Promise<PublicUser[]> {
  const result = await request<{ users: PublicUser[] }>(
    `/api/friends/search?q=${encodeURIComponent(query)}`,
  );
  return result.users ?? [];
}

export async function fetchFriends(): Promise<Friend[]> {
  const result = await request<{ friends: Friend[] }>('/api/friends');
  return result.friends ?? [];
}

export async function fetchFriendRequests(): Promise<{
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}> {
  return request<{ incoming: FriendRequestItem[]; outgoing: FriendRequestItem[] }>(
    '/api/friends/requests',
  );
}

export async function sendFriendRequest(toUserId: string): Promise<FriendRequestItem> {
  const result = await request<{ request: FriendRequestItem }>('/api/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ toUserId }),
  });
  return result.request;
}

export async function acceptFriendRequest(id: string): Promise<FriendRequestItem> {
  const result = await request<{ request: FriendRequestItem }>(
    `/api/friends/requests/${id}/accept`,
    { method: 'POST' },
  );
  return result.request;
}

export async function rejectFriendRequest(id: string): Promise<FriendRequestItem> {
  const result = await request<{ request: FriendRequestItem }>(
    `/api/friends/requests/${id}/reject`,
    { method: 'POST' },
  );
  return result.request;
}

export async function cancelFriendRequest(id: string): Promise<FriendRequestItem> {
  const result = await request<{ request: FriendRequestItem }>(
    `/api/friends/requests/${id}/cancel`,
    { method: 'POST' },
  );
  return result.request;
}

export async function removeFriend(friendId: string): Promise<void> {
  await request(`/api/friends/${friendId}`, { method: 'DELETE' });
}

export async function fetchInvites(): Promise<{
  incoming: ChallengeInvite[];
  outgoing: ChallengeInvite[];
}> {
  return request<{ incoming: ChallengeInvite[]; outgoing: ChallengeInvite[] }>(
    '/api/friends/invites',
  );
}

export async function sendChallengeInvite(
  challengeId: string,
  toUserId: string,
): Promise<ChallengeInvite> {
  const result = await request<{ invite: ChallengeInvite }>('/api/friends/invites', {
    method: 'POST',
    body: JSON.stringify({ challengeId, toUserId }),
  });
  return result.invite;
}

export async function acceptChallengeInvite(id: string): Promise<ChallengeInvite> {
  const result = await request<{ invite: ChallengeInvite }>(
    `/api/friends/invites/${id}/accept`,
    { method: 'POST', body: JSON.stringify({ consent: true }) },
  );
  return result.invite;
}

export async function declineChallengeInvite(id: string): Promise<ChallengeInvite> {
  const result = await request<{ invite: ChallengeInvite }>(
    `/api/friends/invites/${id}/decline`,
    { method: 'POST' },
  );
  return result.invite;
}

export async function fetchSharedChallenges(friendId: string): Promise<{
  friend: PublicUser;
  shared: SharedChallenge[];
}> {
  return request<{ friend: PublicUser; shared: SharedChallenge[] }>(
    `/api/friends/${friendId}/shared-challenges`,
  );
}
