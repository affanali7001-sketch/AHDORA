/**
 * API client for the AHDORA native app (Expo / React Native).
 *
 * Ported from the web app's src/lib/http.ts. Same server, same rules:
 * the API uses double-submit-cookie CSRF — GET /api/auth/csrf returns
 * a token AND sets an `ahdora_csrf` cookie; every state-changing
 * request (POST/PUT/PATCH/DELETE) must send the token back as the
 * X-CSRF-Token header AND the cookie. If the server rejects a request
 * with X-CSRF-Error: invalid-token, the token is refreshed once and
 * the request is retried.
 *
 * React Native fetch does NOT reliably persist cookies on Android
 * (the same problem the Capacitor APK had — its native layer dropped
 * them; Heroku logs 2026-11-21 proved it: CSRF GET 200, login POST
 * 403 "Invalid CSRF token" twice). So this file keeps a manual
 * cookie jar: Set-Cookie headers are parsed out of responses (best
 * effort — some runtimes hide them), the jar is sent back as a Cookie
 * header on later requests, and the CSRF token is seeded into the
 * jar directly from the token body (the token IS the cookie value),
 * so login works even when Set-Cookie is invisible. No `credentials`
 * option is passed — the jar is the only cookie transport.
 */

export const API_BASE = 'https://ahdora-f85f76ceea58.herokuapp.com';

/** Friendly, specific message for a transport failure (slow/offline network). */
export const NETWORK_ERROR_MESSAGE =
  'Connection slow ya unavailable hai. Apna internet check karke dobara try karo.';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
};

/**
 * Session token (Bearer) transport — the fix for the 2026-11-22
 * "Authentication required" bug (see extractSessionToken in
 * api/src/lib/session.ts).
 *
 * React Native fetch (Hermes) HIDES Set-Cookie, so the
 * `ahdora_session` cookie set by login was never captured by the
 * manual jar and no session was ever sent back — every
 * authenticated call 401'd after a fresh login, while curl and the
 * browser worked fine. The server now also returns the token in the
 * login/signup body, and this client sends it as
 * `Authorization: Bearer <token>` on every request. The token is
 * kept in SecureStore (encrypted on-device storage) so it survives
 * app restarts — login once, stay logged in like Instagram. The
 * cookie jar is kept as a fallback (it helps if Set-Cookie IS
 * visible in some runtime) but the Bearer token is the primary
 * transport.
 */
import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'ahdora_session_token';

let sessionToken: string | null = null;

async function loadSessionToken(): Promise<string | null> {
  if (sessionToken) return sessionToken;
  try {
    sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    sessionToken = null;
  }
  return sessionToken;
}

async function saveSessionToken(token: string): Promise<void> {
  sessionToken = token;
  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    /* In-memory token still works for this session. */
  }
}

async function clearSessionToken(): Promise<void> {
  sessionToken = null;
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    /* Already gone. */
  }
}

/**
 * Called when any API request gets a 401 (session expired/revoked).
 * App.tsx sets this to log the user out and show the login screen
 * instead of leaving every screen stuck on "Authentication required".
 */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

/** CSRF cookie name — must match api/src/config.ts CSRF_COOKIE_NAME. */
const CSRF_COOKIE_NAME = 'ahdora_csrf';

/** Manual cookie jar: name -> value. */
const cookieJar = new Map<string, string>();

function resolveUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * Split a possibly comma-joined Set-Cookie header value into
 * individual cookies. Commas also appear inside Expires dates
 * ("Expires=Sat, 21 Nov 2026 ..."), so only split on a comma
 * followed by something that looks like a new cookie name
 * (a token immediately followed by '=').
 */
function splitSetCookieValue(raw: string): string[] {
  return raw.split(/,\s*(?=[^;,=\s]+=)/);
}

function storeOneCookie(raw: string): void {
  // Take name=value before the first ';' (attributes follow it).
  const pair = raw.split(';', 1)[0].trim();
  const eq = pair.indexOf('=');
  if (eq <= 0) return;
  cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
}

/**
 * Parse Set-Cookie out of a response's headers. Handles the
 * Headers object (getSetCookie() when the runtime provides it,
 * otherwise get('set-cookie')) and plain record headers.
 * Best effort: if the runtime hides Set-Cookie entirely, the jar
 * simply stays as seeded from the CSRF token.
 */
function storeCookies(headers: unknown): void {
  if (!headers || typeof headers !== 'object') return;
  const h = headers as {
    getSetCookie?: () => string[];
    get?: (name: string) => string | null;
    [key: string]: unknown;
  };
  if (typeof h.getSetCookie === 'function') {
    for (const raw of h.getSetCookie()) {
      if (typeof raw === 'string') storeOneCookie(raw);
    }
    return;
  }
  if (typeof h.get === 'function') {
    const raw = h.get('set-cookie');
    if (typeof raw === 'string' && raw.length > 0) {
      for (const piece of splitSetCookieValue(raw)) storeOneCookie(piece);
    }
    return;
  }
  // Plain record shape: { 'set-cookie': string | string[] }.
  for (const [key, value] of Object.entries(h as Record<string, unknown>)) {
    if (key.toLowerCase() !== 'set-cookie') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const raw of values) {
      if (typeof raw !== 'string') continue;
      for (const piece of splitSetCookieValue(raw)) storeOneCookie(piece);
    }
  }
}

function cookieHeader(): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

/** Exposed for tests/diagnostics: the cookies currently in the jar. */
export function debugCookieNames(): string[] {
  return [...cookieJar.keys()];
}

function isMutation(init?: RequestInit): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

async function doRequest(path: string, init: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  // Send the manual cookie jar: React Native fetch does not reliably
  // persist cookies on Android.
  if (!headers['Cookie']) {
    const jar = cookieHeader();
    if (jar) headers['Cookie'] = jar;
  }
  // Send the Bearer session token (primary auth transport — see the
  // note above). Loaded lazily so the first call restores it from
  // SecureStore without every caller having to initialise it.
  if (!headers['Authorization']) {
    const token = await loadSessionToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  let response: Response;
  try {
    response = await fetch(resolveUrl(path), { ...init, headers });
  } catch (error) {
    // fetch only rejects on a transport failure — say so plainly
    // instead of leaking the raw "Failed to fetch" / TypeError.
    if (error instanceof TypeError || error instanceof Error) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw error;
  }
  // Persist any cookies the response set (session + CSRF).
  storeCookies(response.headers);
  // A 401 means the stored session is dead (expired/revoked) — hand
  // it to the app shell so it logs the user out cleanly instead of
  // leaving every screen on "Authentication required". The logout
  // call itself is exempt: its 401 is expected when the session is
  // already dead, and firing the handler there would loop
  // (handler -> logout -> 401 -> handler ...).
  if (response.status === 401 && path !== '/api/auth/logout' && onUnauthorized) {
    try {
      onUnauthorized();
    } catch {
      /* The handler must never break the response. */
    }
  }
  return response;
}

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    const promise = doRequest('/api/auth/csrf', { method: 'GET' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          csrfToken?: unknown;
        };
        const token = typeof data.csrfToken === 'string' ? data.csrfToken : null;
        // Seed the manual cookie jar from the token — the token IS
        // the ahdora_csrf cookie value by construction, so the login
        // POST sends the cookie even when the runtime hides
        // Set-Cookie headers entirely.
        if (token) cookieJar.set(CSRF_COOKIE_NAME, token);
        return token;
      })
      .catch(() => null);
    csrfPromise = promise;
    // Only the latest fetch may populate the cache: an older in-flight
    // fetch that resolves late must not overwrite a fresher token.
    void promise.then((token) => {
      if (csrfPromise === promise) csrfToken = token;
    });
    void promise.finally(() => {
      if (csrfPromise === promise) csrfPromise = null;
    });
  }
  return csrfPromise;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * Discard the cached token and fetch a fresh one immediately.
 * The login submit calls this right before the POST: a token cached
 * from an earlier app lifetime can already be stale, and a login
 * that fails on a stale token is the worst first impression. A
 * failed refresh resolves to null and the POST still goes ahead
 * with the normal 403 retry.
 */
export async function refreshCsrfToken(): Promise<string | null> {
  csrfToken = null;
  csrfPromise = null;
  return fetchCsrfToken();
}

/** True when an error is the server's CSRF rejection (403 invalid-token). */
export function isCsrfError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Invalid CSRF token');
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token && isMutation(init)) headers['X-CSRF-Token'] = token;
    return doRequest(path, { ...init, headers });
  };

  if (!isMutation(init)) return doFetch(null);

  let response = await doFetch(await fetchCsrfToken());
  if (response.status === 403 && response.headers.get('X-CSRF-Error') === 'invalid-token') {
    clearCsrfToken();
    response = await doFetch(await fetchCsrfToken());
  }
  return response;
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

/**
 * Real login against the live API. Returns the logged-in user.
 * Throws an Error carrying the server's message (e.g. wrong
 * email/password) or the network message on a transport failure.
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  await refreshCsrfToken();
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson<{ user?: AuthUser; sessionToken?: unknown; error?: unknown }>(
    response,
  );
  if (!response.ok || !data.user) {
    const message =
      typeof data.error === 'string' && data.error.length > 0
        ? data.error
        : 'Request failed. Please try again.';
    throw new Error(message);
  }
  // The server returns the session token in the body (the native app
  // cannot read it from Set-Cookie) — persist it so the session
  // survives app restarts.
  if (typeof data.sessionToken === 'string' && data.sessionToken.length > 0) {
    await saveSessionToken(data.sessionToken);
  }
  return data.user;
}

export type SignupResult = {
  user: AuthUser;
  verificationEmailSent: boolean;
  notice?: string;
};

/**
 * Real signup against the live API. Returns the created user.
 * The server requires name 2–60 chars and password 12–128 chars;
 * it returns 400 for invalid details and 409 when the email is
 * already registered. Throws an Error carrying the server's message.
 */
export async function signup(
  name: string,
  email: string,
  password: string
): Promise<SignupResult> {
  await refreshCsrfToken();
  const response = await apiFetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await parseJson<{
    user?: AuthUser;
    verificationEmailSent?: boolean;
    sessionToken?: unknown;
    notice?: string;
    error?: unknown;
  }>(response);
  if (!response.ok || !data.user) {
    const message =
      typeof data.error === 'string' && data.error.length > 0
        ? data.error
        : 'Request failed. Please try again.';
    throw new Error(message);
  }
  // Persist the session token (same reason as login above).
  if (typeof data.sessionToken === 'string' && data.sessionToken.length > 0) {
    await saveSessionToken(data.sessionToken);
  }
  return {
    user: data.user,
    verificationEmailSent: data.verificationEmailSent === true,
    notice: typeof data.notice === 'string' ? data.notice : undefined,
  };
}

/** Real logout against the live API. Best effort — local state is cleared regardless. */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Local-first logout: the session is dropped on the device
    // even if the request itself failed.
  }
  csrfToken = null;
  csrfPromise = null;
  cookieJar.clear();
  await clearSessionToken();
}

/**
 * GET /api/auth/me — the logged-in user for the stored session token.
 * Returns null when there is no token or the session is dead.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = await loadSessionToken();
  if (!token) return null;
  try {
    const response = await apiFetch('/api/auth/me', { method: 'GET' });
    if (!response.ok) return null;
    const data = await parseJson<{ user?: AuthUser }>(response);
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Restore a saved session on app start (Instagram-style: login once,
 * stay logged in). Loads the token from SecureStore and validates it
 * against /me. Returns the user when the session is alive, else null
 * (and the dead token is cleared so a stale value never lingers).
 */
export async function restoreSession(): Promise<AuthUser | null> {
  const user = await fetchMe();
  if (!user) await clearSessionToken();
  return user;
}
