import { apiFetch } from './http.js';
/**
 * Quran API client.
 *
 * All Arabic text, transliteration and translation come from the
 * verified upstream (AlQuran Cloud, Tanzil Uthmani text) via the
 * backend — never from the client, never generated. Audio streams
 * directly from EveryAyah; the reciter is always credited.
 */

export type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type QuranAyah = {
  number: number;
  numberInSurah: number;
  text: string;
  transliteration: string;
  translation: string;
  juz: number;
  page: number;
  sajda: boolean;
  audioUrl: string;
};

export type SurahDetail = {
  source: string;
  translation: { edition: string; name: string };
  transliteration: { edition: string; name: string };
  audio: {
    reciter: { id: string; name: string; bitrate: string };
    source: string;
    reciters: { id: string; name: string }[];
  };
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
    ayahs: QuranAyah[];
  };
};

export type QuranBookmark = {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  note: string;
  createdAt: string;
};

export type QuranHistory = {
  dailyTarget: number;
  ayahsOpenedToday: number;
  date: string;
  history: { surahNumber: number; lastAyahNumber: number; lastReadAt: string }[];
};

export type AyahSearchMatch = {
  number: number;
  text: string;
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, { credentials: 'include', ...init });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Quran request failed.');
  }
  return data as T;
}

export async function fetchSurahList(): Promise<{ source: string; surahs: SurahMeta[] }> {
  return request('/api/quran/surahs');
}

export async function fetchSurah(number: number, reciter?: string): Promise<SurahDetail> {
  const query = reciter ? `?reciter=${encodeURIComponent(reciter)}` : '';
  return request(`/api/quran/surahs/${number}${query}`);
}

export async function searchQuran(query: string): Promise<{
  source: string;
  query: string;
  surahs: SurahMeta[];
  ayahs: AyahSearchMatch[];
  ayahSearchError?: string;
}> {
  return request(`/api/quran/search?q=${encodeURIComponent(query)}`);
}

export async function fetchBookmarks(): Promise<{ bookmarks: QuranBookmark[] }> {
  return request('/api/quran/bookmarks');
}

export async function addBookmark(
  surahNumber: number,
  ayahNumber: number,
  note?: string,
): Promise<{ bookmark: QuranBookmark }> {
  return request('/api/quran/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surahNumber, ayahNumber, note: note ?? '' }),
  });
}

export async function deleteBookmark(id: string): Promise<{ deleted: boolean }> {
  return request(`/api/quran/bookmarks/${id}`, { method: 'DELETE' });
}

export async function recordRead(
  surahNumber: number,
  ayahNumber: number,
): Promise<{ recorded: boolean; ayahsAddedToday: number }> {
  return request('/api/quran/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surahNumber, ayahNumber }),
  });
}

export async function fetchQuranHistory(): Promise<QuranHistory> {
  return request('/api/quran/history');
}

export async function setDailyTarget(dailyTarget: number): Promise<{ dailyTarget: number }> {
  return request('/api/quran/target', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyTarget }),
  });
}
