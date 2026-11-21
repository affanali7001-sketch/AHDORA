/**
 * Friends — friend search, discover, requests and list via the live API.
 * GET /api/friends/discover, GET /api/friends/search?q=,
 * GET /api/friends, GET /api/friends/requests,
 * POST /api/friends/requests, .../accept, .../reject, .../cancel,
 * DELETE /api/friends/:friendId, GET /api/friends/invites (+ accept/decline).
 *
 * Privacy rule (server-enforced, honoured here): another user is only
 * ever shown as id + name + initial — never email, never profile data.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import {
  acceptChallengeInvite,
  acceptFriendRequest,
  cancelFriendRequest,
  declineChallengeInvite,
  discoverPeople,
  listChallengeInvites,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  removeFriend,
  searchPeople,
  sendFriendRequest,
  type ChallengeInvite,
  type FriendRequestItem,
  type PublicUser,
} from '../lib/apiSocial';

const C = {
  ice: '#F5F7F6',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#687A75',
  teal950: '#06231F',
  teal900: '#0A352F',
  teal: '#0B4F4A',
  teal2: '#0F766E',
  peach: '#FFD9BE',
  peach2: '#FFF1E3',
  peachDeep: '#B45309',
  red: '#E11D2E',
  line: '#E6ECE9',
};

const STR = {
  en: {
    back: '← Back',
    title: 'Friends',
    sub: 'Find people, send requests, and see your friends. Only a name and initial are ever shown — never emails or private data.',
    search: 'Search people',
    searchPlaceholder: 'Name or exact email (min 2 letters)',
    searchHint: 'Search needs at least 2 characters.',
    discover: 'Discover people',
    noDiscover: 'No other people found yet.',
    myFriends: 'My friends',
    noFriends: 'No friends yet. Send a request below to connect.',
    requests: 'Friend requests',
    incoming: 'Incoming',
    outgoing: 'Outgoing',
    noRequests: 'No pending requests.',
    accept: 'Accept',
    reject: 'Reject',
    cancel: 'Cancel request',
    remove: 'Remove',
    sent: 'Request sent',
    send: 'Add friend',
    invites: 'Challenge invites',
    noInvites: 'No challenge invites.',
    acceptInvite: 'Accept invite',
    declineInvite: 'Decline',
    loading: 'Loading friends…',
    retry: 'Retry',
    searching: 'Searching…',
  },
  hi: {
    back: '← Wapas',
    title: 'Friends',
    sub: 'Logon ko dhoondo, request bhejo, aur apne doston ko dekho. Sirf naam aur initial dikhta hai — kabhi email ya private data nahi.',
    search: 'Logon ko dhoondo',
    searchPlaceholder: 'Naam ya exact email (kam se kam 2 akshar)',
    searchHint: 'Search ke liye kam se kam 2 akshar chahiye.',
    discover: 'Logon ko discover karo',
    noDiscover: 'Abhi koi aur log nahi mile.',
    myFriends: 'Mere dost',
    noFriends: 'Abhi koi dost nahi hai. Connect karne ke liye neeche se request bhejo.',
    requests: 'Friend requests',
    incoming: 'Aane wali',
    outgoing: 'Bheji hui',
    noRequests: 'Koi pending request nahi hai.',
    accept: 'Accept karo',
    reject: 'Reject karo',
    cancel: 'Request cancel karo',
    remove: 'Hatao',
    sent: 'Request bhej di',
    send: 'Dost banao',
    invites: 'Challenge invites',
    noInvites: 'Koi challenge invite nahi hai.',
    acceptInvite: 'Invite accept karo',
    declineInvite: 'Decline karo',
    loading: 'Friends load ho rahe hain…',
    retry: 'Dobara try karo',
    searching: 'Search ho raha hai…',
  },
} as const;

export default function FriendsScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [friends, setFriends] = useState<(PublicUser & { since: string })[]>([]);
  const [discover, setDiscover] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [invites, setInvites] = useState<ChallengeInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setOutgoing(reqs.outgoing);
      setInvites(inv.incoming);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(person: PublicUser) {
    if (busyId) return;
    setBusyId(person.id);
    setError(null);
    try {
      await sendFriendRequest(person.id);
      setSentIds((prev) => new Set(prev).add(person.id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function act(id: string, fn: (id: string) => Promise<void>) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await fn(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const personRow = (person: PublicUser, action?: ReactNode) => (
    <View key={person.id} style={styles.personRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{person.initial}</Text>
      </View>
      <Text style={styles.personName}>{person.name}</Text>
      {action}
    </View>
  );

  const friendIds = new Set(friends.map((f) => f.id));
  const outgoingIds = new Set(outgoing.map((r) => r.other?.id).filter(Boolean) as string[]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.sub}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.note}>{s.loading}</Text>
        </View>
      ) : error && friends.length === 0 && discover.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.sectionTitle}>{s.search}</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(t) => void runSearch(t)}
            placeholder={s.searchPlaceholder}
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.trim().length > 0 && query.trim().length < 2 ? (
            <Text style={styles.note}>{s.searchHint}</Text>
          ) : null}
          {searching ? <Text style={styles.note}>{s.searching}</Text> : null}
          {results !== null && query.trim().length >= 2 && !searching
            ? results.map((person) =>
                personRow(
                  person,
                  friendIds.has(person.id) ? undefined : (
                    <Pressable
                      onPress={() => void sendRequest(person)}
                      style={[styles.smallBtn, (sentIds.has(person.id) || outgoingIds.has(person.id) || busyId === person.id) && styles.btnDisabled]}
                      disabled={sentIds.has(person.id) || outgoingIds.has(person.id) || busyId === person.id}
                      accessibilityRole="button"
                    >
                      <Text style={styles.smallBtnText}>
                        {sentIds.has(person.id) || outgoingIds.has(person.id) ? s.sent : s.send}
                      </Text>
                    </Pressable>
                  ),
                ),
              )
            : null}

          <Text style={styles.sectionTitle}>{s.myFriends}</Text>
          {friends.length === 0 ? (
            <Text style={styles.empty}>{s.noFriends}</Text>
          ) : (
            friends.map((f) =>
              personRow(
                f,
                <Pressable
                  onPress={() => void act(f.id, removeFriend)}
                  disabled={busyId === f.id}
                  accessibilityRole="button"
                >
                  <Text style={styles.remove}>{s.remove}</Text>
                </Pressable>,
              ),
            )
          )}

          <Text style={styles.sectionTitle}>{s.requests}</Text>
          {incoming.length === 0 && outgoing.length === 0 ? (
            <Text style={styles.empty}>{s.noRequests}</Text>
          ) : (
            <>
              {incoming.map((r) =>
                r.other
                  ? personRow(
                      r.other,
                      <View style={styles.reqBtns}>
                        <Pressable
                          onPress={() => void act(r.id, acceptFriendRequest)}
                          disabled={busyId === r.id}
                          accessibilityRole="button"
                        >
                          <Text style={styles.accept}>{s.accept}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void act(r.id, rejectFriendRequest)}
                          disabled={busyId === r.id}
                          accessibilityRole="button"
                        >
                          <Text style={styles.remove}>{s.reject}</Text>
                        </Pressable>
                      </View>,
                    )
                  : null,
              )}
              {outgoing.map((r) =>
                r.other
                  ? personRow(
                      r.other,
                      <Pressable
                        onPress={() => void act(r.id, cancelFriendRequest)}
                        disabled={busyId === r.id}
                        accessibilityRole="button"
                      >
                        <Text style={styles.remove}>{s.cancel}</Text>
                      </Pressable>,
                    )
                  : null,
              )}
            </>
          )}

          <Text style={styles.sectionTitle}>{s.invites}</Text>
          {invites.length === 0 ? (
            <Text style={styles.empty}>{s.noInvites}</Text>
          ) : (
            invites.map((inv) => (
              <View key={inv.id} style={styles.card}>
                <Text style={styles.cardTitle}>{inv.challenge?.title ?? 'Challenge'}</Text>
                <Text style={styles.cardBody}>
                  {inv.other?.name ?? ''} · {inv.challenge?.durationDays ?? ''} days
                </Text>
                <View style={styles.reqBtns}>
                  <Pressable
                    onPress={() => void act(inv.id, acceptChallengeInvite)}
                    disabled={busyId === inv.id}
                    accessibilityRole="button"
                  >
                    <Text style={styles.accept}>{s.acceptInvite}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void act(inv.id, declineChallengeInvite)}
                    disabled={busyId === inv.id}
                    accessibilityRole="button"
                  >
                    <Text style={styles.remove}>{s.declineInvite}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>{s.discover}</Text>
          {discover.length === 0 ? (
            <Text style={styles.empty}>{s.noDiscover}</Text>
          ) : (
            discover
              .filter((p) => !friendIds.has(p.id))
              .map((person) =>
                personRow(
                  person,
                  <Pressable
                    onPress={() => void sendRequest(person)}
                    style={[styles.smallBtn, (sentIds.has(person.id) || outgoingIds.has(person.id) || busyId === person.id) && styles.btnDisabled]}
                    disabled={sentIds.has(person.id) || outgoingIds.has(person.id) || busyId === person.id}
                    accessibilityRole="button"
                  >
                    <Text style={styles.smallBtnText}>
                      {sentIds.has(person.id) || outgoingIds.has(person.id) ? s.sent : s.send}
                    </Text>
                  </Pressable>,
                ),
              )
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 20, lineHeight: 20 },
  center: { alignItems: 'center', paddingVertical: 40 },
  note: { fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 10 },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  empty: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 8, marginBottom: 12 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 4 },
  cardBody: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 10 },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
    marginBottom: 12,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: C.white, fontSize: 18, fontWeight: '800' },
  personName: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  smallBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallBtnText: { color: C.white, fontSize: 13, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  reqBtns: { flexDirection: 'row', gap: 14 },
  accept: { color: C.teal2, fontSize: 14, fontWeight: '800' },
  remove: { color: C.red, fontSize: 14, fontWeight: '700' },
});
