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
  POINT_REASON_LABELS,
  type PointTransaction,
  type RewardsSummary,
} from './lib/rewardsApi';
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
      : 'Request failed. Please try again.';
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

export function countdownTo(time: string, now: Date): string {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return '';
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

const guidanceCards = [
  { mood: 'Feeling overwhelmed', category: 'Patience & hope', ref: 'Surah Ash-Sharh · 94:5–6', icon: Heart },
  { mood: 'Looking for direction', category: 'Guidance', ref: 'Explore verified guidance', icon: Compass },
  { mood: 'Need a dua', category: 'Supplication', ref: 'Explore verified duas', icon: BookMarked },
  { mood: 'Building consistency', category: 'Steadfastness', ref: 'Explore verified guidance', icon: Target },
];

function App() {
  const [screen, setScreen] = useState<'checking' | 'welcome' | 'login' | 'forgot' | 'reset' | 'onboarding' | 'app' | 'language'>('checking');
  // Phase 13 — language choice (English / Hinglish), stored in
  // localStorage under `ahdora-language`. The app's copy from Login
  // through Onboarding is bilingual: the chosen language is shown
  // big, the other language alongside it in smaller text.
  const [language, setLanguage] = useState<AppLanguage>(() => readStoredLanguage() ?? 'hi');
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
   */
  function openPostAuthScreen(next: 'app' | 'onboarding') {
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
      notify(error instanceof Error ? error.message : 'Profile load nahi ho payi.');
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
          notify(`Shared progress updated in "${payload.challengeTitle}".`);
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
          notify('Email verified. Welcome to AHDORA.');
          setEmailNotice(null);
          setAuthUser((current) => (current ? { ...current, emailVerified: true } : current));
        })
        .catch((err) => notify(err instanceof Error ? err.message : 'Verification link did not work.'));
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
        // Logged out: first open without a stored language goes to the
        // picker (which then sends the user to Login); everyone else
        // gets the welcome screen as before. Reset-link users keep
        // the pre-existing behaviour (welcome).
        if (resetLinkRef.current || readStoredLanguage() !== null) {
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
        throw new Error('Security check fail ho gaya. Page ko refresh karke dobara login karo.');
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
      notify('Profile save karne ke liye pehle account mein login karo.');
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
      if (wasEditing) setPage('profile');
      notify('Profile MongoDB API par save ho gayi.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Profile save nahi ho payi.');
      throw error;
    }
  }

  /** Skip: save whatever is filled in as a partial profile and enter the app. */
  async function handleOnboardingSkip(step: number) {
    if (!authUser) {
      notify('Profile save karne ke liye pehle account mein login karo.');
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
      setPage('home');
      notify('Theek hai — jo bhara tha wo save ho gaya. Baad me Profile se poora kar lena.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Skip nahi ho paya. Dobara try karo.');
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
      notify('Profile edit karne ke liye pehle sign in karo.');
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
      notify('Neend ka time save karne ke liye pehle sign in karo.');
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
      notify('Neend ka time save ho gaya. App restrictions Android app me kaam karenge.');
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Neend ka time save nahi ho paya.');
      return false;
    } finally {
      setFocusSaving(false);
    }
  }

  async function handleLogout() {
    try {
      if (authUser) await apiRequest<null>('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Logout nahi ho paya. Dobara try karo.');
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
    notify('Your account and all its data were deleted.');
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
        notify('Your email is already verified.');
      } else {
        setEmailNotice('Verification email sent. Check your inbox.');
        notify('Verification email sent. Check your inbox.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send the verification email.';
      setEmailNotice(message);
      notify(message);
    } finally {
      setResendingVerification(false);
    }
  }

  if (screen === 'checking') {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><AhdoraLogo size={42} /><span>AHDORA</span></div><p>Checking your secure session...</p></div></div>;
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
    return <ResetPassword token={resetToken} onDone={() => { setResetToken(''); setScreen('login'); notify('Password reset. Please log in with your new password.'); }} onBack={() => { setResetToken(''); setScreen('login'); }} />;
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
            <span>{emailNotice ?? 'Your email is not verified yet. Some account features need verification.'}</span>
            <button className="text-button" onClick={handleResendVerification} disabled={resendingVerification}>{resendingVerification ? 'Sending…' : 'Resend verification email'}</button>
          </div>
        )}
        {authUser && !guestMode && onboardingCompleted === false && (
          <div className="verify-banner">
            <UserRound size={16} />
            <span>Aapka profile adhoora hai — kuch details abhi baki hain.</span>
            <button className="text-button" onClick={() => handleEditProfile(resumeStep(newUser))}>Profile poora karo</button>
          </div>
        )}
        <div className="page-content">
          {page === 'home' && <HomeScreen profile={newUser} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} guestMode={guestMode} onNavigate={goTo} onOpenGuidance={goToGuidance} />}
          {page === 'dashboard' && <Dashboard userName={profileName || 'there'} onNavigate={goTo} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} todayTasks={todayTasks} studyStats={studyStats} guestMode={guestMode} activeChallenges={activeChallenges} rewards={rewards} dataLoading={!guestMode && (!studyLoaded || !salahLoaded)} sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} unreadCount={unreadCount} onOpenNotifications={() => goTo('notifications')} />}
          {page === 'deen' && <Deen onNotify={notify} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} onRefreshSalah={refreshSalahToday} onOpenGuidance={goToGuidance} onBack={() => goTo('home')} profile={newUser} />}
          {page === 'salah-calendar' && (
            <section className="salahcal-screen">
              <div className="apphead">
                <button type="button" className="aback" onClick={() => goTo('home')} aria-label="Wapas jao"><ChevronLeft size={20} /></button>
                <div><h4>Salah Calendar</h4><div className="asub">Mahine bhar ki namaz ek nazar me</div></div>
              </div>
              <SalahTracker onNotify={notify} />
            </section>
          )}
          {page === 'tasbeeh' && <Tasbeeh userId={authUser?.id ?? ''} onBack={() => goTo('home')} />}
          {page === 'notifications' && <NotificationsScreen onBack={() => goTo('home')} onNotify={notify} guestMode={guestMode} onChanged={refreshNotifications} />}
          {page === 'sleep' && <Sleep sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} onSleepChange={(start, end) => setNewUser((current) => ({ ...current, sleepStartTime: start, sleepEndTime: end }))} onSaveFocus={handleSaveFocus} focusSaving={focusSaving} focusEnabled={focusEnabled} setFocusEnabled={setFocusEnabled} youtubeAllowed={youtubeAllowed} setYoutubeAllowed={setYoutubeAllowed} onNotify={notify} onBack={() => goTo('home')} onOpenGuidance={goToGuidance} guestMode={guestMode} />}
          {page === 'study' && <Study subjects={subjects} tasks={tasks} todayTasks={todayTasks} schedule={todaySchedule} stats={studyStats} activeSession={activePomodoro} history={pomodoroHistory} studyError={studyError} guestMode={guestMode} profile={newUser} onRefresh={refreshStudy} onNotify={notify} onBack={() => goTo('home')} />}
          {page === 'challenges' && <Challenges onNotify={notify} onRefresh={refreshChallenges} guestMode={guestMode} onBack={() => goTo('home')} />}
          {page === 'friends' && <Friends onNotify={notify} refreshKey={friendsRefreshKey} guestMode={guestMode} />}
          {page === 'guidance' && <Guidance onNotify={notify} onOpenFeedback={() => setFeedbackOpen(true)} tab={guidanceTab} onTabChange={setGuidanceTab} guestMode={guestMode} profileCity={newUser.city} initialSurah={guidanceSurah} onInitialSurahOpened={() => setGuidanceSurah(null)} onOpenSurah={(surahNumber) => goToGuidance('quran', surahNumber)} />}
          {page === 'focus' && <Focus activeSession={activePomodoro} history={pomodoroHistory} stats={studyStats} tasks={tasks} onRefresh={refreshStudy} onNotify={notify} onNavigate={goTo} guestMode={guestMode} />}
          {page === 'analytics' && <Analytics stats={studyStats} guestMode={guestMode} rewards={rewards} activeChallenges={activeChallenges} challengeHistory={challengeHistory} focusHistory={pomodoroHistory} onNotify={notify} salahToday={salahToday} sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} onBack={() => goTo('home')} />}
          {page === 'profile' && <Profile onNotify={notify} user={authUser} guestMode={guestMode} onLogout={handleLogout} onAccountDeleted={handleAccountDeleted} onboardingIncomplete={onboardingCompleted === false} onEditProfile={handleEditProfile} onboardingResumeStep={resumeStep(newUser)} onOpenFeedback={() => setFeedbackOpen(true)} onNavigate={goTo} language={language} onLanguageChange={handleLanguageChange} rewards={rewards} studyStats={studyStats} profile={newUser} />}
        </div>
      </main>
      <nav className="pillnav-bar" aria-label="Main sections">
        <button type="button" className={`pillnav-item ${(page === 'home' || page === 'dashboard') ? 'on' : ''}`} onClick={() => goTo('home')} aria-label="Home"><Home size={21} strokeWidth={1.8} /></button>
        <button type="button" className={`pillnav-item ${page === 'guidance' ? 'on' : ''}`} onClick={() => goToGuidance('quran')} aria-label="Quran"><BookOpen size={21} strokeWidth={1.8} /></button>
        <button type="button" className={`pillnav-item ${page === 'focus' ? 'on' : ''}`} onClick={() => goTo('focus')} aria-label="Focus"><Target size={21} strokeWidth={1.8} /></button>
        <button type="button" className={`pillnav-item ${page === 'profile' ? 'on' : ''}`} onClick={() => goTo('profile')} aria-label="Profile"><UserRound size={21} strokeWidth={1.8} /></button>
      </nav>
      {feedbackOpen && <FeedbackForm onClose={() => setFeedbackOpen(false)} onNotify={notify} />}
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

function ResetPassword({ token, onDone, onBack }: { token: string; onDone: () => void; onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Password reset nahi ho paya.');
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
          <button type="submit" className="primary-button full-width" disabled={busy}>
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
}: {
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  now: Date;
  onQaza: (prayer: string) => void;
  qazaBusy: string | null;
}) {
  if (prayerStatus === 'loading' || prayerStatus === 'idle') {
    return (
      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>Loading prayer times…</p>
      </section>
    );
  }
  if (prayerStatus === 'no-city') {
    return (
      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>Add your city in Profile to see prayer times.</p>
      </section>
    );
  }
  if (prayerStatus === 'error' || !prayerTimes) {
    return (
      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>{prayerError || 'Prayer times could not be loaded. Check your connection / city.'}</p>
      </section>
    );
  }
  const nextName = prayerTimes.nextPrayer?.name ?? null;
  const nextCountdown = prayerTimes.nextPrayer ? countdownTo(prayerTimes.nextPrayer.time, now) : '';
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
    { name: 'Fajr', icon: Moon, sub: 'Tulu-e-aftab se pehle' },
    { name: 'Sunrise', icon: Sun, sub: 'Tulu-e-aftab' },
    { name: 'Dhuhr', icon: Sun, sub: 'Dopeher ki namaz' },
    { name: 'Asr', icon: Clock3, sub: 'Darmiyani namaz' },
    { name: 'Maghrib', icon: Moon, sub: 'Suraj doobte hi' },
    { name: 'Isha', icon: Moon, sub: 'Raat ki namaz' },
  ];
  for (const entry of order) {
    if (entry.name === 'Sunrise') {
      rows.push({
        name: 'Sunrise',
        time: prayerTimes.timings.Sunrise,
        sub: 'Tulu-e-aftab',
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
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: 'Waqt par padhi', pill: 'Padhi ✓', pillClass: 'ok', highlight: false, icon: entry.icon });
    } else if (status === 'missed') {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: 'Waqt khatam', pill: 'Miss', pillClass: 'miss', highlight: false, icon: entry.icon });
    } else if (status === 'qaza') {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: 'Qaza padhi', pill: 'Qaza', pillClass: 'qaza', highlight: false, icon: entry.icon });
    } else if (isNext) {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: nextCountdown ? `Agli namaz · ${nextCountdown} baaki` : 'Agli namaz', pill: 'Agli', pillClass: 'qaza', highlight: true, icon: entry.icon });
    } else {
      rows.push({ name: entry.name, time: prayerTimes.timings[entry.name as keyof typeof prayerTimes.timings], sub: 'Abhi waqt nahi aaya', pill: 'Baaki', pillClass: 'wait', highlight: false, icon: entry.icon });
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
          <h5>{name} ki qaza baaki hai</h5>
          <p>
            Aaj {name} miss ho gayi thi. Qaza padh lo to yahan mark kar do — asal miss wala
            record history me waisa hi rahega.
          </p>
          <button
            type="button"
            className="sbtn"
            disabled={qazaBusy !== null}
            onClick={() => onQaza(name)}
          >
            {qazaBusy === name ? 'Save ho raha hai…' : 'Qaza padh li ✓'}
          </button>
        </section>
      ))}

      <section className="acard">
        <p className="mut" style={{ margin: 0 }}>
          Time tumhare city ke hisab se aata hai. Kisi namaz ka apna time set kiya ho
          (Onboarding Step 6) to wahi dikhta hai. Source: Aladhan · {prayerTimes.method} · {prayerTimes.city}
          {prayerTimes.perPrayer && Object.values(prayerTimes.perPrayer).some((entry) => entry.source === 'manual') ? ' · kuch time manual set hain' : ''}.
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
}) {
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
          <h4>Assalamu Alaikum, {userName}</h4>
          <div className="dash-sub">{todayLabel}</div>
        </div>
        <button type="button" className="dash-bell" onClick={onOpenNotifications} aria-label="Notifications">
          <Bell size={19} strokeWidth={1.8} />
          {unreadCount > 0 && <span className="dash-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      </header>

      <div className="dash-kpis">
        <div className="dash-kpi"><b>{rewards?.total ?? 0}</b><span>POINTS</span></div>
        <div className="dash-kpi"><b>{streak} din</b><span>STREAK</span></div>
        <div className="dash-kpi"><b>{rewards?.badges.length ?? 0}</b><span>BADGES</span></div>
      </div>

      <section className="dash-card">
        <h5>Aaj ki progress</h5>
        {dataLoading ? (
          <p className="dash-empty">Aaj ka data load ho raha hai…</p>
        ) : (
          <>
            {!hasActivity && !guestMode && (
              <p className="dash-empty">Aaj abhi kuch nahi kiya — pehli namaz ya ek task se shuru karo. Yahan sirf asal progress dikhegi.</p>
            )}
            {guestMode && (
              <p className="dash-empty">Guest preview — apni progress dekhne ke liye sign in karo.</p>
            )}
            <div className="dash-statrow"><span>Namaz</span><span>{prayedCount} / 5 padhi</span></div>
            <div className="dash-prog"><i style={{ width: `${(prayedCount / 5) * 100}%` }} /></div>
            <div className="dash-statrow"><span>Padhai</span><span>{totalTasksToday === 0 ? 'Aaj koi task nahi' : `${tasksCompletedToday} / ${totalTasksToday} task poore`}</span></div>
            <div className="dash-prog"><i style={{ width: totalTasksToday === 0 ? '0%' : `${Math.min(100, (tasksCompletedToday / totalTasksToday) * 100)}%` }} /></div>
            <div className="dash-statrow"><span>Focus</span><span>{todayFocusMinutes} minute</span></div>
            <div className="dash-prog"><i style={{ width: `${focusBarPct}%` }} /></div>
            <div className="dash-statrow"><span>Neend ka schedule</span><span>{guestMode ? 'Sign in karke schedule banao' : `${formatTime12h(sleepStartTime)} – ${formatTime12h(sleepEndTime)}${sleepLabel ? ` · ${sleepLabel}` : ''}`}</span></div>
            <div className="dash-prog dash-prog-peach"><i style={{ width: guestMode ? '0%' : '100%' }} /></div>
            {!guestMode && <p className="dash-note">Neend ka time schedule hai — asal neend nahi.</p>}
          </>
        )}
      </section>

      <NextPrayerBanner prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} now={now} />

      <section className="dash-card">
        {challenge ? (
          <>
            <h5>Challenge — Day {challenge.currentDay}</h5>
            <p className="dash-challenge-text">{challenge.challenge.title} · {challenge.completedDays} / {challenge.totalDays} din poore · {challenge.pointsEarned} points mile</p>
            <div className="dash-prog dash-prog-peach"><i style={{ width: `${challengePct}%` }} /></div>
            <div className="dash-statrow"><span>{challenge.completedDays} / {challenge.totalDays} din</span><span>{challenge.streak > 0 ? `Streak ${challenge.streak} din 🔥` : 'Streak abhi nahi'}</span></div>
            <button type="button" className="dash-challenge-btn" onClick={() => onNavigate('challenges')}>Aaj ka din dekho</button>
          </>
        ) : (
          <>
            <h5>Challenge</h5>
            <p className="dash-empty">Koi challenge active nahi hai. Ek challenge join karo aur roz thoda-thoda aage badho.</p>
            <button type="button" className="dash-challenge-btn" onClick={() => onNavigate('challenges')}>Challenge join karo</button>
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
function Deen({ onNotify, prayerTimes, prayerStatus, prayerError, salahToday, onRefreshSalah, onOpenGuidance, onBack, profile }: {
  onNotify: (message: string) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  onRefreshSalah: () => Promise<void>;
  onOpenGuidance: (tab: GuidanceTab, surahNumber?: number) => void;
  onBack: () => void;
  profile: UserProfile;
}) {
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
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Qaza save nahi ho payi.');
      await onRefreshSalah();
      onNotify(`${prayer} ki qaza mark ho gayi.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Qaza save nahi ho payi.');
    } finally {
      setQazaBusy(null);
    }
  }

  const city = prayerTimes?.city || profile.city || '';
  const methodLine = profile.asrMethod ? `${profile.asrMethod} tareeqa` : (prayerTimes?.method ?? '');
  const sub = [city, methodLine].filter(Boolean).join(' · ') || 'Namaz ke time';

  return (
    <section className="deen-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Namaz ke Time</h4>
          <div className="asub">{sub}</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn gh" onClick={() => onOpenGuidance('hijri')}>
            <CalendarDays size={13} /> Islamic calendar
          </button>
        </div>
      </div>

      <NextPrayerBanner prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} now={now} />

      <PrayerTimesPanel prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} now={now} onQaza={handleQaza} qazaBusy={qazaBusy} />

      <section className="acard">
        <h5>Apni daily practice</h5>
        <div className="prow prow-link" role="button" tabIndex={0} onClick={() => onOpenGuidance('duas')} onKeyDown={(e) => { if (e.key === 'Enter') onOpenGuidance('duas'); }}>
          <span className="pic"><BookMarked size={19} strokeWidth={1.8} /></span>
          <div>Duas<small>Verified supplications</small></div>
          <ChevronRight size={17} className="prow-chev" />
        </div>
        <div className="prow prow-link" role="button" tabIndex={0} onClick={() => onOpenGuidance('hijri')} onKeyDown={(e) => { if (e.key === 'Enter') onOpenGuidance('hijri'); }}>
          <span className="pic"><CalendarDays size={19} strokeWidth={1.8} /></span>
          <div>Islamic calendar<small>Dates &amp; occasions</small></div>
          <ChevronRight size={17} className="prow-chev" />
        </div>
        <div className="prow prow-link" role="button" tabIndex={0} onClick={() => onOpenGuidance('mosques')} onKeyDown={(e) => { if (e.key === 'Enter') onOpenGuidance('mosques'); }}>
          <span className="pic"><Compass size={19} strokeWidth={1.8} /></span>
          <div>Find a masjid<small>Nearby places</small></div>
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
}) {
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
        onNotify(activeSession.mode === 'focus' ? 'Focus session complete. Well done.' : 'Break complete.');
        await onRefresh();
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : 'Session could not be completed.'))
      .finally(() => { completingRef.current = false; });
  }, [activeSession, remainingMs, onNotify, onRefresh]);

  if (guestMode) {
    return (
      <>
        <PageHeading
          eyebrow="ILM · LEARNING SYSTEM"
          title="Make your focus count."
          text="Plan your study sessions, protect your attention and keep your learning visible."
        />
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">SIGN IN TO TRACK</span>
          <h3>Your study planner lives in your account</h3>
          <p className="onboarding-help">
            Sign in to save subjects, tasks and focus sessions. Nothing is tracked in guest preview.
          </p>
        </section>
      </>
    );
  }

  const scheduleLines: string[] = [];
  if (schedule?.collegeStartTime && schedule?.collegeEndTime) {
    scheduleLines.push(`College: ${formatTime12h(schedule.collegeStartTime)} – ${formatTime12h(schedule.collegeEndTime)}`);
  }
  if (schedule?.studyStartTime && schedule?.studyEndTime) {
    scheduleLines.push(`Study window: ${formatTime12h(schedule.studyStartTime)} – ${formatTime12h(schedule.studyEndTime)}`);
  }
  if (schedule?.dailyStudyTarget) scheduleLines.push(`Daily target: ${schedule.dailyStudyTarget}`);
  if (schedule?.dailyStudyHours) scheduleLines.push(`Daily study hours: ${schedule.dailyStudyHours}`);
  if (schedule?.studyBreakMinutes) scheduleLines.push(`Break: ${schedule.studyBreakMinutes} min`);
  if (schedule?.preferredStudyDays?.length) scheduleLines.push(`Study days: ${schedule.preferredStudyDays.join(', ')}`);

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
      onNotify('Task ka naam likhna zaroori hai.');
      return;
    }
    const duration = taskDuration.trim() ? Number.parseInt(taskDuration, 10) : null;
    if (duration !== null && (!Number.isFinite(duration) || duration < 1 || duration > 480)) {
      onNotify('Duration 1 se 480 minutes ke beech rakho.');
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
        onNotify('Task updated.');
      } else {
        await createTask(input);
        onNotify('Task saved.');
      }
      setTaskModal(null);
      await onRefresh();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Task save nahi ho payi.');
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
      onNotify(status === 'Completed' ? 'Task completed.' : `Task marked ${status}.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Task update nahi ho paya.');
    } finally {
      setStatusPending(null);
    }
  }

  async function removeTask(task: StudyTask) {
    try {
      await deleteTask(task.id);
      setConfirmDeleteTaskId(null);
      await onRefresh();
      onNotify('Task deleted.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Task delete nahi ho paya.');
    }
  }

  async function saveSubject() {
    if (!subjectForm.name.trim()) {
      onNotify('Subject ka naam likhna zaroori hai.');
      return;
    }
    setBusy(true);
    setPendingAction('save-subject');
    try {
      if (subjectForm.id) {
        await updateSubject(subjectForm.id, { name: subjectForm.name.trim(), label: subjectForm.label.trim(), colour: subjectForm.colour });
        onNotify('Subject updated.');
      } else {
        await createSubject({ name: subjectForm.name.trim(), label: subjectForm.label.trim(), colour: subjectForm.colour });
        onNotify('Subject added.');
      }
      setSubjectForm({ id: null, name: '', label: '', colour: 'mint' });
      await onRefresh();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Subject save nahi ho paya.');
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
      onNotify('Subject deleted. Its tasks are now unassigned.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Subject delete nahi ho paya.');
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
      onNotify(timerMode === 'focus' ? 'Focus session started.' : 'Break started.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Timer could not be started.');
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
      onNotify('Session paused.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session pause nahi ho paya.');
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
      onNotify('Session resumed.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session resume nahi ho paya.');
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
      onNotify('Session finished.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session complete nahi ho paya.');
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
      onNotify('Session reset. It stays in history as abandoned (0 min).');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session reset nahi ho paya.');
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
    schedule?.dailyStudyTarget ? `Target ${schedule.dailyStudyTarget}` : (schedule?.dailyStudyHours ? `Target ${schedule.dailyStudyHours} ghante` : ''),
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
        <button type="button" className="aback" onClick={onBack} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Study Planner</h4>
          <div className="asub">{studySub}</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn" onClick={() => openTaskModal()}>+ Task</button>
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
              <span className="eyebrow">YOUR SCHEDULE</span>
              <h3>Aaj ke tasks</h3>
            </div>
            <div className="date-chip small-date"><CalendarDays size={14} /> Today</div>
          </div>

          {scheduleLines.length > 0 ? (
            <div className="schedule-summary">
              {scheduleLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          ) : (
            <p className="onboarding-help">No college or study schedule saved yet. Add it during onboarding or in Profile to see it here.</p>
          )}

          {targetMinutes !== null && targetPct !== null && (
            <>
              <div className="statrow">Aaj ka target <span>{`${(todayFocusMinutes / 60).toFixed(1)} / ${targetHours} ghante ho gaya`}</span></div>
              <div className="prog"><i style={{ width: `${targetPct}%` }} /></div>
            </>
          )}

          <div className="task-list full-task-list">
            {todayTasks.length === 0 && (
              <p className="onboarding-help">No tasks for today yet. Add your first task to start tracking.</p>
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
                    aria-label={task.status === 'Completed' ? `${task.title} dobara kholo` : `${task.title} poora mark karo`}
                  >
                    {task.status === 'Completed' ? '✓' : ''}
                  </button>
                  <span className={`task-dot ${subject?.colour ?? 'mint'}`} />
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {task.startTime ? formatTime12h(task.startTime) : 'Not scheduled'}
                      {task.dueDate ? ` · Due ${task.dueDate}` : ''}
                      {subject ? ` · ${subject.name}` : ' · No subject'}
                      {task.durationMinutes ? ` · ${task.durationMinutes}m` : ''}
                    </small>
                    {task.description && <small>{task.description}</small>}
                  </div>
                  <span className={`status-tag ${task.status === 'Completed' ? 'status-done' : task.status === 'In Progress' ? 'status-live' : ''}`}>
                    {task.status}
                  </span>
                  <div className="task-actions">
                    {task.status !== 'Completed' && (
                      <>
                        {task.status !== 'In Progress' && <button disabled={rowPending} onClick={() => changeStatus(task, 'In Progress')}>{rowPending && statusPending?.status === 'In Progress' ? 'Saving…' : 'Start'}</button>}
                        <button disabled={rowPending} onClick={() => changeStatus(task, 'Completed')}>{rowPending && statusPending?.status === 'Completed' ? 'Saving…' : 'Complete'}</button>
                      </>
                    )}
                    {task.status === 'Completed' && <button disabled={rowPending} onClick={() => changeStatus(task, 'Pending')}>{rowPending && statusPending?.status === 'Pending' ? 'Saving…' : 'Reopen'}</button>}
                    <button onClick={() => openTaskModal(task)}>Edit</button>
                    {confirmDeleteTaskId === task.id ? (
                      <button onClick={() => removeTask(task)}>Confirm?</button>
                    ) : (
                      <button onClick={() => setConfirmDeleteTaskId(task.id)}>Delete</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {upcomingTasks.length > 0 && (
            <>
              <h4 className="upcoming-heading">Upcoming</h4>
              <div className="task-list">
                {upcomingTasks.map((task) => {
                  const subject = task.subjectId ? subjectById.get(task.subjectId) : undefined;
                  return (
                    <div className="task-row" key={task.id}>
                      <span className={`task-dot ${subject?.colour ?? 'mint'}`} />
                      <div><strong>{task.title}</strong><small>Due {task.dueDate}{subject ? ` · ${subject.name}` : ' · No subject'}</small></div>
                      <span className="status-tag">{task.status}</span>
                      <button className="task-action-link" onClick={() => openTaskModal(task)}>Edit</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <button className="add-row" onClick={() => openTaskModal()}><Plus size={15} /> Add another session</button>
          <p className="modal-note">Streak rule: a day counts when a focus session finishes or a task is completed.</p>
        </section>

        <section className="panel subjects-card">
          <div className="panel-top">
            <div>
              <span className="eyebrow">YOUR SUBJECTS</span>
              <h3>Your subjects</h3>
            </div>
            <button className="subtle-action" onClick={() => setShowSubjects(!showSubjects)}>
              {showSubjects ? 'Done' : 'Manage subjects'} <ArrowUpRight size={13} />
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
              + Naya subject
            </button>
          </div>
          {showSubjects && (
            <div className="subject-form">
              <label className="field-label">Subject name</label>
              <input className="form-input" value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Applied Mathematics" />
              <label className="field-label">Label / code (optional)</label>
              <input className="form-input" value={subjectForm.label} onChange={(e) => setSubjectForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. 312301" />
              <label className="field-label">Colour</label>
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
                {pendingAction === 'save-subject' ? 'Saving…' : subjectForm.id ? 'Save subject' : 'Add subject'}
              </button>
              {subjectForm.id && (
                <button className="text-button" onClick={() => setSubjectForm({ id: null, name: '', label: '', colour: 'mint' })}>
                  Cancel edit
                </button>
              )}
              <p className="modal-note">Deleting a subject keeps its tasks — they become “No subject”.</p>
            </div>
          )}
          <div className="subject-list">
            {subjects.length === 0 && (
              <p className="onboarding-help">No subjects yet. Add your first subject to organise tasks and focus time.</p>
            )}
            {subjects.map((subject) => {
              const row = subjectStats(subject);
              return (
                <div key={subject.id}>
                  <SubjectRow name={subject.name} label={subject.label} tasksDone={row.tasksDone} tasksTotal={row.tasksTotal} focusMinutes={row.focusMinutesWeek} colour={subject.colour} />
                  {showSubjects && (
                    <div className="subject-actions">
                      <button onClick={() => setSubjectForm({ id: subject.id, name: subject.name, label: subject.label, colour: subject.colour })}>Edit</button>
                      {confirmDeleteSubjectId === subject.id ? (
                        <button onClick={() => removeSubject(subject)}>Confirm delete?</button>
                      ) : (
                        <button onClick={() => setConfirmDeleteSubjectId(subject.id)}>Delete</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel timer-card">
          <span className="eyebrow">POMODORO · FOCUS TIMER</span>
          <div className="timer-circle">
            <div>
              <strong>{activeSession ? formatCountdown(remainingMs ?? 0) : `${String(selectedMinutes).padStart(2, '0')}:00`}</strong>
              <span>
                {activeSession
                  ? activeSession.status === 'paused'
                    ? 'Paused'
                    : activeSession.mode === 'focus' ? 'Focus session' : 'Break'
                  : 'Ready when you are'}
              </span>
            </div>
          </div>
          {activeSession && (
            <p className="muted-footnote">
              {activeSession.mode === 'focus' ? `${activeSession.plannedMinutes}-minute focus` : `${activeSession.plannedMinutes}-minute break`}
              {activeSession.taskId ? ` · ${tasks.find((t) => t.id === activeSession.taskId)?.title ?? ''}` : ''}
              {' · '}Saved on the server — a refresh won&apos;t stop the timer.
            </p>
          )}
          {!activeSession && (
            <>
              <div className="timer-presets">
                <button className={timerMode === 'focus' ? 'preset-selected' : ''} onClick={() => { setTimerMode('focus'); setSelectedMinutes(25); }}>Focus</button>
                <button className={timerMode === 'break' ? 'preset-selected' : ''} onClick={() => { setTimerMode('break'); setSelectedMinutes(breakDefault); }}>Break</button>
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
                  <label className="field-label">Focus on a task (optional)</label>
                  <select className="form-input" value={focusTaskId} onChange={(e) => setFocusTaskId(e.target.value)}>
                    <option value="">No specific task</option>
                    {tasks.filter((t) => t.status !== 'Completed').map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </>
              )}
              {timerMode === 'break' && (
                <small className="muted-footnote">Break default ({breakDefault} min) comes from your onboarding study settings.</small>
              )}
              <button className="primary-button full-width" disabled={busy} onClick={handleStartTimer}>
                {pendingAction === 'start' ? 'Starting…' : `Start ${timerMode === 'focus' ? 'focus' : 'break'} session`} <ArrowRight size={15} />
              </button>
            </>
          )}
          {activeSession && (
            <div className="timer-actions">
              {activeSession.status === 'active' ? (
                <button className="primary-button full-width" disabled={busy} onClick={handlePauseTimer}>
                  <Timer size={15} /> {pendingAction === 'pause' ? 'Pausing…' : 'Pause session'}
                </button>
              ) : (
                <button className="primary-button full-width" disabled={busy} onClick={handleResumeTimer}>
                  {pendingAction === 'resume' ? 'Resuming…' : 'Resume session'} <ArrowRight size={15} />
                </button>
              )}
              <button className="outline-button full-width" disabled={busy} onClick={handleCompleteTimer}>
                {pendingAction === 'complete' ? 'Finishing…' : 'Finish now'}
              </button>
              {confirmReset ? (
                <button className="outline-button full-width" disabled={busy} onClick={handleAbandonTimer}>
                  {pendingAction === 'abandon' ? 'Resetting…' : 'Confirm reset — session stays in history as abandoned (0 min)'}
                </button>
              ) : (
                <button className="text-button" disabled={busy} onClick={() => setConfirmReset(true)}>
                  Reset timer
                </button>
              )}
            </div>
          )}
          <small className="muted-footnote">The server stores the start time, so refreshing, logging out, or switching devices keeps the timer running.</small>
        </section>

        <section className="panel history-card">
          <SectionTitle title="Focus history" />
          {history.length === 0 ? (
            <p className="onboarding-help">No focus sessions yet. Finished and abandoned sessions will appear here with their real minutes.</p>
          ) : (
            <div className="history-list">
              {history.slice(0, 10).map((session) => (
                <div className="history-row" key={session.id}>
                  <div>
                    <strong>{session.mode === 'focus' ? 'Focus' : 'Break'} · {session.plannedMinutes} min</strong>
                    <small>
                      {session.completedAt
                        ? new Date(session.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : ''}
                      {session.taskId ? ` · ${tasks.find((t) => t.id === session.taskId)?.title ?? ''}` : ''}
                    </small>
                  </div>
                  <span className={`status-tag ${session.status === 'completed' ? 'status-done' : ''}`}>
                    {session.status === 'completed' ? `${session.focusMinutesEarned}m earned` : 'Abandoned · 0m'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel study-tip">
          <div className="tip-icon"><Sparkles size={19} /></div>
          <div>
            <span className="eyebrow">A SMALL REMINDER</span>
            <h3>Study with a clear intention.</h3>
            <p>One focused session is more useful than an hour of distracted studying. Start small and protect the time you set aside.</p>
          </div>
        </section>
      </div>

      {taskModal && (
        <div className="modal-backdrop" onClick={() => setTaskModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><span className="eyebrow">STUDY PLANNER</span><h3>{taskModal.task ? 'Edit task' : 'Add a study task'}</h3></div>
              <button className="icon-button" onClick={() => setTaskModal(null)}><X size={18} /></button>
            </div>
            <label className="field-label">Task name</label>
            <input className="form-input" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Revise calculus" />
            <label className="field-label">Subject</label>
            <select className="form-input" value={taskSubjectId} onChange={(e) => setTaskSubjectId(e.target.value)}>
              <option value="">No subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="field-label">Description</label>
            <textarea className="form-input form-textarea" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="What exactly needs doing?" rows={3} />
            <div className="form-row">
              <div>
                <label className="field-label">Priority</label>
                <select className="form-input" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="field-label">Duration (minutes)</label>
                <input className="form-input" type="number" min={1} max={480} value={taskDuration} onChange={(e) => setTaskDuration(e.target.value)} placeholder="e.g. 60" />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="field-label">Due date</label>
                <input className="form-input" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Start time</label>
                <input className="form-input" type="time" value={taskStartTime} onChange={(e) => setTaskStartTime(e.target.value)} />
              </div>
            </div>
            <button className="primary-button full-width" disabled={busy} onClick={saveTask}>
              {pendingAction === 'save-task' ? 'Saving…' : taskModal.task ? 'Save changes' : 'Add task'} <ArrowRight size={16} />
            </button>
            <p className="modal-note">Tasks are saved to your account in MongoDB and stay in sync across devices.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function SubjectRow({ name, label, tasksDone, tasksTotal, focusMinutes, colour }: {
  name: string;
  label: string;
  tasksDone: number;
  tasksTotal: number;
  focusMinutes: number;
  colour: string;
}) {
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  return (
    <div className="subject-row">
      <div>
        <div><strong>{name}</strong><span>{label || 'No label'}</span></div>
        <b>{tasksDone}/{tasksTotal} tasks · {focusMinutes}m this week</b>
      </div>
      <div className="progress-track"><span className={`fill-${colour}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

const CHALLENGE_CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  prayers: 'Prayers',
  quran: 'Quran',
  study: 'Study',
  focus: 'Focus',
  sleep: 'Sleep',
  discipline: 'Discipline',
};

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

function requirementFor(category: ChallengeCategory): string {
  switch (category) {
    case 'prayers':
      return 'All five prayers prayed or Qaza';
    case 'study':
      return 'Complete a task or finish a focus session';
    case 'focus':
      return 'Finish a focus session';
    default:
      return 'Self-reported daily check-in';
  }
}

function progressSourceLabel(source: string): string {
  switch (source) {
    case 'salah':
      return 'From your Salah record';
    case 'study-task':
      return 'From a completed task';
    case 'focus-session':
      return 'From a finished focus session';
    case 'self-reported':
      return 'Self-reported';
    default:
      return source;
  }
}

function Challenges({
  onNotify,
  onRefresh,
  guestMode,
  onBack,
}: {
  onNotify: (message: string) => void;
  onRefresh: () => void;
  guestMode: boolean;
  onBack: () => void;
}) {
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
      setError(err instanceof Error ? err.message : 'Challenges could not be loaded.');
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
      onNotify(err instanceof Error ? err.message : 'Challenge could not be loaded.');
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
      onNotify('Please read the rules and tick the consent box to join.');
      return;
    }
    setBusy(true);
    try {
      const { challenge } = await joinTemplate(template.id);
      onNotify(`Joined “${template.title}”. Day 1 starts today.`);
      setExpandedTemplate(null);
      setTemplateConsent(false);
      await refreshAfterChange();
      await openDetail(challenge.id);
      setTab('mine');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not join this challenge.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinDetail() {
    if (!detail || !detailConsent) {
      onNotify('Please read the rules and tick the consent box to join.');
      return;
    }
    setBusy(true);
    try {
      await joinChallenge(detail.challenge.id);
      onNotify(`Joined “${detail.challenge.title}”. Day 1 starts today.`);
      await refreshAfterChange();
      await openDetail(detail.challenge.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not join this challenge.');
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
      onNotify(err instanceof Error ? err.message : 'Could not leave this challenge.');
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
      onNotify(err instanceof Error ? err.message : 'Check-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const rules = createRules.split('\n').map((r) => r.trim()).filter(Boolean);
    if (!createTitle.trim() || rules.length === 0 || !createConsent) {
      onNotify('Add a title, at least one rule, and tick the consent box.');
      return;
    }
    const durationDays = Number.parseInt(createDuration, 10);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
      onNotify('Duration must be between 1 and 365 days.');
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
      onNotify(`“${challenge.title}” created — you joined automatically.`);
      setShowCreate(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateRules('');
      setCreateConsent(false);
      await refreshAfterChange();
      await openDetail(challenge.id);
      setTab('mine');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Challenge could not be created.');
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
          eyebrow="COMMUNITY · ACCOUNTABILITY"
          title="Progress feels better together."
          text="Choose a healthy goal and keep yourself accountable."
        />
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">SIGN IN TO TRACK</span>
          <h3>Challenges live in your account</h3>
          <p className="onboarding-help">
            Sign in to join challenges and earn points from your real activity. Nothing is tracked in guest preview.
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
          <button type="button" className="aback" onClick={() => setDetail(null)} aria-label="Saare challenges dekho">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h4>{challenge.title}</h4>
            <div className="asub">{CHALLENGE_CATEGORY_LABELS[challenge.category]} · {challenge.durationDays} din · {challenge.kind === 'template' ? 'Template' : 'Apna challenge'}</div>
          </div>
        </div>
        {detailLoading && <p className="onboarding-help">Loading challenge details…</p>}

        {completed && participation && (
          <section className="panel challenge-completed">
            <Trophy size={22} />
            <div>
              <span className="eyebrow">CHALLENGE COMPLETED</span>
              <h3>You finished all {challenge.durationDays} days.</h3>
              <p>
                Badge earned: {challenge.durationDays >= 365 ? '365-Day Challenger' : challenge.durationDays >= 30 ? '30-Day Challenger' : 'Challenge Finisher'} · {participation.pointsEarned} points from this challenge.
              </p>
            </div>
          </section>
        )}

        <div className="challenge-detail-grid">
          <section className="panel">
            <span className="eyebrow">{CHALLENGE_CATEGORY_LABELS[challenge.category].toUpperCase()} · {challenge.durationDays} DAYS · {challenge.kind === 'template' ? 'TEMPLATE' : 'YOUR CHALLENGE'}</span>
            <h3>Rules — read before joining</h3>
            <ul className="challenge-rules">
              {challenge.rules.map((rule, index) => <li key={index}>{rule}</li>)}
            </ul>
            <p className="onboarding-help">
              What completes a day: {requirementFor(challenge.category)}.
              {!auto && ' Days are self-reported — they are shown as self-reported, never as verified.'}
            </p>

            {!participation && (
              <div className="challenge-consent">
                <label className="consent-row">
                  <input type="checkbox" checked={detailConsent} onChange={(e) => setDetailConsent(e.target.checked)} />
                  <span>I have read the rules and I join this challenge willingly.</span>
                </label>
                <button className="primary-button" disabled={!detailConsent || busy} onClick={handleJoinDetail}>
                  Join this challenge
                </button>
              </div>
            )}

            {participation && participation.status === 'active' && (
              <div className="challenge-leave">
                {!confirmLeave ? (
                  <button className="outline-button" onClick={() => setConfirmLeave(true)}>Leave challenge</button>
                ) : (
                  <>
                    <p className="onboarding-help">{detail.leaveRule}</p>
                    <div className="challenge-leave-actions">
                      <button className="primary-button" disabled={busy} onClick={handleLeave}>Yes, leave — keep my history</button>
                      <button className="outline-button" onClick={() => setConfirmLeave(false)}>Stay</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="panel">
            {participation ? (
              <>
                <span className="eyebrow">YOUR PROGRESS</span>
                <h3>Day {participation.currentDay} of {participation.totalDays}</h3>
                <div className="progress-track"><span className="fill-mint" style={{ width: `${Math.round((participation.completedDays / participation.totalDays) * 100)}%` }} /></div>
                <div className="challenge-stat-row">
                  <div><strong>{participation.completedDays}</strong><span>days done</span></div>
                  <div><strong>{participation.streak}</strong><span>day streak</span></div>
                  <div><strong>{participation.pointsEarned}</strong><span>points</span></div>
                </div>
                <p className="onboarding-help">
                  {detail.todayCompleted
                    ? 'Today is done. Come back tomorrow for the next day.'
                    : auto
                      ? `Today is not done yet — ${requirementFor(challenge.category).toLowerCase()}. It completes automatically from your real activity.`
                      : 'Today is not done yet — mark it yourself after you have kept the habit.'}
                </p>
                {participation.status === 'active' && !auto && !detail.todayCompleted && (
                  <button className="primary-button" disabled={busy} onClick={handleCheckIn}>
                    <Check size={16} /> Check in for today (self-reported)
                  </button>
                )}
                {detail.progress.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 18 }}>Recent days</h3>
                    <div className="challenge-progress-list">
                      {detail.progress.slice(0, 14).map((day) => (
                        <div className="challenge-progress-row" key={day.date}>
                          <span className="challenge-day-dot done" />
                          <div><strong>Day {day.dayNumber} · {day.date}</strong><small>{progressSourceLabel(day.source)}{day.source === 'self-reported' ? ' — self-reported, not verified' : ''}</small></div>
                          <Check size={15} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="eyebrow">YOUR PROGRESS</span>
                <h3>Not joined yet</h3>
                <p className="onboarding-help">Read the rules, tick the consent box and join to start day 1 today.</p>
              </>
            )}
            {detail.history.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>Past attempts</h3>
                {detail.history.map((attempt) => (
                  <p className="onboarding-help" key={attempt.id}>
                    {attempt.status === 'completed' ? 'Completed' : 'Left'} · {attempt.completedDays} of {attempt.totalDays} days · {attempt.pointsEarned} points kept
                  </p>
                ))}
              </>
            )}
          </section>
        </div>

        <div className="privacy-callout">
          <Lock size={16} />
          <div>
            <strong>Privacy comes first</strong>
            <span>Your prayer history and private activity are never shared. Challenges here are solo — friends and invites come in a later phase.</span>
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
        <button type="button" className="aback" onClick={onBack} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Challenges</h4>
          <div className="asub">Roz thoda, lambay samay tak</div>
        </div>
        <div className="aright">
          <button type="button" className="sbtn" onClick={() => setShowCreate(true)}>+ Banao</button>
        </div>
      </div>

      {error && <p className="salah-error">{error}</p>}
      {loading && <p className="onboarding-help">Loading challenges…</p>}

      {hero ? (
        <div className="acard-l ch-hero">
          <div className="ch-hero-top">
            <span className="mchip">CHAL RAHA HAI</span>
            <span className="ch-hero-streak">🔥 {hero.streak} din streak</span>
          </div>
          <div className="ch-hero-title">{hero.challenge.title}</div>
          <p className="ch-hero-rules-line">
            {hero.challenge.rules.slice(0, 3).join(' · ')}
            {hero.challenge.rules.length > 3 ? ' · …' : ''}
          </p>
          <div className="prog pk"><i style={{ width: `${hero.totalDays > 0 ? Math.round((hero.completedDays / hero.totalDays) * 100) : 0}%` }} /></div>
          <div className="ch-hero-meta"><span>Day {hero.currentDay} / {hero.totalDays}</span><span>{hero.pointsEarned} points mile</span></div>
          <div className="btnrow">
            <button type="button" className="sbtn pk" onClick={() => openDetail(hero.challengeId)}>Aaj ka din dekho</button>
            <button type="button" className="sbtn gh" onClick={() => setHeroShowRules((v) => !v)}>Rules</button>
          </div>
          {heroShowRules && (
            <div className="challenge-rules-box ch-hero-rules">
              <strong>Rules — read before joining</strong>
              <ul className="challenge-rules">
                {hero.challenge.rules.map((rule, index) => <li key={index}>{rule}</li>)}
              </ul>
              <p className="onboarding-help">What completes a day: {requirementFor(hero.challenge.category)}.</p>
            </div>
          )}
        </div>
      ) : (
        !loading && (
          <div className="acard-l">
            <h5>Koi challenge active nahi hai</h5>
            <p className="onboarding-help">
              Neeche se ek ready-made challenge join karo ya apna banao — roz thoda-thoda,
              points sirf asal activity se milenge.
            </p>
            <button type="button" className="sbtn pk" onClick={() => setTab('explore')}>Challenge join karo</button>
          </div>
        )
      )}

      <div className="challenge-controls">
        <div className="segmented">
          <button className={tab === 'explore' ? 'on' : ''} onClick={() => setTab('explore')}>Explore</button>
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My challenges ({myActive.length})</button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History ({myHistory.length})</button>
        </div>
        <div className="privacy-hint"><ShieldCheck size={14} /> Private progress by default</div>
      </div>

      {tab === 'explore' && (
        <div className="acard-l">
          <h5>Ready-made challenges</h5>
          {templates.length === 0 && !loading && (
            <p className="onboarding-help">No templates available right now. Create your own challenge instead.</p>
          )}
          {templates.map((template) => {
            const joined = participationForTemplate(template.id);
            const expanded = expandedTemplate === template.id;
            return (
              <div key={template.id}>
                <div className="taskrow">
                  <span className="snum2">{template.durationDays}</span>
                  <div>{template.title}<small>{template.description || `${CHALLENGE_CATEGORY_LABELS[template.category]} · ${template.requirement}`}</small></div>
                  {joined ? (
                    <button type="button" className="sbtn" style={{ marginLeft: 'auto' }} onClick={() => openDetail(joined.challengeId)}>
                      Day {joined.currentDay} — View
                    </button>
                  ) : expanded ? (
                    <button type="button" className="sbtn gh" style={{ marginLeft: 'auto' }} onClick={() => { setExpandedTemplate(null); setTemplateConsent(false); }}>
                      Close
                    </button>
                  ) : (
                    <button type="button" className="sbtn" style={{ marginLeft: 'auto' }} onClick={() => { setExpandedTemplate(template.id); setTemplateConsent(false); }}>
                      Join
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
                      <span>I have read the rules and I join this challenge willingly.</span>
                    </label>
                    <button type="button" className="primary-button full-width" disabled={!templateConsent || busy} onClick={() => handleJoinTemplate(template)}>
                      Join this challenge
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="taskrow">
            <span className="snum2 snum2-peach">+</span>
            <div>Apna challenge banao<small>Apne din, apna target, apne rules</small></div>
            <button type="button" className="sbtn pk" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>Banao</button>
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div className="challenge-cards">
          {myActive.length === 0 && !loading && (
            <p className="onboarding-help">You have no active challenges. Explore the templates or create your own.</p>
          )}
          {myActive.map((participation) => {
            const Icon = CHALLENGE_CATEGORY_ICONS[participation.challenge.category];
            return (
              <div className="panel challenge-card" key={participation.id}>
                <div className="challenge-card-icon"><Icon size={21} /></div>
                <span className="eyebrow">{CHALLENGE_CATEGORY_LABELS[participation.challenge.category].toUpperCase()} · {participation.totalDays} DAYS</span>
                <h3>{participation.challenge.title}</h3>
                <p>{participation.challenge.description}</p>
                <div className="challenge-meta">
                  <span><CalendarDays size={14} /> Day {participation.currentDay} of {participation.totalDays}</span>
                  <span><Flame size={14} /> {participation.streak}-day streak</span>
                </div>
                <div className="progress-track"><span className="fill-mint" style={{ width: `${Math.round((participation.completedDays / participation.totalDays) * 100)}%` }} /></div>
                <p className="onboarding-help">{participation.completedDays} days done · {participation.pointsEarned} points{participation.todayCompleted ? ' · Today done' : ' · Today pending'}</p>
                <button className="outline-button full-width" onClick={() => openDetail(participation.challengeId)}>
                  View challenge <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'history' && (
        <div className="challenge-cards">
          {myHistory.length === 0 && !loading && (
            <p className="onboarding-help">No finished or left challenges yet. Your history will appear here and is never deleted.</p>
          )}
          {myHistory.map((participation) => {
            const Icon = CHALLENGE_CATEGORY_ICONS[participation.challenge.category];
            return (
              <div className="panel challenge-card" key={participation.id}>
                <div className="challenge-card-icon"><Icon size={21} /></div>
                <span className="eyebrow">{CHALLENGE_CATEGORY_LABELS[participation.challenge.category].toUpperCase()} · {participation.totalDays} DAYS · {participation.status === 'completed' ? 'COMPLETED' : 'LEFT'}</span>
                <h3>{participation.challenge.title}</h3>
                <p>{participation.completedDays} of {participation.totalDays} days done · {participation.pointsEarned} points kept</p>
                {participation.status === 'completed' && (
                  <p className="onboarding-help">Badge earned: {participation.totalDays >= 365 ? '365-Day Challenger' : participation.totalDays >= 30 ? '30-Day Challenger' : 'Challenge Finisher'}</p>
                )}
                <button className="outline-button full-width" onClick={() => openDetail(participation.challengeId)}>
                  View challenge <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="acard-l">
        <p className="mut" style={{ margin: 0 }}>
          <b>Join se pehle rules:</b> ek challenge ek hi baar join hoga, beech me chhod sakte ho
          (history rehti hai), points server par bante hain — haath se badle nahi ja sakte.
          Poora karne par badge milega.
        </p>
      </div>

      <div className="privacy-callout">
        <Lock size={16} />
        <div>
          <strong>Privacy comes first</strong>
          <span>Random matching will require consent. Your location, prayer history and private religious activity will never be shared with strangers. Friends and invites come in a later phase.</span>
        </div>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><span className="eyebrow">CHALLENGES</span><h3>Create your own challenge</h3></div>
              <button className="icon-button" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <label className="field-label">Title</label>
              <input className="form-input" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Read 10 pages every day" />
              <label className="field-label">Description (optional)</label>
              <input className="form-input" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="What is this challenge about?" />
              <div className="form-row">
                <div>
                  <label className="field-label">Category</label>
                  <select className="form-input" value={createCategory} onChange={(e) => setCreateCategory(e.target.value as ChallengeCategory)}>
                    {(Object.keys(CHALLENGE_CATEGORY_LABELS) as ChallengeCategory[]).map((c) => (
                      <option key={c} value={c}>{CHALLENGE_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Duration (days)</label>
                  <input className="form-input" inputMode="numeric" value={createDuration} onChange={(e) => setCreateDuration(e.target.value)} placeholder="30" />
                </div>
              </div>
              <p className="onboarding-help">What completes a day: {requirementFor(createCategory)}.{!isAutoCategory(createCategory) && ' Days are self-reported — shown as self-reported, never as verified.'}</p>
              <label className="field-label">Rules (one per line)</label>
              <textarea className="form-input" value={createRules} onChange={(e) => setCreateRules(e.target.value)} placeholder={'e.g. A day counts when I finish the task.\nDays are counted in my own timezone.'} rows={4} />
              <label className="consent-row">
                <input type="checkbox" checked={createConsent} onChange={(e) => setCreateConsent(e.target.checked)} />
                <span>I understand the rules and I join this challenge willingly. I can leave at any time — my history and earned points are kept.</span>
              </label>
              <button className="primary-button full-width" type="submit" disabled={busy}>Create &amp; join</button>
              <p className="modal-note">You join automatically when you create a challenge. Friends and invites come in a later phase — this is solo for now.</p>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Guidance({ onNotify, onOpenFeedback, tab, onTabChange, guestMode, profileCity, initialSurah, onInitialSurahOpened, onOpenSurah }: {
  onNotify: (message: string) => void;
  onOpenFeedback: () => void;
  tab: GuidanceTab;
  onTabChange: (tab: GuidanceTab) => void;
  guestMode: boolean;
  profileCity: string;
  initialSurah: number | null;
  onInitialSurahOpened: () => void;
  onOpenSurah: (surahNumber: number) => void;
}) {
  const [selected, setSelected] = useState('Feeling overwhelmed');

  function openVerifiedReading() {
    if (selected === 'Need a dua') {
      onTabChange('duas');
      return;
    }
    if (selected === 'Feeling overwhelmed') {
      // Surah Ash-Sharh (94) — the reference already shown on this card.
      onOpenSurah(94);
      return;
    }
    onTabChange('quran');
  }

  return (
    <>
      <PageHeading
        eyebrow="REFLECTION · QURANIC GUIDANCE"
        title="A moment to pause and reflect."
        text="Find relevant, carefully sourced Quranic guidance for different moments in life."
      />

      <div className="guidance-layout">
        <section className="panel guidance-main">
          <span className="eyebrow">WHAT IS ON YOUR MIND?</span>
          <h2>How are you feeling today?</h2>
          <p>Choose a topic to explore relevant guidance.</p>

          <div className="mood-grid">
            {guidanceCards.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.mood}
                  className={selected === m.mood ? 'selected' : ''}
                  onClick={() => setSelected(m.mood)}
                >
                  <Icon size={19} />
                  <strong>{m.mood}</strong>
                  <span>{m.category}</span>
                </button>
              );
            })}
          </div>

          <div className="guidance-result">
            <div className="guidance-result-top">
              <span className="eyebrow">SUGGESTED READING · PREVIEW</span>
              <BookOpen size={18} />
            </div>
            <h3>{guidanceCards.find((m) => m.mood === selected)?.category}</h3>
            <div className="reference-chip">{guidanceCards.find((m) => m.mood === selected)?.ref}</div>
            <p>
              Verified Arabic text, translation, context and source attribution from the Qur'an browser below.
            </p>
            <button className="primary-button" onClick={openVerifiedReading}>
              Open verified reading <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <aside className="guidance-side">
          <div className="panel source-panel">
            <div className="source-icon"><ShieldCheck size={20} /></div>
            <span className="eyebrow">OUR CONTENT PROMISE</span>
            <h3>Accuracy before quantity.</h3>
            <p>Quranic Arabic comes from the Tanzil Uthmani text via AlQuran Cloud, with translation attribution shown on every reading. Curated duas carry their exact surah, ayah, para and page references.</p>
            <div className="source-check"><CheckCheck size={14} /> Exact surah and ayah references</div>
            <div className="source-check"><CheckCheck size={14} /> Translation attribution</div>
            <div className="source-check"><CheckCheck size={14} /> Source shown on every reading</div>
          </div>

          <div className="panel support-panel">
            <Heart size={20} />
            <h3>Faith can support you. You don't have to handle everything alone.</h3>
            <p>Spiritual reflection can sit alongside practical support and professional care when needed.</p>
            <button className="text-button" onClick={onOpenFeedback}>
              Madad chahiye? Feedback bhejo <ArrowRight size={14} />
            </button>
          </div>
        </aside>
      </div>

      <div className="guidance-tabs" role="tablist" aria-label="Quranic guidance sections">
        {([
          ['quran', 'Read Qur\'an'],
          ['duas', 'Curated duas'],
          ['hijri', 'Hijri calendar'],
          ['mosques', 'Find a masjid'],
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
        />
      )}
      {tab === 'duas' && <CuratedDuas onOpenSurah={onOpenSurah} />}
      {tab === 'hijri' && <HijriCalendar onNotify={onNotify} guestMode={guestMode} />}
      {tab === 'mosques' && (
        <MosqueFinder onNotify={onNotify} guestMode={guestMode} profileCity={profileCity} />
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
}: {
  activeSession: PomodoroSession | null;
  history: PomodoroSession[];
  stats: StudyStats | null;
  tasks: StudyTask[];
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  onNavigate: (page: Page) => void;
  guestMode: boolean;
}) {
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
        onNotify(activeSession.mode === 'focus' ? 'Focus session complete. Well done.' : 'Break complete.');
        await onRefresh();
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : 'Session could not be completed.'))
      .finally(() => { completingRef.current = false; });
  }, [activeSession, remainingMs, onNotify, onRefresh]);

  async function handlePauseTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    setPendingAction('pause');
    try {
      await pausePomodoro(activeSession.id);
      await onRefresh();
      onNotify('Session paused.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session pause nahi ho paya.');
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
      onNotify('Session resumed.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session resume nahi ho paya.');
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
      onNotify('Session finished.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session complete nahi ho paya.');
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  function formatMinutes(total: number): string {
    if (total >= 60) {
      const hours = total / 60;
      return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} gh`;
    }
    return `${total} min`;
  }

  const todayMinutes = stats?.todayFocusMinutes ?? 0;
  const weekMinutes = stats?.weekFocusMinutes ?? 0;
  const completedFocusSessions = history.filter((s) => s.mode === 'focus' && s.status === 'completed');
  const activeTaskTitle = activeSession?.taskId
    ? tasks.find((t) => t.id === activeSession.taskId)?.title ?? ''
    : '';
  const ringLabel = activeSession
    ? (activeTaskTitle ? `${activeTaskTitle.toUpperCase()} CHAL RAHA HAI` : activeSession.mode === 'focus' ? 'FOCUS CHAL RAHA HAI' : 'BREAK CHAL RAHA HAI')
    : 'KOI SESSION NAHI';
  const ringPct = activeSession && activeSession.plannedMinutes > 0
    ? Math.max(0, Math.min(100, Math.round(((remainingMs ?? 0) / (activeSession.plannedMinutes * 60_000)) * 100)))
    : 0;

  return (
    <section className="focus-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={() => onNavigate('home')} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Focus</h4>
          <div className="asub">Bina rukawat padhai</div>
        </div>
      </div>

      {guestMode ? (
        <div className="acard">
          <p className="mut" style={{ margin: 0 }}>
            Focus sessions tumhare account me save hote hain. Guest preview me timer nahi
            chalega — sign in karke apna pehla focus session shuru karo.
          </p>
          <button type="button" className="sbtn pk" style={{ marginTop: 12 }} onClick={() => onNavigate('study')}>
            Study planner dekho
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
                <span>{activeSession && activeSession.status === 'paused' ? 'PAUSED' : ringLabel}</span>
              </div>
            </div>
          </div>

          {activeSession ? (
            <div className="btnrow focus-actions">
              {activeSession.status === 'active' ? (
                <button type="button" className="sbtn" disabled={busy} onClick={() => void handlePauseTimer()}>
                  <Pause size={15} /> {pendingAction === 'pause' ? 'Pausing…' : 'Pause'}
                </button>
              ) : (
                <button type="button" className="sbtn" disabled={busy} onClick={() => void handleResumeTimer()}>
                  <Play size={15} /> {pendingAction === 'resume' ? 'Resuming…' : 'Resume'}
                </button>
              )}
              <button type="button" className="sbtn gh" disabled={busy} onClick={() => void handleCompleteTimer()}>
                <Square size={14} /> {pendingAction === 'complete' ? 'Finishing…' : 'Khatam'}
              </button>
            </div>
          ) : (
            <div className="btnrow focus-actions">
              <button type="button" className="sbtn pk" onClick={() => onNavigate('study')}>
                Study me session shuru karo
              </button>
            </div>
          )}
          {activeSession && (
            <p className="mut focus-session-note">
              {activeSession.mode === 'focus' ? `${activeSession.plannedMinutes}-minute focus` : `${activeSession.plannedMinutes}-minute break`}
              {activeTaskTitle ? ` · ${activeTaskTitle}` : ''}
              {' · '}Server par save hai — refresh ya device badalne par bhi timer chalta rahega.
            </p>
          )}

          <div className="kpis">
            <div className="kpi"><b>{formatMinutes(todayMinutes)}</b><span>AAJ</span></div>
            <div className="kpi"><b>{formatMinutes(weekMinutes)}</b><span>IS HAFTE</span></div>
            <div className="kpi"><b>{completedFocusSessions.length}</b><span>SESSIONS</span></div>
          </div>
          <p className="mut focus-kpi-note">Sessions ki ginti pichhle 20 loaded sessions me se hai.</p>

          <div className="acard">
            <h5>Pichhle sessions</h5>
            {history.length === 0 ? (
              <p className="mut" style={{ margin: '8px 0 0' }}>
                Abhi koi focus session nahi hai. Study planner se pehla session shuru karo —
                poora hone par wo yahan dikhega.
              </p>
            ) : (
              history.slice(0, 10).map((session) => {
                const title = session.taskId
                  ? tasks.find((t) => t.id === session.taskId)?.title ?? (session.mode === 'focus' ? 'Focus session' : 'Break')
                  : (session.mode === 'focus' ? 'Focus session' : 'Break');
                const when = new Date(session.completedAt ?? session.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return (
                  <div className="srow" key={session.id}>
                    <span className="snum2">📚</span>
                    <div>{title}<small>{when}</small></div>
                    <b className="srow-right">{session.status === 'completed' ? `${session.focusMinutesEarned} min` : 'Abandoned · 0 min'}</b>
                  </div>
                );
              })
            )}
          </div>

          <div className="acard">
            <p className="mut" style={{ margin: 0 }}>
              Sach ye hai: web wala version doosri apps ko block nahi kar sakta — isliye yahan
              koi nakli "app block" button nahi hai. Asal app-blocking sirf Android version me
              hoga, wo bhi tumhari marzi se.
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
}) {
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
      setPointsHistoryError(err instanceof Error ? err.message : 'Points history load nahi ho payi.');
    } finally {
      setPointsHistoryLoading(false);
    }
  }

  const historyPanel = (
    <section className="panel history-card" style={{ marginTop: 14 }}>
      <SectionTitle title="Activity history" />
      <div>
        <span className="eyebrow">POINTS</span>
        {pointsHistoryLoading ? (
          <p className="onboarding-help">Loading your points history…</p>
        ) : pointsHistoryError ? (
          <>
            <p className="onboarding-help">{pointsHistoryError}</p>
            {rewards && rewards.recent.length > 0 && (
              <div className="history-list">
                {rewards.recent.map((entry) => (
                  <div className="history-row" key={entry.id}>
                    <div><strong>+{entry.amount} points</strong><small>{POINT_REASON_LABELS[entry.reason]} · {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : pointsHistory && pointsHistory.length > 0 ? (
          <div className="history-list">
            {pointsHistory.map((entry) => (
              <div className="history-row" key={entry.id}>
                <div><strong>+{entry.amount} points</strong><small>{POINT_REASON_LABELS[entry.reason]} · {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></div>
              </div>
            ))}
            {pointsHistoryTotal > pointsHistory.length && (
              <p className="onboarding-help">Showing latest {pointsHistory.length} of {pointsHistoryTotal} point awards.</p>
            )}
          </div>
        ) : (
          <p className="onboarding-help">No points earned yet. Finish a focus session, complete a task, or complete a challenge day to earn your first points.</p>
        )}
      </div>
      <div style={{ marginTop: 18 }}>
        <span className="eyebrow">FOCUS SESSIONS</span>
        {focusHistory.length === 0 ? (
          <p className="onboarding-help">No focus sessions yet. Finished and abandoned sessions will appear here with their real minutes.</p>
        ) : (
          <div className="history-list">
            {focusHistory.slice(0, 10).map((session) => (
              <div className="history-row" key={session.id}>
                <div>
                  <strong>{session.mode === 'focus' ? 'Focus' : 'Break'} · {session.plannedMinutes} min</strong>
                  <small>
                    {new Date(session.completedAt ?? session.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </small>
                </div>
                <span className={`status-tag ${session.status === 'completed' ? 'status-done' : ''}`}>
                  {session.status === 'completed' ? `${session.focusMinutesEarned}m earned` : 'Abandoned · 0m'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 18 }}>
        <span className="eyebrow">CHALLENGES</span>
        {activeChallenges.length === 0 && challengeHistory.length === 0 ? (
          <p className="onboarding-help">No challenges joined yet. Join one from the Challenges screen and your attempts will appear here.</p>
        ) : (
          <div className="history-list">
            {[...activeChallenges, ...challengeHistory].map((participation) => (
              <div className="history-row" key={participation.id}>
                <div>
                  <strong>{participation.challenge.title}</strong>
                  <small>
                    Day {participation.currentDay} of {participation.totalDays} · {participation.status === 'active' ? 'Active' : participation.status === 'completed' ? 'Completed' : 'Left'} · {participation.pointsEarned} points
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
      <button type="button" className="aback" onClick={onBack} aria-label="Wapas jao">
        <ChevronLeft size={20} />
      </button>
      <div>
        <h4>Analytics</h4>
        <div className="asub">Tumhari mehnat, gin kar</div>
      </div>
      <div className="aright">
        <button
          type="button"
          className="sbtn gh"
          aria-expanded={showHistory}
          onClick={() => void toggleHistory()}
        >
          <CalendarDays size={13} /> Activity history
        </button>
      </div>
    </div>
  );

  if (guestMode) {
    return (
      <section className="analytics-screen">
        {apphead}
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">SIGN IN TO TRACK</span>
          <h3>Your progress lives in your account</h3>
          <p className="onboarding-help">
            Sign in to see analytics from your saved study activity. Nothing is tracked in guest preview.
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
          <span className="eyebrow">PRIVATE ACTIVITY DATA</span>
          <h3>Loading your progress…</h3>
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

  // ---- Real per-period focus bars (completed focus sessions only) ----
  function formatHours(totalMinutes: number): string {
    if (totalMinutes < 60) return `${totalMinutes} min`;
    return `${parseFloat((totalMinutes / 60).toFixed(1))} gh`;
  }

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
      { label: 'Subah', test: (h: number) => h >= 5 && h < 11 },
      { label: 'Dopeher', test: (h: number) => h >= 11 && h < 16 },
      { label: 'Shaam', test: (h: number) => h >= 16 && h < 21 },
      { label: 'Raat', test: (h: number) => h >= 21 || h < 5 },
    ];
    bars = buckets.map((bucket) => ({
      label: bucket.label,
      value: completedFocus
        .filter((s) => (s.completedAt ?? s.startedAt).slice(0, 10) === todayKeyStr)
        .filter((s) => bucket.test(new Date(s.completedAt ?? s.startedAt).getHours()))
        .reduce((sum, s) => sum + s.focusMinutesEarned, 0),
      future: false,
    }));
    barsTitle = 'Focus — aaj (minute)';
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
    barsTitle = 'Padhai — is hafte (ghante)';
  } else {
    const buckets = [
      { label: 'Week 1', test: (d: number) => d >= 1 && d <= 7 },
      { label: 'Week 2', test: (d: number) => d >= 8 && d <= 14 },
      { label: 'Week 3', test: (d: number) => d >= 15 && d <= 21 },
      { label: 'Week 4', test: (d: number) => d >= 22 && d <= 28 },
      { label: 'Week 5', test: (d: number) => d >= 29 },
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
    barsTitle = 'Focus — is mahine (ghante)';
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
          <span className="eyebrow">PRIVATE ACTIVITY DATA</span>
          <h3>No analytics available yet</h3>
          <p className="onboarding-help">
            Complete a study task or finish a focus session and your real numbers will appear here.
            AHDORA will not display invented scores or public rankings.
          </p>
        </section>
      ) : (
        <>
          <div className="analytics-period">
            {([
              ['day', 'Din'],
              ['week', 'Hafta'],
              ['month', 'Mahina'],
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
                Is {period === 'day' ? 'din' : period === 'week' ? 'hafte' : 'mahine'} ka koi finished
                focus session nahi hai — graph khali hai, andaza nahi lagaya gaya.
              </p>
            ) : (
              <>
                <div className="wbars">
                  {bars.map((bar) => (
                    <div className="wb" key={bar.label}>
                      <em>{bar.future || bar.value === null ? '—' : period === 'day' ? `${bar.value}m` : formatHours(bar.value)}</em>
                      <i
                        className={bar.future ? 'wb-future' : bar.value === barsMax && barsMax > 0 ? 'wb-best' : ''}
                        style={{ height: `${bar.future || barsMax === 0 ? 6 : Math.max(8, Math.round(((bar.value ?? 0) / barsMax) * 100))}%` }}
                      />
                      <span>{bar.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mut" style={{ margin: '8px 0 0' }}>
                  Kul: <b>{formatHours(barsTotal)}</b>
                  {bestBar ? ` · sabse achha: ${bestBar.label}` : ''}
                  {period === 'month' ? ' · sirf pichhle 20 loaded sessions se (kam se kam)' : ''}
                </p>
              </>
            )}
          </div>

          <div className="acard-l analytics-summary">
            <div className="setrow"><div>🕌 Namaz<small>Aaj {prayedToday} / 5 padhi</small></div><b>{prayedToday}/5</b></div>
            <div className="setrow"><div>📚 Padhai<small>Aaj {stats.tasksCompletedToday} task poore · {formatHours(stats.todayFocusMinutes)} focus</small></div><b>{formatHours(stats.todayFocusMinutes)}</b></div>
            <div className="setrow"><div>🎯 Focus<small>Is hafte {completedFocus.length} finished sessions (loaded)</small></div><b>{formatHours(stats.weekFocusMinutes)}</b></div>
            <div className="setrow"><div>🌙 Neend ka schedule<small>{formatTime12h(sleepStartTime)} – {formatTime12h(sleepEndTime)}{sleepLabel ? ` · ${sleepLabel}` : ''} · schedule, asal neend nahi</small></div><b>Schedule</b></div>
            <div className="setrow"><div>🏆 Challenge<small>{firstChallenge ? `${firstChallenge.challenge.title} · Day ${firstChallenge.currentDay}` : 'Koi challenge active nahi'}</small></div><b>{challengePct === null ? '—' : `${challengePct}%`}</b></div>
          </div>

          <section className="panel progress-breakdown" style={{ marginTop: 14 }}>
            <SectionTitle title="Subjects this week" />
            {stats.subjectBreakdown.length === 0 ? (
              <p className="onboarding-help">No subjects yet. Add one from the Study planner.</p>
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
                />
              ))
            )}
          </section>
          <section className="panel progress-breakdown" style={{ marginTop: 14 }}>
            <SectionTitle title="Challenges & points" />
            <div className="analytics-grid" style={{ marginTop: 0 }}>
              <div className="panel metric-card">
                <span className="eyebrow">TOTAL POINTS</span>
                <strong>{rewards?.total ?? 0}</strong>
                <span className="metric-trend"><Zap size={13} /> From real activity only — never per prayer</span>
              </div>
              <div className="panel metric-card">
                <span className="eyebrow">BADGES EARNED</span>
                <strong>{rewards?.badges.length ?? 0}</strong>
                <span className="metric-trend"><Trophy size={13} /> {rewards && rewards.badges.length > 0 ? rewards.badges.map((b) => b.title).join(', ') : 'No badges yet'}</span>
              </div>
              <div className="panel metric-card">
                <span className="eyebrow">ACTIVE CHALLENGES</span>
                <strong>{activeChallenges.length}</strong>
                <span className="metric-trend"><Target size={13} /> {completedChallenges} completed in total</span>
              </div>
            </div>
            {rewards && rewards.recent.length > 0 && (
              <div className="challenge-progress-list" style={{ marginTop: 14 }}>
                {rewards.recent.map((entry) => (
                  <div className="challenge-progress-row" key={entry.id}>
                    <span className="challenge-day-dot done" />
                    <div><strong>+{entry.amount} points</strong><small>{POINT_REASON_LABELS[entry.reason]} · {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></div>
                  </div>
                ))}
              </div>
            )}
            {(!rewards || rewards.recent.length === 0) && (
              <p className="onboarding-help">No points yet. Finish a focus session, complete a task, or complete a challenge day to earn your first points.</p>
            )}
          </section>
          <p className="analytics-footnote">
            Study analytics are calculated only from your saved tasks and finished focus sessions.
            Challenge and points analytics come only from your saved activity and server-side awards.
            Salah analytics here show only today's count — weekly Salah reports are not connected yet,
            so no weekly percentage is invented.
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
  const displayName = user?.name || (guestMode ? 'Guest preview' : 'Your account');
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
    .join(' · ') || (user?.email ?? 'Preview without an account');
  const streak = studyStats?.streak ?? 0;

  // Settings rows in EXACTLY the preview's order. Sleep schedule is
  // kept as an extra row after Notifications (it existed before and
  // now points at the standalone Sleep screen, not Focus).
  const rows: { icon: string; title: string; detail: string; onClick: () => void; disabled?: boolean }[] = [
    { icon: '✏️', title: 'Apni details badlo', detail: 'Naam, course, college — onboarding wali details', onClick: () => onEditProfile(0), disabled: guestMode },
    { icon: '🕌', title: 'Namaz settings', detail: 'City, tareeqa (Hanafi), apne set time', onClick: () => onEditProfile(4), disabled: guestMode },
    { icon: '🔔', title: 'Notifications', detail: 'Categories aur quiet hours', onClick: () => setShowNotifSettings((open) => !open) },
    { icon: '🔑', title: 'Password badlo', detail: 'Email verification ke saath', onClick: () => setShowSecurity((open) => !open), disabled: guestMode },
    { icon: '🌙', title: 'Sleep schedule', detail: 'Neend ka time aur sleep focus', onClick: () => onNavigate('sleep') },
    { icon: '💬', title: 'Feedback / Shikayat', detail: 'Koi dikkat ho to seedha likho', onClick: onOpenFeedback },
    { icon: '↩', title: 'Onboarding dobara', detail: 'Details wapas step-by-step bharo', onClick: () => onEditProfile(0), disabled: guestMode },
  ];

  return (
    <section className="profile-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={() => onNavigate('home')} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Profile</h4>
          <div className="asub">Tumhara account, tumhare control me</div>
        </div>
      </div>

      <div className="profile-avatar">{initials}</div>
      <div className="profile-name">{displayName}</div>
      <div className="mut profile-college">{collegeLine}</div>
      <div className="profile-status">
        {user ? 'Authenticated account · Session active' : 'Guest preview · Not signed in'}
      </div>

      <div className="kpis">
        <div className="kpi"><b>{rewards?.total ?? 0}</b><span>POINTS</span></div>
        <div className="kpi"><b>{streak} din</b><span>STREAK</span></div>
        <div className="kpi"><b>{rewards?.badges.length ?? 0}</b><span>BADGES</span></div>
      </div>

      {onboardingIncomplete && !guestMode && (
        <button type="button" className="sbtn pk profile-complete-btn" onClick={() => onEditProfile(onboardingResumeStep)}>
          <UserRound size={15} /> Profile poora karo
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
          <div>🌐 Language · Bhasha<small>Login aur onboarding ki bhasha</small></div>
          <div className="lang-switch" role="group" aria-label="Language">
            <button type="button" className={language === 'en' ? 'selected' : ''} onClick={() => onLanguageChange('en')}>English</button>
            <button type="button" className={language === 'hi' ? 'selected' : ''} onClick={() => onLanguageChange('hi')}>Hinglish</button>
          </div>
        </div>
        {showNotifSettings && (
          <div className="profile-panel">
            {guestMode ? (
              <p className="onboarding-help">Sign in to change notification preferences.</p>
            ) : (
              <NotificationSettingsPanel onNotify={onNotify} />
            )}
          </div>
        )}
        {showSecurity && (
          <div className="profile-panel">
            {guestMode || !user ? (
              <p className="onboarding-help">Sign in to change security settings.</p>
            ) : (
              <SecuritySettings onNotify={onNotify} emailVerified={user.emailVerified} onAccountDeleted={onAccountDeleted} />
            )}
          </div>
        )}
      </div>

      <div className="acard">
        <button type="button" className="setrow" onClick={onLogout}>
          <div>🚪 Logout</div>
          <span className="chev">›</span>
        </button>
        <button
          type="button"
          className="setrow danger"
          disabled={guestMode}
          onClick={() => { setShowSecurity(true); setDeleteHint(true); }}
        >
          <div>🗑 Account delete karo<small>Saara data hamesha ke liye mit jayega</small></div>
          <span className="chev">›</span>
        </button>
        {deleteHint && !guestMode && (
          <p className="onboarding-help profile-delete-hint">
            Account delete karne ke liye upar khule Security panel me password daalo aur confirm
            karo — wahi purana confirm flow hai, yahan se seedha delete nahi hota.
          </p>
        )}
        {guestMode && (
          <p className="onboarding-help">Guest preview me account delete nahi hota — sign in karo.</p>
        )}
      </div>
    </section>
  );
}

export default App;