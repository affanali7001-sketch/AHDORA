/**
 * App theme + display preferences (Noor Connect parity — built from
 * scratch, no Noor code).
 *
 * - Theme preference: 'light' | 'system' | 'dark'. Default 'light'.
 *   'system' follows the device appearance (Appearance API).
 * - Fluid animations: spring press-scale on buttons/tiles. Default ON.
 * - Splash greeting: Salam lines on the Welcome screen. Default ON.
 * - Home greeting: daily Salam greeting on Home. Default ON.
 *
 * All four are per-user AsyncStorage (`theme:*:<uid>`, same
 * `<feature>:<uid>` convention as hifz.ts / minimal.ts).
 *
 * Dark theme scope (honest): the dark variant is REAL and applies to
 * the app shell (App.tsx background), Home, Profile, Welcome and
 * Mood Remedy — the screens the user opens first — plus the press
 * animations gate in the shared ui components. Other screens still
 * render the light theme until they are migrated; the light theme
 * colors (Ice White / Deep Teal / Soft Peach) are unchanged.
 */
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'light' | 'system' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Dark palette — deep teal family, same layout, no gold. */
export const DARK = {
  bg: '#06231F',
  card: '#0B3D34',
  border: '#155E4E',
  text: '#F4F8F6',
  muted: '#A7C3B6',
  accent: '#6FC7A8',
  chip: '#0E4A3E',
  peachBg: '#FBD9BE',
  peachText: '#8A4416',
} as const;

type ThemeState = {
  pref: ThemePref;
  animations: boolean;
  splashGreeting: boolean;
  homeGreeting: boolean;
  systemDark: boolean;
};

let currentUid = 'anon';
let loadedUid: string | null = null;
let appearanceWired = false;

let state: ThemeState = {
  pref: 'light',
  animations: true,
  splashGreeting: true,
  homeGreeting: true,
  systemDark: Appearance.getColorScheme() === 'dark',
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): ThemeState {
  return state;
}

function setState(patch: Partial<ThemeState>): void {
  state = { ...state, ...patch };
  emit();
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'dark') return 'dark';
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return 'light';
}

function prefKey(uid: string): string {
  return `theme:pref:${uid}`;
}
function animationsKey(uid: string): string {
  return `theme:animations:${uid}`;
}
function splashKey(uid: string): string {
  return `theme:splash:${uid}`;
}
function homeGreetKey(uid: string): string {
  return `theme:homeGreet:${uid}`;
}

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function parsePref(raw: string | null): ThemePref {
  if (raw === 'dark' || raw === 'system' || raw === 'light') return raw;
  return 'light';
}

/**
 * Load this user's display prefs into the store. Called by App.tsx
 * when the user changes (and once at startup for 'anon'). Safe to
 * call repeatedly — reloads only when the uid changed.
 */
export function initAppTheme(uid: string): void {
  currentUid = uid;
  if (loadedUid === uid) return;
  loadedUid = uid;
  if (!appearanceWired) {
    appearanceWired = true;
    Appearance.addChangeListener(({ colorScheme }) => {
      setState({ systemDark: colorScheme === 'dark' });
    });
  }
  void Promise.all([
    AsyncStorage.getItem(prefKey(uid)),
    AsyncStorage.getItem(animationsKey(uid)),
    AsyncStorage.getItem(splashKey(uid)),
    AsyncStorage.getItem(homeGreetKey(uid)),
  ])
    .then(([pref, anim, splash, home]) => {
      if (currentUid !== uid) return;
      setState({
        pref: parsePref(pref),
        animations: parseBool(anim, true),
        splashGreeting: parseBool(splash, true),
        homeGreeting: parseBool(home, true),
      });
    })
    .catch(() => undefined);
}

export type AppTheme = {
  pref: ThemePref;
  resolved: ResolvedTheme;
  dark: boolean;
  animations: boolean;
  splashGreeting: boolean;
  homeGreeting: boolean;
};

/** Reactive hook — re-renders when any display pref changes. */
export function useAppTheme(): AppTheme {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  const resolved = resolveTheme(s.pref, s.systemDark);
  return {
    pref: s.pref,
    resolved,
    dark: resolved === 'dark',
    animations: s.animations,
    splashGreeting: s.splashGreeting,
    homeGreeting: s.homeGreeting,
  };
}

/** Non-hook read for places that cannot use hooks (e.g. style helpers). */
export function getAppTheme(): AppTheme {
  const resolved = resolveTheme(state.pref, state.systemDark);
  return {
    pref: state.pref,
    resolved,
    dark: resolved === 'dark',
    animations: state.animations,
    splashGreeting: state.splashGreeting,
    homeGreeting: state.homeGreeting,
  };
}

export function setThemePref(uid: string, pref: ThemePref): void {
  setState({ pref });
  void AsyncStorage.setItem(prefKey(uid), pref).catch(() => undefined);
}

export function setAnimationsPref(uid: string, on: boolean): void {
  setState({ animations: on });
  void AsyncStorage.setItem(animationsKey(uid), on ? 'true' : 'false').catch(() => undefined);
}

export function setSplashGreetingPref(uid: string, on: boolean): void {
  setState({ splashGreeting: on });
  void AsyncStorage.setItem(splashKey(uid), on ? 'true' : 'false').catch(() => undefined);
}

export function setHomeGreetingPref(uid: string, on: boolean): void {
  setState({ homeGreeting: on });
  void AsyncStorage.setItem(homeGreetKey(uid), on ? 'true' : 'false').catch(() => undefined);
}
