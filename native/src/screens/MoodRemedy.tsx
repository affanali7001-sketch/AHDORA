/**
 * Mood Remedy — "How are you feeling?" check-in.
 *
 * Pick a mood → one verified Quran-based remedy at a time (ayah, dua
 * or dhikr), with Play (ayah audio via the Quran audio manager), Copy,
 * Next (non-repeating) and Favorite. One check-in per day is logged
 * (a second check-in the same day replaces today's mood); favorites
 * and history are per-user AsyncStorage (see src/lib/moodRemedy.ts).
 * Nothing is faked: empty states when there is no history/favorite.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Chip, EmptyState, PillButton } from '../components/ui';
import {
  MOODS,
  globalAyahStart,
  loadCheckins,
  loadFavorites,
  moodById,
  nextRemedyIndex,
  remedyById,
  saveCheckin,
  saveFavorites,
  todayDateKey,
  type Mood,
  type MoodCheckin,
  type MoodId,
  type MoodRemedy,
} from '../lib/moodRemedy';
import {
  getQuranAudioState,
  startLifeAyah,
  subscribeQuranAudio,
  toggleQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    todayCard: string;
    notCheckedIn: string;
    checkedInToday: (mood: string) => string;
    chooseMood: string;
    remedyFor: (mood: string) => string;
    play: string;
    pause: string;
    copy: string;
    copied: string;
    next: string;
    favorites: string;
    noFavorites: string;
    history: string;
    noHistory: string;
    fullAyah: string;
    hideFull: string;
    ayahTag: string;
    duaTag: string;
    dhikrTag: string;
  }
> = {
  en: {
    title: 'Mood Remedy',
    subtitle: 'How are you feeling? Tap a mood and get a Quran-based remedy.',
    todayCard: 'Today',
    notCheckedIn: 'You have not checked in today yet.',
    checkedInToday: (mood) => `Today you feel ${mood}.`,
    chooseMood: 'Choose how you feel',
    remedyFor: (mood) => `Remedy for ${mood}`,
    play: '▶ Play',
    pause: '❚❚ Pause',
    copy: 'Copy',
    copied: 'Copied!',
    next: 'Next remedy →',
    favorites: 'Favorites',
    noFavorites: 'No favorites yet. Tap the heart on a remedy to save it here.',
    history: 'Mood history',
    noHistory: 'No check-ins yet. Your moods will appear here.',
    fullAyah: 'Read full ayah',
    hideFull: 'Hide full ayah',
    ayahTag: 'Quran Ayah',
    duaTag: 'Dua',
    dhikrTag: 'Dhikr',
  },
  hi: {
    title: 'Mood Remedy',
    subtitle: 'Aaj kaisa mehsoos ho raha hai? Mood chuno aur Quran se ilaaj pao.',
    todayCard: 'Aaj',
    notCheckedIn: 'Aaj abhi check-in nahi kiya.',
    checkedInToday: (mood) => `Aaj aap ${mood} mehsoos kar rahe hain.`,
    chooseMood: 'Kaisa mehsoos ho raha hai, chuno',
    remedyFor: (mood) => `${mood} ke liye ilaaj`,
    play: '▶ Suno',
    pause: '❚❚ Roko',
    copy: 'Copy karo',
    copied: 'Copy ho gaya!',
    next: 'Agla ilaaj →',
    favorites: 'Pasandida',
    noFavorites: 'Abhi koi pasandida nahi. Kisi ilaaj par dil dabao to yahan save hoga.',
    history: 'Mood history',
    noHistory: 'Abhi koi check-in nahi. Aapke mood yahan dikhenge.',
    fullAyah: 'Poori ayat padhein',
    hideFull: 'Poori ayat chhupayein',
    ayahTag: 'Quran ki Ayat',
    duaTag: 'Dua',
    dhikrTag: 'Dhikr',
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateKey(key: string): string {
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  const day = Number(parts[2]);
  const month = MONTHS[Number(parts[1]) - 1] ?? '';
  return `${day} ${month} ${parts[0]}`;
}

function remedyTitle(r: MoodRemedy): string {
  return r.kind === 'ayah' ? `Mood Remedy · ${r.reference}` : `Mood Remedy · ${r.title}`;
}

function remedyCopyText(r: MoodRemedy): string {
  if (r.kind === 'ayah') {
    const full = r.fullArabic ? `${r.arabic}\n\n${r.fullArabic}` : r.arabic;
    const fullTr = r.fullTranslation ? `${r.translation}\n\n${r.fullTranslation}` : r.translation;
    return `${full}\n${fullTr}\n— ${r.reference}`;
  }
  return `${r.arabic}\n${r.transliteration}\n${r.meaning}\n— ${r.source}`;
}

export default function MoodRemedyScreen({ lang, user }: ScreenProps) {
  const s = STRINGS[lang];
  const uid = user?.id ?? 'anon';
  const today = todayDateKey();

  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
  const [remedyIndex, setRemedyIndex] = useState(0);
  const [shown, setShown] = useState<number[]>([0]);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showFullId, setShowFullId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());

  useEffect(() => subscribeQuranAudio(setAudio), []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadCheckins(uid), loadFavorites(uid)]).then(([c, f]) => {
      if (!active) return;
      setCheckins(c);
      setFavorites(f);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [uid]);

  const mood: Mood | null = selectedMood ? moodById(selectedMood) : null;
  const remedy: MoodRemedy | null =
    mood && mood.remedies.length > 0 ? mood.remedies[remedyIndex % mood.remedies.length] : null;
  const todayEntry = checkins.find((c) => c.date === today) ?? null;
  const favoriteRemedies = useMemo(
    () => favorites.map((id) => remedyById(id)).filter((r): r is MoodRemedy => r !== null),
    [favorites],
  );

  function moodLabel(m: Mood): string {
    return lang === 'hi' ? m.labelHi : m.labelEn;
  }

  function selectMood(id: MoodId): void {
    setSelectedMood(id);
    setRemedyIndex(0);
    setShown([0]);
    setShowFullId(null);
    const entry: MoodCheckin = { date: today, mood: id };
    setCheckins((prev) => {
      const next = [entry, ...prev.filter((e) => e.date !== today)];
      next.sort((a, b) => (a.date < b.date ? 1 : -1));
      return next;
    });
    void saveCheckin(uid, entry);
  }

  function handleNext(): void {
    if (!mood) return;
    const next = nextRemedyIndex(mood.remedies.length, remedyIndex, shown);
    setRemedyIndex(next);
    setShown((prev) => [...prev, next]);
    setShowFullId(null);
  }

  function toggleFavorite(id: string): void {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    void saveFavorites(uid, next);
  }

  async function handleCopy(r: MoodRemedy): Promise<void> {
    try {
      await Clipboard.setStringAsync(remedyCopyText(r));
      setCopiedId(r.id);
      setTimeout(() => setCopiedId((cur) => (cur === r.id ? null : cur)), 2000);
    } catch {
      /* Clipboard unavailable — the button simply does nothing. */
    }
  }

  async function handlePlay(r: MoodRemedy): Promise<void> {
    if (r.kind !== 'ayah') return;
    const title = remedyTitle(r);
    if (audio.playing && audio.title === title) {
      toggleQuranAudio();
      return;
    }
    try {
      await startLifeAyah(
        r.surah,
        r.ayahStart,
        r.ayahEnd,
        globalAyahStart(r.surah, r.ayahStart),
        'tilawat',
        title,
      );
    } catch {
      /* Audio errors surface through the manager's own state. */
    }
  }

  function renderRemedyCard(r: MoodRemedy, opts: { showNext: boolean }): ReactNode {
    const isFav = favorites.includes(r.id);
    const isAyah = r.kind === 'ayah';
    const tag = isAyah ? s.ayahTag : r.kind === 'dhikr' ? s.dhikrTag : s.duaTag;
    const playingThis = isAyah && audio.playing && audio.title === remedyTitle(r);
    const ref = isAyah ? r.reference : r.source;
    return (
      <Card key={r.id} style={styles.remedyCard}>
        <View style={styles.remedyHead}>
          <Chip label={tag} tone="teal" />
          <Text style={styles.refText}>{ref}</Text>
          <Pressable
            onPress={() => toggleFavorite(r.id)}
            accessibilityRole="button"
            accessibilityLabel={s.favorites}
            hitSlop={8}
          >
            <Text style={[styles.heart, isFav && styles.heartOn]}>{isFav ? '♥' : '♡'}</Text>
          </Pressable>
        </View>
        {isAyah && r.quoteNote ? <Text style={styles.quoteNote}>{r.quoteNote}</Text> : null}
        <Text style={styles.arabicText}>{r.arabic}</Text>
        {!isAyah ? <Text style={styles.translit}>{r.transliteration}</Text> : null}
        <Text style={styles.translation}>{isAyah ? r.translation : r.meaning}</Text>
        {isAyah && r.fullArabic ? (
          <View>
            <Pressable
              onPress={() => setShowFullId((cur) => (cur === r.id ? null : r.id))}
              hitSlop={6}
            >
              <Text style={styles.fullToggle}>
                {showFullId === r.id ? s.hideFull : s.fullAyah}
              </Text>
            </Pressable>
            {showFullId === r.id ? (
              <View>
                <Text style={styles.arabicText}>{r.fullArabic}</Text>
                <Text style={styles.translation}>{r.fullTranslation}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.actions}>
          {isAyah ? (
            <PillButton
              label={playingThis ? s.pause : s.play}
              variant="primary"
              small
              onPress={() => void handlePlay(r)}
            />
          ) : null}
          <PillButton
            label={copiedId === r.id ? s.copied : s.copy}
            variant="soft"
            small
            onPress={() => void handleCopy(r)}
          />
          {opts.showNext ? (
            <PillButton label={s.next} variant="peach" small onPress={handleNext} />
          ) : null}
        </View>
        {isAyah && audio.error && playingThis ? (
          <Text style={T.error}>{audio.error}</Text>
        ) : null}
      </Card>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.title}</Text>
      <Text style={T.sub}>{s.subtitle}</Text>

      {!loaded ? (
        <ActivityIndicator color={C.teal700} style={{ marginTop: 24 }} />
      ) : (
        <View>
          <Card style={styles.todayCard}>
            <Text style={T.label}>{s.todayCard}</Text>
            {todayEntry ? (
              <Text style={styles.todayText}>
                {moodById(todayEntry.mood).emoji} {s.checkedInToday(moodLabel(moodById(todayEntry.mood)))}
              </Text>
            ) : (
              <Text style={T.cardBody}>{s.notCheckedIn}</Text>
            )}
          </Card>

          <Text style={[T.h2, styles.sectionTitle]}>{s.chooseMood}</Text>
          <View style={styles.moodGrid}>
            {MOODS.map((m) => {
              const active = selectedMood === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => selectMood(m.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.moodChip,
                    active && styles.moodChipActive,
                    pressed && styles.moodChipPressed,
                  ]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>
                    {moodLabel(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mood && remedy ? (
            <View>
              <Text style={[T.h2, styles.sectionTitle]}>{s.remedyFor(moodLabel(mood))}</Text>
              {renderRemedyCard(remedy, { showNext: true })}
            </View>
          ) : null}

          <Text style={[T.h2, styles.sectionTitle]}>{s.favorites}</Text>
          {favoriteRemedies.length === 0 ? (
            <EmptyState title={s.favorites} body={s.noFavorites} />
          ) : (
            favoriteRemedies.map((r) => renderRemedyCard(r, { showNext: false }))
          )}

          <Text style={[T.h2, styles.sectionTitle]}>{s.history}</Text>
          {checkins.length === 0 ? (
            <EmptyState title={s.history} body={s.noHistory} />
          ) : (
            checkins.map((c) => {
              const m = moodById(c.mood);
              return (
                <Card key={c.date} style={styles.historyRow}>
                  <Text style={styles.historyEmoji}>{m.emoji}</Text>
                  <Text style={styles.historyLabel}>{moodLabel(m)}</Text>
                  <Text style={styles.historyDate}>{formatDateKey(c.date)}</Text>
                </Card>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  sectionTitle: { marginTop: 22, marginBottom: 10 },
  todayCard: { marginTop: 16 },
  todayText: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 4 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodChip: {
    width: '31%',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  moodChipActive: { backgroundColor: C.teal900, borderColor: C.teal900 },
  moodChipPressed: { opacity: 0.85 },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontFamily: F.sans, fontSize: 12.5, fontWeight: '700', color: C.ink, textAlign: 'center' },
  moodLabelActive: { color: C.white },
  remedyCard: { gap: 10 },
  remedyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refText: { flex: 1, fontFamily: F.sans, fontSize: 12.5, fontWeight: '700', color: C.teal700 },
  heart: { fontSize: 24, color: C.muted, lineHeight: 28 },
  heartOn: { color: C.red },
  quoteNote: { fontFamily: F.sans, fontSize: 12, fontWeight: '700', color: C.peachInk },
  arabicText: {
    fontFamily: F.arabic,
    fontSize: 22,
    lineHeight: 36,
    color: C.ink,
    textAlign: 'right',
  },
  translit: { fontFamily: F.sans, fontSize: 13.5, fontStyle: 'italic', color: C.muted, lineHeight: 20 },
  translation: { fontFamily: F.sans, fontSize: 14.5, color: C.teal700, lineHeight: 22 },
  fullToggle: { fontFamily: F.sans, fontSize: 13, fontWeight: '700', color: C.teal500, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    marginBottom: 8,
  },
  historyEmoji: { fontSize: 20 },
  historyLabel: { flex: 1, fontFamily: F.sans, fontSize: 14.5, fontWeight: '700', color: C.ink },
  historyDate: { fontFamily: F.sans, fontSize: 12.5, color: C.muted },
});
