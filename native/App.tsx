/**
 * App shell ONLY: language state, user state, screen state per nav.ts,
 * bottom pill nav (Home, Dashboard, Quran, Focus, Profile) after login,
 * and logout. Screens live in src/screens/ and receive ScreenProps.
 *
 * Post-login routing: after a successful login the profile's onboarding
 * status is checked — if onboarding was never completed (and never
 * skipped), the user goes to Onboarding; otherwise to Dashboard
 * (the post-login landing). A failed profile check never blocks login.
 *
 * NOTE: all ScreenIds are wired to their real screens (other workers'
 * files landed during this phase and typecheck cleanly). The Placeholder
 * remains only as a default fallback. Worker A owns Welcome, Login,
 * Onboarding, Home, Dashboard, Prayer and SalahCalendar.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { logout, type AuthUser } from './src/lib/api';
import { loadProfileWithCompletion } from './src/lib/apiCore';
import { PILL_NAV, type ScreenId, type ScreenProps } from './src/lib/nav';
import { stringsFor, type AppLanguage } from './src/lib/strings';
import { C } from './src/lib/theme';
import WelcomeScreen from './src/screens/Welcome';
import LoginScreen from './src/screens/Login';
import OnboardingScreen from './src/screens/Onboarding';
import HomeScreen from './src/screens/Home';
import DashboardScreen from './src/screens/Dashboard';
import PrayerScreen from './src/screens/Prayer';
import SalahCalendarScreen from './src/screens/SalahCalendar';
import QuranBookScreen from './src/screens/QuranBook';
import LifeAyahsScreen from './src/screens/LifeAyahs';
import DuasScreen from './src/screens/Duas';
import TasbeehScreen from './src/screens/Tasbeeh';
import HijriScreen from './src/screens/Hijri';
import MosqueScreen from './src/screens/Mosque';
import StudyScreen from './src/screens/Study';
import FocusScreen from './src/screens/Focus';
import SleepScreen from './src/screens/Sleep';
import AppBlockScreen from './src/screens/AppBlock';
import ChallengesScreen from './src/screens/Challenges';
import FriendsScreen from './src/screens/Friends';
import AnalyticsScreen from './src/screens/Analytics';
import NotificationsScreen from './src/screens/Notifications';
import ProfileScreen from './src/screens/Profile';
import PlaceholderScreen from './src/screens/Placeholder';

const PILL_LABELS: Record<string, keyof ReturnType<typeof stringsFor>> = {
  home: 'navHome',
  dashboard: 'navDashboard',
  quran: 'navQuran',
  focus: 'navFocus',
  profile: 'navProfile',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('welcome');
  const [lang, setLang] = useState<AppLanguage>('hi');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  const s = stringsFor(lang);

  function goTo(next: ScreenId) {
    setScreen(next);
  }

  async function handleLoginSuccess(u: AuthUser) {
    setUser(u);
    setCheckingOnboarding(true);
    try {
      const status = await loadProfileWithCompletion(u.name);
      if (!status.onboardingCompleted && !status.onboardingSkipped) {
        setScreen('onboarding');
      } else {
        setScreen('dashboard');
      }
    } catch {
      // A failed profile check never blocks login.
      setScreen('dashboard');
    } finally {
      setCheckingOnboarding(false);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setScreen('welcome');
  }

  const props: ScreenProps = {
    lang,
    goTo,
    user,
    onLang: setLang,
    onLoginSuccess: handleLoginSuccess,
    onLogout: handleLogout,
    onOnboardingDone: () => setScreen('dashboard'),
  };

  const showPillNav = user !== null && screen !== 'onboarding' && !checkingOnboarding;

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      {checkingOnboarding ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={styles.loadingText}>{s.loading}</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.screenWrap}>{renderScreen(screen, props)}</View>
          {showPillNav ? (
            <View style={styles.pillNav}>
              {PILL_NAV.map((id) => {
                const active = screen === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => goTo(id)}
                    style={[styles.pillItem, active && styles.pillItemActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {s[PILL_LABELS[id]]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function renderScreen(screen: ScreenId, props: ScreenProps) {
  switch (screen) {
    case 'welcome':
      return <WelcomeScreen {...props} />;
    case 'login':
      return <LoginScreen {...props} />;
    case 'onboarding':
      return <OnboardingScreen {...props} />;
    case 'home':
      return <HomeScreen {...props} />;
    case 'dashboard':
      return <DashboardScreen {...props} />;
    case 'prayer':
      return <PrayerScreen {...props} />;
    case 'salahCalendar':
      return <SalahCalendarScreen {...props} />;
    case 'quran':
      return <QuranBookScreen {...props} />;
    case 'lifeAyahs':
      return <LifeAyahsScreen {...props} />;
    case 'duas':
      return <DuasScreen {...props} />;
    case 'tasbeeh':
      return <TasbeehScreen {...props} />;
    case 'hijri':
      return <HijriScreen {...props} />;
    case 'mosque':
      return <MosqueScreen {...props} />;
    case 'study':
      return <StudyScreen {...props} />;
    case 'focus':
      return <FocusScreen {...props} />;
    case 'sleep':
      return <SleepScreen {...props} />;
    case 'appBlock':
      return <AppBlockScreen {...props} />;
    case 'challenges':
      return <ChallengesScreen {...props} />;
    case 'friends':
      return <FriendsScreen {...props} />;
    case 'analytics':
      return <AnalyticsScreen {...props} />;
    case 'notifications':
      return <NotificationsScreen {...props} />;
    case 'profile':
      return <ProfileScreen {...props} />;
    default:
      return <PlaceholderScreen {...props} />;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ice },
  body: { flex: 1 },
  screenWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: C.muted },
  pillNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    backgroundColor: C.teal950,
    borderRadius: 999,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillItem: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillItemActive: { backgroundColor: C.teal },
  pillText: { fontSize: 12, fontWeight: '700', color: '#B9CFC9' },
  pillTextActive: { color: C.white },
});
