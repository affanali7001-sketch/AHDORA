import SalahTracker from './components/SalahTracker';
import { useEffect, useMemo, useState } from 'react';
import Onboarding from './components/Onboarding';
import { emptyProfile, type UserProfile } from './types/profile';
import { loadProfile, saveProfile } from './lib/profileApi';
import { fetchPrayerTimes, type PrayerTimesResponse } from './lib/prayerApi';
import { sleepDurationLabel } from './types/profile';
import type { CSSProperties, ReactNode, FormEvent } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, BookMarked,
  CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Compass, Flame, Footprints, GraduationCap, Heart, Home, LayoutDashboard, Lock,
  LockKeyhole, LogOut, Menu, Moon, MoreHorizontal, Plus, Search, Settings, Shield,
  ShieldCheck, Sparkles, Sun, Target, Timer, Trophy, UserRound, Users, X, Zap,
} from 'lucide-react';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="16" fill="%23d9b36c"/%3E%3Cpath d="M16 45 32 15l16 30h-8l-3.2-7H27.2L24 45h-8Zm14-14-2.8 6h5.6L30 31Z" fill="%23343d35"/%3E%3C/svg%3E';

type AuthUser = { id: string; name: string; email: string; role: string };
type ApiResponse<T> = T;

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
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

type Page = 'dashboard' | 'deen' | 'study' | 'challenges' | 'guidance' | 'focus' | 'analytics' | 'profile';
type IconType = typeof Home;



const navItems: { id: Page; label: string; icon: IconType; group: string }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { id: 'deen', label: 'Deen & Salah', icon: Compass, group: 'Workspace' },
  { id: 'study', label: 'Study planner', icon: GraduationCap, group: 'Workspace' },
  { id: 'challenges', label: 'Challenges', icon: Trophy, group: 'Community' },
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
  const [screen, setScreen] = useState<'checking' | 'welcome' | 'login' | 'onboarding' | 'app'>('checking');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
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
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [tasks, setTasks] = useState<{ name: string; time: string; status: string; color: string }[]>([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
    setAuthUser(null);
    setGuestMode(false);
    setProfileName('');
    setNewUser(emptyProfile());
    setPrayerTimes(null);
    setPrayerStatus('idle');
    setSalahToday({});
    setScreen('welcome');
    setPage('dashboard');
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
    return <Login onBack={() => setScreen('welcome')} onLogin={handleLogin} onSignup={handleSignup} />;
  }
  if (screen === 'onboarding') {
    return <Onboarding user={newUser} onChange={setNewUser} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><img src={logo} alt="AHDORA logo" /><div><strong>AHDORA</strong><span>DEEN · ILM · DISCIPLINE</span></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="workspace-switch"><span className="workspace-dot" /><span>Personal space</span><ChevronDown size={14} /></div>
        {['Workspace', 'Community', 'Tools'].map((group) => <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{navItems.filter((item) => item.group === group).map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => goTo(item.id)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'challenges' && <span className="nav-count">2</span>}</button>; })}</div>)}
        <div className="sidebar-bottom"><div className="sidebar-quote"><Sparkles size={15} /><p>Small steps, sincere intentions, steady growth.</p></div><button className="profile-mini" onClick={() => goTo('profile')}><div className="avatar">{initials}</div><div><strong>{displayName}</strong><span>Personal account</span></div><MoreHorizontal size={17} /></button></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><span className="demo-pill"><span />{authUser ? 'SECURE SESSION' : 'GUEST PREVIEW'}</span><button className="icon-button search-trigger" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search"><Search size={18} /></button><button className="icon-button notification-button" onClick={() => notify('You are all caught up.')} aria-label="Notifications"><Bell size={18} /><i /></button><button className="top-avatar" onClick={() => goTo('profile')}>{initials}</button></div></header>
        {searchOpen && <div className="search-popover"><Search size={17} /><input autoFocus placeholder="Search AHDORA pages..." value={query} onChange={(e) => setQuery(e.target.value)} /><button onClick={() => { setQuery(''); setSearchOpen(false); }}><X size={16} /></button><div className="search-results">{filteredNav.map((item) => <button key={item.id} onClick={() => goTo(item.id)}>{item.label}<ArrowUpRight size={14} /></button>)}</div></div>}
        <div className="page-content">
          {page === 'dashboard' && <Dashboard userName={profileName || 'there'} onNavigate={goTo} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} salahToday={salahToday} onPrayerToggle={() => goTo('deen')} tasks={tasks} />}
          {page === 'deen' && <Deen onNotify={notify} prayerTimes={prayerTimes} prayerStatus={prayerStatus} prayerError={prayerError} />}
          {page === 'study' && <Study tasks={tasks} onAdd={() => setShowAddTask(true)} onNotify={notify} />}
          {page === 'challenges' && <Challenges onNotify={notify} />}
          {page === 'guidance' && <Guidance onNotify={notify} />}
          {page === 'focus' && <Focus sleepStartTime={newUser.sleepStartTime || newUser.sleepTime} sleepEndTime={newUser.sleepEndTime} focusEnabled={focusEnabled} setFocusEnabled={setFocusEnabled} youtubeAllowed={youtubeAllowed} setYoutubeAllowed={setYoutubeAllowed} onNotify={notify} />}
          {page === 'analytics' && <Analytics />}
          {page === 'profile' && <Profile onNotify={notify} user={authUser} guestMode={guestMode} onLogout={handleLogout} />}
        </div>
        <footer className="app-footer"><span>© 2026 AHDORA</span><span>Built around what matters.</span><button onClick={() => notify('Help centre will be connected in a later phase.')}><CircleHelp size={14} /> Help & feedback</button></footer>
      </main>
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      {showAddTask && <div className="modal-backdrop" onClick={() => setShowAddTask(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">STUDY PLANNER</span><h3>Add a study task</h3></div><button className="icon-button" onClick={() => setShowAddTask(false)}><X size={18} /></button></div><label className="field-label">Task name</label><input className="form-input" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="e.g. Revise calculus" /><button className="primary-button full-width" onClick={() => { if (newTask.trim()) { setTasks((prev) => [...prev, { name: newTask.trim(), time: 'Not scheduled', status: 'Upcoming', color: 'mint' }]); setNewTask(''); setShowAddTask(false); notify('Task added for this session. Persistence is not enabled yet.'); } }}>Add task <ArrowRight size={16} /></button><p className="modal-note">Tasks are currently session-only until the study planner API is connected.</p></div></div>}
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
}: {
  onBack: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (user: { name: string; email: string; password: string }) => Promise<void>;
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

        <div className="auth-notice">
          <Shield size={15} />
          <span>
            Secure session is handled by the AHDORA API. Use a unique password. Email verification is not enabled yet, so this is still a development-stage account flow.
          </span>
        </div>
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
  tasks,
}: {
  userName: string;
  onNavigate: (page: Page) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
  salahToday: Record<string, { status: string }>;
  onPrayerToggle: (name: string) => void;
  tasks: { name: string; time: string; status: string; color: string }[];
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
              <strong>Your activity will appear here.</strong>
              <span>Complete a Salah check-in or add a study task to start tracking progress.</span>
              <small><ArrowUpRight size={13} /> No activity recorded yet</small>
            </div>
          </div>
          <div className="progress-footer"><span>Keep showing up.</span><span>Not enough data</span></div>
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
          <div className="study-stat-row">
            <div><strong>{tasks.length}</strong><span>Tasks in this session</span></div>
            <div className="study-stat-divider" />
            <div><strong>Not tracked</strong><span>Focused time</span></div>
          </div>
          <div className="task-list compact">
            {tasks.slice(0, 3).map((task) => (
              <div className="task-row" key={task.name}>
                <span className={`task-dot ${task.color}`} />
                <div><strong>{task.name}</strong><small>{task.time}</small></div>
                <span className={`status-tag ${task.status === 'Completed' ? 'status-done' : task.status === 'In progress' ? 'status-live' : ''}`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
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
            <span className="eyebrow">COMMUNITY</span>
            <Trophy size={18} />
          </div>
          <div className="challenge-teaser-copy">
            <h3>Grow better,<br />together.</h3>
            <p>Choose a healthy challenge and invite a friend to join you.</p>
            <button className="outline-gold" onClick={() => onNavigate('challenges')}>
              Explore challenges <ArrowRight size={14} />
            </button>
          </div>
          <div className="challenge-avatars"><span>Private until you invite someone.</span></div>
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

function Deen({ onNotify, prayerTimes, prayerStatus, prayerError }: {
  onNotify: (message: string) => void;
  prayerTimes: PrayerTimesResponse | null;
  prayerStatus: 'idle' | 'loading' | 'loaded' | 'error' | 'no-city';
  prayerError: string;
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
            <QuickTile icon={BookMarked} title="Duas" text="Verified supplications" onClick={() => onNotify('Verified dua library is planned for a later phase.')} />
            <QuickTile icon={CalendarDays} title="Islamic calendar" text="Dates & occasions" onClick={() => onNotify('Islamic calendar is planned for a later phase.')} />
            <QuickTile icon={Compass} title="Find a masjid" text="Nearby places" onClick={() => onNotify('Masjid finder will be connected later.')} />
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

function Study({
  tasks,
  onAdd,
  onNotify,
}: {
  tasks: { name: string; time: string; status: string; color: string }[];
  onAdd: () => void;
  onNotify: (message: string) => void;
}) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState('25:00');

  return (
    <>
      <PageHeading
        eyebrow="ILM · LEARNING SYSTEM"
        title="Make your focus count."
        text="Plan your study sessions, protect your attention and keep your learning visible."
        action={<button className="primary-button" onClick={onAdd}><Plus size={16} /> Add study task</button>}
      />

      <div className="study-page-grid">
        <section className="panel schedule-card">
          <div className="panel-top">
            <div>
              <span className="eyebrow">YOUR SCHEDULE</span>
              <h3>Today's study plan</h3>
            </div>
            <div className="date-chip small-date"><CalendarDays size={14} /> Today</div>
          </div>

          <div className="task-list full-task-list">
            {tasks.map((task, index) => (
              <div className="task-row large-task" key={`${task.name}-${index}`}>
                <span className={`task-dot ${task.color}`} />
                <div><strong>{task.name}</strong><small>{task.time}</small></div>
                <span className={`status-tag ${task.status === 'Completed' ? 'status-done' : task.status === 'In progress' ? 'status-live' : ''}`}>
                  {task.status}
                </span>
                <button className="icon-button task-more" onClick={() => onNotify('Task actions will be available when tasks are stored in your account.')}>
                  <MoreHorizontal size={17} />
                </button>
              </div>
            ))}
          </div>

          <button className="add-row" onClick={onAdd}><Plus size={15} /> Add another session</button>
        </section>

        <section className="panel timer-card">
          <span className="eyebrow">POMODORO · FOCUS TIMER</span>
          <div className="timer-circle">
            <div>
              <strong>{selectedDuration}</strong>
              <span>{timerRunning ? 'Focus session' : 'Ready when you are'}</span>
            </div>
          </div>
          <div className="timer-presets">
            {['25:00', '45:00', '50:00'].map((v) => (
              <button
                key={v}
                className={selectedDuration === v ? 'preset-selected' : ''}
                onClick={() => { setSelectedDuration(v); setTimerRunning(false); }}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="primary-button full-width" onClick={() => setTimerRunning(!timerRunning)}>
            {timerRunning ? 'Pause session' : 'Start focus session'}
            {timerRunning ? <Timer size={15} /> : <ArrowRight size={15} />}
          </button>
          <small className="muted-footnote">Timer interaction preview. Background timing and notifications are not connected yet.</small>
        </section>

        <section className="panel subjects-card">
          <SectionTitle title="Your subjects" action="Manage subjects" />
          <div className="subject-list">
            <SubjectRow name="Applied Mathematics" label="312301" value={72} color="mint" />
            <SubjectRow name="Computer Science" label="Core subject" value={54} color="gold" />
            <SubjectRow name="C Programming" label="Practical" value={38} color="blue" />
          </div>
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
    </>
  );
}

function SubjectRow({ name, label, value, color }: { name: string; label: string; value: number; color: string }) {
  return (
    <div className="subject-row">
      <div>
        <div><strong>{name}</strong><span>{label}</span></div>
        <b>{value}%</b>
      </div>
      <div className="progress-track"><span className={`fill-${color}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Challenges({ onNotify }: { onNotify: (message: string) => void }) {
  const [tab, setTab] = useState<'all' | 'friends' | 'solo'>('all');

  const challengeData = [
    { title: '7-Day Study Sprint', category: 'Study', duration: '7 days', people: '2 friends', description: 'Build a repeatable daily study rhythm.', tag: 'Popular', icon: GraduationCap },
    { title: 'Early Sleep Reset', category: 'Lifestyle', duration: '14 days', people: 'Solo or friend', description: 'Create a calmer, consistent night routine.', tag: 'Lifestyle', icon: Moon },
    { title: 'Daily Walk Challenge', category: 'Fitness', duration: '21 days', people: 'Solo or friend', description: 'Make movement part of your everyday routine.', tag: 'Wellbeing', icon: Footprints },
  ];

  const visible = challengeData.filter((c) =>
    tab === 'all' ||
    (tab === 'friends' ? c.people.toLowerCase().includes('friend') : c.people.toLowerCase().includes('solo'))
  );

  return (
    <>
      <PageHeading
        eyebrow="COMMUNITY · ACCOUNTABILITY"
        title="Progress feels better together."
        text="Choose a healthy goal, invite someone you trust and keep each other accountable."
        action={
          <button className="primary-button" onClick={() => onNotify('Challenge creation flow will be connected after backend permissions and privacy rules are ready.')}>
            <Plus size={16} /> Create challenge
          </button>
        }
      />

      <div className="challenge-highlight panel">
        <div>
          <span className="eyebrow">A HEALTHY KIND OF COMPETITION</span>
          <h2>Compete with your past self.<br /><em>Support each other.</em></h2>
          <p>Keep worship personal. Use shared challenges for study, sleep, fitness and everyday habits.</p>
          <button className="gold-button" onClick={() => onNotify('Challenge setup will be connected in the backend phase.')}>
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
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Explore all</button>
          <button className={tab === 'friends' ? 'on' : ''} onClick={() => setTab('friends')}>With friends</button>
          <button className={tab === 'solo' ? 'on' : ''} onClick={() => setTab('solo')}>Solo goals</button>
        </div>
        <div className="privacy-hint"><ShieldCheck size={14} /> Private progress by default</div>
      </div>

      <div className="challenge-cards">
        {visible.map((c) => {
          const Icon = c.icon;
          return (
            <div className="panel challenge-card" key={c.title}>
              <div className="challenge-card-icon"><Icon size={21} /></div>
              <span className="eyebrow">{c.category.toUpperCase()} · {c.tag.toUpperCase()}</span>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <div className="challenge-meta">
                <span><CalendarDays size={14} /> {c.duration}</span>
                <span><Users size={14} /> {c.people}</span>
              </div>
              <button className="outline-button full-width" onClick={() => onNotify('Challenge details and consent flow are coming with the secure backend.')}>
                View challenge <ArrowRight size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="privacy-callout">
        <Lock size={16} />
        <div>
          <strong>Privacy comes first</strong>
          <span>Random matching will require consent. Your location, prayer history and private religious activity will never be shared with strangers.</span>
        </div>
      </div>
    </>
  );
}

function Guidance({ onNotify }: { onNotify: (message: string) => void }) {
  const [selected, setSelected] = useState('Feeling overwhelmed');

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
              Verified Arabic text, translation, context and source attribution will be displayed here after review. This preview intentionally does not generate or reproduce Quranic text.
            </p>
            <button className="primary-button" onClick={() => onNotify('Only verified Quran text and reviewed translations will be published here.')}>
              Open verified reading <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <aside className="guidance-side">
          <div className="panel source-panel">
            <div className="source-icon"><ShieldCheck size={20} /></div>
            <span className="eyebrow">OUR CONTENT PROMISE</span>
            <h3>Accuracy before quantity.</h3>
            <p>Quranic Arabic, references and translations will come from verified sources and be reviewed before publication.</p>
            <div className="source-check"><CheckCheck size={14} /> Exact surah and ayah references</div>
            <div className="source-check"><CheckCheck size={14} /> Translation attribution</div>
            <div className="source-check"><CheckCheck size={14} /> Scholarly review process</div>
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

function Analytics() {
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
        <h3>No analytics available yet</h3>
        <p className="onboarding-help">
          Analytics will be calculated from persisted Salah, study, and habit activity once those tracking systems are connected.
          AHDORA will not display invented scores or public rankings.
        </p>
      </section>
    </>
  );
}

function Profile({
  onNotify,
  user,
  guestMode,
  onLogout,
}: {
  onNotify: (message: string) => void;
  user: AuthUser | null;
  guestMode: boolean;
  onLogout: () => void;
}) {
  const displayName = user?.name || (guestMode ? 'Guest preview' : 'Your account');
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'AH';

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
            detail="Prayer, study and habit reminders"
            onClick={() => onNotify('Notification preferences will be added later.')}
          />
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
            detail="Sessions, devices and data controls"
            onClick={() => onNotify('Session security is handled by the backend. More controls are planned.')}
          />
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