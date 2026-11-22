/**
 * Challenges — rebuilt to the approved preview (§20 in the preview file).
 * Dark-teal hero card for the first active challenge: Day X / total,
 * streak, a 30-cell streak grid (✓ done, 😢 missed, peach today),
 * REAL Share (OS share sheet) and REAL Invite (pick a friend — the
 * invite goes through POST /api/friends/invites). Friends' streak
 * card from GET /api/friends/:id/shared-challenges (shared progress
 * only, never private data). Peach dare card with a REAL rotating
 * dare (fixed list of harmless dares). Template chips join real
 * challenges (rules shown before joining); "+ Apna banao" creates a
 * real custom challenge via POST /api/challenges/. No "coming soon"
 * anywhere.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Chip, EmptyState, Input, PillButton, TealHead } from '../components/ui';
import {
  checkInChallenge,
  discoverPeople,
  joinTemplate,
  leaveChallenge,
  listChallengeTemplates,
  listFriends,
  myChallenges,
  sendFriendRequest,
  type ChallengeParticipation,
  type ChallengeTemplate,
  type PublicUser,
} from '../lib/apiSocial';
import { takeChallengeUserTarget, type ChallengeUserTarget } from '../lib/navTarget';

const DARES: Record<AppLanguage, string[]> = {
  en: [
    'The loser reads 1 page of Quran aloud to the winner after Fajr tomorrow.',
    'The loser prays 2 nafl rakahs for the winner’s success.',
    'The loser treats the winner to their favourite snack (under ₹50).',
    'The loser writes down 3 things they learned this week and shares them.',
    'The loser does 20 push-ups (or a 20-minute walk) before Maghrib.',
    'The loser recites Surah Al-Ikhlas 10 times and gifts the reward to the winner.',
    'The loser makes chai for the winner tomorrow.',
  ],
  hi: [
    'Haar ne wale ko kal Fajr ke baad 1 page Quran padh kar sunana hai.',
    'Haar ne wala jeetne wale ki kamyabi ke liye 2 nafl padhega.',
    'Haar ne wala jeetne wale ko uska favourite snack khilayega (₹50 ke andar).',
    'Haar ne wala is hafte ki 3 seekhi hui baatein likh kar share karega.',
    'Haar ne wala Maghrib se pehle 20 push-ups (ya 20 minute walk) karega.',
    'Haar ne wala Surah Al-Ikhlas 10 baar padh kar sawaab jeetne wale ko dega.',
    'Haar ne wala kal jeetne wale ke liye chai banayega.',
  ],
};

type SharedProgress = {
  challengeId: string;
  challengeTitle: string;
  friend: { currentDay: number; totalDays: number; completedDays: number; pointsEarned: number };
};

async function sharedWith(friendId: string): Promise<SharedProgress[]> {
  const response = await apiFetch(`/api/friends/${encodeURIComponent(friendId)}/shared-challenges`);
  const data = (await response.json().catch(() => ({}))) as { shared?: SharedProgress[] };
  return Array.isArray(data.shared) ? data.shared : [];
}

async function sendInvite(challengeId: string, toUserId: string): Promise<void> {
  const response = await apiFetch('/api/friends/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, toUserId }),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed. Please try again.');
  }
}

async function createCustomChallenge(title: string): Promise<void> {
  const response = await apiFetch('/api/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description: '',
      category: 'discipline',
      durationDays: 30,
      rules: ['Roz ka kaam poora karo', 'Ek din chhoota to streak toot jayega'],
      consent: true,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed. Please try again.');
  }
}

/** Missed days, from server numbers only. */
function missedDays(p: ChallengeParticipation): number {
  const doneBeforeToday = p.completedDays - (p.todayCompleted ? 1 : 0);
  return Math.max(0, p.currentDay - 1 - doneBeforeToday);
}

export default function ChallengesScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [active, setActive] = useState<ChallengeParticipation[]>([]);
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [friends, setFriends] = useState<(PublicUser & { since: string })[]>([]);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [targetUser, setTargetUser] = useState<ChallengeUserTarget | null>(null);
  const [reqSentIds, setReqSentIds] = useState<Set<string>>(new Set());
  const [friendProgress, setFriendProgress] = useState<
    { friend: PublicUser; progress: SharedProgress }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [dare, setDare] = useState<string | null>(null);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, temps, fr, disc] = await Promise.all([
        myChallenges(),
        listChallengeTemplates(),
        listFriends(),
        discoverPeople(50).catch(() => [] as PublicUser[]),
      ]);
      setActive(mine.active);
      setTemplates(temps);
      setFriends(fr);
      // Invite picker shows EVERYONE (friends + new people), not
      // just friends — the server only allows inviting friends, so
      // non-friends get a "Send request" button instead (after they
      // accept, they can be invited). Dedupe by id.
      const seen = new Set<string>();
      const merged: PublicUser[] = [];
      for (const u of [...fr, ...disc]) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          merged.push(u);
        }
      }
      setAllUsers(merged);
      // Friends' shared challenge progress (shared fields only).
      const settled = await Promise.allSettled(fr.slice(0, 6).map(async (f) => ({ f, shared: await sharedWith(f.id) })));
      const rows: { friend: PublicUser; progress: SharedProgress }[] = [];
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const first = result.value.shared[0];
        if (first) rows.push({ friend: result.value.f, progress: first });
      }
      rows.sort((a, b) => b.progress.friend.completedDays - a.progress.friend.completedDays);
      setFriendProgress(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  // A friend/discover row's "Challenge" button sets this target:
  // open the invite picker for that person (they sort first).
  useEffect(() => {
    const target = takeChallengeUserTarget();
    if (target) {
      setTargetUser(target);
      setShowInvitePicker(true);
    }
  }, []);

  const hero = active.find((p) => p.totalDays === 30) ?? active[0] ?? null;

  async function shareChallenge() {
    if (!hero) return;
    try {
      await Share.share({
        message:
          lang === 'hi'
            ? `Main AHDORA par "${hero.challenge.title}" challenge me Day ${hero.currentDay}/${hero.totalDays} par hoon — 🔥 ${hero.streak} din ki streak! Tum bhi join karo.`
            : `I'm on Day ${hero.currentDay}/${hero.totalDays} of the "${hero.challenge.title}" challenge on AHDORA — 🔥 ${hero.streak} day streak! Join me.`,
      });
    } catch {
      // Share sheet dismissed — nothing to report.
    }
  }

  async function inviteFriend(friendId: string) {
    if (!hero || busyId) return;
    setBusyId(friendId);
    setError('');
    try {
      await sendInvite(hero.challengeId, friendId);
      setInvitedIds((prev) => new Set(prev).add(friendId));
      setNotice(s.chInviteSent);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function checkIn() {
    if (!hero || busyId) return;
    setBusyId(hero.challengeId);
    setError('');
    try {
      const result = await checkInChallenge(hero.challengeId);
      setNotice(result.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function leave() {
    if (!hero || busyId) return;
    setBusyId(hero.challengeId);
    setError('');
    try {
      await leaveChallenge(hero.challengeId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function join(template: ChallengeTemplate) {
    if (busyId) return;
    setBusyId(template.id);
    setError('');
    try {
      await joinTemplate(template.id);
      setSelectedTemplate(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function createCustom() {
    const title = customTitle.trim();
    if (!title || busyId) return;
    setBusyId('custom');
    setError('');
    try {
      await createCustomChallenge(title);
      setCustomTitle('');
      setCreatingCustom(false);
      setNotice(s.chCreated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  function showDare() {
    const list = DARES[lang];
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    setDare(list[dayOfYear % list.length]);
  }

  // Streak grid cells for the hero challenge.
  const gridCells: ('done' | 'missed' | 'today' | 'future')[] = [];
  if (hero) {
    const missed = missedDays(hero);
    const doneBeforeToday = Math.max(0, hero.completedDays - (hero.todayCompleted ? 1 : 0));
    for (let day = 1; day <= hero.totalDays; day += 1) {
      if (day === hero.currentDay) gridCells.push('today');
      else if (day < hero.currentDay) {
        gridCells.push(day <= doneBeforeToday ? 'done' : day <= doneBeforeToday + missed ? 'missed' : 'future');
      } else gridCells.push('future');
    }
  }

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.chTitle}</Text>
      <Text style={T.sub}>{s.chSub}</Text>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : error && active.length === 0 && templates.length === 0 ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void load()} />
        </Card>
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {/* Hero — first active challenge */}
          {hero ? (
            <TealHead style={{ marginTop: 14 }}>
              <View style={styles.heroHead}>
                <Text style={styles.heroTitle}>{hero.challenge.title}</Text>
                <Text style={styles.heroTag}>
                  Day {hero.currentDay} / {hero.totalDays}
                </Text>
              </View>
              <Text style={styles.heroStreak}>
                🔥 {hero.streak} <Text style={styles.heroStreakSub}>{s.chStreakWord}</Text>
              </Text>
              <View style={styles.streakGrid}>
                {gridCells.map((cell, i) => (
                  <View
                    key={i}
                    style={[
                      styles.streakCell,
                      cell === 'done' && styles.streakDone,
                      cell === 'today' && styles.streakToday,
                      cell === 'missed' && styles.streakMissed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.streakCellText,
                        cell === 'done' && styles.streakDoneText,
                        cell === 'today' && styles.streakTodayText,
                      ]}
                    >
                      {cell === 'done' ? '✓' : cell === 'missed' ? '😢' : cell === 'today' ? hero.currentDay : ''}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.heroNote}>
                {s.chGridNote.replace('{day}', String(hero.currentDay))}
              </Text>
              <View style={styles.heroBtns}>
                <View style={{ flex: 1 }}>
                  <PillButton label={s.chShare} small variant="peach" block onPress={() => void shareChallenge()} />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton
                    label={s.chInvite}
                    small
                    variant="soft"
                    block
                    onPress={() => setShowInvitePicker((v) => !v)}
                  />
                </View>
              </View>
              {!hero.todayCompleted ? (
                <PillButton
                  label={s.chCheckIn}
                  small
                  variant="soft"
                  block
                  onPress={() => void checkIn()}
                  disabled={busyId === hero.challengeId}
                />
              ) : (
                <Text style={styles.checkedIn}>{s.chCheckedIn}</Text>
              )}
              <Pressable onPress={() => void leave()} disabled={busyId === hero.challengeId} accessibilityRole="button">
                <Text style={styles.leave}>{s.chLeave}</Text>
              </Pressable>
            </TealHead>
          ) : (
            <EmptyState title={s.chTitle} body={s.chNoActive} />
          )}

          {/* Invite picker — EVERYONE (friends + new people), with
              search. The server only lets you invite friends, so a
              non-friend gets a "Send request" button instead: once
              they accept, they can be invited. The person picked on
              Friends/Study/Search sorts first. */}
          {showInvitePicker && hero ? (
            <Card>
              <Text style={T.cardTitle}>{s.chInvitePick}</Text>
              <Text style={[T.cardBody, { marginTop: 4 }]}>{s.chInviteAll}</Text>
              <View style={{ marginTop: 10 }}>
                <Input
                  value={inviteQuery}
                  onChangeText={setInviteQuery}
                  placeholder={s.chInviteSearchPh}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              {(() => {
                const q = inviteQuery.trim().toLowerCase();
                const friendIds = new Set(friends.map((f) => f.id));
                const rows = allUsers
                  .filter((u) => !q || u.name.toLowerCase().includes(q))
                  .sort((a, b) => {
                    if (targetUser && a.id === targetUser.id) return -1;
                    if (targetUser && b.id === targetUser.id) return 1;
                    const aF = friendIds.has(a.id) ? 0 : 1;
                    const bF = friendIds.has(b.id) ? 0 : 1;
                    return aF - bF;
                  });
                if (rows.length === 0) {
                  return (
                    <Text style={[T.cardBody, { marginTop: 8 }]}>{s.chNoUsers}</Text>
                  );
                }
                return rows.map((u, i) => {
                  const isFriend = friendIds.has(u.id);
                  const invited = invitedIds.has(u.id);
                  const reqSent = reqSentIds.has(u.id);
                  return (
                    <View
                      key={u.id}
                      style={[
                        styles.friendRow,
                        targetUser?.id === u.id && styles.targetRow,
                      ]}
                    >
                      <View style={[styles.avatar, i % 2 === 1 && styles.avatarPeach]}>
                        <Text style={[styles.avatarText, i % 2 === 1 && styles.avatarTextPeach]}>
                          {u.initial}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{u.name}</Text>
                        <Text style={styles.friendSub}>
                          ⭐ {typeof u.points === 'number' ? u.points : 0} {s.frPoints}
                          {isFriend ? '' : ` · ${s.frReq}`}
                        </Text>
                      </View>
                      {isFriend ? (
                        <PillButton
                          label={invited ? s.chInviteSent : s.chInvite}
                          small
                          variant={invited ? 'ghost' : 'primary'}
                          onPress={() => void inviteFriend(u.id)}
                          disabled={invited || busyId === u.id}
                        />
                      ) : (
                        <PillButton
                          label={reqSent ? s.frSent : s.frReq}
                          small
                          variant={reqSent ? 'ghost' : 'primary'}
                          onPress={() => {
                            if (busyId || reqSent) return;
                            setBusyId(u.id);
                            void sendFriendRequest(u.id)
                              .then(() => {
                                setReqSentIds((prev) => new Set(prev).add(u.id));
                                setNotice(s.frSent);
                              })
                              .catch((e) => {
                                setError(e instanceof Error ? e.message : s.errorGeneric);
                              })
                              .finally(() => setBusyId(null));
                          }}
                          disabled={reqSent || busyId === u.id}
                        />
                      )}
                    </View>
                  );
                });
              })()}
            </Card>
          ) : null}

          {/* Friends' streaks — shared progress only */}
          <Card>
            <Text style={T.cardTitle}>{s.chFriendH}</Text>
            {friendProgress.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 6 }]}>{s.chNoShared}</Text>
            ) : (
              friendProgress.map(({ friend, progress }, i) => (
                <View key={friend.id} style={styles.friendRow}>
                  <View style={[styles.avatar, i % 2 === 1 && styles.avatarPeach]}>
                    <Text style={[styles.avatarText, i % 2 === 1 && styles.avatarTextPeach]}>
                      {friend.initial}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendSub}>
                      Day {progress.friend.currentDay} / {progress.friend.totalDays} · 🔥{' '}
                      {progress.friend.completedDays} din streak
                    </Text>
                  </View>
                  <Text style={styles.rankTag}>{i + 1 === 1 ? '1st' : i + 1 === 2 ? '2nd' : '3rd'}</Text>
                </View>
              ))
            )}
            <Text style={[T.cardBody, { marginTop: 10 }]}>{s.chFriendNote}</Text>
          </Card>

          {/* Dare rule */}
          <View style={styles.dareCard}>
            <Text style={styles.dareTitle}>{s.chDareH}</Text>
            <Text style={styles.dareBody}>{s.chDareBody}</Text>
            <PillButton label={s.chDareBtn} small variant="soft" onPress={showDare} />
            {dare ? <Text style={styles.dareText}>{dare}</Text> : null}
          </View>

          {/* Template chips + custom */}
          <View style={styles.chips}>
            {templates.slice(0, 3).map((t) => (
              <Chip
                key={t.id}
                label={t.title}
                selected={selectedTemplate?.id === t.id}
                onPress={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
              />
            ))}
            <Chip label={`+ ${s.chCustom}`} tone="peach" onPress={() => setCreatingCustom((v) => !v)} />
          </View>
          {selectedTemplate ? (
            <Card>
              <Text style={T.cardTitle}>{selectedTemplate.title}</Text>
              <Text style={[T.cardBody, { marginTop: 4 }]}>{selectedTemplate.description}</Text>
              <Text style={[T.cardBody, { marginTop: 4 }]}>
                {selectedTemplate.durationDays} days · {selectedTemplate.requirement}
              </Text>
              {selectedTemplate.rules.map((rule) => (
                <Text key={rule} style={[T.cardBody, { marginTop: 2 }]}>
                  • {rule}
                </Text>
              ))}
              <View style={{ marginTop: 10 }}>
                <PillButton
                  label={selectedTemplate.joined ? s.chJoined : s.chJoin}
                  onPress={() => void join(selectedTemplate)}
                  disabled={selectedTemplate.joined || busyId === selectedTemplate.id}
                  busy={busyId === selectedTemplate.id}
                />
              </View>
            </Card>
          ) : null}
          {creatingCustom ? (
            <View style={styles.addRow}>
              <Input
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder={s.chCustomTitlePh}
                editable={busyId !== 'custom'}
                onSubmitEditing={() => void createCustom()}
                style={{ flex: 1 }}
              />
              <PillButton label={s.chCreateBtn} small onPress={() => void createCustom()} busy={busyId === 'custom'} />
            </View>
          ) : null}
          <Text style={styles.footnote}>{s.chRules}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 13,
    fontWeight: '700',
    color: C.teal700,
    backgroundColor: C.teal100,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    lineHeight: 18,
  },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  heroTitle: { fontFamily: 'PlusJakartaSans', fontSize: 17, fontWeight: '800', color: C.white, flex: 1 },
  heroTag: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: C.peach,
    color: C.peachInk,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  heroStreak: { fontFamily: 'PlusJakartaSans', fontSize: 26, fontWeight: '800', color: C.white, marginTop: 12 },
  heroStreakSub: { fontSize: 15, fontWeight: '700', color: C.navInactive },
  streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  streakCell: {
    width: '12.5%',
    aspectRatio: 1,
    borderRadius: 9,
    backgroundColor: '#EDF3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDone: { backgroundColor: C.teal500 },
  streakToday: { backgroundColor: C.peach, borderWidth: 2, borderColor: C.peachMid },
  streakMissed: { backgroundColor: '#FDF0ED' },
  streakCellText: { fontFamily: 'PlusJakartaSans', fontSize: 12, fontWeight: '700', color: C.muted },
  streakDoneText: { color: C.white },
  streakTodayText: { color: C.peachInk },
  heroNote: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.navInactive, marginTop: 10, lineHeight: 18 },
  heroBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  checkedIn: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '700', color: C.navInactive, textAlign: 'center', marginTop: 4 },
  leave: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '700', color: C.peach, textAlign: 'center', marginTop: 10 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  targetRow: {
    backgroundColor: C.teal100,
    borderRadius: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal700, alignItems: 'center', justifyContent: 'center' },
  avatarPeach: { backgroundColor: C.peachMid },
  avatarText: { fontFamily: 'PlusJakartaSans', fontSize: 17, fontWeight: '800', color: C.white },
  avatarTextPeach: { color: C.peachText },
  friendName: { fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '700', color: C.ink, flex: 1 },
  friendSub: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, marginTop: 2 },
  rankTag: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: C.teal100,
    color: C.teal900,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  dareCard: { backgroundColor: C.peach, borderWidth: 1, borderColor: C.peach, borderRadius: 20, padding: 16, marginBottom: 12 },
  dareTitle: { fontFamily: 'PlusJakartaSans', fontSize: 15.5, fontWeight: '800', color: C.peachInk },
  dareBody: { fontFamily: 'PlusJakartaSans', fontSize: 14, color: C.peachInk, lineHeight: 22, marginTop: 6, marginBottom: 12 },
  dareText: { fontFamily: 'PlusJakartaSans', fontSize: 14, fontWeight: '700', color: C.peachInk, lineHeight: 20, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  footnote: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 10, textAlign: 'center' },
});
