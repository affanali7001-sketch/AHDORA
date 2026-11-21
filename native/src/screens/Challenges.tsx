/**
 * Challenges — real data from the live API.
 * GET /api/challenges/mine, GET /api/challenges/templates,
 * POST /api/challenges/templates/:id/join, POST /api/challenges/:id/check-in,
 * POST /api/challenges/:id/leave.
 *
 * Streak is shown with a fire from the server's streak count. Missed
 * days are derived honestly from server numbers only: days elapsed
 * before today minus days completed before today. Share & dare have
 * NO backend yet — the buttons lead to an honest "coming" state and
 * never fake a share or a dare.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import {
  checkInChallenge,
  joinTemplate,
  leaveChallenge,
  listChallengeTemplates,
  myChallenges,
  type ChallengeParticipation,
  type ChallengeTemplate,
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
    title: 'Challenges',
    sub: 'Real challenges from your account. Days count only from real activity or an honest self-reported check-in.',
    active: 'Your active challenges',
    noActive: 'No active challenges yet. Join one below.',
    templates: 'Join a challenge',
    noTemplates: 'No challenge templates available right now.',
    day: 'Day',
    of: 'of',
    daysDone: 'days done',
    streak: 'day streak',
    points: 'points',
    checkIn: 'Check in today',
    checkedIn: 'Checked in today',
    leave: 'Leave',
    join: 'Join',
    joined: 'Joined',
    share: 'Share',
    dare: 'Dare a friend',
    comingTitle: 'Coming in a later phase',
    comingBody:
      'Sharing challenges and friend dares are not built yet. Nothing was shared and no dare was sent.',
    missedDays: 'missed days',
    missedNote: 'Missed days stay missed — check in today to keep the streak alive.',
    selfReported: 'Self-reported check-in: this day is recorded from your own confirmation, not measured activity.',
    leaveRule: 'Leaving keeps your history and points — nothing is taken back.',
    loading: 'Loading challenges…',
    retry: 'Retry',
    close: 'Close',
  },
  hi: {
    back: '← Wapas',
    title: 'Challenges',
    sub: 'Aapke account ke asli challenges. Din sirf asli activity ya imaandaar self-reported check-in se ginte hain.',
    active: 'Aapke active challenges',
    noActive: 'Abhi koi active challenge nahi hai. Neeche se ek join karo.',
    templates: 'Challenge join karo',
    noTemplates: 'Abhi koi challenge template available nahi hai.',
    day: 'Din',
    of: 'me se',
    daysDone: 'din poore',
    streak: 'din ki streak',
    points: 'points',
    checkIn: 'Aaj check-in karo',
    checkedIn: 'Aaj check-in ho gaya',
    leave: 'Chhod do',
    join: 'Join karo',
    joined: 'Joined',
    share: 'Share karo',
    dare: 'Dost ko dare do',
    comingTitle: 'Agle phase me aayega',
    comingBody:
      'Challenge share karna aur dost ko dare dena abhi bana nahi hai. Kuch share nahi hua aur koi dare nahi bheja gaya.',
    missedDays: 'din miss hue',
    missedNote: 'Miss hue din miss hi rehte hain — streak bachane ke liye aaj check-in karo.',
    selfReported: 'Self-reported check-in: ye din aapki apni confirmation se record hua hai, measured activity se nahi.',
    leaveRule: 'Chhodne par aapki history aur points rehte hain — kuch wapas nahi liya jata.',
    loading: 'Challenges load ho rahe hain…',
    retry: 'Dobara try karo',
    close: 'Band karo',
  },
} as const;

/**
 * Missed days, from server numbers only: days elapsed before today
 * minus days completed before today. Never negative, never invented.
 */
function missedDays(p: ChallengeParticipation): number {
  const doneBeforeToday = p.completedDays - (p.todayCompleted ? 1 : 0);
  return Math.max(0, p.currentDay - 1 - doneBeforeToday);
}

export default function ChallengesScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [active, setActive] = useState<ChallengeParticipation[]>([]);
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkInNote, setCheckInNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, temps] = await Promise.all([myChallenges(), listChallengeTemplates()]);
      setActive(mine.active);
      setTemplates(temps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(template: ChallengeTemplate) {
    if (busyId) return;
    setBusyId(template.id);
    setError(null);
    try {
      const participation = await joinTemplate(template.id);
      setActive((prev) => [participation, ...prev]);
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, joined: true } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function checkIn(p: ChallengeParticipation) {
    if (busyId) return;
    setBusyId(p.challengeId);
    setError(null);
    try {
      const result = await checkInChallenge(p.challengeId);
      setCheckInNote(result.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function leave(p: ChallengeParticipation) {
    if (busyId) return;
    setBusyId(p.challengeId);
    setError(null);
    try {
      await leaveChallenge(p.challengeId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.sub}</Text>

      {notice ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{s.comingTitle}</Text>
          <Text style={styles.noticeBody}>{s.comingBody}</Text>
          <Pressable onPress={() => setNotice(null)} accessibilityRole="button">
            <Text style={styles.noticeClose}>{s.close}</Text>
          </Pressable>
        </View>
      ) : null}
      {checkInNote ? <Text style={styles.checkInNote}>{checkInNote}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.note}>{s.loading}</Text>
        </View>
      ) : error && active.length === 0 && templates.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.sectionTitle}>{s.active}</Text>
          {active.length === 0 ? (
            <Text style={styles.empty}>{s.noActive}</Text>
          ) : (
            active.map((p) => {
              const missed = missedDays(p);
              const progress = p.totalDays > 0 ? p.completedDays / p.totalDays : 0;
              return (
                <View key={p.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{p.challenge.title}</Text>
                  <Text style={styles.cardBody}>{p.challenge.description}</Text>
                  <Text style={styles.meta}>
                    {s.day} {p.currentDay} {s.of} {p.totalDays} · {p.completedDays} {s.daysDone}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.streak}>
                    🔥 {p.streak} {s.streak} · {p.pointsEarned} {s.points}
                  </Text>
                  {missed > 0 ? (
                    <Text style={styles.missed}>
                      😢 {missed} {s.missedDays} — {s.missedNote}
                    </Text>
                  ) : null}
                  <View style={styles.btnRow}>
                    <Pressable
                      onPress={() => void checkIn(p)}
                      style={[
                        styles.primaryBtn,
                        styles.flexBtn,
                        (p.todayCompleted || busyId === p.challengeId) && styles.btnDisabled,
                      ]}
                      disabled={p.todayCompleted || busyId === p.challengeId}
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryBtnText}>
                        {p.todayCompleted ? s.checkedIn : s.checkIn}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setNotice('share')}
                      style={[styles.peachBtn, styles.flexBtn]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.peachBtnText}>{s.share}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setNotice('dare')}
                      style={[styles.peachBtn, styles.flexBtn]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.peachBtnText}>{s.dare}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.meta}>{s.selfReported}</Text>
                  <Pressable onPress={() => void leave(p)} disabled={busyId === p.challengeId} accessibilityRole="button">
                    <Text style={styles.leave}>{s.leave} — {s.leaveRule}</Text>
                  </Pressable>
                </View>
              );
            })
          )}

          <Text style={styles.sectionTitle}>{s.templates}</Text>
          {templates.length === 0 ? (
            <Text style={styles.empty}>{s.noTemplates}</Text>
          ) : (
            templates.map((t) => (
              <View key={t.id} style={styles.card}>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <Text style={styles.cardBody}>{t.description}</Text>
                <Text style={styles.meta}>
                  {t.durationDays} days · {t.requirement}
                </Text>
                {t.rules.slice(0, 3).map((rule) => (
                  <Text key={rule} style={styles.rule}>
                    • {rule}
                  </Text>
                ))}
                <Pressable
                  onPress={() => void join(t)}
                  style={[
                    styles.primaryBtn,
                    (t.joined || busyId === t.id) && styles.btnDisabled,
                  ]}
                  disabled={t.joined || busyId === t.id}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>{t.joined ? s.joined : s.join}</Text>
                </Pressable>
              </View>
            ))
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
  note: { fontSize: 13, color: C.muted, marginTop: 10, textAlign: 'center' },
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
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 6 },
  cardBody: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 8 },
  meta: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 8 },
  rule: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 4 },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: C.line,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: 10, backgroundColor: C.teal, borderRadius: 5 },
  streak: { fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 8 },
  missed: { fontSize: 14, color: C.ink, lineHeight: 20, marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  flexBtn: { flex: 1 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryBtnText: { color: C.white, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  peachBtnText: { color: C.peachDeep, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  btnDisabled: { opacity: 0.6 },
  leave: { color: C.red, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  noticeCard: {
    backgroundColor: C.peach2,
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  noticeTitle: { fontSize: 16, fontWeight: '800', color: C.peachDeep, marginBottom: 6 },
  noticeBody: { fontSize: 14, color: C.ink, lineHeight: 20, marginBottom: 8 },
  noticeClose: { color: C.teal, fontSize: 14, fontWeight: '800' },
  checkInNote: {
    fontSize: 13,
    color: C.teal,
    backgroundColor: C.peach2,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    lineHeight: 18,
  },
});
