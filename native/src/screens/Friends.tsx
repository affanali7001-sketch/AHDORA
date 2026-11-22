/**
 * Friends — rebuilt to the approved preview (§21 in the preview file).
 * Order: Discover → Pending → My friends. Name-only search
 * ("Dost dhundho (naam se)"). Discover rows show avatar (teal/peach
 * alternating) + name + "Sirf naam aur initial dikhta hai" + teal
 * "Request bhejo" pill (sent state "Bhej di ✓"). Pending rows have
 * teal Accept + ghost Reject pills; incoming challenge invites are
 * folded into the same card. My friends rows show the friend's REAL
 * shared challenge progress (🔥 streak · challenge name, from
 * GET /api/friends/:id/shared-challenges) + ghost "Challenge" button
 * to Challenges. No auto-friending, no email search, no Remove link.
 * Real friends API throughout (discover returns id+name+initial only).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Field, Input, PillButton } from '../components/ui';
import {
  acceptChallengeInvite,
  acceptFriendRequest,
  declineChallengeInvite,
  discoverPeople,
  listChallengeInvites,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  searchPeople,
  sendFriendRequest,
  type ChallengeInvite,
  type FriendRequestItem,
  type PublicUser,
} from '../lib/apiSocial';

type SharedProgress = {
  challengeTitle: string;
  friend: { currentDay: number; totalDays: number; completedDays: number };
};

async function sharedWith(friendId: string): Promise<SharedProgress | null> {
  try {
    const response = await apiFetch(`/api/friends/${encodeURIComponent(friendId)}/shared-challenges`);
    const data = (await response.json().catch(() => ({}))) as { shared?: SharedProgress[] };
    return Array.isArray(data.shared) && data.shared.length > 0 ? data.shared[0] : null;
  } catch {
    return null;
  }
}

export default function FriendsScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [friends, setFriends] = useState<(PublicUser & { since: string })[]>([]);
  const [discover, setDiscover] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoingIds, setOutgoingIds] = useState<Set<string>>(new Set());
  const [invites, setInvites] = useState<ChallengeInvite[]>([]);
  const [streaks, setStreaks] = useState<Record<string, SharedProgress | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fr, disc, reqs, inv] = await Promise.all([
        listFriends(),
        discoverPeople(),
        listFriendRequests(),
        listChallengeInvites(),
      ]);
      setFriends(fr);
      setDiscover(disc);
      setIncoming(reqs.incoming);
      setOutgoingIds(new Set(reqs.outgoing.map((r) => r.other?.id).filter(Boolean) as string[]));
      setInvites(inv.incoming);
      // Real shared challenge progress per friend (shared fields only).
      const settled = await Promise.allSettled(
        fr.map(async (f) => ({ id: f.id, shared: await sharedWith(f.id) })),
      );
      const map: Record<string, SharedProgress | null> = {};
      for (const result of settled) {
        if (result.status === 'fulfilled') map[result.value.id] = result.value.shared;
      }
      setStreaks(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchPeople(text.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

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

  async function act(id: string, fn: (id: string) => Promise<void>) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      await fn(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  const friendIds = new Set(friends.map((f) => f.id));
  const shownDiscover = (results !== null ? results : discover).filter((p) => !friendIds.has(p.id));

  const discoverRow = (person: PublicUser, index: number) => {
    const sent = sentIds.has(person.id) || outgoingIds.has(person.id);
    return (
      <View key={person.id} style={styles.row}>
        <View style={[styles.avatar, index % 2 === 1 && styles.avatarPeach]}>
          <Text style={[styles.avatarText, index % 2 === 1 && styles.avatarTextPeach]}>{person.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.sub}>{s.frPrivacy}</Text>
        </View>
        <PillButton
          label={sent ? s.frSent : s.frReq}
          small
          variant={sent ? 'ghost' : 'primary'}
          onPress={() => void sendRequest(person)}
          disabled={sent || busyId === person.id}
        />
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.frTitle}</Text>
      <Text style={T.sub}>{s.frSub}</Text>

      <Field label={s.frSearchLbl}>
        <Input
          value={query}
          onChangeText={(t) => void runSearch(t)}
          placeholder="e.g. Ahmed…"
          autoCapitalize="words"
          autoCorrect={false}
        />
      </Field>
      {searching ? <Text style={styles.note}>{s.loading}</Text> : null}
      <Text style={styles.note}>{s.frSearchHint}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && friends.length === 0 && discover.length === 0 ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}

          {/* Discover — first */}
          <Card>
            <Text style={T.cardTitle}>{s.frDiscover}</Text>
            {shownDiscover.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 6 }]}>{s.frNoDiscover}</Text>
            ) : (
              shownDiscover.map((person, i) => discoverRow(person, i))
            )}
          </Card>

          {/* Pending — incoming requests + challenge invites */}
          <Card>
            <Text style={T.cardTitle}>{s.frPending}</Text>
            {incoming.length === 0 && invites.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 6 }]}>{s.frNoPending}</Text>
            ) : (
              <>
                {incoming.map((r, i) =>
                  r.other ? (
                    <View key={r.id} style={styles.row}>
                      <View style={[styles.avatar, i % 2 === 1 && styles.avatarPeach]}>
                        <Text style={[styles.avatarText, i % 2 === 1 && styles.avatarTextPeach]}>
                          {r.other.initial}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{r.other.name}</Text>
                        <Text style={styles.sub}>{s.frSentYou}</Text>
                      </View>
                      <View style={styles.reqBtns}>
                        <PillButton
                          label={s.frAccept}
                          small
                          onPress={() => void act(r.id, acceptFriendRequest)}
                          disabled={busyId === r.id}
                        />
                        <PillButton
                          label={s.frReject}
                          small
                          variant="ghost"
                          onPress={() => void act(r.id, rejectFriendRequest)}
                          disabled={busyId === r.id}
                        />
                      </View>
                    </View>
                  ) : null,
                )}
                {invites.map((inv) => (
                  <View key={inv.id} style={styles.row}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{inv.other?.initial ?? '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{inv.other?.name ?? ''}</Text>
                      <Text style={styles.sub}>
                        {inv.challenge?.title ?? 'Challenge'} · {inv.challenge?.durationDays ?? ''} days
                      </Text>
                    </View>
                    <View style={styles.reqBtns}>
                      <PillButton
                        label={s.frAccept}
                        small
                        onPress={() => void act(inv.id, acceptChallengeInvite)}
                        disabled={busyId === inv.id}
                      />
                      <PillButton
                        label={s.frReject}
                        small
                        variant="ghost"
                        onPress={() => void act(inv.id, declineChallengeInvite)}
                        disabled={busyId === inv.id}
                      />
                    </View>
                  </View>
                ))}
              </>
            )}
          </Card>

          {/* My friends */}
          <Card>
            <Text style={T.cardTitle}>{s.frMine}</Text>
            {friends.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 6 }]}>{s.frNoFriends}</Text>
            ) : (
              friends.map((f, i) => {
                const shared = streaks[f.id];
                return (
                  <View key={f.id} style={styles.row}>
                    <View style={[styles.avatar, i % 2 === 1 && styles.avatarPeach]}>
                      <Text style={[styles.avatarText, i % 2 === 1 && styles.avatarTextPeach]}>
                        {f.initial}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{f.name}</Text>
                      <Text style={styles.sub}>
                        {shared
                          ? `🔥 ${shared.friend.completedDays} din streak · ${shared.challengeTitle}`
                          : s.frNoShared}
                      </Text>
                    </View>
                    <PillButton label={s.frChallenge} small variant="ghost" onPress={() => goTo('challenges')} />
                  </View>
                );
              })
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.muted, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal700, alignItems: 'center', justifyContent: 'center' },
  avatarPeach: { backgroundColor: C.peachMid },
  avatarText: { fontFamily: 'PlusJakartaSans', fontSize: 17, fontWeight: '800', color: C.white },
  avatarTextPeach: { color: C.peachText },
  name: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  sub: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, marginTop: 2 },
  reqBtns: { flexDirection: 'row', gap: 6 },
});
