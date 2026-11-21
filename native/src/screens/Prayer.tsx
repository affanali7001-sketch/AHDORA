/**
 * Prayer — today's prayer times from the live API, with
 * Prayed / Missed / Qaza marking (PUT /api/salah/day/:date) and the
 * manual time editor (per-prayer overrides + deadlines, saved to
 * the profile). Never assumes a prayer was prayed.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, S, T } from '../lib/theme';
import { Card, Chip, EmptyState, PillButton, SectionTitle } from '../components/ui';
import {
  fetchPrayerSettings,
  fetchPrayerTimes,
  fetchSalahDay,
  formatTime12h,
  savePrayerSettings,
  todayKey,
  updateSalahStatus,
  PRAYER_NAMES,
  type PrayerName,
  type PrayerRecord,
  type PrayerSettings,
  type PrayerTimesResponse,
  type SalahStatus,
} from '../lib/apiCore';

export default function PrayerScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const today = todayKey();
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [day, setDay] = useState<PrayerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<PrayerName | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PrayerSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingTimes, setSavingTimes] = useState(false);
  const [timesMessage, setTimesMessage] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([fetchPrayerTimes(today), fetchSalahDay(today)]).then(
      ([timesResult, dayResult]) => {
        if (!active) return;
        if (timesResult.status === 'fulfilled') setTimes(timesResult.value);
        if (dayResult.status === 'fulfilled') setDay(dayResult.value);
        if (timesResult.status === 'rejected' && dayResult.status === 'rejected') {
          setError(s.loadFailed);
        } else if (timesResult.status === 'rejected') {
          setError(
            timesResult.reason instanceof Error ? timesResult.reason.message : s.loadFailed,
          );
        }
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [s.loadFailed, today]);

  useEffect(load, [load]);

  async function mark(prayer: PrayerName, status: SalahStatus) {
    if (saving) return;
    if (status === 'pending') return;
    setSaving(prayer);
    setError('');
    try {
      const updated = await updateSalahStatus(today, prayer, status);
      setDay(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.statusSaveFailed);
    } finally {
      setSaving(null);
    }
  }

  async function openEditor() {
    if (editorOpen) {
      setEditorOpen(false);
      return;
    }
    setEditorOpen(true);
    setTimesMessage('');
    if (draft) return;
    setSettingsLoading(true);
    try {
      setDraft(await fetchPrayerSettings());
    } catch (e) {
      setTimesMessage(e instanceof Error ? e.message : s.settingsLoadFailed);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveTimes() {
    if (!draft) return;
    setSavingTimes(true);
    setTimesMessage('');
    try {
      await savePrayerSettings(draft);
      setTimesMessage(s.timesSaved);
      const refreshed = await fetchPrayerTimes(today).catch(() => null);
      if (refreshed) setTimes(refreshed);
    } catch (e) {
      setTimesMessage(e instanceof Error ? e.message : s.timesSaveFailed);
    } finally {
      setSavingTimes(false);
    }
  }

  function statusLabel(prayer: PrayerName): string {
    const entry = day?.[prayer];
    if (!entry) return s.statusPending;
    if (entry.status === 'missed' && entry.autoMissed) return s.statusMissedAuto;
    if (entry.status === 'qaza' && entry.wasMissed) return s.statusQazaWasMissed;
    if (entry.status === 'prayed') return s.statusPrayed;
    if (entry.status === 'missed') return s.statusMissed;
    if (entry.status === 'qaza') return s.statusQaza;
    return s.statusPending;
  }

  function statusTone(prayer: PrayerName): 'teal' | 'red' | 'peach' | 'muted' {
    const entry = day?.[prayer];
    if (!entry) return 'muted';
    if (entry.status === 'prayed') return 'teal';
    if (entry.status === 'missed') return 'red';
    if (entry.status === 'qaza') return 'peach';
    return 'muted';
  }

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.eyebrow}>{s.prayerTitle}</Text>
      <Text style={[T.title, { marginTop: 6 }]}>{s.prayerTitle}</Text>
      <Text style={[T.sub, { marginBottom: 18 }]}>{s.prayerSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginVertical: 24 }} />
      ) : times ? (
        <View>
          <Card>
            <Text style={T.cardBody}>
              {times.city}
              {times.country ? `, ${times.country}` : ''} · {times.method}
            </Text>
            {times.notice ? (
              <Text style={[T.cardBody, { marginTop: 6, color: C.peachDeep }]}>
                {times.notice}
              </Text>
            ) : null}
          </Card>

          {PRAYER_NAMES.map((prayer) => {
            const per = times.perPrayer[prayer];
            const time = per?.time ?? times.timings[prayer] ?? '';
            const deadline = per?.deadline ?? '';
            const source = per?.source ?? 'calculated';
            const entry = day?.[prayer];
            const isNext = times.nextPrayer?.name === prayer;
            return (
              <Card key={prayer}>
                <View style={styles.prayerHead}>
                  <View>
                    <Text style={styles.prayerName}>
                      {prayer}
                      {isNext ? ` · ${s.nextPrayer}` : ''}
                    </Text>
                    <Text style={styles.prayerTime}>{formatTime12h(time)}</Text>
                    {deadline ? (
                      <Text style={T.cardBody}>
                        {s.deadline}: {formatTime12h(deadline)}
                      </Text>
                    ) : null}
                  </View>
                  <Chip
                    label={
                      source === 'manual'
                        ? s.sourceManual
                        : source === 'unavailable'
                          ? s.sourceUnavailable
                          : s.sourceCalculated
                    }
                    tone={statusTone(prayer)}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color:
                      entry?.status === 'prayed'
                        ? C.teal2
                        : entry?.status === 'missed'
                          ? C.red
                          : entry?.status === 'qaza'
                            ? C.peachDeep
                            : C.muted,
                    marginTop: 8,
                    marginBottom: 10,
                  }}
                >
                  {statusLabel(prayer)}
                </Text>
                <View style={styles.markRow}>
                  {(['prayed', 'missed', 'qaza'] as SalahStatus[]).map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => mark(prayer, status)}
                      disabled={saving === prayer}
                      style={[
                        styles.markBtn,
                        entry?.status === status && styles.markBtnOn,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: entry?.status === status }}
                    >
                      <Text
                        style={[
                          styles.markBtnText,
                          entry?.status === status && styles.markBtnTextOn,
                        ]}
                      >
                        {status === 'prayed'
                          ? s.statusPrayed
                          : status === 'missed'
                            ? s.statusMissed
                            : s.statusQaza}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {saving === prayer ? (
                  <ActivityIndicator color={C.teal} style={{ marginTop: 8 }} />
                ) : null}
              </Card>
            );
          })}

          <Text style={[T.note, { marginBottom: 16 }]}>{s.prayerTimesNote}</Text>

          {/* Manual time editor */}
          <SectionTitle title={s.editTimesTitle} sub={s.editTimesSub} />
          <PillButton
            label={editorOpen ? s.cancel : s.editTimesTitle}
            variant="ghost"
            onPress={openEditor}
          />
          {editorOpen ? (
            <Card>
              {settingsLoading ? (
                <ActivityIndicator color={C.teal} />
              ) : draft ? (
                <View>
                  {PRAYER_NAMES.map((prayer) => (
                    <View key={prayer} style={styles.editorBox}>
                      <Text style={styles.prayerName}>{prayer}</Text>
                      <Text style={T.label}>{s.timeOverride}</Text>
                      <TextInput
                        style={L.input}
                        value={draft[prayer].timeOverride}
                        onChangeText={(v) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  [prayer]: { ...prev[prayer], timeOverride: v },
                                }
                              : prev,
                          )
                        }
                        placeholder="HH:mm"
                        placeholderTextColor={C.muted}
                        autoCapitalize="none"
                      />
                      <Text style={T.label}>{s.endTime}</Text>
                      <TextInput
                        style={L.input}
                        value={draft[prayer].endTime}
                        onChangeText={(v) =>
                          setDraft((prev) =>
                            prev
                              ? { ...prev, [prayer]: { ...prev[prayer], endTime: v } }
                              : prev,
                          )
                        }
                        placeholder="HH:mm"
                        placeholderTextColor={C.muted}
                        autoCapitalize="none"
                      />
                    </View>
                  ))}
                  <PillButton
                    label={s.save}
                    onPress={saveTimes}
                    busy={savingTimes}
                    disabled={savingTimes}
                  />
                </View>
              ) : null}
              {timesMessage ? <Text style={T.note}>{timesMessage}</Text> : null}
            </Card>
          ) : null}
        </View>
      ) : (
        <EmptyState title={s.prayerTitle} body={s.loadFailed} />
      )}

      {error ? <Text style={T.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  prayerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  prayerName: { fontSize: 17, fontWeight: '800', color: C.ink },
  prayerTime: { fontSize: 22, fontWeight: '800', color: C.teal900, marginTop: 4 },
  markRow: { flexDirection: 'row', gap: 8 },
  markBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    paddingVertical: 10,
    alignItems: 'center',
  },
  markBtnOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  markBtnText: { fontSize: 13, fontWeight: '800', color: C.teal },
  markBtnTextOn: { color: C.white },
  editorBox: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: S.radiusSm,
    padding: 12,
    marginBottom: 12,
  },
});
