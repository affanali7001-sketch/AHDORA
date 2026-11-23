/**
 * Prayer journal — a short personal note after a prayer.
 *
 * Modelled on Mihrab's journal (src/journal/journal.ts: one entry per
 * (date, prayer), notes are private and never leave the device) but
 * re-implemented from scratch for AHDORA: AHDORA already has a server
 * salah record for statuses (prayed/missed/qaza), so this journal
 * stores ONLY the free-text note — the status stays where it is, on
 * the server, and this file never invents or assumes a prayer was
 * prayed. A note with no entry is simply absent; nothing is
 * pre-filled and no entry is ever faked.
 *
 * Storage (per-user AsyncStorage, same key pattern as tasbih.ts /
 * hifz.ts): `prayer:journal:<uid>` → JSON array of PrayerJournalEntry.
 * One entry per (date, prayer); saving a note upserts it, saving an
 * empty note deletes it. All dates are local YYYY-MM-DD.
 *
 * No exported function ever throws.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRAYER_NAMES, type PrayerName } from './apiCore';

export type { PrayerName };

export type PrayerJournalEntry = {
  /** Local YYYY-MM-DD. */
  date: string;
  prayer: PrayerName;
  /** The user's own words, trimmed. Never empty — empty deletes. */
  note: string;
  /** ISO timestamp of the last save. */
  updatedAt: string;
};

const keyFor = (uid: string): string => `prayer:journal:${uid}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_NOTE_LENGTH = 500;

function coerceEntries(input: unknown): PrayerJournalEntry[] {
  if (!Array.isArray(input)) return [];
  const out: PrayerJournalEntry[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) continue;
    if (typeof r.prayer !== 'string' || !PRAYER_NAMES.includes(r.prayer as PrayerName)) continue;
    if (typeof r.note !== 'string' || r.note.trim() === '') continue;
    if (typeof r.updatedAt !== 'string') continue;
    out.push({
      date: r.date,
      prayer: r.prayer as PrayerName,
      note: r.note.slice(0, MAX_NOTE_LENGTH),
      updatedAt: r.updatedAt,
    });
  }
  return out;
}

export async function loadPrayerJournal(uid: string): Promise<PrayerJournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if (!raw) return [];
    return coerceEntries(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

async function storeEntries(uid: string, entries: PrayerJournalEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify(entries));
  } catch {
    // Kept in memory for this session only.
  }
}

/**
 * Save (or delete, when the note is empty) one note. Returns the
 * updated entry list. Never throws.
 */
export async function savePrayerJournalNote(
  uid: string,
  date: string,
  prayer: PrayerName,
  note: string,
): Promise<PrayerJournalEntry[]> {
  const entries = await loadPrayerJournal(uid);
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  const rest = entries.filter((e) => !(e.date === date && e.prayer === prayer));
  const next =
    trimmed === ''
      ? rest
      : [...rest, { date, prayer, note: trimmed, updatedAt: new Date().toISOString() }];
  await storeEntries(uid, next);
  return next;
}

/** Delete one note. Returns the updated entry list. Never throws. */
export async function deletePrayerJournalNote(
  uid: string,
  date: string,
  prayer: PrayerName,
): Promise<PrayerJournalEntry[]> {
  return savePrayerJournalNote(uid, date, prayer, '');
}

export function journalNoteFor(
  entries: PrayerJournalEntry[],
  date: string,
  prayer: PrayerName,
): string {
  return entries.find((e) => e.date === date && e.prayer === prayer)?.note ?? '';
}

export type JournalDayGroup = { date: string; entries: PrayerJournalEntry[] };

/**
 * Entries grouped by date, newest first; each day's entries in
 * prayer order (Fajr → Isha). Empty days never appear.
 */
export function groupJournalByDate(entries: PrayerJournalEntry[]): JournalDayGroup[] {
  const byDate = new Map<string, PrayerJournalEntry[]>();
  for (const entry of entries) {
    const day = byDate.get(entry.date) ?? [];
    day.push(entry);
    byDate.set(entry.date, day);
  }
  const order = new Map(PRAYER_NAMES.map((name, i) => [name, i]));
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries.sort(
        (a, b) => (order.get(a.prayer) ?? 99) - (order.get(b.prayer) ?? 99),
      ),
    }));
}
