
import type { UserProfile } from '../types/profile';
import {
  profileFromApi,
  profileToApi,
  type SavedProfile,
} from '../types/profile';

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
        : 'Profile request failed. Please try again.',
    );
  }

  return data as T;
}

export async function loadProfile(name: string, email: string) {
  const result = await request<{ profile: SavedProfile | null }>('/api/profile');

  if (!result.profile) return null;

  return profileFromApi(result.profile, name, email);
}

export async function saveProfile(profile: UserProfile) {
  const payload = profileToApi(profile);

  const result = await request<{ message: string; profile: SavedProfile }>(
    '/api/profile',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return profileFromApi(result.profile, profile.name, profile.email);
}