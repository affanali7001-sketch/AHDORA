import { apiFetch } from './http.js';

import type { UserProfile } from '../types/profile';
import {
  profileFromApi,
  profileToApi,
  type SavedProfile,
} from '../types/profile';

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
    // Keep the server's per-field errors (e.g. the completion check
    // naming a missing city/state) in the message the UI shows, so a
    // 400 never degrades to a bare "Invalid profile details".
    const details = (data as { details?: Record<string, string[] | undefined> }).details;
    const detailMessages = details
      ? Object.values(details).flatMap((messages) => messages ?? [])
      : [];
    const base =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Profile request failed. Please try again.';
    throw new Error(
      detailMessages.length > 0 && !detailMessages.every((message) => base.includes(message))
        ? `${base} ${detailMessages.join(' ')}`
        : base,
    );
  }

  return data as T;
}

export async function loadProfile(name: string, email: string) {
  const loaded = await loadProfileWithCompletion(name, email);
  return loaded ? loaded.profile : null;
}

/**
 * Load the saved profile together with its onboarding summary, exactly
 * as GET /api/profile returns it:
 *   { profile, onboarding: { status: 'not-started' | 'in-progress' |
 *     'skipped' | 'completed', step: 0-8, completed: boolean,
 *     skipped: boolean } }
 * The summary is preferred; the profile's own onboardingCompleted flag
 * is the fallback. Profiles saved before the flag existed are treated
 * as completed.
 */
export async function loadProfileWithCompletion(
  name: string,
  email: string,
): Promise<{
  profile: UserProfile;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingSkipped: boolean;
} | null> {
  const result = await request<{
    profile: SavedProfile | null;
    onboarding?: {
      status: string;
      step: number;
      completed: boolean;
      skipped: boolean;
    };
  }>('/api/profile');

  if (!result.profile) return null;

  const summary = result.onboarding;
  return {
    profile: profileFromApi(result.profile, name, email),
    onboardingCompleted: summary
      ? summary.completed
      : result.profile.onboardingCompleted !== false,
    onboardingStep: summary && Number.isInteger(summary.step) ? summary.step : 0,
    onboardingSkipped: summary ? summary.skipped : false,
  };
}

/**
 * Skip-save: persist whatever the user has filled in so far and record
 * the skip exactly as the backend contract specifies:
 *   POST /api/profile { ..., onboardingSkipped: true,
 *     onboardingStep: <0-8, the step they were on> }
 * The backend marks onboarding.status 'skipped' with that step as the
 * resume point. Saving any other field later clears a previous skip,
 * and completing onboarding clears it and pins step 8 — so this
 * function must ONLY be used for a skip (or for a save that must keep
 * an incomplete profile incomplete, e.g. the Focus sleep save).
 */
export async function saveProfilePartial(profile: UserProfile, step = 0) {
  const resumeStep = Math.min(8, Math.max(0, Math.floor(step) || 0));
  const payload = {
    ...profileToApi(profile),
    onboardingCompleted: false,
    onboardingSkipped: true,
    onboardingStep: resumeStep,
  };

  const result = await request<{ message: string; profile: SavedProfile }>(
    '/api/profile',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return profileFromApi(result.profile, profile.name, profile.email);
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