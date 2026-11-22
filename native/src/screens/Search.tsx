/**
 * Search — the Home header search (WhatsApp-style top bar).
 *
 * One box, three real searches, all live:
 * - People: the live friends search (GET /api/friends/search,
 *   min 2 letters) — Request and Challenge buttons work inline.
 * - Surahs: the 114-surah index (AlQuran Cloud, loaded once and
 *   filtered locally) — tapping one opens it in the Quran Book.
 * - Duas: the live /api/duas list (loaded once, filtered locally)
 *   — tapping one opens the Duas screen.
 * Nothing is faked: empty results say so, and a failed load only
 * hides its own section.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Field, Input, PillButton } from '../components/ui';
import {
  fetchDuas,
  fetchSurahList,
  type Dua,
  type MushafSurahRef,
} from '../lib/apiWorship';
import {
  searchPeople,
  sendFriendRequest,
  type PublicUser,
} from '../lib/apiSocial';
import { setChallengeUserTarget, setQuranSurahTarget } from '../lib/navTarget';

export default function SearchScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PublicUser[] | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [surahs, setSurahs] = useState<MushafSurahRef[]>([]);
  const [duas, setDuas] = useState<Dua[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Surah index + duas load once; people search is live per query.
  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchSurahList(), fetchDuas()]).then(([su, du]) => {
      if (!active) return;
      if (su.status === 'fulfilled') setSurahs(su.value);
      if (du.status === 'fulfilled') setDuas(du.value.duas);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const runSearch = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.trim().length < 2) {
      setPeople(null);
      setPeopleLoading(false);
      return;
    }
    setPeopleLoading(true);
    timerRef.current = setTimeout(() => {
      void searchPeople(text.trim())
        .then((users) => setPeople(users))
        .catch(() => setPeople([]))
        .finally(() => setPeopleLoading(false));
    }, 400);
  }, []);

  async function sendRequest(person: PublicUser) {
    if (busyId) return;
    setBusyId(person.id);
    setError('');
    try {
      await sendFriendRequest(person.id);
      setSentIds((prev) => new Set(prev).add(person.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  function challenge(person: PublicUser) {
    setChallengeUserTarget({ id: person.id, name: person.name });
    goTo('challenges');
  }

  const q = query.trim().toLowerCase();
  const filteredSurahs = q
    ? surahs.filter(
        (su) =>
          su.englishName.toLowerCase().includes(q) ||
          su.englishNameTranslation.toLowerCase().includes(q) ||
          String(su.number) === q,
      )
    : [];
  const filteredDuas = q
    ? duas.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.when.toLowerCase().includes(q) ||
          d.topics.some((t) => t.toLowerCase().includes(q)),
      )
    : [];
  const hasQuery = q.length > 0;
  const nothingFound =
    hasQuery &&
    !peopleLoading &&
    (people?.length ?? 0) === 0 &&
    filteredSurahs.length === 0 &&
    filteredDuas.length === 0;

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.searchTitle}</Text>
      <Text style={T.sub}>{s.searchSub}</Text>

      <Field label={s.searchTitle}>
        <Input
          value={query}
          onChangeText={runSearch}
          placeholder={s.searchPh}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </Field>
      {!hasQuery ? <Text style={styles.hint}>{s.searchHint}</Text> : null}
      {error ? <Text style={T.error}>{error}</Text> : null}

      {hasQuery && peopleLoading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 16 }} />
      ) : null}

      {hasQuery && people && people.length > 0 ? (
        <Card>
          <Text style={T.cardTitle}>{s.searchUsers}</Text>
          {people.map((person, i) => {
            const sent = sentIds.has(person.id);
            return (
              <View key={person.id} style={styles.row}>
                <View style={[styles.avatar, i % 2 === 1 && styles.avatarPeach]}>
                  <Text style={[styles.avatarText, i % 2 === 1 && styles.avatarTextPeach]}>
                    {person.initial}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Text style={styles.sub}>
                    ⭐ {typeof person.points === 'number' ? person.points : 0} {s.frPoints}
                  </Text>
                </View>
                <View style={styles.rowBtns}>
                  <PillButton
                    label={sent ? s.frSent : s.frReq}
                    small
                    variant={sent ? 'ghost' : 'primary'}
                    onPress={() => void sendRequest(person)}
                    disabled={sent || busyId === person.id}
                  />
                  <PillButton
                    label={s.frChallenge}
                    small
                    variant="ghost"
                    onPress={() => challenge(person)}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {filteredSurahs.length > 0 ? (
        <Card>
          <Text style={T.cardTitle}>{s.searchSurahs}</Text>
          {filteredSurahs.slice(0, 10).map((su) => (
            <View key={su.number} style={styles.row}>
              <View style={styles.surahBadge}>
                <Text style={styles.surahBadgeText}>{su.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{su.englishName}</Text>
                <Text style={styles.sub}>
                  {su.englishNameTranslation} · {su.numberOfAyahs} ayahs
                </Text>
              </View>
              <PillButton
                label={s.searchOpen}
                small
                variant="ghost"
                onPress={() => {
                  setQuranSurahTarget(su.number);
                  goTo('quran');
                }}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {filteredDuas.length > 0 ? (
        <Card>
          <Text style={T.cardTitle}>{s.searchDuas}</Text>
          {filteredDuas.slice(0, 10).map((d) => (
            <View key={d.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{d.title}</Text>
                <Text style={styles.sub}>{d.when}</Text>
              </View>
              <PillButton label={s.searchOpen} small variant="ghost" onPress={() => goTo('duas')} />
            </View>
          ))}
        </Card>
      ) : null}

      {nothingFound ? (
        <Card>
          <Text style={[T.cardBody, { marginTop: 2 }]}>{s.searchNoResults}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.teal700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPeach: { backgroundColor: C.peachMid },
  avatarText: { fontFamily: 'PlusJakartaSans', fontSize: 17, fontWeight: '800', color: C.white },
  avatarTextPeach: { color: C.peachText },
  name: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  sub: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, marginTop: 2 },
  rowBtns: { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  surahBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahBadgeText: { fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '800', color: C.teal900 },
});
