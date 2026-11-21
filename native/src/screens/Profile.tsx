/**
 * Profile — profile display, edit-profile entry point, logout.
 * Profile data comes from GET /api/profile (name, city, state,
 * country, timezone) plus the signed-in user from the login session.
 * "Edit profile" opens onboarding in edit mode (goTo('onboarding'));
 * the onboarding screen itself is owned by another worker.
 * Logout calls the onLogout prop (real API logout, local-first).
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
import { getProfile, rewardsSummary, type ProfileData, type RewardsSummary } from '../lib/apiSocial';

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
    title: 'Profile',
    emailVerified: 'Email verified',
    emailNotVerified: 'Email not verified yet',
    location: 'Location',
    timezone: 'Timezone',
    onboarding: 'Onboarding',
    onboardingDone: 'Completed',
    onboardingPending: 'Not completed yet',
    points: 'Total points',
    badges: 'Badges',
    editProfile: 'Edit profile',
    editNote: 'Change your personal, prayer, study and sleep settings in onboarding.',
    logOut: 'Log out',
    loggingOut: 'Logging out…',
    loading: 'Loading your profile…',
    retry: 'Retry',
    notSet: 'Not set',
    sleep: 'Sleep',
  },
  hi: {
    back: '← Wapas',
    title: 'Profile',
    emailVerified: 'Email verified hai',
    emailNotVerified: 'Email abhi verify nahi hua',
    location: 'Location',
    timezone: 'Timezone',
    onboarding: 'Onboarding',
    onboardingDone: 'Poora ho gaya',
    onboardingPending: 'Abhi poora nahi hua',
    points: 'Total points',
    badges: 'Badges',
    editProfile: 'Edit profile',
    editNote: 'Apni personal, namaz, study aur sleep settings onboarding me badlo.',
    logOut: 'Log out',
    loggingOut: 'Logging out…',
    loading: 'Aapka profile load ho raha hai…',
    retry: 'Dobara try karo',
    notSet: 'Set nahi hai',
    sleep: 'Sleep',
  },
} as const;

export default function ProfileScreen({ lang, goTo, user, onLogout }: ScreenProps) {
  const s = STR[lang];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prof, rw] = await Promise.all([getProfile(), rewardsSummary()]);
      setProfile(prof.profile);
      setOnboardingDone(prof.onboarding.completed);
      setRewards(rw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const location = [profile?.city, profile?.state, profile?.country]
    .filter((v) => typeof v === 'string' && v.length > 0)
    .join(', ');
  const sleepText = [profile?.sleepStartTime, profile?.sleepEndTime]
    .filter((v) => typeof v === 'string' && v.length > 0)
    .join(' – ');

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>

      <View style={styles.helloCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.helloName}>{user?.name ?? ''}</Text>
        <Text style={styles.helloEmail}>{user?.email ?? ''}</Text>
        <Text style={styles.verified}>
          {user?.emailVerified ? s.emailVerified : s.emailNotVerified}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.note}>{s.loading}</Text>
        </View>
      ) : error && !profile ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.card}>
            <Row label={s.location} value={location || s.notSet} />
            <Row
              label={s.timezone}
              value={typeof profile?.timezone === 'string' ? profile.timezone : s.notSet}
            />
            <Row
              label={s.sleep}
              value={sleepText || s.notSet}
            />
            <Row
              label={s.onboarding}
              value={
                onboardingDone === null
                  ? s.notSet
                  : onboardingDone
                    ? s.onboardingDone
                    : s.onboardingPending
              }
            />
            {rewards ? (
              <>
                <Row label={s.points} value={String(rewards.total)} />
                <Row label={s.badges} value={String(rewards.badges.length)} />
              </>
            ) : null}
          </View>
        </>
      )}

      <Pressable onPress={() => goTo('onboarding')} style={styles.peachBtn} accessibilityRole="button">
        <Text style={styles.peachBtnText}>{s.editProfile}</Text>
      </Pressable>
      <Text style={styles.note}>{s.editNote}</Text>

      <Pressable
        onPress={async () => {
          if (loggingOut) return;
          setLoggingOut(true);
          try {
            await onLogout();
          } finally {
            setLoggingOut(false);
          }
        }}
        style={[styles.primaryBtn, loggingOut && styles.btnDisabled]}
        disabled={loggingOut}
        accessibilityRole="button"
      >
        {loggingOut ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <Text style={styles.primaryBtnText}>{s.logOut}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5, marginBottom: 16 },
  center: { alignItems: 'center', paddingVertical: 40 },
  note: { fontSize: 13, color: C.muted, marginTop: 12, textAlign: 'center', lineHeight: 19 },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  helloCard: {
    backgroundColor: C.teal950,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: C.white, fontSize: 32, fontWeight: '800' },
  helloName: { color: C.white, fontSize: 24, fontWeight: '800' },
  helloEmail: { color: '#B8CFCB', fontSize: 14, marginTop: 4 },
  verified: { color: C.peach, fontSize: 13, fontWeight: '700', marginTop: 8 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: C.muted },
  rowValue: { fontSize: 14, fontWeight: '700', color: C.ink, textAlign: 'right', flex: 1, marginLeft: 12 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '800' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peachBtnText: { color: C.peachDeep, fontSize: 17, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
});
