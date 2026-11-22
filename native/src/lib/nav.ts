/**
 * Shared navigation contract for the native app (Phase 2).
 *
 * State-based navigation (NOT Expo Router): Phase 1 deliberately used
 * state-based screens in App.tsx and this phase keeps it, so the
 * working login and the running Metro preview are not disturbed.
 * Every screen lives in src/screens/<Name>.tsx and exports a default
 * component named <Name>Screen accepting ScreenProps. App.tsx passes
 * all props to every screen; screens ignore what they don't need.
 */
import type { AppLanguage } from './strings';
import type { AuthUser } from './api';

export type ScreenId =
  | 'welcome'
  | 'language'
  | 'login'
  | 'signup'
  | 'onboarding'
  | 'home'
  | 'dashboard'
  | 'prayer'
  | 'salahCalendar'
  | 'islamic-calendar'
  | 'search'
  | 'quran'
  | 'reader'
  | 'now-playing'
  | 'para'
  | 'lifeAyahs'
  | 'duas'
  | 'tasbeeh'
  | 'hifz'
  | 'khatmah'
  | 'qibla'
  | 'fasting'
  | 'mosque'
  | 'study'
  | 'focus'
  | 'sleep'
  | 'appBlock'
  | 'challenges'
  | 'friends'
  | 'analytics'
  | 'notifications'
  | 'support'
  | 'profile';

export type ScreenProps = {
  lang: AppLanguage;
  goTo: (s: ScreenId) => void;
  /** Go to the previous screen (no-op when there is none). */
  goBack: () => void;
  /** True when goBack has somewhere to go. */
  canGoBack: boolean;
  user: AuthUser | null;
  onLang: (l: AppLanguage) => void;
  onLoginSuccess: (u: AuthUser) => void;
  onLogout: () => Promise<void>;
  onOnboardingDone: () => void;
  /** True only when Onboarding is opened fresh after signup/login
   * (not when editing the profile) — shows the details-video popup. */
  freshOnboarding?: boolean;
};

/** Bottom pill nav (shown only after login): Home, Dashboard, Quran, Focus, Profile. */
export const PILL_NAV: ScreenId[] = ['home', 'dashboard', 'quran', 'focus', 'profile'];
