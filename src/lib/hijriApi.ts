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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, { credentials: 'include', ...init });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Hijri request failed.');
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
  return request('/api/hijri/settings');
}

export async function setHijriOffset(hijriDayOffset: number): Promise<{ hijriDayOffset: number }> {
  return request('/api/hijri/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hijriDayOffset }),
  });
}
