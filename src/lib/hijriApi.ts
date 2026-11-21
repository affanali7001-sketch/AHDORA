import { apiFetch } from './http.js';
/**
 * Hijri calendar API client. All dates come from Aladhan
 * (Umm al-Qura calendar); the day adjustment is the user's own
 * setting for local moon-sighting differences.
 */

export type HijriDay = {
  gregorian: { date: string; weekday: string };
  hijri: {
    date: string;
    day: string;
    month: { number: number; en: string; ar: string; days: number };
    year: string;
    holidays: string[];
  };
  isToday: boolean;
};

export type HijriToday = {
  source: string;
  convention: string;
  gregorian: { date: string };
  hijri: {
    date: string;
    day: string;
    month: { number: number; en: string; ar: string };
    year: string;
    holidays: string[];
  };
  adjustmentDays: number;
};

export type HijriMonth = {
  source: string;
  convention: string;
  year: number;
  month: number;
  adjustmentDays: number;
  hijriMonths: string[];
  days: HijriDay[];
};

/**
 * Friendly login prompts. The API's raw 401 string ('Authentication
 * required') must NEVER be rendered inside a card — a guest, or a
 * user whose session lives in another browser, sees a clear login
 * prompt instead. Today/month are public since Phase 15, so a 401
 * there is unreachable in practice; the mapping below is defence in
 * depth for settings (still authed) and any future regression.
 */
export const HIJRI_LOGIN_REQUIRED_MESSAGE = 'Please log in to see your Hijri calendar.';
export const HIJRI_SETTINGS_LOGIN_REQUIRED_MESSAGE = 'Please log in to save your Hijri day adjustment.';

/** True when an error is one of the friendly login prompts above (lets a screen render a login action instead of an error line). */
export function isHijriLoginRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === HIJRI_LOGIN_REQUIRED_MESSAGE ||
      error.message === HIJRI_SETTINGS_LOGIN_REQUIRED_MESSAGE)
  );
}

function friendlyError(status: number, serverMessage: string | undefined, authMessage: string): string {
  if (status === 401 || serverMessage === 'Authentication required') return authMessage;
  return serverMessage || 'Hijri request failed.';
}

async function request<T>(path: string, init?: RequestInit, authMessage: string = HIJRI_LOGIN_REQUIRED_MESSAGE): Promise<T> {
  const response = await apiFetch(path, { credentials: 'include', ...init });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(
      friendlyError(response.status, typeof data.error === 'string' ? data.error : undefined, authMessage),
    );
  }
  return data as T;
}

export async function fetchHijriToday(): Promise<HijriToday> {
  return request('/api/hijri/today');
}

export async function fetchHijriMonth(year: number, month: number): Promise<HijriMonth> {
  return request(`/api/hijri/month?year=${year}&month=${month}`);
}

export async function fetchHijriSettings(): Promise<{
  hijriDayOffset: number;
  source: string;
  convention: string;
}> {
  return request('/api/hijri/settings', undefined, HIJRI_SETTINGS_LOGIN_REQUIRED_MESSAGE);
}

export async function setHijriOffset(hijriDayOffset: number): Promise<{ hijriDayOffset: number }> {
  return request(
    '/api/hijri/settings',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hijriDayOffset }),
    },
    HIJRI_SETTINGS_LOGIN_REQUIRED_MESSAGE,
  );
}
