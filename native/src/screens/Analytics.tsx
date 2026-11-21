/**
 * Analytics — real data only, from the live API.
 * GET /api/study/stats (focus minutes, tasks done, streak, per-subject
 * breakdown), GET /api/rewards/summary (points, badges, recent),
 * GET /api/salah/calendar/:month (prayed/qaza/missed/pending counts),
 * GET /api/challenges/mine (active challenge counts).
 *
 * Only counts the server actually returns are shown. Where there is
 * no data, an honest empty state is shown. No percentages, no
 * invented statistics, ever.
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
  myChallenges,
  rewardsSummary,
  salahCalendar,
  studyStats,
  type RewardsSummary,
  type StudyStats,
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
    title: 'Analytics',
    sub: 'Only real numbers from your account. If a section is empty, it means there is no data yet — nothing is estimated.',
    focusToday: 'Focus minutes today',
    focusWeek: 'Focus minutes this week',
    tasksToday: 'Tasks completed today',
    streak: 'Focus streak',
    days: 'days',
    min: 'min',
    points: 'Total points',
    badges: 'Badges earned',
    noBadges: 'No badges yet — badges are earned from real activity.',
    recentPoints: 'Recent points',
    noRecent: 'No points yet.',
    salahMonth: 'Salah this month',
    prayed: 'Prayed',
    qaza: 'Qaza',
    missed: 'Missed',
    pending: 'Pending',
    noSalah: 'No Salah records this month yet.',
    subjects: 'Subjects this week',
    noSubjects: 'No subjects yet.',
    tasksDone: 'tasks done',
    focusWeekSub: 'focus this week',
    challenges: 'Challenges',
    activeChallenges: 'active challenges',
    noChallenges: 'No challenges joined yet.',
    loading: 'Loading your analytics…',
    retry: 'Retry',
    emptyAll: 'Nothing to show yet — use Salah, Study, Focus or Challenges and your real numbers will appear here.',
  },
  hi: {
    back: '← Wapas',
    title: 'Analytics',
    sub: 'Sirf aapke account ke asli numbers. Agar koi section khaali hai to matlab abhi data nahi hai — kuch estimate nahi kiya gaya.',
    focusToday: 'Aaj ke focus minutes',
    focusWeek: 'Is hafte ke focus minutes',
    tasksToday: 'Aaj poore hue tasks',
    streak: 'Focus streak',
    days: 'din',
    min: 'min',
    points: 'Total points',
    badges: 'Mile hue badges',
    noBadges: 'Abhi koi badge nahi — badge asli activity se milte hain.',
    recentPoints: 'Recent points',
    noRecent: 'Abhi koi points nahi.',
    salahMonth: 'Is mahine ki Salah',
    prayed: 'Prayed',
    qaza: 'Qaza',
    missed: 'Missed',
    pending: 'Pending',
    noSalah: 'Is mahine abhi koi Salah record nahi hai.',
    subjects: 'Is hafte ke subjects',
    noSubjects: 'Abhi koi subject nahi hai.',
    tasksDone: 'tasks poore',
    focusWeekSub: 'is hafte focus',
    challenges: 'Challenges',
    activeChallenges: 'active challenges',
    noChallenges: 'Abhi koi challenge join nahi kiya.',
    loading: 'Aapki analytics load ho rahi hai…',
    retry: 'Dobara try karo',
    emptyAll: 'Abhi dikhane ko kuch nahi — Salah, Study, Focus ya Challenges use karo, aapke asli numbers yahan aa jayenge.',
  },
} as const;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function AnalyticsScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [salahTotals, setSalahTotals] = useState<Record<string, number> | null>(null);
  const [activeChallengeCount, setActiveChallengeCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, rw, cal, mine] = await Promise.all([
        studyStats(),
        rewardsSummary(),
        salahCalendar(currentMonthKey()),
        myChallenges(),
      ]);
      setStats(st);
      setRewards(rw);
      setSalahTotals(cal.totals);
      setActiveChallengeCount(mine.active.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasAnyData =
    (stats !== null &&
      (stats.todayFocusMinutes > 0 ||
        stats.weekFocusMinutes > 0 ||
        stats.tasksCompletedToday > 0 ||
        stats.streak > 0 ||
        stats.subjectBreakdown.length > 0)) ||
    (rewards !== null && (rewards.total > 0 || rewards.badges.length > 0)) ||
    (salahTotals !== null &&
      Object.values(salahTotals).some((v) => v > 0)) ||
    (activeChallengeCount !== null && activeChallengeCount > 0);

  const statCard = (label: string, value: string) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

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
      ) : error && !stats && !rewards ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!hasAnyData ? <Text style={styles.empty}>{s.emptyAll}</Text> : null}

          {stats ? (
            <>
              <View style={styles.statGrid}>
                {statCard(s.focusToday, `${stats.todayFocusMinutes} ${s.min}`)}
                {statCard(s.focusWeek, `${stats.weekFocusMinutes} ${s.min}`)}
                {statCard(s.tasksToday, String(stats.tasksCompletedToday))}
                {statCard(s.streak, `${stats.streak} ${s.days}`)}
              </View>
              <Text style={styles.sectionTitle}>{s.subjects}</Text>
              {stats.subjectBreakdown.length === 0 ? (
                <Text style={styles.empty}>{s.noSubjects}</Text>
              ) : (
                stats.subjectBreakdown.map((row) => (
                  <View key={row.subjectId} style={styles.rowCard}>
                    <Text style={styles.rowTitle}>{row.name}</Text>
                    <Text style={styles.rowMeta}>
                      {row.tasksDone}/{row.tasksTotal} {s.tasksDone} · {row.focusMinutesWeek}{' '}
                      {s.min} {s.focusWeekSub}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : null}

          {rewards ? (
            <>
              <Text style={styles.sectionTitle}>{s.points}</Text>
              <View style={styles.statGrid}>{statCard(s.points, String(rewards.total))}</View>
              <Text style={styles.sectionTitle}>{s.badges}</Text>
              {rewards.badges.length === 0 ? (
                <Text style={styles.empty}>{s.noBadges}</Text>
              ) : (
                rewards.badges.map((b) => (
                  <View key={b.badgeId} style={styles.rowCard}>
                    <Text style={styles.rowTitle}>{b.title}</Text>
                    {b.description ? <Text style={styles.rowMeta}>{b.description}</Text> : null}
                  </View>
                ))
              )}
              <Text style={styles.sectionTitle}>{s.recentPoints}</Text>
              {rewards.recent.length === 0 ? (
                <Text style={styles.empty}>{s.noRecent}</Text>
              ) : (
                rewards.recent.map((t) => (
                  <View key={t.id} style={styles.rowCard}>
                    <Text style={styles.rowTitle}>
                      +{t.amount} · {t.reason}
                    </Text>
                    <Text style={styles.rowMeta}>{new Date(t.createdAt).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </>
          ) : null}

          {salahTotals ? (
            <>
              <Text style={styles.sectionTitle}>{s.salahMonth}</Text>
              {(salahTotals.prayed ?? 0) +
                (salahTotals.qaza ?? 0) +
                (salahTotals.missed ?? 0) +
                (salahTotals.pending ?? 0) ===
              0 ? (
                <Text style={styles.empty}>{s.noSalah}</Text>
              ) : (
                <View style={styles.statGrid}>
                  {statCard(s.prayed, String(salahTotals.prayed ?? 0))}
                  {statCard(s.qaza, String(salahTotals.qaza ?? 0))}
                  {statCard(s.missed, String(salahTotals.missed ?? 0))}
                  {statCard(s.pending, String(salahTotals.pending ?? 0))}
                </View>
              )}
            </>
          ) : null}

          {activeChallengeCount !== null ? (
            <>
              <Text style={styles.sectionTitle}>{s.challenges}</Text>
              {activeChallengeCount === 0 ? (
                <Text style={styles.empty}>{s.noChallenges}</Text>
              ) : (
                <View style={styles.statGrid}>
                  {statCard(s.activeChallenges, String(activeChallengeCount))}
                </View>
              )}
            </>
          ) : null}
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
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: C.teal900 },
  statLabel: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  rowCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  rowMeta: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
});
