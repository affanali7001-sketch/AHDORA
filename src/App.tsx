import SalahTracker from './components/SalahTracker';
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
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from './lib/notificationsApi';
import { useEffect, useMemo, useRef, useState } from 'react';
import Onboarding from './components/Onboarding';
import { emptyProfile, type UserProfile } from './types/profile';
import { loadProfile, saveProfile } from './lib/profileApi';
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
  fetchRewardsSummary,
  POINT_REASON_LABELS,
  type RewardsSummary,
} from './lib/rewardsApi';
import { apiFetch, clearCsrfToken } from './lib/http.js';
import type { CSSProperties, ReactNode, FormEvent } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, BookMarked,
  CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Compass, Flame, Footprints, GraduationCap, Heart, Home, LayoutDashboard, Lock,
  LockKeyhole, LogOut, Menu, Moon, MoreHorizontal, Plus, Search, Settings, Shield,
  ShieldCheck, Sparkles, Sun, Target, Timer, Trophy, UserRound, Users, X, Zap,
} from 'lucide-react';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="16" fill="%23d9b36c"/%3E%3Cpath d="M16 45 32 15l16 30h-8l-3.2-7H27.2L24 45h-8Zm14-14-2.8 6h5.6L30 31Z" fill="%23343d35"/%3E%3C/svg%3E';

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

type Page = 'dashboard' | 'deen' | 'study' | 'challenges' | 'friends' | 'guidance' | 'focus' | 'analytics' | 'profile';

type GuidanceTab = 'quran' | 'duas' | 'hijri' | 'mosques';
type IconType = typeof Home;



const navItems: { id: Page; label: string; icon: IconType; group: string }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { id: 'deen', label: 'Deen & Salah', icon: Compass, group: 'Workspace' },
  { id: 'study', label: 'Study planner', icon: GraduationCap, group: 'Workspace' },
  { id: 'challenges', label: 'Challenges', icon: Trophy, group: 'Community' },
  { id: 'friends', label: 'Friends', icon: Users, group: 'Community' },
  { id: 'guidance', label: 'Quranic guidance', icon: BookOpen, group: 'Community' },
  { id: 'focus', label: 'Focus & sleep', icon: LockKeyhole, group: 'Tools' },
  { id: 'analytics', label: 'My progress', icon: Activity, group: 'Tools' },
  { id: 'profile', label: 'Profile & settings', icon: UserRound, group: 'Tools' },
];

const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function todayKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function countdownTo(time: string, now: Date): string {
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
  const [screen, setScreen] = useState<'checking' | 'welcome' | 'login' | 'forgot' | 'reset' | 'onboarding' | 'app'>('checking');
  const [resetToken, setResetToken] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [guidanceTab, setGuidanceTab] = useState<GuidanceTab>('quran');
  const [guidanceSurah, setGuidanceSurah] = useState<number | null>(null);
  const [newUser, setNewUser] = useState<UserProfile>(() => emptyProfile());
  const [profileName, setProfileName] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  async function hydrateProfile(user: AuthUser) {
    setAuthUser(user);
    setProfileName(user.name);
    try {
      const saved = await loadProfile(user.name, user.email);
      if (saved) {
        setNewUser(saved);
        setScreen('app');
      } else {
        setNewUser(emptyProfile(user.name, user.email));
        setScreen('onboarding');
      }
    } catch (error) {
      // A missing /api/profile route is not treated as a completed profile.
      setNewUser(emptyProfile(user.name, user.email));
      setScreen('onboarding');
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
    if (screen === 'app' && authUser && !guestMode && page === 'dashboard') {
      refreshSalahToday();
    }
    if (screen === 'app' && authUser && !guestMode && (page === 'dashboard' || page === 'study' || page === 'analytics')) {
      refreshStudy();
    }
    if (screen === 'app' && authUser && !guestMode && (page === 'dashboard' || page === 'challenges' || page === 'analytics')) {
      refreshChallenges();
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
          const saved = await loadProfile(user.name, user.email);
          if (!active) return;
          if (saved) {
            setNewUser(saved);
            setScreen('app');
          } else {
            setNewUser(emptyProfile(user.name, user.email));
            setScreen('onboarding');
          }
        } catch {
          if (!active) return;
          setNewUser(emptyProfile(user.name, user.email));
          setScreen('onboarding');
        }
      })
      .catch(() => { if (active) setScreen('welcome'); });
    return () => { active = false; };
  }, []);

  const filteredNav = useMemo(() => {
    if (!query.trim()) return navItems;
    return navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const goTo = (next: Page) => {
    setPage(next);
    setScreen('app');
    setMobileNav(false);
    setSearchOpen(false);
  };

  const goToGuidance = (tab: GuidanceTab, surahNumber?: number) => {
    setGuidanceTab(tab);
    setGuidanceSurah(surahNumber ?? null);
    goTo('guidance');
  };

  async function handleLogin(email: string, password: string) {
    const result = await apiRequest<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await hydrateProfile(result.user);
  }

  async function handleSignup(user: { name: string; email: string; password: string }) {
    const result = await apiRequest<{ user: AuthUser }>('/api/auth/signup', {
      method: 'POST', body: JSON.stringify(user),
    });
    setAuthUser(result.user);
    setProfileName(result.user.name);
    setNewUser(emptyProfile(result.user.name, result.user.email));
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
      setPrayerStatus('idle');
      setPrayerTimes(null);
      setScreen('app');
      notify('Profile MongoDB API par save ho gayi.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Profile save nahi ho payi.');
      throw error;
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
    setProfileName('');
    setNewUser(emptyProfile());
    setPrayerTimes(null);
    setPrayerStatus('idle');
    setSalahToday({});
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
    setNotifOpen(false);
    setFriendsRefreshKey(0);
    disconnectSocket();
    setScreen('welcome');
    setPage('dashboard');
  }

  function handleAccountDeleted() {
    clearCsrfToken();
    setAuthUser(null);
    setGuestMode(false);
    setProfileName('');
    setNewUser(emptyProfile());
    setScreen('welcome');
    setPage('dashboard');
    notify('Your account and all its data were deleted.');
  }

  async function handleResendVerification() {
    try {
      const result = await apiRequest<{ sent?: boolean; alreadyVerified?: boolean }>('/api/auth/verify-email', { method: 'POST' });
      if (result.alreadyVerified) {
        setAuthUser((current) => (current ? { ...current, emailVerified: true } : current));
        notify('Your email is already verified.');
      } else {
        notify('Verification email sent. Check your inbox.');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not send the verification email.');
    }
  }

  const displayName = authUser?.name || profileName || 'Guest';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'AH';

  if (screen === 'checking') {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><img src={logo} alt="AHDORA" /><span>AHDORA</span></div><p>Checking your secure session...</p></div></div>;
  }
  if (screen === 'welcome') {
    return <Welcome onContinue={() => setScreen('login')} onExplore={() => { setGuestMode(true); setProfileName('Guest'); setScreen('app'); }} />;
  }
  if (screen === 'login') {
    return <Login onBack={() => setScreen('welcome')} onLogin={handleLogin} onSignup={handleSignup} onForgot={() => setScreen('forgot')} />;
  }
  if (screen === 'forgot') {
    return <ForgotPassword onBack={() => setScreen('login')} onSent={() => notify('If an account exists for this email, a reset link has been sent.')} />;
  }
  if (screen === 'reset') {
    return <ResetPassword token={resetToken} onDone={() => { setResetToken(''); setScreen('login'); notify('Password reset. Please log in with your new password.'); }} onBack={() => { setResetToken(''); setScreen('login'); }} />;
  }
  if (screen === 'onboarding') {
    return <Onboarding user={newUser} onChange={setNewUser} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><img src={logo} alt="AHDORA logo" /><div><strong>AHDORA</strong><span>DEEN · ILM · DISCIPLINE</span></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="workspace-switch"><span className="workspace-dot" /><span>Personal space</span><ChevronDown size={14} /></div>
        {['Workspace', 'Community', 'Tools'].map((group) => <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{navItems.filter((item) => item.group === group).map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => goTo(item.id)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'challenges' && activeChallenges.length > 0 && <span className="nav-count">{activeChallenges.length}</span>}</button>; })}</div>)}
        <div className="sidebar-bottom"><div className="sidebar-quote"><Sparkles size={15} /><p>Small steps, sincere intentions, steady growth.</p></div><button className="profile-mini" onClick={() => goTo('profile')}><div className="avatar">{initials}</div><div><strong>{displayName}</strong><span>Personal account</span></div><MoreHorizontal size={17} /></button></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><span className="demo-pill"><span />{authUser ? 'SECURE SESSION' : 'GUEST PREVIEW'}</span><button className="icon-button search-trigger" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search"><Search size={18} /></button><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => { setNotifOpen((open) => !open); if (!notifOpen) refreshNotifications(); }} aria-label="Notifications"><Bell size={18} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>{notifOpen && <div className="notification-panel"><div className="notification-panel-head"><strong>Notifications</strong>{unreadCount > 0 && <button onClick={async () => { try { await markAllNotificationsRead(); await refreshNotifications(); } catch { notify('Could not mark all as read.'); } }}>Mark all read</button>}</div>{!authUser || guestMode ? <p className="onboarding-help">Notifications dekhne ke liye sign in karo.</p> : notifications.length === 0 ? <p className="onboarding-help">Abhi koi notification nahi hai. Namaz, padhai, neend aur challenge ki notifications yahan dikhengi.</p> : <div className="notification-list">{notifications.map((item) => <button key={item.id} className={`notification-item ${item.read ? 'notification-read' : ''}`} onClick={async () => { if (!item.read) { try { await markNotificationRead(item.id); await refreshNotifications(); } catch { notify('Could not mark as read.'); } } }}><span className="notification-dot" /><span><strong>{item.title}</strong><small>{item.body}</small><small>{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span></button>)}</div>}</div>}</div><button className="top-avatar" onClick={() => goTo('profile')}>{initials}</button></div></header>
        {searchOpen && <div className="search-popover"><Search size={17} /><input autoFocus placeholder="Search AHDORA pages..." value={query} onChange={(e) => setQuery(e.target.value)} /><button onClick={() => { setQuery(''); setSearchOpen(false); }}><X size={16} /></button><div className="search-results">{filteredNav.map((item) => <button key={item.id} onClick={() => goTo(item.id)}>{item.label}<ArrowUpRight size={14} /></button>)}</div></div>}
        {authUser && !authUser.emailVerified && !guestMode && (
          <div className="verify-banner">
            <Shield size={16} />
            <span>Your email is not verified yet. Some account features need verification.</span>
            <button className="text-button" onClick={handleResendVerification}>Resend verification email</button>
          </div>
        )}
        <div className="page-content">
          {page === 'dashboard' && <Dashboard userName={profileName || 'there'} onNavigate={goTo} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} onPrayerToggle={() => goTo('deen')} subjects={subjects} todayTasks={todayTasks} studyStats={studyStats} guestMode={guestMode} activeChallenges={activeChallenges} rewards={rewards} />}
          {page === 'deen' && <Deen onNotify={notify} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} onOpenGuidance={goToGuidance} />}
          {page === 'study' && <Study subjects={subjects} tasks={tasks} todayTasks={todayTasks} schedule={todaySchedule} stats={studyStats} activeSession={activePomodoro} history={pomodoroHistory} studyError={studyError} guestMode={guestMode} profile={newUser} onRefresh={refreshStudy} onNotify={notify} />}
          {page === 'challenges' && <Challenges onNotify={notify} onRefresh={refreshChallenges} guestMode={guestMode} />}
          {page === 'friends' && <Friends onNotify={notify} refreshKey={friendsRefreshKey} guestMode={guestMode} />}
          {page === 'guidance' && <Guidance onNotify={notify} tab={guidanceTab} onTabChange={setGuidanceTab} guestMode={guestMode} profileCity={newUser.city} initialSurah={guidanceSurah} onInitialSurahOpened={() => setGuidanceSurah(null)} onOpenSurah={(surahNumber) => goToGuidance('quran', surahNumber)} />}
          {page === 'focus' && <Focus sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} focusEnabled={focusEnabled} setFocusEnabled={setFocusEnabled} youtubeAllowed={youtubeAllowed} setYoutubeAllowed={setYoutubeAllowed} onNotify={notify} />}
          {page === 'analytics' && <Analytics stats={studyStats} guestMode={guestMode} rewards={rewards} activeChallenges={activeChallenges} challengeHistory={challengeHistory} />}
          {page === 'profile' && <Profile onNotify={notify} user={authUser} guestMode={guestMode} onLogout={handleLogout} onAccountDeleted={handleAccountDeleted} />}
        </div>
        <footer className="app-footer"><span>© 2026 AHDORA</span><span>Built around what matters.</span><button onClick={() => notify('Help centre will be connected in a later phase.')}><CircleHelp size={14} /> Help & feedback</button></footer>
      </main>
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );
}

function Welcome({ onContinue, onExplore }: { onContinue: () => void; onExplore: () => void }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-nav">
        <div className="welcome-brand">
          <img src={logo} alt="" />
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
}: {
  onBack: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (user: { name: string; email: string; password: string }) => Promise<void>;
  onForgot: () => void;
}) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;
    setError('');

    if (!email.trim() || !password) {
      setError('Email aur password dono bharna zaroori hai.');
      return;
    }

    if (tab === 'signup') {
      if (name.trim().length < 2) {
        setError('Apna naam sahi se enter karo.');
        return;
      }

      if (password.length < 12) {
        setError('Password kam se kam 12 characters ka rakho.');
        return;
      }

      setBusy(true);

      try {
        await onSignup({ name: name.trim(), email: email.trim(), password });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Account create nahi ho paya.');
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);

      try {
        await onLogin(email.trim(), password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login nahi ho paya.');
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="auth-screen">
      <button className="back-link" onClick={onBack}>
        <ArrowRight className="back-arrow" size={16} /> Back to welcome
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt="AHDORA" />
          <span>AHDORA</span>
        </div>

        <div className="auth-heading">
          <span className="eyebrow">YOUR SPACE, YOUR PACE</span>
          <h1>{tab === 'login' ? 'Welcome back.' : 'Begin with intention.'}</h1>
          <p>{tab === 'login' ? 'Pick up where you left off.' : 'Create your personal AHDORA space.'}</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === 'login' ? 'selected' : ''}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={tab === 'signup' ? 'selected' : ''}
            onClick={() => { setTab('signup'); setError(''); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'signup' && (
            <>
              <label className="field-label">Your name</label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                required
              />
            </>
          )}

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

          <label className="field-label">Password</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === 'signup' ? 'Minimum 12 characters' : 'Your password'}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            required
          />

          {error && <p style={{ color: '#c45b52', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <button type="submit" className="primary-button full-width" disabled={busy}>
            {busy ? 'Please wait...' : tab === 'login' ? 'Log in' : 'Create account'}
            <ArrowRight size={16} />
          </button>
        </form>

        {tab === 'login' && (
          <button type="button" className="text-button" onClick={onForgot} style={{ marginTop: 12 }}>
            Forgot your password?
          </button>
        )}

        <div className="auth-notice">
          <Shield size={15} />
          <span>
            Secure session is handled by the AHDORA API. Use a unique password. Email verification is available once email sending is set up on the server — until then the app will tell you it is not configured.
          </span>
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
          <img src={logo} alt="AHDORA" />
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
            {error && <p style={{ color: '#c45b52', fontSize: 13, marginTop: 12 }}>{error}</p>}
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
      setError('Passwords do not match.');
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
          <img src={logo} alt="AHDORA" />
          <span>AHDORA</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">RESET PASSWORD</span>
          <h1>Choose a new password.</h1>
          <p>Your reset link is valid for 1 hour and can be used only once.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="field-label">New password</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 12 characters"
            autoComplete="new-password"
            required
          />
          <label className="field-label">Confirm new password</label>
          <input
            className="form-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat the new password"
            autoComplete="new-password"
            required
          />
          {error && <p style={{ color: '#c45b52', fontSize: 13, marginTop: 12 }}>{error}</p>}
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

function PrayerTimesPanel({
  prayerTimes,
  prayerStatus,
  prayerError,
}: {
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
}) {
  if (prayerStatus === 'loading' || prayerStatus === 'idle') {
    return (
      <section className="panel prayer-panel">
        <div className="panel-top"><div><span className="eyebrow">DEEN &amp; SALAH</span><h3>Prayer times</h3></div></div>
        <p className="onboarding-help">Loading prayer times…</p>
      </section>
    );
  }
  if (prayerStatus === 'no-city') {
    return (
      <section className="panel prayer-panel">
        <div className="panel-top"><div><span className="eyebrow">DEEN &amp; SALAH</span><h3>Prayer times</h3></div></div>
        <p className="onboarding-help">Add your city in Profile to see prayer times.</p>
      </section>
    );
  }
  if (prayerStatus === 'error' || !prayerTimes) {
    return (
      <section className="panel prayer-panel">
        <div className="panel-top"><div><span className="eyebrow">DEEN &amp; SALAH</span><h3>Prayer times</h3></div></div>
        <p className="onboarding-help">{prayerError || 'Prayer times could not be loaded. Check your connection / city.'}</p>
      </section>
    );
  }
  return (
    <section className="panel prayer-panel">
      <div className="panel-top">
        <div>
          <span className="eyebrow">DEEN &amp; SALAH</span>
          <h3>Prayer times · {prayerTimes.city}</h3>
        </div>
        {prayerTimes.hijri?.date && <span className="date-chip small-date">{prayerTimes.hijri.date} {prayerTimes.hijri.month} {prayerTimes.hijri.year}</span>}
      </div>
      <div className="prayer-list">
        {prayerNames.map((name) => (
          <div className="prayer-item" key={name}>
            <span>{name}</span>
            <strong>{formatTime12h(prayerTimes.timings[name as keyof typeof prayerTimes.timings])}</strong>
            {prayerTimes.perPrayer[name as keyof typeof prayerTimes.perPrayer]?.source === 'manual' && <small>Manual</small>}
          </div>
        ))}
        <div className="prayer-item">
          <span>Sunrise</span>
          <strong>{formatTime12h(prayerTimes.timings.Sunrise)}</strong>
        </div>
      </div>
      <div className="demo-caption">Source: Aladhan · {prayerTimes.method} · {prayerTimes.city}</div>
    </section>
  );
}

function Dashboard({
  userName,
  onNavigate,
  prayerTimes,
  prayerStatus,
  prayerError,
  salahToday,
  onPrayerToggle,
  subjects,
  todayTasks,
  studyStats,
  guestMode,
  activeChallenges,
  rewards,
}: {
  userName: string;
  onNavigate: (page: Page) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  onPrayerToggle: (name: string) => void;
  subjects: StudySubject[];
  todayTasks: StudyTask[];
  studyStats: StudyStats | null;
  guestMode: boolean;
  activeChallenges: ChallengeParticipation[];
  rewards: RewardsSummary | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const prayedNames = prayerNames.filter((name) => salahToday[name]?.status === 'prayed');
  const prayedCount = prayedNames.length;
  const completionPct = Math.round((prayedCount / prayerNames.length) * 100);
  const nextPrayer = prayerTimes?.nextPrayer ?? null;
  const nextCountdown = nextPrayer ? countdownTo(nextPrayer.time, now) : '';
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const tasksCompletedToday = studyStats?.tasksCompletedToday ?? 0;
  const todayFocusMinutes = studyStats?.todayFocusMinutes ?? 0;
  const streak = studyStats?.streak ?? 0;
  const hasActivity = prayedCount > 0 || tasksCompletedToday > 0 || todayFocusMinutes > 0;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <>
      <div className="welcome-line">
        <div>
          <span className="eyebrow">{todayLabel.toUpperCase()}</span>
          <h1>Assalamu alaikum, {userName} <span className="wave">✦</span></h1>
          <p>Make today count, without rushing it.</p>
        </div>
        <div className="date-chip"><CalendarDays size={16} /> {todayLabel}</div>
      </div>

      <div className="dashboard-grid">
        <section className="panel hero-panel">
          <div className="hero-panel-content">
            <span className="eyebrow light-eyebrow"><Sparkles size={13} /> YOUR DAILY REMINDER</span>
            <h2>Progress is built<br />one sincere step<br /><em>at a time.</em></h2>
            <p>Keep your intentions clear and your effort consistent.</p>
            <button className="gold-button" onClick={() => onNavigate('guidance')}>
              Explore guidance <ArrowRight size={15} />
            </button>
          </div>
          <div className="hero-panel-art">
            <div className="tiny-crescent">☾</div>
            <div className="arch arch-one" />
            <div className="arch arch-two" />
            <div className="arch arch-three" />
            <div className="hero-horizon" />
          </div>
        </section>

        <section className="panel daily-progress">
          <div className="panel-top">
            <span className="eyebrow">TODAY'S OVERVIEW</span>
            <MoreHorizontal size={17} />
          </div>
          <div className="progress-main">
            <div>
              <strong>{hasActivity ? 'Today so far' : 'Your activity will appear here.'}</strong>
              <span>
                {hasActivity
                  ? `${prayedCount} of 5 prayers · ${tasksCompletedToday} task${tasksCompletedToday === 1 ? '' : 's'} completed · ${todayFocusMinutes}m focused`
                  : 'Complete a Salah check-in or add a study task to start tracking progress.'}
              </span>
              <small><ArrowUpRight size={13} /> {hasActivity ? (streak > 0 ? `${streak}-day streak — a day counts when a focus session finishes or a task is completed.` : 'No streak yet — finish a focus session or a task.') : 'No activity recorded yet'}</small>
            </div>
          </div>
          <div className="progress-footer"><span>Keep showing up.</span><span>{hasActivity ? `${completionPct}% prayers` : 'Not enough data'}</span></div>
        </section>

        <section className="panel prayer-panel">
          <div className="panel-top">
            <div>
              <span className="eyebrow">DEEN & SALAH</span>
              <h3>Prayer check-in</h3>
            </div>
            <button className="subtle-action" onClick={() => onNavigate('deen')}>
              View all <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="prayer-summary">
            <div className="prayer-next-icon"><Moon size={18} /></div>
            <div>
              <small>PRAYER TIMES</small>
              {prayerStatus === 'loaded' && prayerTimes ? (
                <>
                  <strong>{nextPrayer ? `Next: ${nextPrayer.name} · ${formatTime12h(nextPrayer.time)}` : 'All prayers passed for today'}</strong>
                  <small>{nextCountdown || `${prayedCount} of 5 prayed · ${completionPct}%`}</small>
                </>
              ) : prayerStatus === 'loading' || prayerStatus === 'idle' ? (
                <>
                  <strong>Loading prayer times…</strong>
                  <small>Open Deen &amp; Salah to record your prayers.</small>
                </>
              ) : prayerStatus === 'no-city' ? (
                <>
                  <strong>Set up your city</strong>
                  <small>Add your city in Profile to see prayer times.</small>
                </>
              ) : (
                <>
                  <strong>Prayer times unavailable</strong>
                  <small>{prayerError || 'Check your connection / city.'}</small>
                </>
              )}
            </div>
            <div className="prayer-location"><Compass size={13} /> {prayerTimes?.city ?? 'Profile settings'}</div>
          </div>
          <div className="prayer-list">
            {prayerNames.map((name) => (
              <button
                className="prayer-item"
                key={name}
                onClick={() => onPrayerToggle(name)}
              >
                <span className={`prayer-check ${prayedNames.includes(name) ? 'checked' : ''}`}>
                  {prayedNames.includes(name) && <Check size={11} />}
                </span>
                <span>{name}</span>
                <strong>{prayerStatus === 'loaded' && prayerTimes ? formatTime12h(prayerTimes.timings[name as keyof typeof prayerTimes.timings]) : 'Open tracker'}</strong>
              </button>
            ))}
          </div>
          {prayerStatus === 'loaded' && prayerTimes ? (
            <div className="demo-caption">Source: Aladhan · {prayerTimes.method} · {prayerTimes.city} · {prayedCount} of 5 prayed</div>
          ) : prayerStatus === 'error' ? (
            <div className="demo-caption">{prayerError || 'Prayer times could not be loaded. Check your connection / city.'}</div>
          ) : null}
        </section>

        <section className="panel study-panel">
          <div className="panel-top">
            <div>
              <span className="eyebrow">ILM · STUDY</span>
              <h3>Today's focus</h3>
            </div>
            <button className="subtle-action" onClick={() => onNavigate('study')}>
              Open planner <ArrowUpRight size={13} />
            </button>
          </div>
          {guestMode ? (
            <p className="onboarding-help">Sign in to track your study tasks and focus time.</p>
          ) : (
            <>
              <div className="study-stat-row">
                <div><strong>{tasksCompletedToday}</strong><span>Completed today</span></div>
                <div className="study-stat-divider" />
                <div><strong>{todayFocusMinutes}m</strong><span>Focused today</span></div>
                <div className="study-stat-divider" />
                <div><strong>{streak}d</strong><span>Day streak</span></div>
              </div>
              <div className="task-list compact">
                {todayTasks.length === 0 && (
                  <p className="onboarding-help">No tasks for today yet. Add one from the Study planner.</p>
                )}
                {todayTasks.slice(0, 3).map((task) => (
                  <div className="task-row" key={task.id}>
                    <span className={`task-dot ${subjectById.get(task.subjectId ?? '')?.colour ?? 'mint'}`} />
                    <div><strong>{task.title}</strong><small>{task.startTime ? formatTime12h(task.startTime) : 'Not scheduled'}{task.subjectId ? ` · ${subjectById.get(task.subjectId)?.name ?? 'No subject'}` : ''}</small></div>
                    <span className={`status-tag ${task.status === 'Completed' ? 'status-done' : task.status === 'In Progress' ? 'status-live' : ''}`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel habits-panel">
          <div className="panel-top">
            <div>
              <span className="eyebrow">DISCIPLINE</span>
              <h3>Daily intentions</h3>
            </div>
            <button className="subtle-action" onClick={() => onNavigate('analytics')}>
              See progress <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="habit-list"><p className="onboarding-help">Habit tracking is not enabled yet. No check-ins are shown.</p></div>
          <div className="habit-bottom">
            <Flame size={15} />
            <span>Saved activity will appear as you build your rhythm.</span>
          </div>
        </section>

        <section className="panel challenge-teaser">
          <div className="challenge-bg-shape" />
          <div className="panel-top">
            <span className="eyebrow">CHALLENGES · POINTS</span>
            <Trophy size={18} />
          </div>
          <div className="challenge-teaser-copy">
            <h3>{activeChallenges[0] ? activeChallenges[0].challenge.title : 'Grow better, together.'}</h3>
            <p>
              {activeChallenges[0]
                ? `Day ${activeChallenges[0].currentDay} of ${activeChallenges[0].totalDays} · ${activeChallenges[0].completedDays} day${activeChallenges[0].completedDays === 1 ? '' : 's'} done · ${activeChallenges[0].pointsEarned} pts from this challenge`
                : 'Choose a healthy challenge and keep yourself accountable.'}
            </p>
            {rewards && (
              <p className="challenge-points-line">
                <Zap size={13} /> {rewards.total} points earned
                {rewards.badges.length > 0 && ` · ${rewards.badges.length} badge${rewards.badges.length === 1 ? '' : 's'}: ${rewards.badges.map((b) => b.title).join(', ')}`}
              </p>
            )}
            <button className="outline-gold" onClick={() => onNavigate('challenges')}>
              {activeChallenges.length > 0 ? 'View my challenges' : 'Explore challenges'} <ArrowRight size={14} />
            </button>
          </div>
          <div className="challenge-avatars"><span>{activeChallenges.length > 0 ? `${activeChallenges.length} active challenge${activeChallenges.length === 1 ? '' : 's'}` : 'Private until you invite someone.'}</span></div>
        </section>
      </div>
    </>
  );
}

function HabitItem({ icon: Icon, title, meta, done }: { icon: IconType; title: string; meta: string; done?: boolean }) {
  return (
    <div className="habit-row">
      <div className="habit-icon"><Icon size={16} /></div>
      <div className="habit-copy"><strong>{title}</strong><small>{meta}</small></div>
      <span className={`habit-tick ${done ? 'is-done' : ''}`}>{done && <Check size={12} />}</span>
    </div>
  );
}

function QuranDuas() {
  return (
    <section className="panel quran-duas-card">
      <div className="panel-top">
        <div>
          <span className="eyebrow">QURANIC GUIDANCE</span>
          <h3>A dua for today</h3>
        </div>
        <BookOpen size={18} />
      </div>
      <p className="dua-text">“My Lord, increase me in knowledge.”</p>
      <span className="dua-reference">Surah Ta-Ha · 20:114</span>
    </section>
  );
}

function Deen({ onNotify, prayerTimes, prayerStatus, prayerError, onOpenGuidance }: {
  onNotify: (message: string) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  onOpenGuidance: (tab: GuidanceTab, surahNumber?: number) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="DEEN · DAILY PRACTICE"
        title="Make room for what matters."
        text="Your personal Salah record and Qur'anic supplications."
      />

      <PrayerTimesPanel prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} />

      <SalahTracker onNotify={onNotify} />

      <QuranDuas />

      <div className="deen-grid">
        <section className="panel deen-quick-card">
          <SectionTitle title="Your daily practice" />
          <div className="quick-grid">
            <QuickTile icon={BookMarked} title="Duas" text="Verified supplications" onClick={() => onOpenGuidance('duas')} />
            <QuickTile icon={CalendarDays} title="Islamic calendar" text="Dates & occasions" onClick={() => onOpenGuidance('hijri')} />
            <QuickTile icon={Compass} title="Find a masjid" text="Nearby places" onClick={() => onOpenGuidance('mosques')} />
          </div>
        </section>

        <section className="panel deen-reflection">
          <span className="eyebrow">A MOMENT TO REFLECT</span>
          <div className="reflection-mark">“</div>
          <h3>Consistency is not about never missing a day. It is about returning with sincerity.</h3>
          <p>AHDORA reflection · Original reminder, not a Quranic quotation.</p>
          <button className="text-button" onClick={() => onNotify('Reflection saved in this demo only.')}>
            <Heart size={15} /> Save reflection
          </button>
        </section>
      </div>
    </>
  );
}

function QuickTile({ icon: Icon, title, text, onClick }: { icon: IconType; title: string; text: string; onClick: () => void }) {
  return (
    <button className="quick-tile" onClick={onClick}>
      <div><Icon size={18} /></div>
      <strong>{title}</strong>
      <span>{text}</span>
      <ArrowUpRight size={13} className="quick-arrow" />
    </button>
  );
}

const subjectColours = ['mint', 'gold', 'blue', 'rose', 'violet'];

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
    }
  }

  async function changeStatus(task: StudyTask, status: TaskStatus) {
    try {
      await setTaskStatus(task.id, status);
      await onRefresh();
      onNotify(status === 'Completed' ? 'Task completed.' : `Task marked ${status}.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Task update nahi ho paya.');
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
    }
  }

  async function handlePauseTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    try {
      await pausePomodoro(activeSession.id);
      await onRefresh();
      onNotify('Session paused.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session pause nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    try {
      await resumePomodoro(activeSession.id);
      await onRefresh();
      onNotify('Session resumed.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session resume nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    try {
      await completePomodoro(activeSession.id);
      await onRefresh();
      onNotify('Session finished.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session complete nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAbandonTimer() {
    if (!activeSession || busy) return;
    setBusy(true);
    try {
      await abandonPomodoro(activeSession.id);
      setConfirmReset(false);
      await onRefresh();
      onNotify('Session reset. It stays in history as abandoned (0 min).');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session reset nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  const breakPresets = Array.from(new Set([breakDefault, 5, 10, 15])).sort((a, b) => a - b);

  return (
    <>
      <PageHeading
        eyebrow="ILM · LEARNING SYSTEM"
        title="Make your focus count."
        text="Plan your study sessions, protect your attention and keep your learning visible."
        action={<button className="primary-button" onClick={() => openTaskModal()}><Plus size={16} /> Add study task</button>}
      />

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
              <h3>Today's study plan</h3>
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

          <div className="task-list full-task-list">
            {todayTasks.length === 0 && (
              <p className="onboarding-help">No tasks for today yet. Add your first task to start tracking.</p>
            )}
            {todayTasks.map((task) => {
              const subject = task.subjectId ? subjectById.get(task.subjectId) : undefined;
              return (
                <div className="task-row large-task" key={task.id}>
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
                        {task.status !== 'In Progress' && <button onClick={() => changeStatus(task, 'In Progress')}>Start</button>}
                        <button onClick={() => changeStatus(task, 'Completed')}>Complete</button>
                      </>
                    )}
                    {task.status === 'Completed' && <button onClick={() => changeStatus(task, 'Pending')}>Reopen</button>}
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
                Start {timerMode === 'focus' ? 'focus' : 'break'} session <ArrowRight size={15} />
              </button>
            </>
          )}
          {activeSession && (
            <div className="timer-actions">
              {activeSession.status === 'active' ? (
                <button className="primary-button full-width" disabled={busy} onClick={handlePauseTimer}>
                  <Timer size={15} /> Pause session
                </button>
              ) : (
                <button className="primary-button full-width" disabled={busy} onClick={handleResumeTimer}>
                  Resume session <ArrowRight size={15} />
                </button>
              )}
              <button className="outline-button full-width" disabled={busy} onClick={handleCompleteTimer}>
                Finish now
              </button>
              {confirmReset ? (
                <button className="outline-button full-width" disabled={busy} onClick={handleAbandonTimer}>
                  Confirm reset — session stays in history as abandoned (0 min)
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
                {subjectForm.id ? 'Save subject' : 'Add subject'}
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
              {taskModal.task ? 'Save changes' : 'Add task'} <ArrowRight size={16} />
            </button>
            <p className="modal-note">Tasks are saved to your account in MongoDB and stay in sync across devices.</p>
          </div>
        </div>
      )}
    </>
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
}: {
  onNotify: (message: string) => void;
  onRefresh: () => void;
  guestMode: boolean;
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
      <>
        <PageHeading
          eyebrow="CHALLENGE · DETAIL"
          title={challenge.title}
          text={challenge.description || 'A challenge you joined.'}
          action={<button className="outline-button" onClick={() => setDetail(null)}>← All challenges</button>}
        />
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
      </>
    );
  }

  /* ---------------- List view ---------------- */

  return (
    <>
      <PageHeading
        eyebrow="COMMUNITY · ACCOUNTABILITY"
        title="Progress feels better together."
        text="Choose a healthy goal, keep yourself accountable, and earn points from real activity — never from invented progress."
        action={
          <button className="primary-button" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create challenge
          </button>
        }
      />

      {error && <p className="salah-error">{error}</p>}
      {loading && <p className="onboarding-help">Loading challenges…</p>}

      <div className="challenge-highlight panel">
        <div>
          <span className="eyebrow">A HEALTHY KIND OF COMPETITION</span>
          <h2>Compete with your past self.<br /><em>Support each other.</em></h2>
          <p>Keep worship personal. Points come from real activity — finished focus sessions, completed tasks and challenge days — never per prayer.</p>
          <button className="gold-button" onClick={() => setTab('explore')}>
            Start a challenge <ArrowRight size={15} />
          </button>
        </div>
        <div className="challenge-highlight-art">
          <div className="trophy-orbit"><Trophy size={54} /></div>
          <span className="orbit-dot dot-a" />
          <span className="orbit-dot dot-b" />
          <span className="orbit-dot dot-c" />
        </div>
      </div>

      <div className="challenge-controls">
        <div className="segmented">
          <button className={tab === 'explore' ? 'on' : ''} onClick={() => setTab('explore')}>Explore</button>
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My challenges ({myActive.length})</button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History ({myHistory.length})</button>
        </div>
        <div className="privacy-hint"><ShieldCheck size={14} /> Private progress by default</div>
      </div>

      {tab === 'explore' && (
        <div className="challenge-cards">
          {templates.length === 0 && !loading && (
            <p className="onboarding-help">No templates available right now. Create your own challenge instead.</p>
          )}
          {templates.map((template) => {
            const Icon = CHALLENGE_CATEGORY_ICONS[template.category];
            const joined = participationForTemplate(template.id);
            const expanded = expandedTemplate === template.id;
            return (
              <div className="panel challenge-card" key={template.id}>
                <div className="challenge-card-icon"><Icon size={21} /></div>
                <span className="eyebrow">{CHALLENGE_CATEGORY_LABELS[template.category].toUpperCase()} · {template.durationDays} DAYS</span>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <div className="challenge-meta">
                  <span><CalendarDays size={14} /> {template.durationDays} days</span>
                  <span><Target size={14} /> {template.requirement}</span>
                </div>
                {expanded && (
                  <div className="challenge-rules-box">
                    <strong>Rules — read before joining</strong>
                    <ul className="challenge-rules">
                      {template.rules.map((rule, index) => <li key={index}>{rule}</li>)}
                    </ul>
                    <label className="consent-row">
                      <input type="checkbox" checked={templateConsent} onChange={(e) => setTemplateConsent(e.target.checked)} />
                      <span>I have read the rules and I join this challenge willingly.</span>
                    </label>
                  </div>
                )}
                {joined ? (
                  <button className="primary-button full-width" onClick={() => openDetail(joined.challengeId)}>
                    Joined · Day {joined.currentDay} of {joined.totalDays} — View <ArrowRight size={15} />
                  </button>
                ) : expanded ? (
                  <div className="challenge-card-actions">
                    <button className="primary-button full-width" disabled={!templateConsent || busy} onClick={() => handleJoinTemplate(template)}>
                      Join this challenge
                    </button>
                    <button className="outline-button full-width" onClick={() => { setExpandedTemplate(null); setTemplateConsent(false); }}>Close rules</button>
                  </div>
                ) : (
                  <button className="outline-button full-width" onClick={() => { setExpandedTemplate(template.id); setTemplateConsent(false); }}>
                    View rules &amp; join <ArrowRight size={15} />
                  </button>
                )}
              </div>
            );
          })}
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
    </>
  );
}

function Guidance({ onNotify, tab, onTabChange, guestMode, profileCity, initialSurah, onInitialSurahOpened, onOpenSurah }: {
  onNotify: (message: string) => void;
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
            <button className="text-button" onClick={() => onNotify('Support resources will be added after review.')}>
              Explore support resources <ArrowRight size={14} />
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
      {tab === 'duas' && <CuratedDuas />}
      {tab === 'hijri' && <HijriCalendar onNotify={onNotify} guestMode={guestMode} />}
      {tab === 'mosques' && (
        <MosqueFinder onNotify={onNotify} guestMode={guestMode} profileCity={profileCity} />
      )}
    </>
  );
}

function Focus({
  sleepStartTime,
  sleepEndTime,
  focusEnabled,
  setFocusEnabled,
  youtubeAllowed,
  setYoutubeAllowed,
  onNotify,
}: {
  sleepStartTime: string;
  sleepEndTime: string;
  focusEnabled: boolean;
  setFocusEnabled: (value: boolean) => void;
  youtubeAllowed: boolean;
  setYoutubeAllowed: (value: boolean) => void;
  onNotify: (message: string) => void;
}) {
  const sleepStart = formatTime12h(sleepStartTime || '22:00');
  const sleepEnd = formatTime12h(sleepEndTime || '04:00');
  const sleepDuration = sleepDurationLabel(sleepStartTime || '22:00', sleepEndTime || '04:00');
  const [socialApps, setSocialApps] = useState(['Instagram', 'Facebook', 'Snapchat', 'WhatsApp', 'Telegram', 'X']);

  return (
    <>
      <PageHeading
        eyebrow="DISCIPLINE · DIGITAL WELLBEING"
        title="Make space for deep rest."
        text="Plan a sleep window and decide which apps should stay out of reach."
        action={<span className="native-badge"><Lock size={13} /> Native Android feature planned</span>}
      />

      <div className="focus-layout">
        <section className="panel focus-main">
          <div className="focus-title-row">
            <div>
              <span className="eyebrow">SLEEP FOCUS</span>
              <h2>Protect your sleep window.</h2>
              <p>During this schedule, selected distracting apps are planned to be restricted.</p>
            </div>
            <button
              className={`toggle ${focusEnabled ? 'toggle-on' : ''}`}
              aria-label="Toggle focus"
              onClick={() => setFocusEnabled(!focusEnabled)}
            >
              <i />
            </button>
          </div>

          <div className="sleep-window">
            <div className="sleep-time">
              <Moon size={19} />
              <span>START</span>
              <strong>{sleepStart}</strong>
            </div>
            <div className="sleep-duration">
              <div className="sleep-line" />
              <span>{sleepDuration ? `${sleepDuration} protected` : 'Protected'}</span>
              <div className="sleep-line" />
            </div>
            <div className="sleep-time">
              <Sun size={19} />
              <span>END</span>
              <strong>{sleepEnd}</strong>
            </div>
          </div>

          <div className="focus-settings">
            <div className="focus-setting-head">
              <div>
                <strong>Apps to restrict</strong>
                <small>Choose the apps you want out of reach.</small>
              </div>
              <span>{socialApps.length} selected</span>
            </div>

            <div className="app-chip-list">
              {['Instagram', 'Facebook', 'Snapchat', 'WhatsApp', 'Telegram', 'X'].map((app) => (
                <button
                  key={app}
                  className={socialApps.includes(app) ? 'app-chip blocked' : 'app-chip'}
                  onClick={() => setSocialApps((prev) => prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app])}
                >
                  <span className="app-chip-dot" />
                  {app}
                  {socialApps.includes(app) && <Check size={12} />}
                </button>
              ))}
            </div>

            <div className="focus-setting-row">
              <div>
                <strong>YouTube</strong>
                <small>Keep YouTube available during sleep focus.</small>
              </div>
              <button
                className={`toggle ${youtubeAllowed ? 'toggle-on' : ''}`}
                onClick={() => setYoutubeAllowed(!youtubeAllowed)}
                aria-label="Allow YouTube"
              >
                <i />
              </button>
            </div>

            <div className="focus-setting-row">
              <div>
                <strong>Cellular calls & emergency access</strong>
                <small>Always remain available.</small>
              </div>
              <span className="always-allowed"><ShieldCheck size={13} /> Allowed</span>
            </div>
          </div>

          <button className="primary-button" onClick={() => onNotify('Settings saved in this frontend preview only. Android app restrictions are not active yet.')}>
            Save focus schedule <ArrowRight size={15} />
          </button>
        </section>

        <aside className="focus-side">
          <div className="panel focus-status">
            <div className="focus-lock-icon"><LockKeyhole size={28} /></div>
            <span className="eyebrow">YOUR CURRENT PLAN</span>
            <h3>{focusEnabled ? 'Sleep focus is planned' : 'Sleep focus is paused'}</h3>
            <p>{focusEnabled ? 'Your selected schedule is ready for native Android integration.' : 'Turn it on when you are ready to protect your rest.'}</p>
            <div className="status-line">
              <span className={focusEnabled ? 'status-light' : 'status-light off'} />
              {focusEnabled ? 'Enabled in preview' : 'Paused'}
            </div>
          </div>

          <div className="panel focus-safety">
            <ShieldCheck size={18} />
            <strong>Safety stays in your hands.</strong>
            <p>Calls and emergency access remain available. No forced uninstall lock or irreversible restriction will be implemented.</p>
          </div>

          <div className="implementation-note">
            <InfoIcon />
            <span>A website cannot block other Android apps. Real restrictions require native Android APIs, permissions, device testing and Play policy review.</span>
          </div>
        </aside>
      </div>
    </>
  );
}

function InfoIcon() {
  return <span className="info-icon">i</span>;
}

function Analytics({
  stats,
  guestMode,
  rewards,
  activeChallenges,
  challengeHistory,
}: {
  stats: StudyStats | null;
  guestMode: boolean;
  rewards: RewardsSummary | null;
  activeChallenges: ChallengeParticipation[];
  challengeHistory: ChallengeParticipation[];
}) {
  if (guestMode) {
    return (
      <>
        <PageHeading
          eyebrow="DISCIPLINE · REFLECTION"
          title="Notice the progress you're making."
          text="Look at patterns, celebrate consistency and find where a small adjustment could help."
          action={<div className="date-chip"><CalendarDays size={15} /> Activity history</div>}
        />
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">SIGN IN TO TRACK</span>
          <h3>Your progress lives in your account</h3>
          <p className="onboarding-help">
            Sign in to see analytics from your saved study activity. Nothing is tracked in guest preview.
          </p>
        </section>
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <PageHeading
          eyebrow="DISCIPLINE · REFLECTION"
          title="Notice the progress you're making."
          text="Look at patterns, celebrate consistency and find where a small adjustment could help."
          action={<div className="date-chip"><CalendarDays size={15} /> Activity history</div>}
        />
        <section className="panel" style={{ padding: 28 }}>
          <span className="eyebrow">PRIVATE ACTIVITY DATA</span>
          <h3>Loading your progress…</h3>
        </section>
      </>
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

  return (
    <>
      <PageHeading
        eyebrow="DISCIPLINE · REFLECTION"
        title="Notice the progress you're making."
        text="Look at patterns, celebrate consistency and find where a small adjustment could help."
        action={<div className="date-chip"><CalendarDays size={15} /> Activity history</div>}
      />
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
          <div className="analytics-grid">
            <div className="panel metric-card">
              <span className="eyebrow">FOCUSED TODAY</span>
              <strong>{stats.todayFocusMinutes}<small> min</small></strong>
              <span className="metric-trend"><Clock3 size={13} /> From finished focus sessions</span>
            </div>
            <div className="panel metric-card">
              <span className="eyebrow">FOCUSED THIS WEEK</span>
              <strong>{stats.weekFocusMinutes}<small> min</small></strong>
              <span className="metric-trend"><Clock3 size={13} /> Last 7 days, finished sessions only</span>
            </div>
            <div className="panel metric-card">
              <span className="eyebrow">TASKS COMPLETED TODAY</span>
              <strong>{stats.tasksCompletedToday}</strong>
              <span className="metric-trend"><Check size={13} /> From your saved tasks</span>
            </div>
            <div className="panel metric-card">
              <span className="eyebrow">DAY STREAK</span>
              <strong>{stats.streak}<small> day{stats.streak === 1 ? '' : 's'}</small></strong>
              <span className="metric-trend"><Flame size={13} /> A day counts when a focus session finishes or a task is completed</span>
            </div>
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
            Salah and habit analytics are not connected yet — no scores are invented for them.
          </p>
        </>
      )}
    </>
  );
}

function Profile({
  onNotify,
  user,
  guestMode,
  onLogout,
  onAccountDeleted,
}: {
  onNotify: (message: string) => void;
  user: AuthUser | null;
  guestMode: boolean;
  onLogout: () => void;
  onAccountDeleted: () => void;
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

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT · PREFERENCES"
        title="Your space, your settings."
        text="Manage how AHDORA fits around your routines and personal preferences."
      />

      <div className="profile-layout">
        <section className="panel profile-card">
          <div className="profile-cover" />
          <div className="profile-details">
            <div className="profile-avatar-large">{initials}</div>
            <h2>{displayName}</h2>
            <p>{user?.email || 'Preview without an account'}</p>
            <span className="account-status">
              <span />
              {user ? 'Authenticated account · Session active' : 'Guest preview · Not signed in'}
            </span>
            <button className="outline-button" onClick={() => onNotify('Profile editing will be available in a later phase.')}>
              <UserRound size={15} /> Edit profile
            </button>
            <button className="outline-button" onClick={onLogout}>
              <LogOut size={15} /> {user ? 'Log out' : 'Exit preview'}
            </button>
          </div>
        </section>

        <section className="panel settings-card">
          <SectionTitle title="Preferences" />
          <SettingRow
            icon={Bell}
            title="Notifications"
            detail="Categories, quiet hours and live alerts"
            onClick={() => setShowNotifSettings((open) => !open)}
          />
          {showNotifSettings && !guestMode && <NotificationSettingsPanel onNotify={onNotify} />}
          {showNotifSettings && guestMode && (
            <p className="onboarding-help">Sign in to change notification preferences.</p>
          )}
          <SettingRow
            icon={Compass}
            title="Prayer calculation"
            detail="Location, method and Asr school"
            onClick={() => onNotify('Prayer calculation preferences will be connected later.')}
          />
          <SettingRow
            icon={Moon}
            title="Sleep schedule"
            detail="Your focus window and allowed apps"
            onClick={() => onNotify('Opening Focus & sleep settings.')}
          />
          <SettingRow
            icon={Shield}
            title="Privacy & security"
            detail="Password, sessions, data export and account deletion"
            onClick={() => setShowSecurity((open) => !open)}
          />
          {showSecurity && !guestMode && user && (
            <SecuritySettings onNotify={onNotify} emailVerified={user.emailVerified} onAccountDeleted={onAccountDeleted} />
          )}
          {showSecurity && guestMode && (
            <p className="onboarding-help">Sign in to change security settings.</p>
          )}
          <SettingRow
            icon={CircleHelp}
            title="Help & support"
            detail="Get help or share feedback"
            onClick={() => onNotify('Help centre is planned for a later phase.')}
          />
        </section>
      </div>
    </>
  );
}

function SettingRow({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: IconType;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="setting-row" onClick={onClick}>
      <div className="setting-icon"><Icon size={17} /></div>
      <div><strong>{title}</strong><span>{detail}</span></div>
      <ChevronRight size={17} />
    </button>
  );
}

export default App;