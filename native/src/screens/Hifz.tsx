/**
 * Hifz — Quran memorisation tracker with spaced-repetition revision.
 *
 * - Grid of all 114 surahs (real list from AlQuran Cloud via
 *   fetchSurahList — no hardcoded surah names or ayah counts).
 *   Tapping a surah opens a panel to mark the whole surah, or a
 *   portion of it (ayah range), as memorised.
 * - Revision ladder 1 → 3 → 7 → 14 → 30 days (see src/lib/hifz.ts).
 *   After reciting from memory the user says how it went —
 *   Needed help (back to 1 day), Fine (next interval), Fluent
 *   (skip one interval) — capped at 30 days.
 * - "Daily revision" tab: units due today (due date <= today),
 *   each with a Recite-from-memory check-off. Honest empty state
 *   when nothing is due.
 * - Everything persists per user in AsyncStorage (`hifz:items:<uid>`,
 *   uid or 'anon' — same convention as tasbih.ts). The summary
 *   counts only what was actually recorded; nothing is pre-filled.
 * Strings are local (EN + HI), following Tasbeeh.tsx — nothing
 * was added to src/lib/strings.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import {
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  PillButton,
  SectionTitle,
  SegmentedControl,
} from '../components/ui';
import { fetchSurahList, type MushafSurahRef } from '../lib/apiWorship';
import {
  dueToday,
  isWholeSurahMemorised,
  itemsForSurah,
  loadHifz,
  markMemorised,
  recordReview,
  removeItem,
  summarise,
  saveHifz,
  todayDateKey,
  type HifzItem,
  type HifzResult,
} from '../lib/hifz';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    summary: (surahs: number, due: number) => string;
    summarySub: (units: number, reviews: number) => string;
    dueTab: string;
    allTab: string;
    dueTitle: string;
    dueEmptyTitle: string;
    dueEmptyBody: string;
    allTitle: string;
    searchPlaceholder: string;
    loading: string;
    loadError: string;
    retry: string;
    tapHint: string;
    markTitle: string;
    ayahFrom: string;
    ayahTo: string;
    markButton: string;
    wholeSurah: string;
    portion: (a: number, b: number) => string;
    alreadyWhole: string;
    savedPortions: string;
    remove: string;
    recite: string;
    howDidItGo: string;
    help: string;
    fine: string;
    fluent: string;
    reviewed: (name: string, days: number, date: string) => string;
    dueToday: string;
    overdue: (n: number) => string;
    nextDue: (date: string) => string;
    memorised: string;
    notMemorised: string;
    reviews: (n: number) => string;
    invalidRange: (max: number) => string;
    noMatch: string;
    close: string;
  }
> = {
  en: {
    title: 'Hifz',
    subtitle: 'Memorise the Quran, one surah at a time — and revise on time so it stays.',
    summary: (surahs, due) => `${surahs} surah${surahs === 1 ? '' : 's'} memorised · ${due} due today`,
    summarySub: (units, reviews) => `${units} memorised portion${units === 1 ? '' : 's'} · ${reviews} revision${reviews === 1 ? '' : 's'} recorded`,
    dueTab: 'Daily revision',
    allTab: 'All surahs',
    dueTitle: 'Due for revision today',
    dueEmptyTitle: 'Nothing due today',
    dueEmptyBody: 'No revision is due. Mark a surah as memorised below and it will appear here when its revision day comes.',
    allTitle: 'All 114 surahs',
    searchPlaceholder: 'Search by name or number…',
    loading: 'Loading surahs…',
    loadError: 'Could not load the surah list. Check your internet and try again.',
    retry: 'Try again',
    tapHint: 'Tap a surah to mark it memorised or see its revision status.',
    markTitle: 'Mark as memorised',
    ayahFrom: 'From ayah',
    ayahTo: 'To ayah',
    markButton: 'Mark as memorised',
    wholeSurah: 'Whole surah',
    portion: (a, b) => `Ayahs ${a}–${b}`,
    alreadyWhole: 'Whole surah already memorised.',
    savedPortions: 'Memorised portions',
    remove: 'Remove',
    recite: 'Recite from memory',
    howDidItGo: 'How did it go?',
    help: 'Needed help',
    fine: 'Fine',
    fluent: 'Fluent',
    reviewed: (name, days, date) => `${name} reviewed — next revision in ${days} day${days === 1 ? '' : 's'} (${date}).`,
    dueToday: 'Due today',
    overdue: (n) => `Overdue by ${n} day${n === 1 ? '' : 's'}`,
    nextDue: (date) => `Next: ${date}`,
    memorised: 'Memorised',
    notMemorised: 'Not memorised',
    reviews: (n) => `${n} revision${n === 1 ? '' : 's'}`,
    invalidRange: (max) => `Ayah range galat hai — 1 se ${max} ke beech likho.`,
    noMatch: 'No surah matches that search.',
    close: 'Close',
  },
  hi: {
    title: 'Hifz',
    subtitle: 'Quran yaad karo, ek surah ek baar mein — aur waqt par dohrao taaki yaad rahe.',
    summary: (surahs, due) => `${surahs} surah yaad · ${due} aaj dohrani hai`,
    summarySub: (units, reviews) => `${units} hissa yaad · ${reviews} dohraai darj hai`,
    dueTab: 'Aaj ki dohraai',
    allTab: 'Sab surahs',
    dueTitle: 'Aaj dohrane ke liye',
    dueEmptyTitle: 'Aaj kuch dohrana nahi hai',
    dueEmptyBody: 'Koi dohraai due nahi hai. Neeche kisi surah ko yaad mark karo — uski dohraai ka din aayega to yahan dikhegi.',
    allTitle: 'Sab 114 surahs',
    searchPlaceholder: 'Naam ya number se dhoondho…',
    loading: 'Surahs load ho rahi hain…',
    loadError: 'Surah list load nahi ho payi. Internet check karke dobara try karo.',
    retry: 'Dobara try karo',
    tapHint: 'Surah par dabao — yaad mark karo ya uski dohraai ki halat dekho.',
    markTitle: 'Yaad mark karo',
    ayahFrom: 'Ayah se',
    ayahTo: 'Ayah tak',
    markButton: 'Yaad mark karo',
    wholeSurah: 'Poori surah',
    portion: (a, b) => `Ayah ${a}–${b}`,
    alreadyWhole: 'Poori surah pehle se yaad hai.',
    savedPortions: 'Yaad kiye gaye hisse',
    remove: 'Hatao',
    recite: 'Yaad se sunao',
    howDidItGo: 'Kaisa raha?',
    help: 'Madad chahiye thi',
    fine: 'Theek tha',
    fluent: 'Rawaan tha',
    reviewed: (name, days, date) => `${name} dohra li — agli dohraai ${days} din baad (${date}).`,
    dueToday: 'Aaj due hai',
    overdue: (n) => `${n} din se due hai`,
    nextDue: (date) => `Agli: ${date}`,
    memorised: 'Yaad hai',
    notMemorised: 'Yaad nahi',
    reviews: (n) => `${n} dohraai`,
    invalidRange: (max) => `Ayah range galat hai — 1 se ${max} ke beech likho.`,
    noMatch: 'Is khoj se koi surah nahi mili.',
    close: 'Band karo',
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-23" → "23 Nov 2026" (local date, no timezone shift). */
function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`;
}

/** Whole days between two local date keys (positive = overdue). */
function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const from = new Date(fy, (fm || 1) - 1, fd || 1).getTime();
  const to = new Date(ty, (tm || 1) - 1, td || 1).getTime();
  return Math.round((to - from) / 86400000);
}

type Tab = 'due' | 'all';

export default function HifzScreen({ lang, user }: ScreenProps) {
  const s = STRINGS[lang];
  const uid = user?.id ?? 'anon';
  const today = todayDateKey();

  const [surahs, setSurahs] = useState<MushafSurahRef[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [surahsError, setSurahsError] = useState(false);
  const [items, setItems] = useState<HifzItem[]>([]);
  const [tab, setTab] = useState<Tab>('due');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [fromText, setFromText] = useState('1');
  const [toText, setToText] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [recitingId, setRecitingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const surahByNumber = useMemo(() => {
    const map = new Map<number, MushafSurahRef>();
    for (const su of surahs) map.set(su.number, su);
    return map;
  }, [surahs]);

  const summary = useMemo(() => summarise(items, today), [items, today]);
  const due = useMemo(() => dueToday(items, today), [items, today]);

  function loadSurahs(): void {
    setSurahsLoading(true);
    setSurahsError(false);
    fetchSurahList()
      .then((list) => setSurahs(list))
      .catch(() => setSurahsError(true))
      .finally(() => setSurahsLoading(false));
  }

  // Surah list (live, AlQuran Cloud) + this user's stored units.
  useEffect(() => {
    let active = true;
    loadSurahs();
    void loadHifz(uid).then((stored) => {
      if (active) setItems(stored);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  function persist(next: HifzItem[]): void {
    setItems(next);
    void saveHifz(uid, next);
  }

  const selectedSurah = selected != null ? surahByNumber.get(selected) : undefined;
  const selectedItems = selected != null ? itemsForSurah(items, selected) : [];
  const wholeDone =
    selected != null &&
    selectedSurah != null &&
    isWholeSurahMemorised(items, selected, selectedSurah.numberOfAyahs);

  function openSurah(n: number): void {
    const su = surahByNumber.get(n);
    setSelected(n);
    setRangeError('');
    setFromText('1');
    setToText(su ? String(su.numberOfAyahs) : '');
    setTab('all');
  }

  function handleMark(): void {
    if (selected == null || !selectedSurah) return;
    const max = selectedSurah.numberOfAyahs;
    const from = Number(fromText.trim());
    const to = Number(toText.trim());
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > max || from > to) {
      setRangeError(s.invalidRange(max));
      return;
    }
    setRangeError('');
    persist(markMemorised(items, selected, from, to, max, today));
  }

  function handleReview(item: HifzItem, result: HifzResult): void {
    const next = recordReview(items, item.id, result, today);
    persist(next);
    setRecitingId(null);
    const updated = next.find((it) => it.id === item.id);
    const name = surahByNumber.get(item.surahNumber)?.englishName ?? `Surah ${item.surahNumber}`;
    if (updated) {
      setReviewNote(s.reviewed(name, updated.intervalDays, formatDateKey(updated.nextDue)));
    }
  }

  function surahLabel(n: number): string {
    const su = surahByNumber.get(n);
    return su ? `${su.number}. ${su.englishName}` : `Surah ${n}`;
  }

  function rangeLabel(item: HifzItem): string {
    const su = surahByNumber.get(item.surahNumber);
    if (su && item.ayahStart === 1 && item.ayahEnd === su.numberOfAyahs) return s.wholeSurah;
    return s.portion(item.ayahStart, item.ayahEnd);
  }

  function dueLabel(item: HifzItem): string {
    if (item.nextDue === today) return s.dueToday;
    if (item.nextDue < today) return s.overdue(daysBetween(item.nextDue, today));
    return s.nextDue(formatDateKey(item.nextDue));
  }

  const filteredSurahs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(
      (su) =>
        su.englishName.toLowerCase().includes(q) ||
        su.name.includes(query.trim()) ||
        String(su.number) === q,
    );
  }, [surahs, query]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.title}</Text>
      <Text style={T.sub}>{s.subtitle}</Text>

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLine}>{s.summary(summary.surahsMemorised, summary.dueTodayCount)}</Text>
        <Text style={styles.summarySub}>{s.summarySub(summary.unitsMemorised, summary.totalReviews)}</Text>
        {reviewNote ? <Text style={styles.reviewNote}>{reviewNote}</Text> : null}
      </Card>

      <SegmentedControl<Tab>
        options={[
          { label: s.dueTab, value: 'due' },
          { label: s.allTab, value: 'all' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'due' ? (
        <View style={styles.section}>
          <SectionTitle title={s.dueTitle} />
          {due.length === 0 ? (
            <EmptyState title={s.dueEmptyTitle} body={s.dueEmptyBody} />
          ) : (
            due.map((item) => {
              const open = recitingId === item.id;
              return (
                <Card key={item.id}>
                  <View style={styles.dueHead}>
                    <View style={styles.dueHeadText}>
                      <Text style={T.cardTitle}>{surahLabel(item.surahNumber)}</Text>
                      <Text style={T.cardBody}>{rangeLabel(item)}</Text>
                    </View>
                    <Text style={styles.dueBadge}>{dueLabel(item)}</Text>
                  </View>
                  <Text style={styles.dueMeta}>{s.reviews(item.reviewCount)}</Text>
                  {open ? (
                    <View>
                      <Text style={styles.howLabel}>{s.howDidItGo}</Text>
                      <View style={styles.resultRow}>
                        <PillButton label={s.help} variant="soft" small onPress={() => handleReview(item, 'help')} />
                        <PillButton label={s.fine} variant="ghost" small onPress={() => handleReview(item, 'fine')} />
                        <PillButton label={s.fluent} variant="primary" small onPress={() => handleReview(item, 'fluent')} />
                      </View>
                    </View>
                  ) : (
                    <PillButton
                      label={s.recite}
                      variant="primary"
                      small
                      block
                      onPress={() => setRecitingId(item.id)}
                    />
                  )}
                </Card>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <SectionTitle title={s.allTitle} sub={s.tapHint} />

          {selectedSurah ? (
            <Card>
              <Text style={T.cardTitle}>
                {selectedSurah.number}. {selectedSurah.englishName}
              </Text>
              <Text style={styles.surahArabic}>{selectedSurah.name}</Text>
              <Text style={T.cardBody}>
                {selectedSurah.englishNameTranslation} · {selectedSurah.numberOfAyahs} ayahs
              </Text>

              {selectedItems.length > 0 ? (
                <View style={styles.portions}>
                  <Text style={styles.portionsTitle}>{s.savedPortions}</Text>
                  {selectedItems.map((it) => (
                    <View key={it.id} style={styles.portionRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.portionLabel}>{rangeLabel(it)}</Text>
                        <Text style={styles.portionMeta}>
                          {dueLabel(it)} · {s.reviews(it.reviewCount)}
                        </Text>
                      </View>
                      <Chip label={s.remove} tone="red" onPress={() => persist(removeItem(items, it.id))} />
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.markTitle}>{s.markTitle}</Text>
              {wholeDone ? (
                <Text style={styles.alreadyNote}>{s.alreadyWhole}</Text>
              ) : (
                <View>
                  <View style={styles.rangeRow}>
                    <View style={styles.rangeField}>
                      <Field label={s.ayahFrom}>
                        <Input
                          value={fromText}
                          onChangeText={setFromText}
                          keyboardType="number-pad"
                          placeholder="1"
                        />
                      </Field>
                    </View>
                    <View style={styles.rangeField}>
                      <Field label={s.ayahTo}>
                        <Input
                          value={toText}
                          onChangeText={setToText}
                          keyboardType="number-pad"
                          placeholder={String(selectedSurah.numberOfAyahs)}
                        />
                      </Field>
                    </View>
                  </View>
                  {rangeError ? <Text style={T.error}>{rangeError}</Text> : null}
                  <PillButton label={s.markButton} variant="primary" block onPress={handleMark} />
                  <Text style={T.note}>{s.wholeSurah} — 1–{selectedSurah.numberOfAyahs}</Text>
                </View>
              )}
              <PillButton
                label={s.close}
                variant="ghost"
                small
                onPress={() => setSelected(null)}
              />
            </Card>
          ) : null}

          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={s.searchPlaceholder}
            style={styles.search}
          />

          {surahsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={C.teal700} />
              <Text style={styles.loadingText}>{s.loading}</Text>
            </View>
          ) : surahsError ? (
            <View>
              <Text style={T.error}>{s.loadError}</Text>
              <PillButton label={s.retry} variant="primary" block onPress={loadSurahs} />
            </View>
          ) : filteredSurahs.length === 0 ? (
            <EmptyState title={s.noMatch} />
          ) : (
            <View style={styles.grid}>
              {filteredSurahs.map((su) => {
                const whole = isWholeSurahMemorised(items, su.number, su.numberOfAyahs);
                const portions = itemsForSurah(items, su.number);
                const isDue = portions.some((it) => it.nextDue <= today);
                const next = portions.length > 0
                  ? portions.map((it) => it.nextDue).sort()[0]
                  : null;
                const isSelected = selected === su.number;
                return (
                  <Pressable
                    key={su.number}
                    onPress={() => openSurah(su.number)}
                    style={[styles.tile, isSelected && styles.tileSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`${su.number}. ${su.englishName}`}
                  >
                    <Text style={styles.tileNumber}>{su.number}</Text>
                    <Text style={styles.tileArabic}>{su.name}</Text>
                    <Text style={styles.tileName} numberOfLines={1}>{su.englishName}</Text>
                    <Text style={styles.tileMeta}>{su.numberOfAyahs} ayahs</Text>
                    {whole ? (
                      <Text style={[styles.tileStatus, styles.statusDone]}>✓ {s.memorised}</Text>
                    ) : portions.length > 0 ? (
                      <Text style={[styles.tileStatus, styles.statusPortion]}>
                        {isDue ? `● ${s.dueToday}` : s.nextDue(formatDateKey(next ?? today))}
                      </Text>
                    ) : (
                      <Text style={[styles.tileStatus, styles.statusNone]}>{s.notMemorised}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  summaryCard: { marginTop: 16, backgroundColor: C.teal900, borderColor: C.teal900 },
  summaryLine: { fontFamily: F.sans, fontSize: 17, fontWeight: '800', color: C.white },
  summarySub: { fontFamily: F.sans, fontSize: 13, color: C.navInactive, marginTop: 4 },
  reviewNote: { fontFamily: F.sans, fontSize: 13, color: C.peach, marginTop: 8, lineHeight: 18 },
  section: { marginTop: 6 },
  dueHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  dueHeadText: { flex: 1 },
  dueBadge: {
    fontFamily: F.sans,
    fontSize: 12,
    fontWeight: '800',
    color: C.red,
    backgroundColor: C.missedBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  dueMeta: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 6, marginBottom: 10 },
  howLabel: { fontFamily: F.sans, fontSize: 13, fontWeight: '700', color: C.teal700, marginBottom: 8 },
  resultRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  surahArabic: { fontFamily: F.arabic, fontSize: 22, color: C.teal700, marginTop: 4 },
  portions: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  portionsTitle: { fontFamily: F.sans, fontSize: 12.5, fontWeight: '700', color: C.teal700, marginBottom: 6 },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  portionLabel: { fontFamily: F.sans, fontSize: 14, fontWeight: '700', color: C.ink },
  portionMeta: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 2 },
  markTitle: { fontFamily: F.sans, fontSize: 14, fontWeight: '800', color: C.ink, marginTop: 14, marginBottom: 4 },
  alreadyNote: { fontFamily: F.sans, fontSize: 13.5, color: C.teal700, marginTop: 6, lineHeight: 19 },
  rangeRow: { flexDirection: 'row', gap: 10 },
  rangeField: { flex: 1 },
  search: { marginTop: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  loadingText: { fontFamily: F.sans, fontSize: 14, color: C.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 3,
    minHeight: 118,
  },
  tileSelected: { borderColor: C.teal700, borderWidth: 2, backgroundColor: C.teal100 },
  tileNumber: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.teal700 },
  tileArabic: { fontFamily: F.arabic, fontSize: 19, color: C.ink },
  tileName: { fontFamily: F.sans, fontSize: 12.5, fontWeight: '700', color: C.ink, textAlign: 'center' },
  tileMeta: { fontFamily: F.sans, fontSize: 11.5, color: C.muted },
  tileStatus: { fontFamily: F.sans, fontSize: 11.5, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  statusDone: { color: C.teal500 },
  statusPortion: { color: C.peachInk },
  statusNone: { color: C.muted, fontWeight: '700' },
});
