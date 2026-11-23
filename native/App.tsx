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
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { logout, restoreSession, setOnUnauthorized, type AuthUser } from './src/lib/api';
import { loadProfileWithCompletion } from './src/lib/apiCore';
import { refreshPrayerNotifications } from './src/lib/prayerNotifications';
import { DARK, initAppTheme, useAppTheme } from './src/lib/appTheme';
import { PILL_NAV, type ScreenId, type ScreenProps } from './src/lib/nav';
import { stringsFor, type AppLanguage } from './src/lib/strings';
import { C, F, S } from './src/lib/theme';
import MiniPlayer from './src/components/MiniPlayer';
import NowPlayingScreen from './src/screens/NowPlaying';
import WelcomeScreen from './src/screens/Welcome';
import LanguageScreen from './src/screens/Language';
import LoginScreen from './src/screens/Login';
import SignupScreen from './src/screens/Signup';
import OnboardingScreen from './src/screens/Onboarding';
import HomeScreen from './src/screens/Home';
import DashboardScreen from './src/screens/Dashboard';
import PrayerScreen from './src/screens/Prayer';
import PrayerJournalScreen from './src/screens/PrayerJournal';
import SalahCalendarScreen from './src/screens/SalahCalendar';
import QuranBookScreen, { QuranReaderScreen } from './src/screens/QuranBook';
import ParaBookScreen from './src/screens/ParaBook';
import LifeAyahsScreen from './src/screens/LifeAyahs';
import DuasScreen from './src/screens/Duas';
import TasbeehScreen from './src/screens/Tasbeeh';
import HifzScreen from './src/screens/Hifz';
import KhatmahScreen from './src/screens/Khatmah';
import QiblaScreen from './src/screens/Qibla';
import FastingScreen from './src/screens/Fasting';
import MoodRemedyScreen from './src/screens/MoodRemedy';
import IslamicCalendarScreen from './src/screens/IslamicCalendar';
import SearchScreen from './src/screens/Search';
import MosqueScreen from './src/screens/Mosque';
import StudyScreen from './src/screens/Study';
import FocusScreen from './src/screens/Focus';
import SleepScreen from './src/screens/Sleep';
import AppBlockScreen from './src/screens/AppBlock';
import ChallengesScreen from './src/screens/Challenges';
import FriendsScreen from './src/screens/Friends';
import AnalyticsScreen from './src/screens/Analytics';
import NotificationsScreen from './src/screens/Notifications';
import SupportScreen from './src/screens/Support';
import ProfileScreen from './src/screens/Profile';
import PlaceholderScreen from './src/screens/Placeholder';

const PILL_LABELS: Record<string, keyof ReturnType<typeof stringsFor>> = {
  home: 'navHome',
  dashboard: 'navDashboard',
  quran: 'navQuran',
  focus: 'navFocus',
  profile: 'navProfile',
};

/** Preview pill-nav icons (Ionicons, 20px): home, grid, book, target, person. */
const PILL_ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  home: { on: 'home', off: 'home-outline' },
  dashboard: { on: 'grid', off: 'grid-outline' },
  quran: { on: 'book', off: 'book-outline' },
  focus: { on: 'locate', off: 'locate-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

// Keep the splash screen visible until the fonts are ready, so text never
// renders in the wrong font (SDK 58 expo-font + expo-splash-screen pattern).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('language');
  // Back stack: every goTo pushes the screen we leave, so any screen
  // opened from a tile (or from another screen) gets a working back
  // button. The five pill-nav screens are top-level and show no back bar.
  const [history, setHistory] = useState<ScreenId[]>([]);
  const [lang, setLang] = useState<AppLanguage>('hi');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  // True while the saved session is being validated on startup
  // (Instagram-style: a stored token logs the user straight in).
  const [restoringSession, setRestoringSession] = useState(true);
  // True only when Onboarding opens fresh after signup/login (not when
  // editing the profile) — Onboarding shows the details-video popup.
  const [onboardingFresh, setOnboardingFresh] = useState(false);

  // Display prefs (theme / animations / greetings): reactive — the
  // shell background below follows the resolved theme.
  const th = useAppTheme();

  // Load this user's display prefs (per-user AsyncStorage) whenever
  // the signed-in user changes; 'anon' before login / after logout.
  useEffect(() => {
    initAppTheme(user?.id ?? 'anon');
  }, [user?.id]);

  // One family name per typeface; fontWeight selects the face (SDK 58
  // expo-font FontFamilyDefinition array form). Family names must match
  // F.sans / F.arabic in src/lib/theme.ts.
  const [fontsLoaded, fontError] = useFonts([
    {
      fontFamily: F.sans,
      fontDefinitions: [
        { path: PlusJakartaSans_400Regular, weight: 400 },
        { path: PlusJakartaSans_500Medium, weight: 500 },
        { path: PlusJakartaSans_600SemiBold, weight: 600 },
        { path: PlusJakartaSans_700Bold, weight: 700 },
        { path: PlusJakartaSans_800ExtraBold, weight: 800 },
      ],
    },
    {
      fontFamily: F.arabic,
      fontDefinitions: [
        { path: Amiri_400Regular, weight: 400 },
        { path: Amiri_700Bold, weight: 700 },
      ],
    },
  ]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Restore a saved session on startup (login once, stay logged
  // in) and register the global 401 handler: when any API call
  // finds the session dead, drop local state and show login
  // instead of leaving every screen on "Authentication required".
  useEffect(() => {
    setOnUnauthorized(() => {
      void logout().finally(() => {
        setUser(null);
        setHistory([]);
        setScreen('welcome');
      });
    });
    let cancelled = false;
    restoreSession()
      .then((u) => {
        if (cancelled) return;
        if (u) {
          void handleLoginSuccess(u);
          // Re-schedule today + tomorrow's prayer alerts on every
          // app open (fire-and-forget; it no-ops when alerts are off
          // or permission is not granted, and never blocks login).
          void refreshPrayerNotifications();
        }
        setRestoringSession(false);
      })
      .catch(() => {
        if (!cancelled) setRestoringSession(false);
      });
    return () => {
      cancelled = true;
      setOnUnauthorized(null);
    };
    // Runs once on mount; handleLoginSuccess only uses stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android hardware back button: go back through the history stack
  // instead of exiting the app. When there is no history, the system
  // handles the press (exits).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (history.length > 0) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [history]);

  const s = stringsFor(lang);

  function goTo(next: ScreenId) {
    if (next === screen) return;
    // Editing the profile is not a fresh onboarding — no video popup.
    if (next === 'onboarding') setOnboardingFresh(false);
    setHistory((prev) => [...prev, screen]);
    setScreen(next);
  }

  function goBack() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setScreen(last);
  }

  async function handleLoginSuccess(u: AuthUser) {
    setUser(u);
    setCheckingOnboarding(true);
    try {
      const status = await loadProfileWithCompletion(u.name);
      if (!status.onboardingCompleted && !status.onboardingSkipped) {
        setOnboardingFresh(true);
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
    setHistory([]);
    setScreen('welcome');
  }

  const props: ScreenProps = {
    lang,
    goTo,
    goBack,
    canGoBack: history.length > 0,
    user,
    onLang: setLang,
    onLoginSuccess: handleLoginSuccess,
    onLogout: handleLogout,
    onOnboardingDone: () => setScreen('dashboard'),
    freshOnboarding: onboardingFresh,
  };

  const showPillNav = user !== null && screen !== 'onboarding' && !checkingOnboarding;
  // Back bar on every screen that is not a top-level pill screen and not
  // part of the auth/onboarding flow — only when there is somewhere to go.
  const showBackBar =
    user !== null &&
    screen !== 'onboarding' &&
    !PILL_NAV.includes(screen) &&
    history.length > 0;

  // Fonts gate: nothing renders until Plus Jakarta Sans + Amiri are loaded
  // (or loading failed, in which case the system font is the fallback).
  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaView style={[styles.safe, th.dark && { backgroundColor: DARK.bg }]}>
        <ExpoStatusBar style={th.dark ? 'light' : 'dark'} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.teal700} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, th.dark && { backgroundColor: DARK.bg }]}>
      <ExpoStatusBar style={th.dark ? 'light' : 'dark'} />
      {checkingOnboarding || restoringSession ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.teal700} />
          <Text style={styles.loadingText}>{s.loading}</Text>
        </View>
      ) : (
        <View style={styles.body}>
          {showBackBar ? (
            <Pressable
              onPress={goBack}
              style={styles.backBar}
              accessibilityRole="button"
              accessibilityLabel={s.back}
            >
              <Text style={styles.backText}>← {s.back}</Text>
            </Pressable>
          ) : null}
          <View style={styles.screenWrap}>{renderScreen(screen, props)}</View>
          {user !== null ? <MiniPlayer onOpenReader={() => goTo('now-playing')} /> : null}
          {showPillNav ? (
            <View style={styles.pillNav}>
              {PILL_NAV.map((id) => {
                const active = screen === id;
                const icon = PILL_ICONS[id];
                return (
                  <Pressable
                    key={id}
                    onPress={() => goTo(id)}
                    style={({ pressed }) => [
                      styles.pillItem,
                      active && styles.pillItemActive,
                      pressed && styles.pillItemPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={active ? icon.on : icon.off}
                      size={20}
                      color={active ? C.teal900 : C.navInactive}
                    />
                    <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
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
    case 'language':
      return <LanguageScreen {...props} />;
    case 'login':
      return <LoginScreen {...props} />;
    case 'signup':
      return <SignupScreen {...props} />;
    case 'onboarding':
      return <OnboardingScreen {...props} />;
    case 'home':
      return <HomeScreen {...props} />;
    case 'dashboard':
      return <DashboardScreen {...props} />;
    case 'prayer':
      return <PrayerScreen {...props} />;
    case 'prayerJournal':
      return <PrayerJournalScreen {...props} />;
    case 'salahCalendar':
      return <SalahCalendarScreen {...props} />;
    case 'quran':
      return <QuranBookScreen {...props} />;
    case 'reader':
      return <QuranReaderScreen {...props} />;
    case 'now-playing':
      return <NowPlayingScreen {...props} />;
    case 'para':
      return <ParaBookScreen {...props} />;
    case 'lifeAyahs':
      return <LifeAyahsScreen {...props} />;
    case 'duas':
      return <DuasScreen {...props} />;
    case 'tasbeeh':
      return <TasbeehScreen {...props} />;
    case 'hifz':
      return <HifzScreen {...props} />;
    case 'khatmah':
      return <KhatmahScreen {...props} />;
    case 'qibla':
      return <QiblaScreen {...props} />;
    case 'fasting':
      return <FastingScreen {...props} />;
    case 'moodRemedy':
      return <MoodRemedyScreen {...props} />;
    case 'islamic-calendar':
      return <IslamicCalendarScreen {...props} />;
    case 'search':
      return <SearchScreen {...props} />;
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
    case 'support':
      return <SupportScreen {...props} />;
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
  loadingText: { fontFamily: F.sans, marginTop: 12, fontSize: 14, color: C.muted },
  pillNav: {
    // In-flow, NOT absolute: the floating pill used to overlap the
    // MiniPlayer (same dark teal, buttons hidden under it — user
    // report 2026-11-22). Stacked in the column — content, then
    // MiniPlayer, then the pill at the very bottom — nothing is
    // covered and every button stays visible and tappable. The
    // pill look (rounded, side margins, shadow) is unchanged.
    flexDirection: 'row',
    gap: 2,
    backgroundColor: C.teal900,
    borderRadius: 999,
    padding: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillItem: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  pillItemActive: { backgroundColor: C.white },
  pillItemPressed: { transform: [{ scale: 0.94 }] },
  pillText: {
    fontFamily: F.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: C.navInactive,
    textAlign: 'center',
  },
  pillTextActive: { color: C.teal900 },
  backBar: {
    // Same top clearance as the screens (S.screenTop) so the button
    // sits BELOW the status bar (time/battery), never under it.
    paddingHorizontal: 20,
    paddingTop: S.screenTop,
    paddingBottom: 6,
  },
  backText: {
    fontFamily: F.sans,
    fontSize: 15,
    fontWeight: '700',
    color: C.teal700,
  },
});
