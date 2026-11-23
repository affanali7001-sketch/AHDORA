/**
 * Prayer journal — a short personal note after a prayer.
 *
 * Today: one row per prayer (Fajr → Isha) with a text box. Saving a
 * note stores it for that (date, prayer); clearing the text and
 * saving deletes it. History below shows earlier days, newest first,
 * each with a delete button. Real data only: an empty journal shows
 * the empty state, never a sample note.
 *
 * Notes live in per-user AsyncStorage (see src/lib/prayerJournal.ts)
 * — the prayer STATUS (prayed/missed/qaza) is untouched here; it
 * stays on the server, marked from the Prayer screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, EmptyState, PillButton } from '../components/ui';
import { PRAYER_NAMES, todayKey, type PrayerName } from '../lib/apiCore';
import {
  deletePrayerJournalNote,
  groupJournalByDate,
  journalNoteFor,
  loadPrayerJournal,
  MAX_NOTE_LENGTH,
  savePrayerJournalNote,
  type PrayerJournalEntry,
} from '../lib/prayerJournal';

export default function PrayerJournalScreen({ lang, user }: ScreenProps) {
  const s = stringsFor(lang);
  const uid = user?.id ?? 'anon';
  const today = todayKey();
  const [entries, setEntries] = useState<PrayerJournalEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<PrayerName, string>>({
    Fajr: '',
    Dhuhr: '',
    Asr: '',
    Maghrib: '',
    Isha: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<PrayerName | null>(null);
  const [savedMark, setSavedMark] = useState<PrayerName | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const loaded = await loadPrayerJournal(uid);
    setEntries(loaded);
    setDrafts({
      Fajr: journalNoteFor(loaded, today, 'Fajr'),
      Dhuhr: journalNoteFor(loaded, today, 'Dhuhr'),
      Asr: journalNoteFor(loaded, today, 'Asr'),
      Maghrib: journalNoteFor(loaded, today, 'Maghrib'),
      Isha: journalNoteFor(loaded, today, 'Isha'),
    });
    setLoading(false);
  }, [uid, today]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNote(prayer: PrayerName) {
    if (saving) return;
    setSaving(prayer);
    setError('');
    try {
      const next = await savePrayerJournalNote(uid, today, prayer, drafts[prayer]);
      setEntries(next);
      setSavedMark(prayer);
      setTimeout(() => setSavedMark((cur) => (cur === prayer ? null : cur)), 2000);
    } catch {
      setError(s.statusSaveFailed);
    } finally {
      setSaving(null);
    }
  }

  async function deleteNote(date: string, prayer: PrayerName) {
    setError('');
    const next = await deletePrayerJournalNote(uid, date, prayer);
    setEntries(next);
    if (date === today) {
      setDrafts((cur) => ({ ...cur, [prayer]: '' }));
    }
  }

  const history = groupJournalByDate(entries).filter((g) => g.date !== today);
  const hasToday = PRAYER_NAMES.some((p) => journalNoteFor(entries, today, p) !== '');

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.journalTitle}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{s.journalSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : (
        <View>
          <Card>
            <Text style={T.cardTitle}>{s.journalToday}</Text>
            {PRAYER_NAMES.map((prayer, index) => {
              const saved = journalNoteFor(entries, today, prayer);
              const dirty = drafts[prayer] !== saved;
              return (
                <View
                  key={prayer}
                  style={[styles.row, index < PRAYER_NAMES.length - 1 && styles.rowBorder]}
                >
                  <Text style={styles.rowName}>{prayer}</Text>
                  <TextInput
                    style={styles.input}
                    value={drafts[prayer]}
                    onChangeText={(v) => setDrafts((cur) => ({ ...cur, [prayer]: v }))}
                    placeholder={s.journalPlaceholder}
                    placeholderTextColor={C.muted}
                    multiline
                    maxLength={MAX_NOTE_LENGTH}
                    editable={saving !== prayer}
                  />
                  <PillButton
                    label={
                      saving === prayer
                        ? '…'
                        : savedMark === prayer
                          ? s.journalSaved
                          : s.journalSave
                    }
                    small
                    variant={dirty ? 'primary' : 'ghost'}
                    disabled={!dirty || saving === prayer}
                    onPress={() => void saveNote(prayer)}
                  />
                </View>
              );
            })}
          </Card>
          <Text style={[T.note, { marginBottom: 16, textAlign: 'left' }]}>
            {s.journalNoteHint}
          </Text>

          {entries.length === 0 && !hasToday ? (
            <EmptyState title={s.journalTitle} body={s.journalEmpty} />
          ) : history.length === 0 ? null : (
            <View>
              <Text style={[T.cardTitle, { marginBottom: 8 }]}>{s.journalHistory}</Text>
              {history.map((group) => (
                <Card key={group.date}>
                  <Text style={styles.dateHead}>{group.date}</Text>
                  {group.entries.map((entry) => (
                    <View key={entry.prayer} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyPrayer}>{entry.prayer}</Text>
                        <Text style={styles.historyNote}>{entry.note}</Text>
                      </View>
                      <PillButton
                        label={s.journalDelete}
                        small
                        variant="ghost"
                        onPress={() => void deleteNote(group.date, entry.prayer)}
                      />
                    </View>
                  ))}
                </Card>
              ))}
            </View>
          )}
        </View>
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    gap: 8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowName: {
    fontFamily: F.sans,
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  input: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.ice,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  dateHead: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '800',
    color: C.teal700,
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  historyPrayer: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },
  historyNote: {
    fontFamily: F.sans,
    fontSize: 13.5,
    color: C.muted,
    lineHeight: 19,
    marginTop: 2,
  },
});
