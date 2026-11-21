import SalahTracker from './components/SalahTracker';
import Tasbeeh from './components/Tasbeeh';
import NotificationsScreen from './components/NotificationsScreen';
import Sleep from './components/Sleep';
import HomeScreen, { NextPrayerBanner } from './components/Home';
import Friends from './components/Friends';
import NotificationSettingsPanel from './components/NotificationSettings';
import CuratedDuas from './components/QuranDuas';
import QuranBrowser from './components/QuranBrowser';
import HijriCalendar from './components/HijriCalendar';
import MosqueFinder from './components/MosqueFinder';
import SecuritySettings from './components/SecuritySettings';
import { connectSocket, disconnectSocket } from './lib/socket';
import {
  fetchNotifications,
  fetchUnreadCount,
  type AppNotification,
} from './lib/notificationsApi';
import FeedbackForm from './components/FeedbackForm';
import PasswordField from './components/PasswordField';
import { useEffect, useMemo, useRef, useState } from 'react';
import Onboarding from './components/Onboarding';
import LanguageSelector from './components/LanguageSelector';
import { LOGIN_STRINGS, pickText, readStoredLanguage, storeLanguage, type AppLanguage } from './lib/language';
import AuthBackdrop from './components/AuthBackdrop';
import Typewriter from './components/Typewriter';
import AhdoraMeaning from './components/AhdoraMeaning';
import AhdoraLogo from './components/AhdoraLogo';
import { emptyProfile, type UserProfile } from './types/profile';
import { loadProfileWithCompletion, saveProfile, saveProfilePartial } from './lib/profileApi';
import { fetchPrayerTimes, type PrayerTimesResponse } from './lib/prayerApi';
import {
  abandonPomodoro,
  completePomodoro,
  createSubject,
  createTask,
  deleteSubject,
  deleteTask,
  fetchActivePomodoro,
  fetchPomodoroHistory,
  fetchStudyStats,
  fetchSubjects,
  fetchTasks,
  fetchToday,
  pausePomodoro,
  resumePomodoro,
  setTaskStatus,
  startPomodoro,
  updateSubject,
  updateTask,
  type PomodoroSession,
  type StudySchedule,
  type StudyStats,
  type StudySubject,
  type StudyTask,
  type TaskPriority,
  type TaskStatus,
} from './lib/studyApi';
import { sleepDurationLabel } from './types/profile';
import {
  checkInChallenge,
  createChallenge,
  fetchChallengeDetail,
  fetchMyChallenges,
  fetchTemplates,
  joinChallenge,
  joinTemplate,
  leaveChallenge,
  type Challenge,
  type ChallengeCategory,
  type ChallengeDetail,
  type ChallengeParticipation,
  type ChallengeTemplate,
} from './lib/challengesApi';
import {
  fetchPointsHistory,
  fetchRewardsSummary,
  type PointTransaction,
  type RewardsSummary,
} from './lib/rewardsApi';
import {
  challengeCategoryLabel,
  challengeProgressSource,
  challengeRequirement,
  minutesOrHours,
  pointReasonLabel,
  stringsFor,
} from './lib/strings';
import { apiFetch, clearCsrfToken, isCsrfError, refreshCsrfToken } from './lib/http.js';
import type { CSSProperties, ReactNode, FormEvent } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, BookMarked,
  CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, Clock3,
  Compass, Eye, EyeOff, Flame, GraduationCap, Heart, Home, Lock,
  Moon, Pause, Play, Plus, Shield,
  ShieldCheck, Sparkles, Square, Sun, Target, Timer, Trophy, UserRound, Users, X, Zap,
} from 'lucide-react';


type AuthUser = { id: string; name: string; email: string; emailVerified: boolean; role: string };
type ApiResponse<T> = T;

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await apiFetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (response.status === 204) return null as ApiResponse<T>;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data && typeof data.error === 'string'
      ? data.error
      : stringsFor(readStoredLanguage() ?? 'hi').common.requestFailed;
    throw new Error(message);
  }

  return data as ApiResponse<T>;
}

export type Page = 'home' | 'dashboard' | 'deen' | 'study' | 'challenges' | 'friends' | 'guidance' | 'focus' | 'analytics' | 'profile' | 'tasbeeh' | 'sleep' | 'notifications' | 'salah-calendar';

type GuidanceTab = 'quran' | 'duas' | 'hijri' | 'mosques';
type IconType = typeof Home;



const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function todayKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function countdownTo(time: string, now: Date, language: AppLanguage = 'hi'): string {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return '';
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const s = stringsFor(language);
  return hours > 0 ? s.common.countdownHm(hours, minutes) : s.common.countdownM(minutes);
}

/** Icons for the Guidance mood cards, in the same order as the
 * dictionary's guidance.cards (mood order is the selection key). */
const GUIDANCE_ICONS = [Heart, Compass, BookMarked, Target] as const;

function App() {
  const [screen, setScreen] = useState<'checking' | 'welcome' | 'login' | 'forgot' | 'reset' | 'onboarding' | 'app' | 'language'>('checking');
  // Phase 13 — language choice (English / Hinglish), stored in
  // localStorage under `ahdora-language`. The app's copy from Login
  // through Onboarding is bilingual: the chosen language is shown
  // big, the other language alongside it in smaller text.
  const [language, setLanguage] = useState<AppLanguage>(() => readStoredLanguage() ?? 'hi');
  // Phase 15 — app-wide bilingual strings: every logged-in screen
  // reads from this dictionary via its `language` prop. Changing the
  // language in Profile re-renders the whole app — no reload.
  const s = stringsFor(language);
  // The socket effect's closures predate a language change; the ref
  // keeps its toasts in the current language.
  const languageRef = useRef(language);
  languageRef.current = language;
  // Where the language screen sends the user after they pick one.
  const [afterLanguageScreen, setAfterLanguageScreen] = useState<'login' | 'app' | 'onboarding'>('login');
  // Password-reset links land on the reset screen; the session check
  // must not reroute those users (pre-existing behaviour preserved).
  // Read during render — before the reset effect clears the URL.
  const resetLinkRef = useRef(new URLSearchParams(window.location.search).has('resetToken'));
  const [resetToken, setResetToken] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  // True briefly after a successful login/signup so the auth button can
  // show its success tick before the screen changes. Presentation only;
  // the session itself is established by handleLogin/handleSignup.
  const [authSuccess, setAuthSuccess] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [guidanceTab, setGuidanceTab] = useState<GuidanceTab>('quran');
  const [guidanceSurah, setGuidanceSurah] = useState<number | null>(null);
  const [newUser, setNewUser] = useState<UserProfile>(() => emptyProfile());
  const [profileName, setProfileName] = useState('');
  const [toast, setToast] = useState('');
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesResponse | null>(null);
  const [prayerStatus, setPrayerStatus] = useState<'idle' | 'loading' | 'loaded' | 'error' | 'no-city'>('idle');
  const [prayerError, setPrayerError] = useState('');
  const [salahToday, setSalahToday] = useState<Record<string, { status: string }>>({});
  const [focusEnabled, setFocusEnabled] = useState(true);
  const [youtubeAllowed, setYoutubeAllowed] = useState(true);
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [todayTasks, setTodayTasks] = useState<StudyTask[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<StudySchedule | null>(null);
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);
  const [activePomodoro, setActivePomodoro] = useState<PomodoroSession | null>(null);
  const [pomodoroHistory, setPomodoroHistory] = useState<PomodoroSession[]>([]);
  const [studyError, setStudyError] = useState('');
  const [activeChallenges, setActiveChallenges] = useState<ChallengeParticipation[]>([]);
  const [challengeHistory, setChallengeHistory] = useState<ChallengeParticipation[]>([]);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [challengeError, setChallengeError] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);
  // false = profile exists but onboarding was skipped / never finished.
  // null = not known yet (before the first profile load).
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [focusSaving, setFocusSaving] = useState(false);
  // P7: the dashboard must not show "0 prayers / No activity recorded
  // yet" while today's data is still loading — those are real zeros
  // only after the first load finishes. Guests never load study/Salah
  // data, so the dashboard gates the loading state on guestMode.
  // Reset on logout / account deletion (see handleLogout).
  const [studyLoaded, setStudyLoaded] = useState(false);
  const [salahLoaded, setSalahLoaded] = useState(false);
  // Honest signup notice from the server (POST /api/auth/signup returns
  // verificationEmailSent + notice). Shown in the verify banner when the
  // verification email could not be sent — never claim it was sent.
  // Also carries the resend result (P10): on success the banner itself
  // confirms "Verification email sent", so the confirmation survives
  // even if the toast is missed; on failure it shows the error.
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  // P10: a resend in flight (slow server must not look dead, and a
  // double-click must not fire the request twice).
  const [resendingVerification, setResendingVerification] = useState(false);
  // P9: the saved resume step from GET /api/profile (the step a skip
  // was saved at). Used only when no step has incomplete required
  // fields — firstIncompleteStep() decides first.
  const [onboardingResumeStep, setOnboardingResumeStep] = useState(0);

  // P10: every notify() used to schedule its own 2.6s clear, so a
  // toast from an earlier action could wipe a newer toast almost
  // instantly (a stale timer firing right after a new toast appears).
  // One shared timer, reset on every notify, so each toast is actually
  // visible for the full duration.
  const toastTimer = useRef<number | null>(null);
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  /**
   * Route to a post-auth screen, showing the language picker first
   * when no choice is stored yet. Reads localStorage directly so
   * the check is never stale inside an effect closure. A returning
   * user (choice stored) never sees the picker again.
   * Phase 15: the post-login landing is the Dashboard (preview #4),
   * not the Home tile grid — the pill nav Home button still goes
   * to Home. The page is set here (before the language picker, if
   * any), so confirming the language keeps the Dashboard landing.
   */
  function openPostAuthScreen(next: 'app' | 'onboarding') {
    if (next === 'app') setPage('dashboard');
    if (readStoredLanguage() !== null) {
      setScreen(next);
      return;
    }
    setAfterLanguageScreen(next);
    setScreen('language');
  }

  /** First-open picker: store the choice, then continue where the user was headed. */
  function handleLanguageConfirm(next: AppLanguage) {
    storeLanguage(next);
    setLanguage(next);
    setScreen(afterLanguageScreen);
  }

  /** Change the language later (Login screen switch, Profile settings). */
  function handleLanguageChange(next: AppLanguage) {
    storeLanguage(next);
    setLanguage(next);
  }

  async function hydrateProfile(user: AuthUser) {
    setAuthUser(user);
    setProfileName(user.name);
    try {
      const loaded = await loadProfileWithCompletion(user.name, user.email);
      if (loaded) {
        setNewUser(loaded.profile);
        setOnboardingCompleted(loaded.onboardingCompleted);
        setOnboardingResumeStep(loaded.onboardingStep);
        // A skipped (incomplete) profile still enters the app — the
        // dashboard works with whatever is filled in, and Profile shows
        // "Profile poora karo" until onboarding is finished.
        openPostAuthScreen('app');
      } else {
        setNewUser(emptyProfile(user.name, user.email));
        setOnboardingCompleted(false);
        // No saved profile: the form opens at the very first step, never
        // at a step left over from a previous account in this tab (P9).
        setOnboardingInitialStep(0);
        setOnboardingResumeStep(0);
        openPostAuthScreen('onboarding');
      }
    } catch (error) {
      // A missing /api/profile route is not treated as a completed profile.
      setNewUser(emptyProfile(user.name, user.email));
      setOnboardingCompleted(false);
      setOnboardingInitialStep(0);
      setOnboardingResumeStep(0);
      openPostAuthScreen('onboarding');
      notify(error instanceof Error ? error.message : s.app.profileLoadFailed);
    }
  }

  async function refreshSalahToday() {
    try {
      const result = await apiRequest<{ date: string; prayers: Record<string, { status: string }> }>(`/api/salah/day/${todayKey()}`);
      setSalahToday(result.prayers ?? {});
    } catch {
      // Dashboard completion stays empty rather than showing invented data.
      setSalahToday({});
    } finally {
      // P7: first load done (even on error) — the dashboard may now
      // show real zeros instead of a loading state.
      setSalahLoaded(true);
    }
  }

  // Study data lives in MongoDB; every load re-fetches it so a refresh,
  // logout, or device change shows the same real records.
  async function refreshStudy() {
    if (!authUser || guestMode) return;
    const results = await Promise.allSettled([
      fetchSubjects(),
      fetchTasks(),
      fetchToday(),
      fetchStudyStats(),
      fetchActivePomodoro(),
      fetchPomodoroHistory(1, 20),
    ]);
    const [subjectsResult, tasksResult, todayResult, statsResult, activeResult, historyResult] = results;
    if (subjectsResult.status === 'fulfilled') setSubjects(subjectsResult.value);
    if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value);
    if (todayResult.status === 'fulfilled') {
      setTodayTasks(todayResult.value.tasks);
      setTodaySchedule(todayResult.value.schedule);
    }
    if (statsResult.status === 'fulfilled') setStudyStats(statsResult.value);
    if (activeResult.status === 'fulfilled') setActivePomodoro(activeResult.value);
    if (historyResult.status === 'fulfilled') setPomodoroHistory(historyResult.value.sessions);
    const failed = results.find((r) => r.status === 'rejected');
    setStudyError(
      failed && failed.status === 'rejected'
        ? failed.reason instanceof Error ? failed.reason.message : 'Study data could not be loaded.'
        : '',
    );
    // P7: first load done (even on partial failure) — the dashboard
    // may now show real zeros instead of a loading state.
    setStudyLoaded(true);
  }

  // Challenges and rewards live in MongoDB; every load re-fetches them so
  // a refresh, logout, or device change shows the same real records.
  async function refreshChallenges() {
    if (!authUser || guestMode) return;
    try {
      const [mine, summary] = await Promise.all([
        fetchMyChallenges(),
        fetchRewardsSummary(),
      ]);
      setActiveChallenges(mine.active);
      setChallengeHistory(mine.history);
      setRewards(summary);
      setChallengeError('');
    } catch (error) {
      setChallengeError(
        error instanceof Error ? error.message : 'Challenge data could not be loaded.',
      );
    }
  }

  // Notifications live in MongoDB; the bell shows the real unread
  // count and the real list. The socket only tells us to refetch.
  async function refreshNotifications() {
    if (!authUser || guestMode) return;
    try {
      const [list, unread] = await Promise.all([
        fetchNotifications(1, 20),
        fetchUnreadCount(),
      ]);
      setNotifications(list.notifications);
      setUnreadCount(unread);
    } catch {
      // The bell stays empty rather than showing invented alerts.
    }
  }

  async function loadPrayerTimes() {
    if (!authUser) return;
    setPrayerStatus('loading');
    setPrayerError('');
    try {
      const times = await fetchPrayerTimes();
      setPrayerTimes(times);
      setPrayerStatus('loaded');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prayer times could not be loaded.';
      setPrayerError(message);
      setPrayerStatus(message.includes('city') ? 'no-city' : 'error');
      setPrayerTimes(null);
    }
    await refreshSalahToday();
  }

  // Fetch prayer times once the user is in the app (not for guests).
  useEffect(() => {
    if (screen === 'app' && authUser && !guestMode && prayerStatus === 'idle') {
      loadPrayerTimes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, authUser, guestMode, prayerStatus]);

  // Keep today's Salah completion fresh when the dashboard is shown.
  useEffect(() => {
    if (screen === 'app' && authUser && !guestMode && (page === 'dashboard' || page === 'deen' || page === 'salah-calendar')) {
      refreshSalahToday();
    }
    if (screen === 'app' && authUser && !guestMode && (page === 'dashboard' || page === 'study' || page === 'analytics' || page === 'focus' || page === 'sleep')) {
      refreshStudy();
    }
    if (screen === 'app' && authUser && !guestMode && (page === 'dashboard' || page === 'challenges' || page === 'analytics')) {
      refreshChallenges();
    }
    if (screen === 'app' && authUser && !guestMode && page === 'notifications') {
      refreshNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Load study data once the user is in the app (not for guests).
  useEffect(() => {
    if (screen === 'app' && authUser && !guestMode) {
      refreshStudy();
      refreshChallenges();
      refreshNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, authUser, guestMode]);

  // Realtime: the socket only PUSHES — every event refetches the
  // authoritative data over REST. If the socket never connects, the
  // app keeps working from the list endpoints; a failed connection
  // never breaks a page.
  useEffect(() => {
    if (screen !== 'app' || !authUser || guestMode) return;
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      const onNotification = (payload: { notification?: AppNotification }) => {
        refreshNotifications();
        if (payload?.notification) notify(payload.notification.title);
      };
      const onFriendEvent = () => {
        refreshNotifications();
        setFriendsRefreshKey((key) => key + 1);
      };
      const onInviteEvent = () => {
        refreshNotifications();
        setFriendsRefreshKey((key) => key + 1);
      };
      const onProgressEvent = (payload: { challengeTitle?: string }) => {
        refreshChallenges();
        if (payload?.challengeTitle) {
          notify(stringsFor(languageRef.current).app.sharedProgressUpdated(payload.challengeTitle));
        }
      };
      socket.on('notification_created', onNotification);
      socket.on('friend_request_received', onFriendEvent);
      socket.on('friend_request_accepted', onFriendEvent);
      socket.on('challenge_invite_received', onInviteEvent);
      socket.on('challenge_invite_response', onInviteEvent);
      socket.on('challenge_progress_updated', onProgressEvent);
      socket.on('connect_error', () => {
        // Silent: REST remains the fallback for every read.
      });
    } catch {
      // A socket that cannot start must never break the app.
    }
    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, authUser, guestMode]);

  // Email links land here: ?verifyToken= confirms verification,
  // ?resetToken= opens the reset-password screen. The token is
  // removed from the URL once handled.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verifyToken') ?? '';
    const token = params.get('resetToken') ?? '';
    if (verifyToken) {
      window.history.replaceState({}, '', window.location.pathname);
      apiRequest<{ verified: boolean }>(`/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`)
        .then(() => {
          notify(s.app.emailVerified);
          setEmailNotice(null);
          setAuthUser((current) => (current ? { ...current, emailVerified: true } : current));
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : s.app.verificationLinkFailed;
          if (message.includes('invalid or has expired')) {
            // Persistent, not just a toast: the banner shows this
            // notice after login, with its resend button (POST
            // /api/auth/verify-email). Links work for 24 hours.
            setEmailNotice(s.app.verificationLinkExpired);
            notify(s.app.verificationLinkExpiredToast);
          } else {
            notify(message);
          }
        });
    } else if (token) {
      window.history.replaceState({}, '', window.location.pathname);
      setResetToken(token);
      setScreen('reset');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ user: AuthUser }>('/api/auth/me')
      .then(async ({ user }) => {
        if (!active) return;
        // Phase 15: a password-reset link wins over session restore.
        // The token effect already put this user on the reset screen;
        // a successful /api/auth/me must not yank them off it into
        // the app/onboarding.
        if (resetLinkRef.current) return;
        setAuthUser(user);
        setProfileName(user.name);
        try {
          const loaded = await loadProfileWithCompletion(user.name, user.email);
          if (!active) return;
          if (loaded) {
            setNewUser(loaded.profile);
            setOnboardingCompleted(loaded.onboardingCompleted);
            setOnboardingResumeStep(loaded.onboardingStep);
            openPostAuthScreen('app');
          } else {
            setNewUser(emptyProfile(user.name, user.email));
            setOnboardingCompleted(false);
            setOnboardingInitialStep(0);
            setOnboardingResumeStep(0);
            openPostAuthScreen('onboarding');
          }
        } catch {
          if (!active) return;
          setNewUser(emptyProfile(user.name, user.email));
          setOnboardingCompleted(false);
          setOnboardingInitialStep(0);
          setOnboardingResumeStep(0);
          openPostAuthScreen('onboarding');
        }
      })
      .catch(() => {
        if (!active) return;
        // Phase 15: a password-reset link wins over session restore.
        // Leave the reset screen (set by the token effect) alone —
        // the old behaviour sent reset-link users to welcome, which
        // is why the link "stopped working" for logged-out users.
        if (resetLinkRef.current) return;
        // Logged out: first open without a stored language goes to the
        // picker (which then sends the user to Login); everyone else
        // gets the welcome screen as before.
        if (readStoredLanguage() !== null) {
          setScreen('welcome');
        } else {
          setAfterLanguageScreen('login');
          setScreen('language');
        }
      });
    return () => { active = false; };
  }, []);

  // The login screen's success tick is cleared whenever we (re)enter it,
  // so a fresh visit never starts in the success state. This does not run
  // while the screen stays on 'login' (e.g. during the success flash).
  useEffect(() => {
    if (screen === 'login') setAuthSuccess(false);
  }, [screen]);

  const goTo = (next: Page) => {
    setPage(next);
    setScreen('app');
  };

  const goToGuidance = (tab: GuidanceTab, surahNumber?: number) => {
    setGuidanceTab(tab);
    setGuidanceSurah(surahNumber ?? null);
    goTo('guidance');
  };

  async function handleLogin(email: string, password: string) {
    // Fresh CSRF token immediately before the login POST: a token
    // cached from an earlier page lifetime can already be stale (the
    // CSRF cookie is shared across tabs, so another tab may have
    // rotated it). apiFetch still retries once on a 403, but starting
    // fresh is what keeps login from failing in the first place.
    // A failed refresh is ignored — the POST goes ahead with the
    // normal retry path.
    await refreshCsrfToken().catch(() => null);
    let result: { user: AuthUser };
    try {
      result = await apiRequest<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      // If the token still failed after the retry, say plainly what
      // fixes it instead of showing the server's terse CSRF error.
      if (isCsrfError(err)) {
        throw new Error(s.app.securityCheckFailed);
      }
      throw err;
    }
    setAuthUser(result.user);
    setProfileName(result.user.name);
    // Brief pause so the auth button's success tick is visible before the
    // profile loads and the screen changes. Auth itself is already done.
    setAuthSuccess(true);
    await new Promise((resolve) => window.setTimeout(resolve, 750));
    await hydrateProfile(result.user);
  }

  async function handleSignup(user: { name: string; email: string; password: string }) {
    const result = await apiRequest<{ user: AuthUser; verificationEmailSent?: boolean; notice?: string }>('/api/auth/signup', {
      method: 'POST', body: JSON.stringify(user),
    });
    setAuthUser(result.user);
    setProfileName(result.user.name);
    setNewUser(emptyProfile(result.user.name, result.user.email));
    // P9: a fresh signup ALWAYS starts onboarding at Step 1.
    // onboardingInitialStep is sticky state: opening Profile's
    // "Prayer calculation" row sets it to 4, and nothing reset it, so
    // a signup in the same tab after that (the overnight check's test
    // account) landed on Step 5 with steps 1–4 still empty.
    setOnboardingInitialStep(0);
    setOnboardingResumeStep(0);
    // Honest verification notice: the server says whether the
    // verification email actually went out. If it did not (SMTP not
    // configured or send failed), keep its notice for the verify
    // banner instead of ever claiming the email was sent.
    if (result.verificationEmailSent === false) {
      setEmailNotice(result.notice ?? 'Email verification is not set up yet — your account is created but your email is unverified.');
    } else {
      setEmailNotice(null);
    }
    // Brief pause so the auth button's success tick is visible before the
    // onboarding screen opens. Auth itself is already done.
    setAuthSuccess(true);
    await new Promise((resolve) => window.setTimeout(resolve, 750));
    setScreen('onboarding');
  }

  async function handleOnboardingComplete() {
    if (!authUser) {
      notify(s.app.loginFirstToSaveProfile);
      return;
    }
    const profileToSave = { ...newUser, name: authUser.name, email: authUser.email };
    try {
      const saved = await saveProfile(profileToSave);
      setNewUser(saved);
      setProfileName(authUser.name);
      setOnboardingCompleted(true);
      setPrayerStatus('idle');
      setPrayerTimes(null);
      const wasEditing = editingProfile;
      setEditingProfile(false);
      setScreen('app');
      // Phase 15: a fresh onboarding lands on the Dashboard (preview
      // #4); editing from Profile returns to Profile.
      if (wasEditing) setPage('profile');
      else setPage('dashboard');
      notify(s.app.profileSaved);
    } catch (error) {
      notify(error instanceof Error ? error.message : s.app.profileSaveFailed);
      throw error;
    }
  }

  /** Skip: save whatever is filled in as a partial profile and enter the app. */
  async function handleOnboardingSkip(step: number) {
    if (!authUser) {
      notify(s.app.loginFirstToSaveProfile);
      return;
    }
    const profileToSave = { ...newUser, name: authUser.name, email: authUser.email };
    try {
      const saved = await saveProfilePartial(profileToSave, step);
      setNewUser(saved);
      setProfileName(authUser.name);
      setOnboardingCompleted(false);
      setOnboardingResumeStep(step);
      setPrayerStatus('idle');
      setPrayerTimes(null);
      setEditingProfile(false);
      setScreen('app');
      // Phase 15: skipping onboarding still lands on the Dashboard.
      setPage('dashboard');
      notify(s.app.onboardingSavedPartial);
    } catch (error) {
      notify(error instanceof Error ? error.message : s.app.skipFailed);
      throw error;
    }
  }

  /** First onboarding step that still needs input (0 = start from the top). */
  function firstIncompleteStep(profile: UserProfile): number {
    if (!profile.education || !profile.course.trim() || !profile.semester.trim() || !profile.subjects.trim()) return 1;
    if (!profile.collegeStart || !profile.collegeEnd || profile.collegeDays.length === 0) return 2;
    if (!profile.studyStart || !profile.studyEnd || !profile.dailyStudyTarget || profile.preferredStudyDays.length === 0) return 3;
    // P2: city AND state are both required — a city with an empty state
    // (Affan's saved "MAHARSTRA") cannot be resolved for prayer times,
    // so it counts as incomplete and resumes at the Location step.
    if (!profile.city.trim() || !(profile.state ?? '').trim()) return 4;
    return 0;
  }

  /**
   * Where "Profile poora karo" should open (P9): the first step with
   * incomplete required fields. When steps 1–4 are all filled but
   * onboarding still isn't finished (the user skipped at a later,
   * all-optional step), fall back to the saved resume step instead of
   * sending them back to Step 1.
   */
  function resumeStep(profile: UserProfile): number {
    const first = firstIncompleteStep(profile);
    if (first !== 0) return first;
    if (onboardingCompleted === false) {
      return Math.min(7, Math.max(0, onboardingResumeStep));
    }
    return 0;
  }

  /** Reopen the onboarding form from Profile, pre-filled, at a given step. */
  function handleEditProfile(step: number) {
    if (!authUser || guestMode) {
      notify(s.app.signInFirstToEditProfile);
      return;
    }
    setOnboardingInitialStep(step);
    setEditingProfile(true);
    setScreen('onboarding');
  }

  function handleOnboardingCancel() {
    setEditingProfile(false);
    setScreen('app');
    setPage('profile');
  }

  /**
   * Focus & sleep: save the sleep window to MongoDB for real.
   * Returns true when the save landed, false otherwise, so the Focus
   * screen can show a persistent confirmation (P15) — the 2.6s toast
   * alone was missed whenever the save itself was slow.
   */
  async function handleSaveFocus(): Promise<boolean> {
    if (!authUser || guestMode) {
      notify(s.app.signInFirstToSaveSleep);
      return false;
    }
    if (focusSaving) return false;
    setFocusSaving(true);
    try {
      const profileToSave = { ...newUser, name: authUser.name, email: authUser.email };
      // Never mark a skipped profile complete just because the sleep
      // window was saved from the Focus screen. Keep the skip with the
      // first incomplete step as the resume point.
      const saved = onboardingCompleted === false
        ? await saveProfilePartial(profileToSave, firstIncompleteStep(newUser))
        : await saveProfile(profileToSave);
      setNewUser(saved);
      notify(s.app.sleepSaved);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : s.app.sleepSaveFailed);
      return false;
    } finally {
      setFocusSaving(false);
    }
  }

  async function handleLogout() {
    try {
      if (authUser) await apiRequest<null>('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      notify(error instanceof Error ? error.message : s.app.logoutFailed);
      return;
    }
    clearCsrfToken();
    setAuthUser(null);
    setGuestMode(false);
    setEmailNotice(null);
    setResendingVerification(false);
    setOnboardingCompleted(null);
    setOnboardingInitialStep(0);
    setOnboardingResumeStep(0);
    setEditingProfile(false);
    setProfileName('');
    setNewUser(emptyProfile());
    setPrayerTimes(null);
    setPrayerStatus('idle');
    setSalahToday({});
    setStudyLoaded(false);
    setSalahLoaded(false);
    setSubjects([]);
    setTasks([]);
    setTodayTasks([]);
    setTodaySchedule(null);
    setStudyStats(null);
    setActivePomodoro(null);
    setPomodoroHistory([]);
    setStudyError('');
    setActiveChallenges([]);
    setChallengeHistory([]);
    setRewards(null);
    setChallengeError('');
    setNotifications([]);
    setUnreadCount(0);
    setFriendsRefreshKey(0);
    disconnectSocket();
    setScreen('welcome');
    setPage('home');
  }

  function handleAccountDeleted() {
    clearCsrfToken();
    setAuthUser(null);
    setGuestMode(false);
    setEmailNotice(null);
    setResendingVerification(false);
    setOnboardingCompleted(null);
    setOnboardingInitialStep(0);
    setOnboardingResumeStep(0);
    setEditingProfile(false);
    setProfileName('');
    setNewUser(emptyProfile());
    setStudyLoaded(false);
    setSalahLoaded(false);
    setScreen('welcome');
    setPage('home');
    notify(s.app.accountDeleted);
  }

  /**
   * Resend the verification email (P10). The overnight check found
   * this gave no confirmation: the banner vanished with no toast, so
   * delivery could not be confirmed. Now: the button shows "Sending…"
   * and disables while the request is in flight; on success BOTH a
   * toast and the banner itself confirm ("Verification email sent.
   * Check your inbox.") and the banner stays until the email is
   * actually verified; on failure BOTH a toast and the banner show
   * the error — the banner never silently vanishes on failure.
   */
  async function handleResendVerification() {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      const result = await apiRequest<{ sent?: boolean; alreadyVerified?: boolean }>('/api/auth/verify-email', { method: 'POST' });
      if (result.alreadyVerified) {
        setAuthUser((current) => (current ? { ...current, emailVerified: true } : current));
        setEmailNotice(null);
        notify(s.app.emailAlreadyVerified);
      } else {
        setEmailNotice(s.app.verificationEmailSent);
        notify(s.app.verificationEmailSent);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : s.app.verificationEmailFailed;
      setEmailNotice(message);
      notify(message);
    } finally {
      setResendingVerification(false);
    }
  }

  if (screen === 'checking') {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><AhdoraLogo size={42} /><span>AHDORA</span></div><p>{s.app.checkingSession}</p></div></div>;
  }
  if (screen === 'language') {
    return <LanguageSelector onConfirm={handleLanguageConfirm} />;
  }
  if (screen === 'welcome') {
    return <Welcome onContinue={() => setScreen('login')} onExplore={() => { setGuestMode(true); setProfileName('Guest'); setScreen('app'); }} />;
  }
  if (screen === 'login') {
    return <Login onBack={() => setScreen('welcome')} onLogin={handleLogin} onSignup={handleSignup} onForgot={() => setScreen('forgot')} authSuccess={authSuccess} language={language} onLanguageChange={handleLanguageChange} />;
  }
  if (screen === 'forgot') {
    return <ForgotPassword onBack={() => setScreen('login')} onSent={() => notify('If an account exists for this email, a reset link has been sent.')} />;
  }
  if (screen === 'reset') {
    return <ResetPassword token={resetToken} onDone={() => { setResetToken(''); setScreen('login'); notify('Password reset. Please log in with your new password.'); }} onBack={() => { setResetToken(''); setScreen('login'); }} onResendLink={() => { setResetToken(''); setScreen('forgot'); }} />;
  }
  if (screen === 'onboarding') {
    return <Onboarding user={newUser} onChange={setNewUser} onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} initialStep={onboardingInitialStep} mode={editingProfile ? 'edit' : 'initial'} onCancel={handleOnboardingCancel} language={language} />;
  }

  return (
    <div className="app-shell">
      <main className="main-area">
        {authUser && !authUser.emailVerified && !guestMode && (
          <div className="verify-banner">
            <Shield size={16} />
            <span>{emailNotice ?? s.app.emailNotVerified}</span>
            <button className="text-button" onClick={handleResendVerification} disabled={resendingVerification}>{resendingVerification ? s.app.sending : s.app.resendVerification}</button>
          </div>
        )}
        {authUser && !guestMode && onboardingCompleted === false && (
          <div className="verify-banner">
            <UserRound size={16} />
            <span>{s.app.profileIncomplete}</span>
            <button className="text-button" onClick={() => handleEditProfile(resumeStep(newUser))}>{s.app.completeProfile}</button>
          </div>
        )}
        <div className="page-content">
          {page === 'home' && <HomeScreen profile={newUser} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} guestMode={guestMode} onNavigate={goTo} onOpenGuidance={goToGuidance} language={language} />}
          {page === 'dashboard' && <Dashboard userName={profileName || 'there'} onNavigate={goTo} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} todayTasks={todayTasks} studyStats={studyStats} guestMode={guestMode} activeChallenges={activeChallenges} rewards={rewards} dataLoading={!guestMode && (!studyLoaded || !salahLoaded)} sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} unreadCount={unreadCount} onOpenNotifications={() => goTo('notifications')} language={language} />}
          {page === 'deen' && <Deen onNotify={notify} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} onRefreshSalah={refreshSalahToday} onOpenGuidance={goToGuidance} onBack={() => goTo('home')} profile={newUser} language={language} />}
          {page === 'salah-calendar' && (
            <section className="salahcal-screen">
              <div className="apphead">
                <button type="button" className="aback" onClick={() => goTo('home')} aria-label={s.common.back}><ChevronLeft size={20} /></button>
                <div><h4>{s.salahCalendar.title}</h4><div className="asub">{s.salahCalendar.sub}</div></div>
              </div>
              <SalahTracker onNotify={notify} language={language} />
            </section>
          )}
          {page === 'tasbeeh' && <Tasbeeh userId={authUser?.id ?? ''} onBack={() => goTo('home')} language={language} />}
          {page === 'notifications' && <NotificationsScreen onBack={() => goTo('home')} onNotify={notify} guestMode={guestMode} onChanged={refreshNotifications} language={language} />}
          {page === 'sleep' && <Sleep sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} onSleepChange={(start, end) => setNewUser((current) => ({ ...current, sleepStartTime: start, sleepEndTime: end }))} onSaveFocus={handleSaveFocus} focusSaving={focusSaving} focusEnabled={focusEnabled} setFocusEnabled={setFocusEnabled} youtubeAllowed={youtubeAllowed} setYoutubeAllowed={setYoutubeAllowed} onNotify={notify} onBack={() => goTo('home')} onOpenGuidance={goToGuidance} guestMode={guestMode} language={language} />}
          {page === 'study' && <Study subjects={subjects} tasks={tasks} todayTasks={todayTasks} schedule={todaySchedule} stats={studyStats} activeSession={activePomodoro} history={pomodoroHistory} studyError={studyError} guestMode={guestMode} profile={newUser} onRefresh={refreshStudy} onNotify={notify} onBack={() => goTo('home')} language={language} />}
          {page === 'challenges' && <Challenges onNotify={notify} onRefresh={refreshChallenges} guestMode={guestMode} onBack={() => goTo('home')} onOpenFriends={() => goTo('friends')} language={language} />}
          {page === 'friends' && <Friends onNotify={notify} refreshKey={friendsRefreshKey} guestMode={guestMode} language={language} />}
          {page === 'guidance' && <Guidance onNotify={notify} onOpenFeedback={() => setFeedbackOpen(true)} tab={guidanceTab} onTabChange={setGuidanceTab} guestMode={guestMode} profileCity={newUser.city} initialSurah={guidanceSurah} onInitialSurahOpened={() => setGuidanceSurah(null)} onOpenSurah={(surahNumber) => goToGuidance('quran', surahNumber)} language={language} />}
          {page === 'focus' && <Focus activeSession={activePomodoro} history={pomodoroHistory} stats={studyStats} tasks={tasks} onRefresh={refreshStudy} onNotify={notify} onNavigate={goTo} guestMode={guestMode} language={language} />}
          {page === 'analytics' && <Analytics stats={studyStats} guestMode={guestMode} rewards={rewards} activeChallenges={activeChallenges} challengeHistory={challengeHistory} focusHistory={pomodoroHistory} onNotify={notify} salahToday={salahToday} sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} onBack={() => goTo('home')} language={language} />}
          {page === 'profile' && <Profile onNotify={notify} user={authUser} guestMode={guestMode} onLogout={handleLogout} onAccountDeleted={handleAccountDeleted} onboardingIncomplete={onboardingCompleted === false} onEditProfile={handleEditProfile} onboardingResumeStep={resumeStep(newUser)} onOpenFeedback={() => setFeedbackOpen(true)} onNavigate={goTo} language={language} onLanguageChange={handleLanguageChange} rewards={rewards} studyStats={studyStats} profile={newUser} />}
        </div>
      </main>
      <nav className="pillnav-bar" aria-label="Main sections">
        <button type="button" className={`pillnav-item ${(page === 'home' || page === 'dashboard') ? 'on' : ''}`} onClick={() => goTo('home')} aria-label={s.nav.home}><Home size={21} strokeWidth={1.8} /></button>
        <button type="button" className={`pillnav-item ${page === 'guidance' ? 'on' : ''}`} onClick={() => goToGuidance('quran')} aria-label={s.nav.quran}><BookOpen size={21} strokeWidth={1.8} /></button>
        <button type="button" className={`pillnav-item ${page === 'focus' ? 'on' : ''}`} onClick={() => goTo('focus')} aria-label={s.nav.focus}><Target size={21} strokeWidth={1.8} /></button>
        <button type="button" className={`pillnav-item ${page === 'profile' ? 'on' : ''}`} onClick={() => goTo('profile')} aria-label={s.nav.profile}><UserRound size={21} strokeWidth={1.8} /></button>
      </nav>
      {feedbackOpen && <FeedbackForm onClose={() => setFeedbackOpen(false)} onNotify={notify} language={language} />}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );

}

function Welcome({ onContinue, onExplore }: { onContinue: () => void; onExplore: () => void }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-nav">
        <div className="welcome-brand">
          <AhdoraLogo size={40} alt="" />
          <strong>AHDORA</strong>
        </div>
        <div className="welcome-nav-links">
          <a href="#meaning">Our approach</a>
          <a href="#features">Features</a>
          <button className="nav-cta" onClick={onContinue}>
            Get started <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      <div className="welcome-hero" id="meaning">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span /> A CALMER WAY TO GROW</div>
          <h1>Your life.<br /><em>Your intention.</em><br />Your growth.</h1>
          <p className="hero-tagline">Deen <span>·</span> Ilm <span>·</span> Discipline</p>
          <p className="hero-description">
            A thoughtful space to bring your faith, learning and daily habits into better balance. One sincere step at a time.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onContinue}>
              Start your journey <ArrowRight size={17} />
            </button>
            <button className="text-button" onClick={onExplore}>
              Explore demo <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="hero-proof">
            <div className="proof-icon"><ShieldCheck size={17} /></div>
            <span>Private by design</span>
            <i />
            <span>Built for steady progress</span>
          </div>
        </div>

        <div className="hero-art">
          <div className="art-glow" />
          <div className="crescent">☾</div>
          <div className="star star-one">✦</div>
          <div className="star star-two">✧</div>
          <div className="mosque-art">
            <div className="dome dome-main"><span /></div>
            <div className="dome dome-small"><span /></div>
            <div className="minaret minaret-one"><i /></div>
            <div className="minaret minaret-two"><i /></div>
            <div className="mosque-base"><div /><div /><div /><div /><div /></div>
            <div className="ground-line" />
          </div>
          <div className="art-label">
            <span>01 / 03</span>
            <strong>Grow with purpose</strong>
            <small>A little better, every day.</small>
          </div>
        </div>
      </div>

      <div className="welcome-bottom" id="features">
        <div className="bottom-intro">
          <span className="eyebrow">A SPACE FOR YOUR WHOLE SELF</span>
          <h2>Bring the important things<br />closer together.</h2>
        </div>
        <FeatureMini icon={Compass} title="Deen" text="Prayer, Quran & reflection" />
        <FeatureMini icon={GraduationCap} title="Ilm" text="Study plans & focused learning" />
        <FeatureMini icon={Target} title="Discipline" text="Habits, sleep & consistency" />
        <FeatureMini icon={Users} title="Together" text="Challenges with people you trust" />
      </div>

      <div className="welcome-footer">
        <span>© 2026 AHDORA</span>
        <span>Designed for intention, not distraction.</span>
        <button onClick={onContinue}>Continue <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

function FeatureMini({ icon: Icon, title, text }: { icon: IconType; title: string; text: string }) {
  return (
    <div className="feature-mini">
      <div><Icon size={19} /></div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function Login({
  onBack,
  onLogin,
  onSignup,
  onForgot,
  authSuccess,
  language,
  onLanguageChange,
}: {
  onBack: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (user: { name: string; email: string; password: string }) => Promise<void>;
  onForgot: () => void;
  authSuccess: boolean;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Phase 13 — bilingual Login: the chosen language is the big line,
  // the other language sits right below it. Strings are the preview's
  // exact data-en / data-hi pairs.
  const heading = pickText(tab === 'login' ? LOGIN_STRINGS.headingLogin : LOGIN_STRINGS.headingSignup, language);
  const sub = tab === 'login'
    ? pickText(LOGIN_STRINGS.subLogin, language)
    : { primary: LOGIN_STRINGS.subSignup, secondary: '' };
  const tabCreate = pickText(LOGIN_STRINGS.tabCreate, language);
  const nameLabel = pickText(LOGIN_STRINGS.nameLabel, language);
  const forgot = pickText(LOGIN_STRINGS.forgot, language);
  const notice = pickText(LOGIN_STRINGS.notice, language);
  const submitSignup = pickText(LOGIN_STRINGS.submitSignup, language);

  // Shows the error and replays the card's shake animation.
  function fail(message: string) {
    setError(message);
    const card = cardRef.current;
    if (card) {
      card.classList.remove('auth-shake');
      void card.offsetWidth;
      card.classList.add('auth-shake');
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;
    setError('');

    if (!email.trim() || !password) {
      fail('Email aur password dono bharna zaroori hai.');
      return;
    }

    if (tab === 'signup') {
      if (name.trim().length < 2) {
        fail('Apna naam sahi se enter karo.');
        return;
      }

      if (password.length < 12) {
        fail('Password kam se kam 12 characters ka rakho.');
        return;
      }

      if (password !== confirmPassword) {
        fail('Dono password ek jaise nahi hain.');
        return;
      }

      setBusy(true);

      try {
        await onSignup({ name: name.trim(), email: email.trim(), password });
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Account create nahi ho paya.');
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);

      try {
        await onLogin(email.trim(), password);
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Login nahi ho paya.');
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="auth-screen auth-screen-animated">
      <AuthBackdrop />
      <button className="back-link" onClick={onBack} disabled={busy || authSuccess}>
        <ArrowRight className="back-arrow" size={16} /> Back to welcome
      </button>

      <div className="auth-card auth-card-animated" ref={cardRef}>
        <div className="auth-brand">
          <AhdoraLogo size={42} />
          <span>AHDORA</span>
        </div>

        <p className="auth-greeting">
          <span className="auth-greeting-ar" lang="ar">ٱلسَّلَامُ عَلَيْكُمْ</span>
          <Typewriter text="Assalamu Alaikum" />
        </p>

        <div className="auth-heading">
          <span className="eyebrow">YOUR SPACE, YOUR PACE</span>
          <h1>{heading.primary}</h1>
          <p className="bilingual-secondary bilingual-secondary-large">{heading.secondary}</p>
          <p style={{ marginTop: 8 }}>{sub.primary}</p>
          {sub.secondary && <p className="bilingual-secondary">{sub.secondary}</p>}
        </div>

        <AhdoraMeaning />

        <div className="auth-tabs auth-tabs-animated">
          <span className={`auth-tab-pill ${tab === 'signup' ? 'auth-tab-pill-right' : ''}`} aria-hidden="true" />
          <button
            type="button"
            className={tab === 'login' ? 'selected' : ''}
            onClick={() => { setTab('login'); setError(''); setConfirmPassword(''); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={tab === 'signup' ? 'selected' : ''}
            onClick={() => { setTab('signup'); setError(''); setConfirmPassword(''); }}
          >
            {tabCreate.primary}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div key={tab} className={`auth-panel ${tab === 'signup' ? 'auth-panel-from-right' : 'auth-panel-from-left'}`}>
            {tab === 'signup' && (
              <div className="auth-field">
                <input
                  id="auth-name"
                  className="form-input auth-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=" "
                  autoComplete="name"
                  required
                />
                <label className="auth-floating-label" htmlFor="auth-name">{nameLabel.primary}</label>
              </div>
            )}

            <div className="auth-field">
              <input
                id="auth-email"
                className="form-input auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                autoComplete="email"
                required
              />
              <label className="auth-floating-label" htmlFor="auth-email">Email address</label>
            </div>

            <div className="auth-field">
              <input
                id="auth-password"
                className="form-input auth-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
                style={{ paddingRight: 42 }}
              />
              <label className="auth-floating-label" htmlFor="auth-password">Password</label>
              <button
                type="button"
                aria-label={showPassword ? 'Password chhupao' : 'Password dikhao'}
                title={showPassword ? 'Password chhupao' : 'Password dikhao'}
                disabled={busy || authSuccess}
                onClick={() => setShowPassword((current) => !current)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, padding: 4, cursor: 'pointer', color: 'inherit', opacity: 0.75, display: 'grid', placeItems: 'center', zIndex: 1 }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {tab === 'signup' && (
              <div className="auth-field">
                <input
                  id="auth-confirm-password"
                  className="form-input auth-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder=" "
                  autoComplete="new-password"
                  required
                  style={{ paddingRight: 42 }}
                />
                <label className="auth-floating-label" htmlFor="auth-confirm-password">Re-enter password</label>
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Password chhupao' : 'Password dikhao'}
                  title={showConfirmPassword ? 'Password chhupao' : 'Password dikhao'}
                  disabled={busy || authSuccess}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, padding: 4, cursor: 'pointer', color: 'inherit', opacity: 0.75, display: 'grid', placeItems: 'center', zIndex: 1 }}
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            )}
            {tab === 'signup' && <small className="auth-hint">Minimum 12 characters</small>}
          </div>

          {error && <p className="auth-error" role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <button type="submit" className={`primary-button full-width auth-submit ${authSuccess ? 'auth-submit-success' : ''}`} disabled={busy}>
            {authSuccess ? (
              <>
                <svg className="auth-tick-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7 12.5 10.5 16 17 8.5" /></svg>
                Welcome!
              </>
            ) : busy ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                Please wait...
              </>
            ) : (
              <>
                {tab === 'login' ? 'Log in' : submitSignup.primary}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {tab === 'login' && (
          <button type="button" className="text-button bilingual-skip" onClick={onForgot} style={{ marginTop: 12 }}>
            <span>{forgot.primary}</span>
            <small>{forgot.secondary}</small>
          </button>
        )}

        <div className="auth-notice">
          <Shield size={15} />
          <span>
            <span>{notice.primary}</span>
            <span className="bilingual-secondary" style={{ display: 'block', marginTop: 4 }}>{notice.secondary}</span>
          </span>
        </div>

        <div className="login-lang-row">
          <span>Bhasha · Language</span>
          <div className="lang-switch" role="group" aria-label="Language">
            <button type="button" className={language === 'en' ? 'selected' : ''} onClick={() => onLanguageChange('en')} disabled={busy || authSuccess}>English</button>
            <button type="button" className={language === 'hi' ? 'selected' : ''} onClick={() => onLanguageChange('hi')} disabled={busy || authSuccess}>Hinglish</button>
          </div>
        </div>
      </div>

      <div className="auth-bottom">AHDORA <span>·</span> Deen, Ilm & Discipline</div>
    </div>
  );
}

function ForgotPassword({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setError('');
    setBusy(true);
    try {
      await apiRequest<{ sent: boolean }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setDone(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <button className="back-link" onClick={onBack}>
        <ArrowRight className="back-arrow" size={16} /> Back to log in
      </button>
      <div className="auth-card">
        <div className="auth-brand">
          <AhdoraLogo size={42} />
          <span>AHDORA</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">RESET PASSWORD</span>
          <h1>Forgot your password?</h1>
          <p>Enter your email and we will send a reset link (valid for 1 hour).</p>
        </div>
        {done ? (
          <p className="onboarding-help">If an account exists for this email, a reset link has been sent. Check your inbox.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label">Email address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <button type="submit" className="primary-button full-width" disabled={busy}>
              {busy ? 'Please wait...' : 'Send reset link'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        <div className="auth-notice">
          <Shield size={15} />
          <span>If email sending is not set up on this server yet, you will see a clear message instead of a fake confirmation.</span>
        </div>
      </div>
      <div className="auth-bottom">AHDORA <span>·</span> Deen, Ilm & Discipline</div>
    </div>
  );
}

function ResetPassword({ token, onDone, onBack, onResendLink }: { token: string; onDone: () => void; onBack: () => void; onResendLink: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (password.length < 12) {
      setError('Password kam se kam 12 characters ka rakho.');
      return;
    }
    if (password !== confirm) {
      setError('Dono password ek jaise nahi hain.');
      return;
    }
    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest<{ reset: boolean }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset nahi ho paya.';
      if (message.includes('invalid or has expired')) {
        setLinkExpired(true);
        setError('This reset link is invalid or has expired. Links work for 1 hour and can be used only once.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <button className="back-link" onClick={onBack}>
        <ArrowRight className="back-arrow" size={16} /> Back to log in
      </button>
      <div className="auth-card">
        <div className="auth-brand">
          <AhdoraLogo size={42} />
          <span>AHDORA</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">RESET PASSWORD</span>
          <h1>Choose a new password.</h1>
          <p>Your reset link is valid for 1 hour and can be used only once.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field-label">New password</label>
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Minimum 12 characters"
            autoComplete="new-password"
            required
          />
          <label className="field-label">Confirm new password</label>
          <PasswordField
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat the new password"
            autoComplete="new-password"
            required
          />
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
          {linkExpired && (
            <button type="button" className="primary-button full-width" style={{ marginTop: 12 }} onClick={onResendLink}>
              Send a fresh link
              <ArrowRight size={16} />
            </button>
          )}
          <button type="submit" className="primary-button full-width" disabled={busy || linkExpired}>
            {busy ? 'Please wait...' : 'Reset password'}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
      <div className="auth-bottom">AHDORA <span>·</span> Deen, Ilm & Discipline</div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      {action && <button>{action} <ArrowUpRight size={13} /></button>}
    </div>
  );
}

function Ring({ value, label, small }: { value: number; label: string; small?: boolean }) {
  return (
    <div className={`ring ${small ? 'ring-small' : ''}`} style={{ '--value': `${value}%` } as CSSProperties}>
      <div>
        <strong>{value}%</strong>
        {!small && <span>{label}</span>}
      </div>
    </div>
  );
}

/** Preview #5 — prayer-times row list. Six rows (Fajr, Sunrise, Dhuhr,
 * Asr, Maghrib, Isha); Sunrise is never prayed/missed, its pill is
 * always '—'. Status pills come from today's real Salah record
 * (salahToday); nothing is assumed prayed. The next prayer row gets
 * the peach highlight. Missed prayers get a qaza card each, wired to
 * the same PUT /api/salah/day/{date} update SalahTracker uses — a
 * Qaza keeps the original miss in history. */
function PrayerTimesPanel({
  prayerTimes,
  prayerStatus,
  prayerError,
  salahToday,
  now,
  onQaza,
  qazaBusy,
  language,
}: {
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  now: Date;
  onQaza: (prayer: string) => void;
  qazaBusy: string | null;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  if (prayerStatus === 'loading' || prayerStatus === 'idle') {
    return (
      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>{s.deen.panelLoading}</p>
      </section>
    );
  }
  if (prayerStatus === 'no-city') {
    return (
      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>{s.deen.panelNoCity}</p>
      </section>
    );
  }
  if (prayerStatus === 'error' || !prayerTimes) {
    return (
      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>{prayerError || s.deen.panelError}</p>
      </section>
    );
  }
  const nextName = prayerTimes.nextPrayer?.name ?? null;
  const nextCountdown = prayerTimes.nextPrayer ? countdownTo(prayerTimes.nextPrayer.time, now, language) : '';
  const missedNames = prayerNames.filter((name) => salahToday[name]?.status === 'missed');

  type Row = {
    name: string;
    time: string;
    sub: string;
    pill: string;
    pillClass: 'ok' | 'miss' | 'qaza' | 'wait';
    highlight: boolean;
    icon: IconType;
  };
  const rows: Row[] = [];
  const order: { name: string; icon: IconType; sub: string }[] = [
    { name: 'Fajr', icon: Moon, sub: s.deen.subFajr },
    { name: 'Sunrise', icon: Sun, sub: s.deen.subSunrise },
    { name: 'Dhuhr', icon: Sun, sub: s.deen.subDhuhr },
    { name: 'Asr', icon: Clock3, sub: s.deen.subAsr },
    { name: 'Maghrib', icon: Moon, sub: s.deen.subMaghrib },
    { name: 'Isha', icon: Moon, sub: s.deen.subIsha },
  ];
  for (const entry of order) {
    if (entry.name === 'Sunrise') {
      rows.push({
        name: 'Sunrise',
        time: prayerTimes.timings.Sunrise,
        sub: s.deen.subSunrise,
        pill: '—',
        pillClass: 'wait',
        highlight: false,
        icon: Sun,
      });
      continue;
    }
    const status = salahToday[entry.name]?.status ?? 'pending';
    const isNext = nextName === entry.name && status !== 'prayed' && status !== 'missed' && status !== 'qaza';
    if (status === 'prayed') {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: s.deen.statusPrayed, pill: s.deen.pillPrayed, pillClass: 'ok', highlight: false, icon: entry.icon });
    } else if (status === 'missed') {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: s.deen.statusMissed, pill: s.deen.pillMissed, pillClass: 'miss', highlight: false, icon: entry.icon });
    } else if (status === 'qaza') {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: s.deen.statusQaza, pill: s.deen.pillQaza, pillClass: 'qaza', highlight: false, icon: entry.icon });
    } else if (isNext) {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: nextCountdown ? s.deen.statusNextWithCountdown(nextCountdown) : s.deen.statusNext, pill: s.deen.pillNext, pillClass: 'qaza', highlight: true, icon: entry.icon });
    } else {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: s.deen.statusPending, pill: s.deen.pillPending, pillClass: 'wait', highlight: false, icon: entry.icon });
    }
  }

  return (
    <>
      <section className="acard deen-times-card">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div className={`prow ${row.highlight ? 'hl' : ''}`} key={row.name}>
              <span className="pic"><Icon size={19} strokeWidth={1.8} /></span>
              <div>{row.name}<small>{row.sub}</small></div>
              <span className="pt">{formatTime12h(row.time)}</span>
              <span className={`st ${row.pillClass}`}>{row.pill}</span>
            </div>
          );
        })}
      </section>

      {missedNames.map((name) => (
        <section className="acard deen-qaza-card" key={name}>
          <h5>{s.deen.qazaTitle(name)}</h5>
          <p>
            {s.deen.qazaBody(name)}
          </p>
          <button
            type="button"
            className="sbtn"
            disabled={qazaBusy !== null}
            onClick={() => onQaza(name)}
          >
            {qazaBusy === name ? s.deen.qazaSaving : s.deen.qazaDone}
          </button>
        </section>
      ))}

      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>
          {s.deen.sourceNote(prayerTimes.method, prayerTimes.city)}
          {prayerTimes.perPrayer && Object.values(prayerTimes.perPrayer).some((entry) => entry.source === 'manual') ? s.deen.sourceNoteManual : ''}.
        </p>
      </section>
    </>
  );
}

function Dashboard({
  userName,
  onNavigate,
  prayerTimes,
  prayerStatus,
  prayerError,
  salahToday,
  todayTasks,
  studyStats,
  guestMode,
  activeChallenges,
  rewards,
  dataLoading,
  sleepStartTime,
  sleepEndTime,
  unreadCount,
  onOpenNotifications,
  language,
}: {
  userName: string;
  onNavigate: (page: Page) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  todayTasks: StudyTask[];
  studyStats: StudyStats | null;
  guestMode: boolean;
  activeChallenges: ChallengeParticipation[];
  rewards: RewardsSummary | null;
  /** P7: true while today's Salah/study data is still loading — the
   * dashboard shows a loading state instead of "0 prayers / No
   * activity recorded yet" (those zeros are only real after load). */
  dataLoading: boolean;
  sleepStartTime: string;
  sleepEndTime: string;
  unreadCount: number;
  onOpenNotifications: () => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const prayedCount = prayerNames.filter((name) => salahToday[name]?.status === 'prayed').length;
  const tasksCompletedToday = studyStats?.tasksCompletedToday ?? 0;
  const todayFocusMinutes = studyStats?.todayFocusMinutes ?? 0;
  const streak = studyStats?.streak ?? 0;
  const hasActivity = prayedCount > 0 || tasksCompletedToday > 0 || todayFocusMinutes > 0;
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const totalTasksToday = todayTasks.length;
  // Focus bar: today's focus minutes as a proportion of one hour of
  // focus — a display proportion only, never a claimed target.
  const focusBarPct = Math.min(100, Math.round((todayFocusMinutes / 60) * 100));
  const sleepLabel = sleepDurationLabel(sleepStartTime, sleepEndTime);
  const challenge = activeChallenges[0] ?? null;
  const challengePct = challenge && challenge.totalDays > 0
    ? Math.round((challenge.completedDays / challenge.totalDays) * 100)
    : 0;

  return (
    <div className="dash-screen">
      <header className="dash-head">
        <div>
          <h4>{s.dashboard.greeting(userName)}</h4>
          <div className="dash-sub">{todayLabel}</div>
        </div>
        <button type="button" className="dash-bell" onClick={onOpenNotifications} aria-label={s.notifications.title}>
          <Bell size={19} strokeWidth={1.8} />
          {unreadCount > 0 && <span className="dash-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      </header>

      <div className="dash-kpis">
        <div className="dash-kpi"><b>{rewards?.total ?? 0}</b><span>{s.dashboard.points}</span></div>
        <div className="dash-kpi"><b>{s.common.days(streak)}</b><span>{s.dashboard.streak}</span></div>
        <div className="dash-kpi"><b>{rewards?.badges.length ?? 0}</b><span>{s.dashboard.badges}</span></div>
      </div>

      <section className="dash-card">
        <h5>{s.dashboard.progressTitle}</h5>
        {dataLoading ? (
          <p className="dash-empty">{s.dashboard.loading}</p>
        ) : (
          <>
            {!hasActivity && !guestMode && (
              <p className="dash-empty">{s.dashboard.empty}</p>
            )}
            {guestMode && (
              <p className="dash-empty">{s.dashboard.guestEmpty}</p>
            )}
            <div className="dash-statrow"><span>{s.dashboard.prayer}</span><span>{s.dashboard.prayedOf(prayedCount)}</span></div>
            <div className="dash-prog"><i style={{ width: `${(prayedCount / 5) * 100}%` }} /></div>
            <div className="dash-statrow"><span>{s.dashboard.study}</span><span>{totalTasksToday === 0 ? s.dashboard.noTasksToday : s.dashboard.tasksDoneOf(tasksCompletedToday, totalTasksToday)}</span></div>
            <div className="dash-prog"><i style={{ width: totalTasksToday === 0 ? '0%' : `${Math.min(100, (tasksCompletedToday / totalTasksToday) * 100)}%` }} /></div>
            <div className="dash-statrow"><span>{s.dashboard.focus}</span><span>{s.dashboard.focusMinutes(todayFocusMinutes)}</span></div>
            <div className="dash-prog"><i style={{ width: `${focusBarPct}%` }} /></div>
            <div className="dash-statrow"><span>{s.dashboard.sleepSchedule}</span><span>{guestMode ? s.dashboard.sleepSignIn : `${formatTime12h(sleepStartTime)} – ${formatTime12h(sleepEndTime)}${sleepLabel ? ` · ${sleepLabel}` : ''}`}</span></div>
            <div className="dash-prog dash-prog-peach"><i style={{ width: guestMode ? '0%' : '100%' }} /></div>
            {!guestMode && <p className="dash-note">{s.dashboard.sleepNote}</p>}
          </>
        )}
      </section>

      <NextPrayerBanner prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} now={now} language={language} />

      <section className="dash-card">
        {challenge ? (
          <>
            <h5>{s.dashboard.challengeDay(challenge.currentDay)}</h5>
            <p className="dash-challenge-text">{s.dashboard.challengeLine(challenge.challenge.title, challenge.completedDays, challenge.totalDays, challenge.pointsEarned)}</p>
            <div className="dash-prog dash-prog-peach"><i style={{ width: `${challengePct}%` }} /></div>
            <div className="dash-statrow"><span>{s.dashboard.challengeDays(challenge.completedDays, challenge.totalDays)}</span><span>{challenge.streak > 0 ? s.dashboard.challengeStreak(challenge.streak) : s.dashboard.challengeNoStreak}</span></div>
            <button type="button" className="dash-challenge-btn" onClick={() => onNavigate('challenges')}>{s.dashboard.challengeSeeToday}</button>
          </>
        ) : (
          <>
            <h5>{s.dashboard.challengeTitle}</h5>
            <p className="dash-empty">{s.dashboard.challengeEmpty}</p>
            <button type="button" className="dash-challenge-btn" onClick={() => onNavigate('challenges')}>{s.dashboard.challengeJoin}</button>
          </>
        )}
      </section>
    </div>
  );
}

/** Preview #5 — Deen & Salah. Dark screen: apphead, next-prayer
 * banner, the 6-row prayer list (PrayerTimesPanel), qaza cards, and
 * the 3 quick tiles. The monthly calendar lives on its own
 * 'salah-calendar' route now, the reflection quote card is gone (not
 * in the preview), and the static "dua for today" card is gone — its
 * content is covered by Guidance / Duas. */
function Deen({ onNotify, prayerTimes, prayerStatus, prayerError, salahToday, onRefreshSalah, onOpenGuidance, onBack, profile, language }: {
  onNotify: (message: string) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  onRefreshSalah: () => Promise<void>;
  onOpenGuidance: (tab: GuidanceTab, surahNumber?: number) => void;
  onBack: () => void;
  profile: UserProfile;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const [qazaBusy, setQazaBusy] = useState<string | null>(null);

  // Mark one missed prayer as Qaza — the same endpoint SalahTracker
  // uses (PUT /api/salah/day/{date}); the server keeps the original
  // miss in history. Refreshes today's record so the pill flips.
  async function handleQaza(prayer: string) {
    if (qazaBusy) return;
    setQazaBusy(prayer);
    try {
      const response = await apiFetch(`/api/salah/day/${todayKey()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prayer, status: 'qaza' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : s.deen.qazaSaveFailed);
      await onRefreshSalah();
      onNotify(s.deen.qazaMarked(prayer));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.deen.qazaSaveFailed);
    } finally {
      setQazaBusy(null);
    }
  }

  const city = prayerTimes?.city || profile.city || '';
  const methodLine = profile.asrMethod ? s.deen.methodLine(profile.asrMethod) : (prayerTimes?.method ?? '');
  const sub = [city, methodLine].filter(Boolean).join(' · ') || s.deen.subFallback;

  return (
    <section className="deen-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.deen.title}</h4>
          <div className="asub">{sub}</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn gh" onClick={() => onOpenGuidance('hijri')}>
            <CalendarDays size={13} /> {s.deen.islamicCalendar}
          </button>
        </div>
      </div>

      <NextPrayerBanner prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} now={now} language={language} />

      <PrayerTimesPanel prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} now={now} onQaza={handleQaza} qazaBusy={qazaBusy} language={language} />

      <section className="acard">
        <h5>{s.deen.dailyPractice}</h5>
        <div className="prow prow-link" role="button" tabIndex={0} onClick={() => onOpenGuidance('duas')} onKeyDown={(e) => { if (e.key === 'Enter') onOpenGuidance('duas'); }}>
          <span className="pic"><BookMarked size={19} strokeWidth={1.8} /></span>
          <div>{s.deen.duasRow}<small>{s.deen.duasRowSub}</small></div>
          <ChevronRight size={17} className="prow-chev" />
        </div>
        <div className="prow prow-link" role="button" tabIndex={0} onClick={() => onOpenGuidance('hijri')} onKeyDown={(e) => { if (e.key === 'Enter') onOpenGuidance('hijri'); }}>
          <span className="pic"><CalendarDays size={19} strokeWidth={1.8} /></span>
          <div>{s.deen.hijriRow}<small>{s.deen.hijriRowSub}</small></div>
          <ChevronRight size={17} className="prow-chev" />
        </div>
        <div className="prow prow-link" role="button" tabIndex={0} onClick={() => onOpenGuidance('mosques')} onKeyDown={(e) => { if (e.key === 'Enter') onOpenGuidance('mosques'); }}>
          <span className="pic"><Compass size={19} strokeWidth={1.8} /></span>
          <div>{s.deen.mosquesRow}<small>{s.deen.mosquesRowSub}</small></div>
          <ChevronRight size={17} className="prow-chev" />
        </div>
      </section>
    </section>
  );
}

const subjectColours = ['mint', 'peach', 'blue', 'rose', 'violet'];

/** Remaining time for a live session, derived exactly like the server does. */
function remainingForSession(session: PomodoroSession, nowMs: number): number {
  const started = new Date(session.startedAt).getTime();
  const end =
    session.status === 'paused' && session.pausedAt
      ? new Date(session.pausedAt).getTime()
      : nowMs;
  const elapsed = Math.max(0, end - started - session.pausedTotalMs);
  return Math.max(0, session.plannedMinutes * 60_000 - elapsed);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function Study({
  subjects,
  tasks,
  todayTasks,
  schedule,
  stats,
  activeSession,
  history,
  studyError,
  guestMode,
  profile,
  onRefresh,
  onNotify,
  onBack,
  language,
}: {
  subjects: StudySubject[];
  tasks: StudyTask[];
  todayTasks: StudyTask[];
  schedule: StudySchedule | null;
  stats: StudyStats | null;
  activeSession: PomodoroSession | null;
  history: PomodoroSession[];
  studyError: string;
  guestMode: boolean;
  profile: UserProfile;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  onBack: () => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  const breakDefault = useMemo(() => {
    const parsed = Number.parseInt(profile.studyBreakMinutes ?? '', 10);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 60 ? parsed : 5;
  }, [profile.studyBreakMinutes]);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [focusTaskId, setFocusTaskId] = useState('');
  const [busy, setBusy] = useState(false);
  // P7: which action is in flight, so its button can say so
  // ("Starting…", "Finishing…") instead of just sitting disabled while
  // the server is slow. `busy` stays the single disable guard.
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // P7: task Complete had no pending state at all — the button looked
  // dead while the request + refresh were in flight. One status
  // change at a time, tracked per task so only its row is affected.
  const [statusPending, setStatusPending] = useState<{ id: string; status: TaskStatus } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const completingRef = useRef(false);

  const [showSubjects, setShowSubjects] = useState(false);
  const [subjectForm, setSubjectForm] = useState<{ id: string | null; name: string; label: string; colour: string }>({ id: null, name: '', label: '', colour: 'mint' });
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  const [taskModal, setTaskModal] = useState<null | { task: StudyTask | null }>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskDuration, setTaskDuration] = useState('');

  const remainingMs = activeSession ? remainingForSession(activeSession, nowMs) : null;

  // Tick the countdown once a second while a session is live.
  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  // When a running session reaches zero, complete it on the server once.
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active' || remainingMs === null || remainingMs > 0) return;
    if (completingRef.current) return;
    completingRef.current = true;
    completePomodoro(activeSession.id)
      .then(async () => {
        onNotify(activeSession.mode === 'focus' ? s.study.focusComplete : s.study.breakComplete);
        await onRefresh();
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : s.study.sessionCompleteError))
      .finally(() => { completingRef.current = false; });
  }, [activeSession, remainingMs, onNotify, onRefresh]);

  if (guestMode) {
    return (
      <>
        <PageHeading
          eyebrow={s.study.guestEyebrow}
          title={s.study.guestTitle}
          text={s.study.guestText}
        />
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">{s.study.guestPanelEyebrow}</span>
          <h3>{s.study.guestPanelTitle}</h3>
          <p className="onboarding-help">
            {s.study.guestPanelText}
          </p>
        </section>
      </>
    );
  }

  const scheduleLines: string[] = [];
  if (schedule?.collegeStartTime && schedule?.collegeEndTime) {
    scheduleLines.push(s.study.collegeLine(formatTime12h(schedule.collegeStartTime), formatTime12h(schedule.collegeEndTime)));
  }
  if (schedule?.studyStartTime && schedule?.studyEndTime) {
    scheduleLines.push(s.study.studyWindowLine(formatTime12h(schedule.studyStartTime), formatTime12h(schedule.studyEndTime)));
  }
  if (schedule?.dailyStudyTarget) scheduleLines.push(s.study.dailyTargetLine(schedule.dailyStudyTarget));
  if (schedule?.dailyStudyHours) scheduleLines.push(s.study.dailyHoursLine(schedule.dailyStudyHours));
  if (schedule?.studyBreakMinutes) scheduleLines.push(s.study.breakLine(schedule.studyBreakMinutes));
  if (schedule?.preferredStudyDays?.length) scheduleLines.push(s.study.studyDaysLine(schedule.preferredStudyDays.join(', ')));

  const upcomingTasks = tasks
    .filter((t) => t.status !== 'Completed' && t.dueDate && t.dueDate > todayKey())
    .sort((a, b) => (a.dueDate ?? '') < (b.dueDate ?? '') ? -1 : 1);

  function subjectStats(subject: StudySubject) {
    const fromStats = stats?.subjectBreakdown.find((b) => b.subjectId === subject.id);
    if (fromStats) return fromStats;
    const subjectTasks = tasks.filter((t) => t.subjectId === subject.id);
    return {
      subjectId: subject.id,
      name: subject.name,
      label: subject.label,
      colour: subject.colour,
      tasksDone: subjectTasks.filter((t) => t.status === 'Completed').length,
      tasksTotal: subjectTasks.length,
      focusMinutesWeek: 0,
    };
  }

  function openTaskModal(task?: StudyTask) {
    if (task) {
      setTaskTitle(task.title);
      setTaskSubjectId(task.subjectId ?? '');
      setTaskDescription(task.description);
      setTaskPriority(task.priority);
      setTaskDueDate(task.dueDate ?? '');
      setTaskStartTime(task.startTime ?? '');
      setTaskDuration(task.durationMinutes ? String(task.durationMinutes) : '');
      setTaskModal({ task });
    } else {
      setTaskTitle('');
      setTaskSubjectId('');
      setTaskDescription('');
      setTaskPriority('Medium');
      setTaskDueDate(todayKey());
      setTaskStartTime('');
      setTaskDuration('');
      setTaskModal({ task: null });
    }
  }

  async function saveTask() {
    if (!taskTitle.trim()) {
      onNotify(s.study.taskNameRequired);
      return;
    }
    const duration = taskDuration.trim() ? Number.parseInt(taskDuration, 10) : null;
    if (duration !== null && (!Number.isFinite(duration) || duration < 1 || duration > 480)) {
      onNotify(s.study.durationRange);
      return;
    }
    const input = {
      title: taskTitle.trim(),
      subjectId: taskSubjectId || null,
      description: taskDescription.trim(),
      priority: taskPriority,
      dueDate: taskDueDate || null,
      startTime: taskStartTime || null,
      durationMinutes: duration,
    };
    setBusy(true);
    setPendingAction('save-task');
    try {
      if (taskModal?.task) {
        await updateTask(taskModal.task.id, input);
        onNotify(s.study.taskUpdated);
      } else {
        await createTask(input);
        onNotify(s.study.taskSaved);
      }
      setTaskModal(null);
      await onRefresh();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.taskSaveFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function changeStatus(task: StudyTask, status: TaskStatus) {
    if (statusPending) return;
    setStatusPending({ id: task.id, status });
    try {
      await setTaskStatus(task.id, status);
      await onRefresh();
      onNotify(status === 'Completed' ? s.study.taskCompleted : s.study.taskMarked(s.study.taskStatus[status]));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.taskUpdateFailed);
    } finally {
      setStatusPending(null);
    }
  }

  async function removeTask(task: StudyTask) {
    try {
      await deleteTask(task.id);
      setConfirmDeleteTaskId(null);
      await onRefresh();
      onNotify(s.study.taskDeleted);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.taskDeleteFailed);
    }
  }

  async function saveSubject() {
    if (!subjectForm.name.trim()) {
      onNotify(s.study.subjectNameRequired);
      return;
    }
    setBusy(true);
    setPendingAction('save-subject');
    try {
      if (subjectForm.id) {
        await updateSubject(subjectForm.id, { name: subjectForm.name.trim(), label: subjectForm.label.trim(), colour: subjectForm.colour });
        onNotify(s.study.subjectUpdated);
      } else {
        await createSubject({ name: subjectForm.name.trim(), label: subjectForm.label.trim(), colour: subjectForm.colour });
        onNotify(s.study.subjectAdded);
      }
      setSubjectForm({ id: null, name: '', label: '', colour: 'mint' });
      await onRefresh();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.subjectSaveFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function removeSubject(subject: StudySubject) {
    try {
      await deleteSubject(subject.id);
      setConfirmDeleteSubjectId(null);
      await onRefresh();
      onNotify(s.study.subjectDeleted);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.subjectDeleteFailed);
    }
  }

  async function handleStartTimer() {
    if (busy) return;
    setBusy(true);
    setPendingAction('start');
    try {
      const task = timerMode === 'focus' && focusTaskId ? tasks.find((t) => t.id === focusTaskId) : undefined;
      await startPomodoro({
        mode: timerMode,
        plannedMinutes: selectedMinutes,
        taskId: task?.id ?? null,
        subjectId: task?.subjectId ?? null,
      });
      setConfirmReset(false);
      await onRefresh();
      onNotify(timerMode === 'focus' ? s.study.focusStarted : s.study.breakStarted);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.timerStartFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function handlePauseTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    setPendingAction('pause');
    try {
      await pausePomodoro(activeSession.id);
      await onRefresh();
      onNotify(s.study.sessionPaused);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionPauseFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function handleResumeTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    setPendingAction('resume');
    try {
      await resumePomodoro(activeSession.id);
      await onRefresh();
      onNotify(s.study.sessionResumed);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionResumeFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function handleCompleteTimer() {
    // The auto-complete effect may already be finishing this session
    // (timer hit zero) — a second tap must not race it into a 409.
    if (!activeSession || busy || completingRef.current) return;
    setBusy(true);
    setPendingAction('complete');
    try {
      await completePomodoro(activeSession.id);
      await onRefresh();
      onNotify(s.study.sessionFinished);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionCompleteFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function handleAbandonTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    setPendingAction('abandon');
    try {
      await abandonPomodoro(activeSession.id);
      setConfirmReset(false);
      await onRefresh();
      onNotify(s.study.sessionReset);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionResetFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  const breakPresets = Array.from(new Set([breakDefault, 5, 10, 15])).sort((a, b) => a - b);

  // Preview #12 header: weekday + date + real daily target from the
  // saved profile (dailyStudyTarget / dailyStudyHours). No target
  // saved → the sub-line just says the date.
  const todayDate = new Date();
  const studySub = [
    todayDate.toLocaleDateString('en-IN', { weekday: 'long' }),
    todayDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    schedule?.dailyStudyTarget ? s.study.targetLine(schedule.dailyStudyTarget) : (schedule?.dailyStudyHours ? s.study.targetHoursLine(schedule.dailyStudyHours) : ''),
  ].filter(Boolean).join(' · ');
  // Aaj ka target bar: today's real focus minutes against the saved
  // daily study hours (parsed from the profile). No saved target →
  // no bar, never a guessed one.
  const targetHours = Number.parseFloat(schedule?.dailyStudyHours ?? profile.dailyStudyHours ?? '');
  const targetMinutes = Number.isFinite(targetHours) && targetHours > 0 ? Math.round(targetHours * 60) : null;
  const todayFocusMinutes = stats?.todayFocusMinutes ?? 0;
  const targetPct = targetMinutes ? Math.min(100, Math.round((todayFocusMinutes / targetMinutes) * 100)) : null;

  return (
    <section className="study-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.study.title}</h4>
          <div className="asub">{studySub}</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn" onClick={() => openTaskModal()}>{s.study.addTask}</button>
        </div>
      </div>

      {studyError && (
        <section className="panel" style={{ padding: 16, marginBottom: 15 }}>
          <p className="salah-error">{studyError}</p>
        </section>
      )}

      <div className="study-page-grid">
        <section className="panel schedule-card">
          <div className="panel-top">
            <div>
              <span className="eyebrow">{s.study.scheduleEyebrow}</span>
              <h3>{s.study.scheduleTitle}</h3>
            </div>
            <div className="date-chip small-date"><CalendarDays size={14} /> {s.study.todayChip}</div>
          </div>

          {scheduleLines.length > 0 ? (
            <div className="schedule-summary">
              {scheduleLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          ) : (
            <p className="onboarding-help">{s.study.noSchedule}</p>
          )}

          {targetMinutes !== null && targetPct !== null && (
            <>
              <div className="statrow">{s.study.todayTarget} <span>{s.study.todayTargetDone((todayFocusMinutes / 60).toFixed(1), String(targetHours))}</span></div>
              <div className="prog"><i style={{ width: `${targetPct}%` }} /></div>
            </>
          )}

          <div className="task-list full-task-list">
            {todayTasks.length === 0 && (
              <p className="onboarding-help">{s.study.noTasksToday}</p>
            )}
            {todayTasks.map((task) => {
              const subject = task.subjectId ? subjectById.get(task.subjectId) : undefined;
              // P7: only this row's buttons disable + show "Saving…"
              // while its status change is in flight.
              const rowPending = statusPending?.id === task.id;
              return (
                <div className="task-row large-task" key={task.id}>
                  <button
                    type="button"
                    className={`tick ${task.status === 'Completed' ? 'done' : ''}`}
                    disabled={rowPending}
                    onClick={() => changeStatus(task, task.status === 'Completed' ? 'Pending' : 'Completed')}
                    aria-label={task.status === 'Completed' ? s.study.reopenAria(task.title) : s.study.completeAria(task.title)}
                  >
                    {task.status === 'Completed' ? '✓' : ''}
                  </button>
                  <span className={`task-dot ${subject?.colour ?? 'mint'}`} />
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {task.startTime ? formatTime12h(task.startTime) : s.study.notScheduled}
                      {task.dueDate ? ` · ${s.study.dueOn(task.dueDate)}` : ''}
                      {subject ? ` · ${subject.name}` : ` · ${s.study.noSubject}`}
                      {task.durationMinutes ? ` · ${task.durationMinutes}m` : ''}
                    </small>
                    {task.description && <small>{task.description}</small>}
                  </div>
                  <span className={`status-tag ${task.status === 'Completed' ? 'status-done' : task.status === 'In Progress' ? 'status-live' : ''}`}>
                    {s.study.taskStatus[task.status]}
                  </span>
                  <div className="task-actions">
                    {task.status !== 'Completed' && (
                      <>
                        {task.status !== 'In Progress' && <button disabled={rowPending} onClick={() => changeStatus(task, 'In Progress')}>{rowPending && statusPending?.status === 'In Progress' ? s.study.saving : s.study.start}</button>}
                        <button disabled={rowPending} onClick={() => changeStatus(task, 'Completed')}>{rowPending && statusPending?.status === 'Completed' ? s.study.saving : s.study.complete}</button>
                      </>
                    )}
                    {task.status === 'Completed' && <button disabled={rowPending} onClick={() => changeStatus(task, 'Pending')}>{rowPending && statusPending?.status === 'Pending' ? s.study.saving : s.study.reopen}</button>}
                    <button onClick={() => openTaskModal(task)}>{s.study.edit}</button>
                    {confirmDeleteTaskId === task.id ? (
                      <button onClick={() => removeTask(task)}>{s.study.confirmDelete}</button>
                    ) : (
                      <button onClick={() => setConfirmDeleteTaskId(task.id)}>{s.study.delete}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {upcomingTasks.length > 0 && (
            <>
              <h4 className="upcoming-heading">{s.study.upcoming}</h4>
              <div className="task-list">
                {upcomingTasks.map((task) => {
                  const subject = task.subjectId ? subjectById.get(task.subjectId) : undefined;
                  return (
                    <div className="task-row" key={task.id}>
                      <span className={`task-dot ${subject?.colour ?? 'mint'}`} />
                      <div><strong>{task.title}</strong><small>{s.study.dueOn(task.dueDate!)}{subject ? ` · ${subject.name}` : ` · ${s.study.noSubject}`}</small></div>
                      <span className="status-tag">{s.study.taskStatus[task.status]}</span>
                      <button className="task-action-link" onClick={() => openTaskModal(task)}>{s.study.edit}</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <button className="add-row" onClick={() => openTaskModal()}><Plus size={15} /> {s.study.addAnother}</button>
          <p className="modal-note">{s.study.streakRule}</p>
        </section>

        <section className="panel subjects-card">
          <div className="panel-top">
            <div>
              <span className="eyebrow">{s.study.subjectsEyebrow}</span>
              <h3>{s.study.subjectsTitle}</h3>
            </div>
            <button className="subtle-action" onClick={() => setShowSubjects(!showSubjects)}>
              {showSubjects ? s.study.done : s.study.manageSubjects} <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="chiprow study-subject-chips">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                className="mchip"
                onClick={() => { setSubjectForm({ id: subject.id, name: subject.name, label: subject.label, colour: subject.colour }); setShowSubjects(true); }}
              >
                {subject.name}
              </button>
            ))}
            <button
              type="button"
              className="mchip mchip-add"
              onClick={() => { setSubjectForm({ id: null, name: '', label: '', colour: 'mint' }); setShowSubjects(true); }}
            >
              {s.study.newSubject}
            </button>
          </div>
          {showSubjects && (
            <div className="subject-form">
              <label className="field-label">{s.study.subjectName}</label>
              <input className="form-input" value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} placeholder={s.study.subjectNamePlaceholder} />
              <label className="field-label">{s.study.subjectLabel}</label>
              <input className="form-input" value={subjectForm.label} onChange={(e) => setSubjectForm((f) => ({ ...f, label: e.target.value }))} placeholder={s.study.subjectLabelPlaceholder} />
              <label className="field-label">{s.study.colour}</label>
              <div className="colour-picker">
                {subjectColours.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`colour-dot colour-${c} ${subjectForm.colour === c ? 'selected' : ''}`}
                    onClick={() => setSubjectForm((f) => ({ ...f, colour: c }))}
                    aria-label={c}
                  />
                ))}
              </div>
              <button className="primary-button" disabled={busy} onClick={saveSubject}>
                {pendingAction === 'save-subject' ? s.study.saving : subjectForm.id ? s.study.saveSubject : s.study.addSubject}
              </button>
              {subjectForm.id && (
                <button className="text-button" onClick={() => setSubjectForm({ id: null, name: '', label: '', colour: 'mint' })}>
                  {s.study.cancelEdit}
                </button>
              )}
              <p className="modal-note">{s.study.deleteSubjectNote}</p>
            </div>
          )}
          <div className="subject-list">
            {subjects.length === 0 && (
              <p className="onboarding-help">{s.study.noSubjects}</p>
            )}
            {subjects.map((subject) => {
              const row = subjectStats(subject);
              return (
                <div key={subject.id}>
                  <SubjectRow name={subject.name} label={subject.label} tasksDone={row.tasksDone} tasksTotal={row.tasksTotal} focusMinutes={row.focusMinutesWeek} colour={subject.colour} language={language} />
                  {showSubjects && (
                    <div className="subject-actions">
                      <button onClick={() => setSubjectForm({ id: subject.id, name: subject.name, label: subject.label, colour: subject.colour })}>{s.study.edit}</button>
                      {confirmDeleteSubjectId === subject.id ? (
                        <button onClick={() => removeSubject(subject)}>{s.study.confirmDeleteSubject}</button>
                      ) : (
                        <button onClick={() => setConfirmDeleteSubjectId(subject.id)}>{s.study.delete}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel timer-card">
          <span className="eyebrow">{s.study.timerEyebrow}</span>
          <div className="timer-circle">
            <div>
              <strong>{activeSession ? formatCountdown(remainingMs ?? 0) : `${String(selectedMinutes).padStart(2, '0')}:00`}</strong>
              <span>
                {activeSession
                  ? activeSession.status === 'paused'
                    ? s.study.paused
                    : activeSession.mode === 'focus' ? s.study.focusSession : s.study.breakLabel
                  : s.study.ready}
              </span>
            </div>
          </div>
          {activeSession && (
            <p className="muted-footnote">
              {activeSession.mode === 'focus' ? s.study.focusMinutesLabel(activeSession.plannedMinutes) : s.study.breakMinutesLabel(activeSession.plannedMinutes)}
              {activeSession.taskId ? ` · ${tasks.find((t) => t.id === activeSession.taskId)?.title ?? ''}` : ''}
              {' · '}{s.study.timerSavedNote}
            </p>
          )}
          {!activeSession && (
            <>
              <div className="timer-presets">
                <button className={timerMode === 'focus' ? 'preset-selected' : ''} onClick={() => { setTimerMode('focus'); setSelectedMinutes(25); }}>{s.study.focusTab}</button>
                <button className={timerMode === 'break' ? 'preset-selected' : ''} onClick={() => { setTimerMode('break'); setSelectedMinutes(breakDefault); }}>{s.study.breakTab}</button>
              </div>
              <div className="timer-presets">
                {(timerMode === 'focus' ? [25, 45, 60] : breakPresets).map((v) => (
                  <button
                    key={v}
                    className={selectedMinutes === v ? 'preset-selected' : ''}
                    onClick={() => setSelectedMinutes(v)}
                  >
                    {v} min
                  </button>
                ))}
              </div>
              {timerMode === 'focus' && (
                <>
                  <label className="field-label">{s.study.focusOnTask}</label>
                  <select className="form-input" value={focusTaskId} onChange={(e) => setFocusTaskId(e.target.value)}>
                    <option value="">{s.study.noSpecificTask}</option>
                    {tasks.filter((t) => t.status !== 'Completed').map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </>
              )}
              {timerMode === 'break' && (
                <small className="muted-footnote">{s.study.breakDefaultNote(breakDefault)}</small>
              )}
              <button className="primary-button full-width" disabled={busy} onClick={handleStartTimer}>
                {pendingAction === 'start' ? s.study.starting : timerMode === 'focus' ? s.study.startFocus : s.study.startBreak} <ArrowRight size={15} />
              </button>
            </>
          )}
          {activeSession && (
            <div className="timer-actions">
              {activeSession.status === 'active' ? (
                <button className="primary-button full-width" disabled={busy} onClick={handlePauseTimer}>
                  <Timer size={15} /> {pendingAction === 'pause' ? s.study.pausing : s.study.pauseSession}
                </button>
              ) : (
                <button className="primary-button full-width" disabled={busy} onClick={handleResumeTimer}>
                  {pendingAction === 'resume' ? s.study.resuming : s.study.resumeSession} <ArrowRight size={15} />
                </button>
              )}
              <button className="outline-button full-width" disabled={busy} onClick={handleCompleteTimer}>
                {pendingAction === 'complete' ? s.study.finishing : s.study.finishNow}
              </button>
              {confirmReset ? (
                <button className="outline-button full-width" disabled={busy} onClick={handleAbandonTimer}>
                  {pendingAction === 'abandon' ? s.study.resetting : s.study.confirmReset}
                </button>
              ) : (
                <button className="text-button" disabled={busy} onClick={() => setConfirmReset(true)}>
                  {s.study.resetTimer}
                </button>
              )}
            </div>
          )}
          <small className="muted-footnote">{s.study.timerServerNote}</small>
        </section>

        <section className="panel history-card">
          <SectionTitle title={s.study.historyTitle} />
          {history.length === 0 ? (
            <p className="onboarding-help">{s.study.noHistory}</p>
          ) : (
            <div className="history-list">
              {history.slice(0, 10).map((session) => (
                <div className="history-row" key={session.id}>
                  <div>
                    <strong>{session.mode === 'focus' ? s.study.historyFocus(session.plannedMinutes) : s.study.historyBreak(session.plannedMinutes)}</strong>
                    <small>
                      {session.completedAt
                        ? new Date(session.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : ''}
                      {session.taskId ? ` · ${tasks.find((t) => t.id === session.taskId)?.title ?? ''}` : ''}
                    </small>
                  </div>
                  <span className={`status-tag ${session.status === 'completed' ? 'status-done' : ''}`}>
                    {session.status === 'completed' ? s.study.earned(session.focusMinutesEarned) : s.study.abandoned}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel study-tip">
          <div className="tip-icon"><Sparkles size={19} /></div>
          <div>
            <span className="eyebrow">{s.study.tipEyebrow}</span>
            <h3>{s.study.tipTitle}</h3>
            <p>{s.study.tipText}</p>
          </div>
        </section>
      </div>

      {taskModal && (
        <div className="modal-backdrop" onClick={() => setTaskModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><span className="eyebrow">{s.study.modalEyebrow}</span><h3>{taskModal.task ? s.study.modalEditTask : s.study.modalAddTask}</h3></div>
              <button className="icon-button" onClick={() => setTaskModal(null)}><X size={18} /></button>
            </div>
            <label className="field-label">{s.study.taskName}</label>
            <input className="form-input" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={s.study.taskNamePlaceholder} />
            <label className="field-label">{s.study.subject}</label>
            <select className="form-input" value={taskSubjectId} onChange={(e) => setTaskSubjectId(e.target.value)}>
              <option value="">{s.study.noSubject}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="field-label">{s.study.description}</label>
            <textarea className="form-input form-textarea" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder={s.study.descriptionPlaceholder} rows={3} />
            <div className="form-row">
              <div>
                <label className="field-label">{s.study.priority}</label>
                <select className="form-input" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}>
                  <option value="Low">{s.study.priorityLow}</option>
                  <option value="Medium">{s.study.priorityMedium}</option>
                  <option value="High">{s.study.priorityHigh}</option>
                </select>
              </div>
              <div>
                <label className="field-label">{s.study.duration}</label>
                <input className="form-input" type="number" min={1} max={480} value={taskDuration} onChange={(e) => setTaskDuration(e.target.value)} placeholder={s.study.durationPlaceholder} />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="field-label">{s.study.dueDate}</label>
                <input className="form-input" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
              </div>
              <div>
                <label className="field-label">{s.study.startTime}</label>
                <input className="form-input" type="time" value={taskStartTime} onChange={(e) => setTaskStartTime(e.target.value)} />
              </div>
            </div>
            <button className="primary-button full-width" disabled={busy} onClick={saveTask}>
              {pendingAction === 'save-task' ? s.study.saving : taskModal.task ? s.study.saveChanges : s.study.addTask} <ArrowRight size={16} />
            </button>
            <p className="modal-note">{s.study.modalNote}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function SubjectRow({ name, label, tasksDone, tasksTotal, focusMinutes, colour, language }: {
  name: string;
  label: string;
  tasksDone: number;
  tasksTotal: number;
  focusMinutes: number;
  colour: string;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  return (
    <div className="subject-row">
      <div>
        <div><strong>{name}</strong><span>{label || s.study.noLabel}</span></div>
        <b>{s.study.subjectProgress(tasksDone, tasksTotal, focusMinutes)}</b>
      </div>
      <div className="progress-track"><span className={`fill-${colour}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

const CHALLENGE_CATEGORY_ICONS: Record<ChallengeCategory, IconType> = {
  prayers: Compass,
  quran: BookOpen,
  study: GraduationCap,
  focus: Timer,
  sleep: Moon,
  discipline: Target,
};

/** Prayers, study and focus complete automatically from real activity. */
function isAutoCategory(category: ChallengeCategory): boolean {
  return category === 'prayers' || category === 'study' || category === 'focus';
}

function Challenges({
  onNotify,
  onRefresh,
  guestMode,
  onBack,
  onOpenFriends,
  language,
}: {
  onNotify: (message: string) => void;
  onRefresh: () => void;
  guestMode: boolean;
  onBack: () => void;
  /** Phase 15: opens the Friends screen, where the invite UI lives. */
  onOpenFriends: () => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [tab, setTab] = useState<'explore' | 'mine' | 'history'>('explore');
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [myActive, setMyActive] = useState<ChallengeParticipation[]>([]);
  const [myHistory, setMyHistory] = useState<ChallengeParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [templateConsent, setTemplateConsent] = useState(false);
  const [detailConsent, setDetailConsent] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [heroShowRules, setHeroShowRules] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCategory, setCreateCategory] = useState<ChallengeCategory>('study');
  const [createDuration, setCreateDuration] = useState('30');
  const [createRules, setCreateRules] = useState('');
  const [createConsent, setCreateConsent] = useState(false);

  async function loadAll() {
    if (guestMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [templateList, mine] = await Promise.all([
        fetchTemplates(),
        fetchMyChallenges(),
      ]);
      setTemplates(templateList);
      setMyActive(mine.active);
      setMyHistory(mine.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.challenges.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(challengeId: string) {
    setDetailLoading(true);
    setDetailConsent(false);
    setConfirmLeave(false);
    try {
      const result = await fetchChallengeDetail(challengeId);
      setDetail(result);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.challenges.loadDetailFailed);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshAfterChange() {
    await loadAll();
    onRefresh();
  }

  async function handleJoinTemplate(template: ChallengeTemplate) {
    if (!templateConsent) {
      onNotify(s.challenges.joinNeedsConsent);
      return;
    }
    setBusy(true);
    try {
      const { challenge } = await joinTemplate(template.id);
      onNotify(s.challenges.joined(template.title));
      setExpandedTemplate(null);
      setTemplateConsent(false);
      await refreshAfterChange();
      await openDetail(challenge.id);
      setTab('mine');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.challenges.joinFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinDetail() {
    if (!detail || !detailConsent) {
      onNotify(s.challenges.joinNeedsConsent);
      return;
    }
    setBusy(true);
    try {
      await joinChallenge(detail.challenge.id);
      onNotify(s.challenges.joined(detail.challenge.title));
      await refreshAfterChange();
      await openDetail(detail.challenge.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.challenges.joinFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await leaveChallenge(detail.challenge.id);
      onNotify(result.message);
      setConfirmLeave(false);
      await refreshAfterChange();
      await openDetail(detail.challenge.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.challenges.leaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckIn() {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await checkInChallenge(detail.challenge.id);
      onNotify(result.message);
      await refreshAfterChange();
      await openDetail(detail.challenge.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.challenges.checkInFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const rules = createRules.split('\n').map((r) => r.trim()).filter(Boolean);
    if (!createTitle.trim() || rules.length === 0 || !createConsent) {
      onNotify(s.challenges.createNeedsFields);
      return;
    }
    const durationDays = Number.parseInt(createDuration, 10);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
      onNotify(s.challenges.createDurationRange);
      return;
    }
    setBusy(true);
    try {
      const { challenge } = await createChallenge({
        title: createTitle.trim(),
        description: createDescription.trim(),
        category: createCategory,
        durationDays,
        rules,
        consent: true,
      });
      onNotify(s.challenges.created(challenge.title));
      setShowCreate(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateRules('');
      setCreateConsent(false);
      await refreshAfterChange();
      await openDetail(challenge.id);
      setTab('mine');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : s.challenges.createFailed);
    } finally {
      setBusy(false);
    }
  }

  function participationForTemplate(templateId: string): ChallengeParticipation | undefined {
    return myActive.find((p) => p.challenge.templateId === templateId);
  }

  if (guestMode) {
    return (
      <>
        <PageHeading
          eyebrow={s.challenges.guestEyebrow}
          title={s.challenges.guestTitle}
          text={s.challenges.guestText}
        />
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">{s.challenges.guestPanelEyebrow}</span>
          <h3>{s.challenges.guestPanelTitle}</h3>
          <p className="onboarding-help">
            {s.challenges.guestPanelText}
          </p>
        </section>
      </>
    );
  }

  /* ---------------- Detail view ---------------- */

  if (detail) {
    const challenge = detail.challenge;
    const participation = detail.participation;
    const Icon = CHALLENGE_CATEGORY_ICONS[challenge.category];
    const auto = isAutoCategory(challenge.category);
    const completed = participation?.status === 'completed';
    return (
      <section className="challenges-screen">
        <div className="apphead">
          <button type="button" className="aback" onClick={() => setDetail(null)} aria-label={s.challenges.backAll}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h4>{challenge.title}</h4>
            <div className="asub">{challengeCategoryLabel(challenge.category, language)} · {s.challenges.kindDays(challenge.durationDays)} · {challenge.kind === 'template' ? s.challenges.templateKind : s.challenges.ownKind}</div>
          </div>
          <div className="aright">
            <button type="button" className="sbtn gh" onClick={onOpenFriends}><Users size={15} /> {s.challenges.inviteFriends}</button>
          </div>
        </div>
        {detailLoading && <p className="onboarding-help">{s.challenges.detailLoading}</p>}

        {completed && participation && (
          <section className="panel challenge-completed">
            <Trophy size={22} />
            <div>
              <span className="eyebrow">{s.challenges.completedEyebrow}</span>
              <h3>{s.challenges.completedTitle(challenge.durationDays)}</h3>
              <p>
                {s.challenges.completedLine(challenge.durationDays >= 365 ? s.challenges.badge365 : challenge.durationDays >= 30 ? s.challenges.badge30 : s.challenges.badgeFinisher, participation.pointsEarned)}
              </p>
            </div>
          </section>
        )}

        <div className="challenge-detail-grid">
          <section className="panel">
            <span className="eyebrow">{challengeCategoryLabel(challenge.category, language).toUpperCase()} · {challenge.durationDays} DAYS · {challenge.kind === 'template' ? s.challenges.kindTemplate : s.challenges.kindOwn}</span>
            <h3>{s.challenges.rulesTitle}</h3>
            <ul className="challenge-rules">
              {challenge.rules.map((rule, index) => <li key={index}>{rule}</li>)}
            </ul>
            <p className="onboarding-help">
              {s.challenges.completesDay(challengeRequirement(challenge.category, language))}
              {!auto && s.challenges.selfReportedNote}
            </p>

            {!participation && (
              <div className="challenge-consent">
                <label className="consent-row">
                  <input type="checkbox" checked={detailConsent} onChange={(e) => setDetailConsent(e.target.checked)} />
                  <span>{s.challenges.consentJoin}</span>
                </label>
                <button className="primary-button" disabled={!detailConsent || busy} onClick={handleJoinDetail}>
                  {s.challenges.joinChallenge}
                </button>
              </div>
            )}

            {participation && participation.status === 'active' && (
              <div className="challenge-leave">
                {!confirmLeave ? (
                  <button className="outline-button" onClick={() => setConfirmLeave(true)}>{s.challenges.leaveChallenge}</button>
                ) : (
                  <>
                    <p className="onboarding-help">{detail.leaveRule}</p>
                    <div className="challenge-leave-actions">
                      <button className="primary-button" disabled={busy} onClick={handleLeave}>{s.challenges.leaveConfirm}</button>
                      <button className="outline-button" onClick={() => setConfirmLeave(false)}>{s.challenges.stay}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="panel">
            {participation ? (
              <>
                <span className="eyebrow">{s.challenges.yourProgress}</span>
                <h3>{s.challenges.dayOf(participation.currentDay, participation.totalDays)}</h3>
                <div className="progress-track"><span className="fill-mint" style={{ width: `${Math.round((participation.completedDays / participation.totalDays) * 100)}%` }} /></div>
                <div className="challenge-stat-row">
                  <div><strong>{participation.completedDays}</strong><span>{s.challenges.daysDone}</span></div>
                  <div><strong>{participation.streak}</strong><span>{s.challenges.dayStreak}</span></div>
                  <div><strong>{participation.pointsEarned}</strong><span>{s.challenges.points}</span></div>
                </div>
                <p className="onboarding-help">
                  {detail.todayCompleted
                    ? s.challenges.todayDone
                    : auto
                      ? s.challenges.todayNotDoneAuto(challengeRequirement(challenge.category, language))
                      : s.challenges.todayNotDoneManual}
                </p>
                {participation.status === 'active' && !auto && !detail.todayCompleted && (
                  <button className="primary-button" disabled={busy} onClick={handleCheckIn}>
                    <Check size={16} /> {s.challenges.checkInToday}
                  </button>
                )}
                {detail.progress.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 18 }}>{s.challenges.recentDays}</h3>
                    <div className="challenge-progress-list">
                      {detail.progress.slice(0, 14).map((day) => (
                        <div className="challenge-progress-row" key={day.date}>
                          <span className="challenge-day-dot done" />
                          <div><strong>{s.challenges.dayDate(day.dayNumber, day.date)}</strong><small>{challengeProgressSource(day.source, language)}{day.source === 'self-reported' ? s.challenges.selfReportedSuffix : ''}</small></div>
                          <Check size={15} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="eyebrow">{s.challenges.yourProgress}</span>
                <h3>{s.challenges.notJoined}</h3>
                <p className="onboarding-help">{s.challenges.notJoinedText}</p>
              </>
            )}
            {detail.history.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>{s.challenges.pastAttempts}</h3>
                {detail.history.map((attempt) => (
                  <p className="onboarding-help" key={attempt.id}>
                    {s.challenges.attemptLine(attempt.status === 'completed' ? s.challenges.attemptCompleted : s.challenges.attemptLeft, attempt.completedDays, attempt.totalDays, attempt.pointsEarned)}
                  </p>
                ))}
              </>
            )}
          </section>
        </div>

        <div className="privacy-callout">
          <Lock size={16} />
          <div>
            <strong>{s.challenges.privacyTitle}</strong>
            <span>{s.challenges.privacyDetail}</span>
          </div>
        </div>
      </section>
    );
  }

  /* ---------------- List view ---------------- */

  const hero = myActive[0] ?? null;

  return (
    <section className="challenges-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.challenges.title}</h4>
          <div className="asub">{s.challenges.sub}</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn gh" onClick={onOpenFriends}><Users size={15} /> {s.challenges.inviteFriends}</button>
          <button type="button" className="sbtn" onClick={() => setShowCreate(true)}>{s.challenges.create}</button>
        </div>
      </div>

      {error && <p className="salah-error">{error}</p>}
      {loading && <p className="onboarding-help">{s.challenges.loading}</p>}

      {hero ? (
        <div className="acard-l ch-hero">
          <div className="ch-hero-top">
            <span className="mchip">{s.challenges.heroRunning}</span>
            <span className="ch-hero-streak">🔥 {s.challenges.heroStreak(hero.streak)}</span>
          </div>
          <div className="ch-hero-title">{hero.challenge.title}</div>
          <p className="ch-hero-rules-line">
            {hero.challenge.rules.slice(0, 3).join(' · ')}
            {hero.challenge.rules.length > 3 ? ' · …' : ''}
          </p>
          <div className="prog pk"><i style={{ width: `${hero.totalDays > 0 ? Math.round((hero.completedDays / hero.totalDays) * 100) : 0}%` }} /></div>
          <div className="ch-hero-meta"><span>{s.challenges.dayOf(hero.currentDay, hero.totalDays)}</span><span>{s.challenges.heroPoints(hero.pointsEarned)}</span></div>
          <div className="btnrow">
            <button type="button" className="sbtn pk" onClick={() => openDetail(hero.challengeId)}>{s.challenges.heroSeeToday}</button>
            <button type="button" className="sbtn gh" onClick={() => setHeroShowRules((v) => !v)}>{s.challenges.rulesButton}</button>
          </div>
          {heroShowRules && (
            <div className="challenge-rules-box ch-hero-rules">
              <strong>Rules — read before joining</strong>
              <ul className="challenge-rules">
                {hero.challenge.rules.map((rule, index) => <li key={index}>{rule}</li>)}
              </ul>
              <p className="onboarding-help">{s.challenges.completesDay(challengeRequirement(hero.challenge.category, language))}</p>
            </div>
          )}
        </div>
      ) : (
        !loading && (
          <div className="acard-l">
            <h5>{s.challenges.noActive}</h5>
            <p className="onboarding-help">
              {s.challenges.noActiveText}
            </p>
            <button type="button" className="sbtn pk" onClick={() => setTab('explore')}>{s.challenges.joinAChallenge}</button>
          </div>
        )
      )}

      <div className="challenge-controls">
        <div className="segmented">
          <button className={tab === 'explore' ? 'on' : ''} onClick={() => setTab('explore')}>{s.challenges.tabExplore}</button>
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>{s.challenges.tabMine(myActive.length)}</button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>{s.challenges.tabHistory(myHistory.length)}</button>
        </div>
        <div className="privacy-hint"><ShieldCheck size={14} /> {s.challenges.privateDefault}</div>
      </div>

      {tab === 'explore' && (
        <div className="acard-l">
          <h5>{s.challenges.readyMade}</h5>
          {templates.length === 0 && !loading && (
            <p className="onboarding-help">{s.challenges.noTemplates}</p>
          )}
          {templates.map((template) => {
            const joined = participationForTemplate(template.id);
            const expanded = expandedTemplate === template.id;
            return (
              <div key={template.id}>
                <div className="taskrow">
                  <span className="snum2">{template.durationDays}</span>
                  <div>{template.title}<small>{template.description || `${challengeCategoryLabel(template.category, language)} · ${template.requirement}`}</small></div>
                  {joined ? (
                    <button type="button" className="sbtn" style={{ marginLeft: 'auto' }} onClick={() => openDetail(joined.challengeId)}>
                      {s.challenges.dayView(joined.currentDay)}
                    </button>
                  ) : expanded ? (
                    <button type="button" className="sbtn gh" style={{ marginLeft: 'auto' }} onClick={() => { setExpandedTemplate(null); setTemplateConsent(false); }}>
                      {s.challenges.close}
                    </button>
                  ) : (
                    <button type="button" className="sbtn" style={{ marginLeft: 'auto' }} onClick={() => { setExpandedTemplate(template.id); setTemplateConsent(false); }}>
                      {s.challenges.join}
                    </button>
                  )}
                </div>
                {expanded && !joined && (
                  <div className="challenge-rules-box">
                    <strong>Rules — read before joining</strong>
                    <ul className="challenge-rules">
                      {template.rules.map((rule, index) => <li key={index}>{rule}</li>)}
                    </ul>
                    <label className="consent-row">
                      <input type="checkbox" checked={templateConsent} onChange={(e) => setTemplateConsent(e.target.checked)} />
                      <span>{s.challenges.consentJoin}</span>
                    </label>
                    <button type="button" className="primary-button full-width" disabled={!templateConsent || busy} onClick={() => handleJoinTemplate(template)}>
                      {s.challenges.joinChallenge}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="taskrow">
            <span className="snum2 snum2-peach">+</span>
            <div>{s.challenges.createOwn}<small>{s.challenges.createOwnSub}</small></div>
            <button type="button" className="sbtn pk" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>{s.challenges.createButton}</button>
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div className="challenge-cards">
          {myActive.length === 0 && !loading && (
            <p className="onboarding-help">{s.challenges.mineEmpty}</p>
          )}
          {myActive.map((participation) => {
            const Icon = CHALLENGE_CATEGORY_ICONS[participation.challenge.category];
            return (
              <div className="panel challenge-card" key={participation.id}>
                <div className="challenge-card-icon"><Icon size={21} /></div>
                <span className="eyebrow">{challengeCategoryLabel(participation.challenge.category, language).toUpperCase()} · {participation.totalDays} DAYS</span>
                <h3>{participation.challenge.title}</h3>
                <p>{participation.challenge.description}</p>
                <div className="challenge-meta">
                  <span><CalendarDays size={14} /> {s.challenges.dayOf(participation.currentDay, participation.totalDays)}</span>
                  <span><Flame size={14} /> {s.challenges.streakDays(participation.streak)}</span>
                </div>
                <div className="progress-track"><span className="fill-mint" style={{ width: `${Math.round((participation.completedDays / participation.totalDays) * 100)}%` }} /></div>
                <p className="onboarding-help">{s.challenges.mineLine(participation.completedDays, participation.pointsEarned)}{participation.todayCompleted ? s.challenges.todayDoneSuffix : s.challenges.todayPendingSuffix}</p>
                <button className="outline-button full-width" onClick={() => openDetail(participation.challengeId)}>
                  {s.challenges.viewChallenge} <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'history' && (
        <div className="challenge-cards">
          {myHistory.length === 0 && !loading && (
            <p className="onboarding-help">{s.challenges.historyEmpty}</p>
          )}
          {myHistory.map((participation) => {
            const Icon = CHALLENGE_CATEGORY_ICONS[participation.challenge.category];
            return (
              <div className="panel challenge-card" key={participation.id}>
                <div className="challenge-card-icon"><Icon size={21} /></div>
                <span className="eyebrow">{challengeCategoryLabel(participation.challenge.category, language).toUpperCase()} · {participation.totalDays} DAYS · {participation.status === 'completed' ? s.challenges.attemptCompleted.toUpperCase() : s.challenges.attemptLeft.toUpperCase()}</span>
                <h3>{participation.challenge.title}</h3>
                <p>{s.challenges.historyLine(participation.completedDays, participation.totalDays, participation.pointsEarned)}</p>
                {participation.status === 'completed' && (
                  <p className="onboarding-help">{s.challenges.badgeEarned(participation.totalDays >= 365 ? s.challenges.badge365 : participation.totalDays >= 30 ? s.challenges.badge30 : s.challenges.badgeFinisher)}</p>
                )}
                <button className="outline-button full-width" onClick={() => openDetail(participation.challengeId)}>
                  {s.challenges.viewChallenge} <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="acard-l">
        <p className="mut" style={{ margin: 0 }}>
          {s.challenges.footerRules}
        </p>
      </div>

      <div className="privacy-callout">
        <Lock size={16} />
        <div>
          <strong>{s.challenges.privacyTitle}</strong>
          <span>{s.challenges.privacyDetail2}</span>
        </div>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><span className="eyebrow">{s.challenges.title.toUpperCase()}</span><h3>{s.challenges.createTitle}</h3></div>
              <button className="icon-button" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <label className="field-label">{s.challenges.createTitleLabel}</label>
              <input className="form-input" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder={s.challenges.createTitlePlaceholder} />
              <label className="field-label">{s.challenges.createDescriptionLabel}</label>
              <input className="form-input" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder={s.challenges.createDescriptionPlaceholder} />
              <div className="form-row">
                <div>
                  <label className="field-label">{s.challenges.createCategory}</label>
                  <select className="form-input" value={createCategory} onChange={(e) => setCreateCategory(e.target.value as ChallengeCategory)}>
                    {(Object.keys(s.challenges.categories) as ChallengeCategory[]).map((c) => (
                      <option key={c} value={c}>{challengeCategoryLabel(c, language)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">{s.challenges.createDuration}</label>
                  <input className="form-input" inputMode="numeric" value={createDuration} onChange={(e) => setCreateDuration(e.target.value)} placeholder="30" />
                </div>
              </div>
              <p className="onboarding-help">{s.challenges.completesDay(challengeRequirement(createCategory, language))}{!isAutoCategory(createCategory) && s.challenges.selfReportedNote}</p>
              <label className="field-label">{s.challenges.createRulesLabel}</label>
              <textarea className="form-input" value={createRules} onChange={(e) => setCreateRules(e.target.value)} placeholder={s.challenges.createRulesPlaceholder} rows={4} />
              <label className="consent-row">
                <input type="checkbox" checked={createConsent} onChange={(e) => setCreateConsent(e.target.checked)} />
                <span>{s.challenges.createConsent}</span>
              </label>
              <button className="primary-button full-width" type="submit" disabled={busy}>{s.challenges.createAndJoin}</button>
              <p className="modal-note">{s.challenges.createNote}</p>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Guidance({ onNotify, onOpenFeedback, tab, onTabChange, guestMode, profileCity, initialSurah, onInitialSurahOpened, onOpenSurah, language }: {
  onNotify: (message: string) => void;
  onOpenFeedback: () => void;
  tab: GuidanceTab;
  onTabChange: (tab: GuidanceTab) => void;
  guestMode: boolean;
  profileCity: string;
  initialSurah: number | null;
  onInitialSurahOpened: () => void;
  onOpenSurah: (surahNumber: number) => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  // Selected mood card as an index into s.guidance.cards (same order
  // as GUIDANCE_ICONS) — the moods are dictionary strings now, so the
  // index is the selection key, not the English text.
  const [selected, setSelected] = useState(0);

  function openVerifiedReading() {
    if (selected === 2) {
      onTabChange('duas');
      return;
    }
    if (selected === 0) {
      // Surah Ash-Sharh (94) — the reference already shown on this card.
      onOpenSurah(94);
      return;
    }
    onTabChange('quran');
  }

  return (
    <>
      <PageHeading
        eyebrow={s.guidance.eyebrow}
        title={s.guidance.title}
        text={s.guidance.text}
      />

      <div className="guidance-layout">
        <section className="panel guidance-main">
          <span className="eyebrow">{s.guidance.whatOnMind}</span>
          <h2>{s.guidance.feelingToday}</h2>
          <p>{s.guidance.chooseTopic}</p>

          <div className="mood-grid">
            {s.guidance.cards.map((card, index) => {
              const Icon = GUIDANCE_ICONS[index];
              return (
                <button
                  key={index}
                  className={selected === index ? 'selected' : ''}
                  onClick={() => setSelected(index)}
                >
                  <Icon size={19} />
                  <strong>{card.mood}</strong>
                  <span>{card.category}</span>
                </button>
              );
            })}
          </div>

          <div className="guidance-result">
            <div className="guidance-result-top">
              <span className="eyebrow">{s.guidance.suggested}</span>
              <BookOpen size={18} />
            </div>
            <h3>{s.guidance.cards[selected].category}</h3>
            <div className="reference-chip">{s.guidance.cards[selected].ref}</div>
            <p>
              {s.guidance.suggestedText}
            </p>
            <button className="primary-button" onClick={openVerifiedReading}>
              {s.guidance.openReading} <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <aside className="guidance-side">
          <div className="panel source-panel">
            <div className="source-icon"><ShieldCheck size={20} /></div>
            <span className="eyebrow">{s.guidance.promiseEyebrow}</span>
            <h3>{s.guidance.promiseTitle}</h3>
            <p>{s.guidance.promiseText}</p>
            <div className="source-check"><CheckCheck size={14} /> {s.guidance.promiseCheck1}</div>
            <div className="source-check"><CheckCheck size={14} /> {s.guidance.promiseCheck2}</div>
            <div className="source-check"><CheckCheck size={14} /> {s.guidance.promiseCheck3}</div>
          </div>

          <div className="panel support-panel">
            <Heart size={20} />
            <h3>{s.guidance.supportTitle}</h3>
            <p>{s.guidance.supportText}</p>
            <button className="text-button" onClick={onOpenFeedback}>
              {s.guidance.supportButton} <ArrowRight size={14} />
            </button>
          </div>
        </aside>
      </div>

      <div className="guidance-tabs" role="tablist" aria-label={s.guidance.tabsAria}>
        {([
          ['quran', s.guidance.tabQuran],
          ['duas', s.guidance.tabDuas],
          ['hijri', s.guidance.tabHijri],
          ['mosques', s.guidance.tabMosques],
        ] as [GuidanceTab, string][]).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'selected' : ''}
            onClick={() => onTabChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'quran' && (
        <QuranBrowser
          onNotify={onNotify}
          guestMode={guestMode}
          initialSurah={initialSurah}
          onInitialSurahOpened={onInitialSurahOpened}
          language={language}
        />
      )}
      {tab === 'duas' && <CuratedDuas onOpenSurah={onOpenSurah} language={language} />}
      {tab === 'hijri' && <HijriCalendar onNotify={onNotify} guestMode={guestMode} language={language} />}
      {tab === 'mosques' && (
        <MosqueFinder onNotify={onNotify} guestMode={guestMode} profileCity={profileCity} language={language} />
      )}
    </>
  );
}

/** Preview #13 — Focus timer screen (dark). The sleep-window /
 * app-selection UI moved to the Sleep screen; this page is the live
 * Pomodoro timer: big ring countdown from the existing server-side
 * session state (activePomodoro, already loaded in App), Pause /
 * Finish wired to pausePomodoro / completePomodoro, KPIs from
 * studyStats / pomodoroHistory, and the session-history list. No
 * points are shown per session — the session record carries no points
 * award, so none is invented. The honesty note stays: web cannot
 * block other apps, so there is no fake blocking toggle. */
function Focus({
  activeSession,
  history,
  stats,
  tasks,
  onRefresh,
  onNotify,
  onNavigate,
  guestMode,
  language,
}: {
  activeSession: PomodoroSession | null;
  history: PomodoroSession[];
  stats: StudyStats | null;
  tasks: StudyTask[];
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  onNavigate: (page: Page) => void;
  guestMode: boolean;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const completingRef = useRef(false);

  const remainingMs = activeSession ? remainingForSession(activeSession, nowMs) : null;

  // Tick the countdown once a second while a session is live.
  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  // When a running session reaches zero, complete it on the server once.
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active' || remainingMs === null || remainingMs > 0) return;
    if (completingRef.current) return;
    completingRef.current = true;
    completePomodoro(activeSession.id)
      .then(async () => {
        onNotify(activeSession.mode === 'focus' ? s.study.focusComplete : s.study.breakComplete);
        await onRefresh();
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : s.study.sessionCompleteError))
      .finally(() => { completingRef.current = false; });
  }, [activeSession, remainingMs, onNotify, onRefresh]);

  async function handlePauseTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    setPendingAction('pause');
    try {
      await pausePomodoro(activeSession.id);
      await onRefresh();
      onNotify(s.study.sessionPaused);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionPauseFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function handleResumeTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    setPendingAction('resume');
    try {
      await resumePomodoro(activeSession.id);
      await onRefresh();
      onNotify(s.study.sessionResumed);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionResumeFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function handleCompleteTimer() {
    if (!activeSession || busy || completingRef.current) return;
    setBusy(true);
    setPendingAction('complete');
    try {
      await completePomodoro(activeSession.id);
      await onRefresh();
      onNotify(s.study.sessionFinished);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.study.sessionCompleteFailed);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  const todayMinutes = stats?.todayFocusMinutes ?? 0;
  const weekMinutes = stats?.weekFocusMinutes ?? 0;
  const completedFocusSessions = history.filter((s) => s.mode === 'focus' && s.status === 'completed');
  const activeTaskTitle = activeSession?.taskId
    ? tasks.find((t) => t.id === activeSession.taskId)?.title ?? ''
    : '';
  const ringLabel = activeSession
    ? (activeTaskTitle ? s.focus.ringTask(activeTaskTitle.toUpperCase()) : activeSession.mode === 'focus' ? s.focus.ringFocus : s.focus.ringBreak)
    : s.focus.ringNone;
  const ringPct = activeSession && activeSession.plannedMinutes > 0
    ? Math.max(0, Math.min(100, Math.round(((remainingMs ?? 0) / (activeSession.plannedMinutes * 60_000)) * 100)))
    : 0;

  return (
    <section className="focus-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={() => onNavigate('home')} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.focus.title}</h4>
          <div className="asub">{s.focus.sub}</div>
        </div>
      </div>

      {guestMode ? (
        <div className="acard">
          <p className="mut" style={{ margin: 0 }}>
            {s.focus.guestText}
          </p>
          <button type="button" className="sbtn pk" style={{ marginTop: 12 }} onClick={() => onNavigate('study')}>
            {s.focus.guestButton}
          </button>
        </div>
      ) : (
        <>
          <div className="ringwrap">
            <div
              className="focus-ring"
              style={{ background: `conic-gradient(var(--peach-deep) ${(100 - ringPct)}%, rgba(255,223,201,.22) ${(100 - ringPct)}%)` }}
            >
              <div className="focus-ring-inner">
                <b>{activeSession ? formatCountdown(remainingMs ?? 0) : '00:00'}</b>
                <span>{activeSession && activeSession.status === 'paused' ? s.focus.ringPaused : ringLabel}</span>
              </div>
            </div>
          </div>

          {activeSession ? (
            <div className="btnrow focus-actions">
              {activeSession.status === 'active' ? (
                <button type="button" className="sbtn" disabled={busy} onClick={() => void handlePauseTimer()}>
                  <Pause size={15} /> {pendingAction === 'pause' ? s.focus.pausing : s.focus.pause}
                </button>
              ) : (
                <button type="button" className="sbtn" disabled={busy} onClick={() => void handleResumeTimer()}>
                  <Play size={15} /> {pendingAction === 'resume' ? s.focus.resuming : s.focus.resume}
                </button>
              )}
              <button type="button" className="sbtn gh" disabled={busy} onClick={() => void handleCompleteTimer()}>
                <Square size={14} /> {pendingAction === 'complete' ? s.focus.finishing : s.focus.finish}
              </button>
            </div>
          ) : (
            <div className="btnrow focus-actions">
              <button type="button" className="sbtn pk" onClick={() => onNavigate('study')}>
                {s.focus.startInStudy}
              </button>
            </div>
          )}
          {activeSession && (
            <p className="mut focus-session-note">
              {activeSession.mode === 'focus' ? s.study.focusMinutesLabel(activeSession.plannedMinutes) : s.study.breakMinutesLabel(activeSession.plannedMinutes)}
              {activeTaskTitle ? ` · ${activeTaskTitle}` : ''}
              {' · '}{s.focus.serverNote}
            </p>
          )}

          <div className="kpis">
            <div className="kpi"><b>{minutesOrHours(todayMinutes, language)}</b><span>{s.focus.today}</span></div>
            <div className="kpi"><b>{minutesOrHours(weekMinutes, language)}</b><span>{s.focus.thisWeek}</span></div>
            <div className="kpi"><b>{completedFocusSessions.length}</b><span>{s.focus.sessions}</span></div>
          </div>
          <p className="mut focus-kpi-note">{s.focus.sessionsNote}</p>

          <div className="acard">
            <h5>{s.focus.pastSessions}</h5>
            {history.length === 0 ? (
              <p className="mut" style={{ margin: '8px 0 0' }}>
                {s.focus.noSessions}
              </p>
            ) : (
              history.slice(0, 10).map((session) => {
                const title = session.taskId
                  ? tasks.find((t) => t.id === session.taskId)?.title ?? (session.mode === 'focus' ? s.focus.focusSession : s.focus.breakLabel)
                  : (session.mode === 'focus' ? s.focus.focusSession : s.focus.breakLabel);
                const when = new Date(session.completedAt ?? session.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return (
                  <div className="srow" key={session.id}>
                    <span className="snum2">📚</span>
                    <div>{title}<small>{when}</small></div>
                    <b className="srow-right">{session.status === 'completed' ? `${session.focusMinutesEarned} min` : s.focus.abandoned}</b>
                  </div>
                );
              })
            )}
          </div>

          <div className="acard">
            <p className="mut" style={{ margin: 0 }}>
              {s.focus.honestyNote}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function Analytics({
  stats,
  guestMode,
  rewards,
  activeChallenges,
  challengeHistory,
  focusHistory,
  onNotify,
  salahToday,
  sleepStartTime,
  sleepEndTime,
  onBack,
  language,
}: {
  stats: StudyStats | null;
  guestMode: boolean;
  rewards: RewardsSummary | null;
  activeChallenges: ChallengeParticipation[];
  challengeHistory: ChallengeParticipation[];
  /** Finished/abandoned focus sessions, loaded at app level (latest 20). */
  focusHistory: PomodoroSession[];
  onNotify: (message: string) => void;
  salahToday: Record<string, { status: string }>;
  sleepStartTime: string;
  sleepEndTime: string;
  onBack: () => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  // P5: the "Activity history" pill used to be a dead <div>. It is now a
  // real button that opens the history panel below, built only from real
  // saved activity — points, focus sessions and challenge attempts.
  const [showHistory, setShowHistory] = useState(false);
  const [pointsHistory, setPointsHistory] = useState<(PointTransaction & { refType: string })[] | null>(null);
  const [pointsHistoryTotal, setPointsHistoryTotal] = useState(0);
  const [pointsHistoryLoading, setPointsHistoryLoading] = useState(false);
  const [pointsHistoryError, setPointsHistoryError] = useState('');
  // Preview #17 period switcher. Din / Hafta / Mahina are each built
  // from real per-period data — never the same numbers relabelled.
  // Din: today's completed focus sessions, grouped into 4 time buckets.
  // Hafta: this week's completed focus sessions, grouped by weekday.
  // Mahina: this month's completed focus sessions, grouped by week of
  // month — from the latest 20 loaded sessions only, so the month total
  // is labelled as a lower bound, never as the full month.
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  async function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    // Lazy-load the full points history (up to 20) the first time the
    // panel opens; the summary's recent-10 list stays as the fallback.
    if (!next || pointsHistory !== null || pointsHistoryLoading) return;
    setPointsHistoryLoading(true);
    setPointsHistoryError('');
    try {
      const result = await fetchPointsHistory(1, 20);
      setPointsHistory(result.transactions);
      setPointsHistoryTotal(result.total);
    } catch (err) {
      setPointsHistoryError(err instanceof Error ? err.message : s.analytics.pointsLoadFailed);
    } finally {
      setPointsHistoryLoading(false);
    }
  }

  const historyPanel = (
    <section className="panel history-card" style={{ marginTop: 14 }}>
      <SectionTitle title={s.analytics.historyTitle} />
      <div>
        <span className="eyebrow">{s.analytics.pointsEyebrow}</span>
        {pointsHistoryLoading ? (
          <p className="onboarding-help">{s.analytics.pointsLoading}</p>
        ) : pointsHistoryError ? (
          <>
            <p className="onboarding-help">{pointsHistoryError}</p>
            {rewards && rewards.recent.length > 0 && (
              <div className="history-list">
                {rewards.recent.map((entry) => (
                  <div className="history-row" key={entry.id}>
                    <div><strong>+{entry.amount} points</strong><small>{pointReasonLabel(entry.reason, language)} · {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : pointsHistory && pointsHistory.length > 0 ? (
          <div className="history-list">
            {pointsHistory.map((entry) => (
              <div className="history-row" key={entry.id}>
                <div><strong>+{entry.amount} points</strong><small>{pointReasonLabel(entry.reason, language)} · {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></div>
              </div>
            ))}
            {pointsHistoryTotal > pointsHistory.length && (
              <p className="onboarding-help">{s.analytics.pointsShowing(pointsHistory.length, pointsHistoryTotal)}</p>
            )}
          </div>
        ) : (
          <p className="onboarding-help">{s.analytics.noPoints}</p>
        )}
      </div>
      <div style={{ marginTop: 18 }}>
        <span className="eyebrow">{s.analytics.focusEyebrow}</span>
        {focusHistory.length === 0 ? (
          <p className="onboarding-help">{s.study.noHistory}</p>
        ) : (
          <div className="history-list">
            {focusHistory.slice(0, 10).map((session) => (
              <div className="history-row" key={session.id}>
                <div>
                  <strong>{session.mode === 'focus' ? s.study.historyFocus(session.plannedMinutes) : s.study.historyBreak(session.plannedMinutes)}</strong>
                  <small>
                    {new Date(session.completedAt ?? session.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </small>
                </div>
                <span className={`status-tag ${session.status === 'completed' ? 'status-done' : ''}`}>
                  {session.status === 'completed' ? s.study.earned(session.focusMinutesEarned) : s.study.abandoned}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 18 }}>
        <span className="eyebrow">{s.analytics.challengesEyebrow}</span>
        {activeChallenges.length === 0 && challengeHistory.length === 0 ? (
          <p className="onboarding-help">{s.analytics.noChallenges}</p>
        ) : (
          <div className="history-list">
            {[...activeChallenges, ...challengeHistory].map((participation) => (
              <div className="history-row" key={participation.id}>
                <div>
                  <strong>{participation.challenge.title}</strong>
                  <small>
                    {s.analytics.challengeLine(participation.currentDay, participation.totalDays, participation.status === 'active' ? s.analytics.statusActive : participation.status === 'completed' ? s.analytics.statusCompleted : s.analytics.statusLeft, participation.pointsEarned)}
                  </small>
                </div>
                <span className="status-tag">
                  {new Date(participation.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const apphead = (
    <div className="apphead">
      <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
        <ChevronLeft size={20} />
      </button>
      <div>
        <h4>{s.analytics.title}</h4>
        <div className="asub">{s.analytics.sub}</div>
      </div>
      <div className="aright">
        <button
          type="button"
          className="sbtn gh"
          aria-expanded={showHistory}
          onClick={() => void toggleHistory()}
        >
          <CalendarDays size={13} /> {s.analytics.historyButton}
        </button>
      </div>
    </div>
  );

  if (guestMode) {
    return (
      <section className="analytics-screen">
        {apphead}
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">{s.analytics.guestEyebrow}</span>
          <h3>{s.analytics.guestTitle}</h3>
          <p className="onboarding-help">
            {s.analytics.guestText}
          </p>
        </section>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="analytics-screen">
        {apphead}
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">{s.analytics.loadingEyebrow}</span>
          <h3>{s.analytics.loadingTitle}</h3>
        </section>
      </section>
    );
  }

  const hasActivity =
    stats.todayFocusMinutes > 0 ||
    stats.weekFocusMinutes > 0 ||
    stats.tasksCompletedToday > 0 ||
    stats.subjectBreakdown.some((s) => s.tasksTotal > 0) ||
    (rewards?.total ?? 0) > 0 ||
    activeChallenges.length > 0 ||
    challengeHistory.length > 0;

  const completedChallenges = challengeHistory.filter((c) => c.status === 'completed').length;

  const completedFocus = focusHistory.filter((s) => s.mode === 'focus' && s.status === 'completed');
  const now = new Date();
  const todayKeyStr = todayKey();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  type Bar = { label: string; value: number | null; future: boolean };
  let bars: Bar[] = [];
  let barsTitle = '';
  if (period === 'day') {
    const buckets = [
      { label: s.analytics.bucketMorning, test: (h: number) => h >= 5 && h < 11 },
      { label: s.analytics.bucketAfternoon, test: (h: number) => h >= 11 && h < 16 },
      { label: s.analytics.bucketEvening, test: (h: number) => h >= 16 && h < 21 },
      { label: s.analytics.bucketNight, test: (h: number) => h >= 21 || h < 5 },
    ];
    bars = buckets.map((bucket) => ({
      label: bucket.label,
      value: completedFocus
        .filter((s) => (s.completedAt ?? s.startedAt).slice(0, 10) === todayKeyStr)
        .filter((s) => bucket.test(new Date(s.completedAt ?? s.startedAt).getHours()))
        .reduce((sum, s) => sum + s.focusMinutesEarned, 0),
      future: false,
    }));
    barsTitle = s.analytics.barsDay;
  } else if (period === 'week') {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    bars = labels.map((label, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      return {
        label,
        value: completedFocus
          .filter((s) => (s.completedAt ?? s.startedAt).slice(0, 10) === key)
          .reduce((sum, s) => sum + s.focusMinutesEarned, 0),
        future: day > now,
      };
    });
    barsTitle = s.analytics.barsWeek;
  } else {
    const buckets = [
      { label: s.analytics.bucketWeek(1), test: (d: number) => d >= 1 && d <= 7 },
      { label: s.analytics.bucketWeek(2), test: (d: number) => d >= 8 && d <= 14 },
      { label: s.analytics.bucketWeek(3), test: (d: number) => d >= 15 && d <= 21 },
      { label: s.analytics.bucketWeek(4), test: (d: number) => d >= 22 && d <= 28 },
      { label: s.analytics.bucketWeek(5), test: (d: number) => d >= 29 },
    ];
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    bars = buckets.map((bucket) => ({
      label: bucket.label,
      value: completedFocus
        .filter((s) => (s.completedAt ?? s.startedAt).startsWith(monthPrefix))
        .filter((s) => bucket.test(new Date(s.completedAt ?? s.startedAt).getDate()))
        .reduce((sum, s) => sum + s.focusMinutesEarned, 0),
      future: false,
    }));
    barsTitle = s.analytics.barsMonth;
  }
  const barsTotal = bars.reduce((sum, bar) => sum + (bar.value ?? 0), 0);
  const barsMax = Math.max(0, ...bars.map((bar) => bar.value ?? 0));
  const bestBar = barsTotal > 0 ? bars.reduce((best, bar) => (bar.value ?? 0) > (best.value ?? 0) ? bar : best, bars[0]) : null;

  const prayedToday = prayerNames.filter((name) => salahToday[name]?.status === 'prayed').length;
  const firstChallenge = activeChallenges[0] ?? null;
  const challengePct = firstChallenge && firstChallenge.totalDays > 0
    ? Math.round((firstChallenge.completedDays / firstChallenge.totalDays) * 100)
    : null;
  const sleepLabel = sleepDurationLabel(sleepStartTime, sleepEndTime);

  return (
    <section className="analytics-screen">
      {apphead}
      {showHistory && historyPanel}
      {!hasActivity ? (
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">{s.analytics.emptyEyebrow}</span>
          <h3>{s.analytics.emptyTitle}</h3>
          <p className="onboarding-help">
            {s.analytics.emptyText}
          </p>
        </section>
      ) : (
        <>
          <div className="analytics-period">
            {([
              ['day', s.analytics.periodDay],
              ['week', s.analytics.periodWeek],
              ['month', s.analytics.periodMonth],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`sbtn ${period === value ? '' : 'gh'}`}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="acard-l">
            <h5>{barsTitle}</h5>
            {barsTotal === 0 ? (
              <p className="onboarding-help">
                {period === 'day' ? s.analytics.barsEmptyDay : period === 'week' ? s.analytics.barsEmptyWeek : s.analytics.barsEmptyMonth}
              </p>
            ) : (
              <>
                <div className="wbars">
                  {bars.map((bar) => (
                    <div className="wb" key={bar.label}>
                      <em>{bar.future || bar.value === null ? '—' : period === 'day' ? `${bar.value}m` : minutesOrHours(bar.value, language)}</em>
                      <i
                        className={bar.future ? 'wb-future' : bar.value === barsMax && barsMax > 0 ? 'wb-best' : ''}
                        style={{ height: `${bar.future || barsMax === 0 ? 6 : Math.max(8, Math.round(((bar.value ?? 0) / barsMax) * 100))}%` }}
                      />
                      <span>{bar.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mut" style={{ margin: '8px 0 0' }}>
                  {s.analytics.total(minutesOrHours(barsTotal, language))}
                  {bestBar ? s.analytics.best(bestBar.label) : ''}
                  {period === 'month' ? s.analytics.monthLowerBound : ''}
                </p>
              </>
            )}
          </div>

          <div className="acard-l analytics-summary">
            <div className="setrow"><div>{s.analytics.prayerRow}<small>{s.analytics.prayerRowSub(prayedToday)}</small></div><b>{prayedToday}/5</b></div>
            <div className="setrow"><div>{s.analytics.studyRow}<small>{s.analytics.studyRowSub(stats.tasksCompletedToday, minutesOrHours(stats.todayFocusMinutes, language))}</small></div><b>{minutesOrHours(stats.todayFocusMinutes, language)}</b></div>
            <div className="setrow"><div>{s.analytics.focusRow}<small>{s.analytics.focusRowSub(completedFocus.length)}</small></div><b>{minutesOrHours(stats.weekFocusMinutes, language)}</b></div>
            <div className="setrow"><div>{s.analytics.sleepRow}<small>{s.analytics.sleepRowSub(formatTime12h(sleepStartTime), formatTime12h(sleepEndTime), sleepLabel ?? '')}</small></div><b>{s.analytics.sleepRowValue}</b></div>
            <div className="setrow"><div>{s.analytics.challengeRow}<small>{firstChallenge ? s.analytics.challengeRowSub(firstChallenge.challenge.title, firstChallenge.currentDay) : s.analytics.noActiveChallenge}</small></div><b>{challengePct === null ? '—' : `${challengePct}%`}</b></div>
          </div>

          <section className="panel progress-breakdown" style={{ marginTop: 14 }}>
            <SectionTitle title={s.analytics.subjectsWeek} />
            {stats.subjectBreakdown.length === 0 ? (
              <p className="onboarding-help">{s.analytics.noSubjects}</p>
            ) : (
              stats.subjectBreakdown.map((subject) => (
                <SubjectRow
                  key={subject.subjectId}
                  name={subject.name}
                  label={subject.label}
                  tasksDone={subject.tasksDone}
                  tasksTotal={subject.tasksTotal}
                  focusMinutes={subject.focusMinutesWeek}
                  colour={subject.colour}
                  language={language}
                />
              ))
            )}
          </section>
          <section className="panel progress-breakdown" style={{ marginTop: 14 }}>
            <SectionTitle title={s.analytics.challengesPoints} />
            <div className="analytics-grid" style={{ marginTop: 0 }}>
              <div className="panel metric-card">
                <span className="eyebrow">{s.analytics.totalPoints}</span>
                <strong>{rewards?.total ?? 0}</strong>
                <span className="metric-trend"><Zap size={13} /> {s.analytics.pointsNote}</span>
              </div>
              <div className="panel metric-card">
                <span className="eyebrow">{s.analytics.badgesEarned}</span>
                <strong>{rewards?.badges.length ?? 0}</strong>
                <span className="metric-trend"><Trophy size={13} /> {rewards && rewards.badges.length > 0 ? rewards.badges.map((b) => b.title).join(', ') : s.analytics.noBadges}</span>
              </div>
              <div className="panel metric-card">
                <span className="eyebrow">{s.analytics.activeChallenges}</span>
                <strong>{activeChallenges.length}</strong>
                <span className="metric-trend"><Target size={13} /> {s.analytics.completedTotal(completedChallenges)}</span>
              </div>
            </div>
            {rewards && rewards.recent.length > 0 && (
              <div className="challenge-progress-list" style={{ marginTop: 14 }}>
                {rewards.recent.map((entry) => (
                  <div className="challenge-progress-row" key={entry.id}>
                    <span className="challenge-day-dot done" />
                    <div><strong>+{entry.amount} points</strong><small>{pointReasonLabel(entry.reason, language)} · {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></div>
                  </div>
                ))}
              </div>
            )}
            {(!rewards || rewards.recent.length === 0) && (
              <p className="onboarding-help">{s.analytics.noPointsYet}</p>
            )}
          </section>
          <p className="analytics-footnote">
            {s.analytics.footnote}
          </p>
        </>
      )}
    </section>
  );
}

function Profile({
  onNotify,
  user,
  guestMode,
  onLogout,
  onAccountDeleted,
  onboardingIncomplete,
  onEditProfile,
  onboardingResumeStep,
  onOpenFeedback,
  onNavigate,
  language,
  onLanguageChange,
  rewards,
  studyStats,
  profile,
}: {
  onNotify: (message: string) => void;
  user: AuthUser | null;
  guestMode: boolean;
  onLogout: () => void;
  onAccountDeleted: () => void;
  /** True when onboarding was skipped / never finished. */
  onboardingIncomplete: boolean;
  /** Reopen the onboarding form, pre-filled, at the given step. */
  onEditProfile: (step: number) => void;
  /** First incomplete onboarding step (P9) — where "Profile poora karo" opens. */
  onboardingResumeStep: number;
  onOpenFeedback: () => void;
  onNavigate: (page: Page) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  rewards: RewardsSummary | null;
  studyStats: StudyStats | null;
  profile: UserProfile;
}) {
  const s = stringsFor(language);
  const displayName = user?.name || (guestMode ? s.profile.guestPreview : s.profile.yourAccount);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'AH';
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [deleteHint, setDeleteHint] = useState(false);

  // Preview #19 college line, from the real saved profile.
  const collegeLine = [profile.collegeName, profile.course, profile.semester ? `Sem ${profile.semester}` : '']
    .filter(Boolean)
    .join(' · ') || (user?.email ?? s.profile.previewNoAccount);
  const streak = studyStats?.streak ?? 0;

  // Settings rows in EXACTLY the preview's order. Sleep schedule is
  // kept as an extra row after Notifications (it existed before and
  // now points at the standalone Sleep screen, not Focus).
  const rows: { icon: string; title: string; detail: string; onClick: () => void; disabled?: boolean }[] = [
    { icon: '✏️', title: s.profile.editDetails, detail: s.profile.editDetailsSub, onClick: () => onEditProfile(0), disabled: guestMode },
    { icon: '🕌', title: s.profile.prayerSettings, detail: s.profile.prayerSettingsSub, onClick: () => onEditProfile(4), disabled: guestMode },
    { icon: '🔔', title: s.profile.notifications, detail: s.profile.notificationsSub, onClick: () => setShowNotifSettings((open) => !open) },
    { icon: '🔑', title: s.profile.changePassword, detail: s.profile.changePasswordSub, onClick: () => setShowSecurity((open) => !open), disabled: guestMode },
    { icon: '🌙', title: s.profile.sleepSchedule, detail: s.profile.sleepScheduleSub, onClick: () => onNavigate('sleep') },
    { icon: '💬', title: s.profile.feedback, detail: s.profile.feedbackSub, onClick: onOpenFeedback },
    { icon: '↩', title: s.profile.onboardingAgain, detail: s.profile.onboardingAgainSub, onClick: () => onEditProfile(0), disabled: guestMode },
  ];

  return (
    <section className="profile-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={() => onNavigate('home')} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.profile.title}</h4>
          <div className="asub">{s.profile.sub}</div>
        </div>
      </div>

      <div className="profile-avatar">{initials}</div>
      <div className="profile-name">{displayName}</div>
      <div className="mut profile-college">{collegeLine}</div>
      <div className="profile-status">
        {user ? s.profile.statusAuthenticated : s.profile.statusGuest}
      </div>

      <div className="kpis">
        <div className="kpi"><b>{rewards?.total ?? 0}</b><span>{s.profile.points}</span></div>
        <div className="kpi"><b>{s.common.days(streak)}</b><span>{s.profile.streak}</span></div>
        <div className="kpi"><b>{rewards?.badges.length ?? 0}</b><span>{s.profile.badges}</span></div>
      </div>

      {onboardingIncomplete && !guestMode && (
        <button type="button" className="sbtn pk profile-complete-btn" onClick={() => onEditProfile(onboardingResumeStep)}>
          <UserRound size={15} /> {s.profile.completeButton}
        </button>
      )}

      <div className="acard">
        {rows.map((row) => (
          <button
            key={row.title}
            type="button"
            className="setrow"
            disabled={row.disabled}
            onClick={row.onClick}
          >
            <div>{row.icon} {row.title}<small>{row.detail}</small></div>
            <span className="chev">›</span>
          </button>
        ))}
        <div className="setrow setrow-static">
          <div>{s.profile.languageRow}<small>{s.profile.languageRowSub}</small></div>
          <div className="lang-switch" role="group" aria-label="Language">
            <button type="button" className={language === 'en' ? 'selected' : ''} onClick={() => onLanguageChange('en')}>English</button>
            <button type="button" className={language === 'hi' ? 'selected' : ''} onClick={() => onLanguageChange('hi')}>Hinglish</button>
          </div>
        </div>
        {showNotifSettings && (
          <div className="profile-panel">
            {guestMode ? (
              <p className="onboarding-help">{s.profile.signInNotifications}</p>
            ) : (
              <NotificationSettingsPanel onNotify={onNotify} language={language} />
            )}
          </div>
        )}
        {showSecurity && (
          <div className="profile-panel">
            {guestMode || !user ? (
              <p className="onboarding-help">{s.profile.signInSecurity}</p>
            ) : (
              <SecuritySettings onNotify={onNotify} emailVerified={user.emailVerified} onAccountDeleted={onAccountDeleted} language={language} />
            )}
          </div>
        )}
      </div>

      <div className="acard">
        <button type="button" className="setrow" onClick={onLogout}>
          <div>🚪 {s.profile.logout}</div>
          <span className="chev">›</span>
        </button>
        <button
          type="button"
          className="setrow danger"
          disabled={guestMode}
          onClick={() => { setShowSecurity(true); setDeleteHint(true); }}
        >
          <div>🗑 {s.profile.deleteAccount}<small>{s.profile.deleteAccountSub}</small></div>
          <span className="chev">›</span>
        </button>
        {deleteHint && !guestMode && (
          <p className="onboarding-help profile-delete-hint">
            {s.profile.deleteHint}
          </p>
        )}
        {guestMode && (
          <p className="onboarding-help">{s.profile.deleteGuest}</p>
        )}
      </div>
    </section>
  );
}

export default App;