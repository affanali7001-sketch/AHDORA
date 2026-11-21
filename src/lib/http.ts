/**
 * Shared fetch wrapper with CSRF protection.
 *
 * Every state-changing request (POST/PUT/PATCH/DELETE) carries the
 * double-submit CSRF token as an X-CSRF-Token header. The token is
 * fetched once from GET /api/auth/csrf and cached in memory; if the
 * server rejects a request with X-CSRF-Error: invalid-token (stale
 * token, e.g. after a long idle period or another tab rotating the
 * shared cookie), the token is refreshed once and the request is
 * retried. Safe methods (GET/HEAD/OPTIONS) never send a token. All
 * API clients in src/lib/*Api.ts and App.tsx's apiRequest go through
 * here.
 *
 * Why login could still fail with "Invalid CSRF token" even though
 * the retry exists (Bug A, 2026-11-21): the token GET used the
 * browser's default cache mode and the server sent no Cache-Control,
 * so the browser could serve a cached token body. The CSRF cookie is
 * shared across tabs, so another tab's fresh GET rotates the cookie
 * while this tab's cached body still holds the old token — and the
 * retry fetched the SAME stale token from cache and failed again.
 * Fixed three ways: the token GET is fetched with `cache: 'no-store'`,
 * the server marks the token response `Cache-Control: no-store`
 * (api/src/middleware/csrf.ts), and the login submit fetches a fresh
 * token immediately before the POST (see refreshCsrfToken).
 *
 * APK (Capacitor) note — this file is the ONLY place that knows about
 * the transport, so the native build is handled here and nowhere else:
 * - Web build: API_BASE is empty, so paths stay relative ("/api/...")
 *   and go through the same-origin server, exactly as before.
 * - Native build: the Vite build is run with
 *   VITE_API_BASE=https://ahdora-f85f76ceea58.herokuapp.com, so every
 *   call is absolute. Plain window.fetch CANNOT be used there: the
 *   WebView origin (https://localhost) is not on the server's CORS
 *   allowlist, and the SameSite=Lax session cookie would not be set by
 *   a cross-site fetch response. Instead requests go through
 *   CapacitorHttp, the native HTTP layer: it bypasses CORS, but it
 *   does NOT send back cookies set by earlier responses (proven
 *   2026-11-21 by Heroku logs: CSRF GET 200, login POST 403
 *   "Invalid CSRF token" twice — the ahdora_csrf cookie was never
 *   sent back). So this file keeps a manual cookie jar for the
 *   native path (see nativeCookieJar): Set-Cookie headers are parsed
 *   out of native responses, the jar is sent as a Cookie header on
 *   later requests, and the CSRF token is seeded into the jar
 *   directly from the token body (the token IS the cookie value).
 *   The response is wrapped back into a standard Response so every
 *   caller is unchanged. On-device login still needs a real-device
 *   check.
 * - No `@capacitor/core` dependency: the repo has no Capacitor
 *   packages (capacitor.config.ts / android/ live only in the
 *   apk-build scratch copy), so the native layer is reached through
 *   the `window.Capacitor` global the Capacitor runtime injects into
 *   the WebView. That keeps the web typecheck/build dependency-free
 *   while working identically inside the APK.
 */
let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

/** Absolute API origin for native builds; empty (relative paths) on web. */
export const API_BASE: string = ((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '');

/** Friendly, specific message for a transport failure (slow/offline network). */
export const NETWORK_ERROR_MESSAGE =
  'Connection slow ya unavailable hai. Apna internet check karke dobara try karo.';

function resolveUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

/**
 * Minimal shape of the Capacitor runtime global. Only what this file
 * uses: the native-platform check and the CapacitorHttp plugin.
 */
type CapacitorHttpPlugin = {
  request: (options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    data?: unknown;
    responseType?: 'text';
    connectTimeout?: number;
    readTimeout?: number;
  }) => Promise<{
    status: number;
    headers?: Record<string, string>;
    data?: unknown;
  }>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: { CapacitorHttp?: CapacitorHttpPlugin };
};

function getCapacitorHttp(): CapacitorHttpPlugin | null {
  if (typeof window === 'undefined') return null;
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!capacitor || capacitor.isNativePlatform?.() !== true) return null;
  return capacitor.Plugins?.CapacitorHttp ?? null;
}

function isNativeHttp(): boolean {
  return getCapacitorHttp() !== null;
}

function isNetworkFailure(error: unknown): boolean {
  // fetch rejects with TypeError on a transport failure; CapacitorHttp
  // rejects with its own error objects. Anything thrown before an
  // HTTP response exists is a transport failure.
  return error instanceof Error;
}

/**
 * Manual cookie jar for the native (CapacitorHttp) path only.
 *
 * The native layer does not reliably send back cookies set by
 * earlier responses — neither the ahdora_csrf cookie from the token
 * GET nor the HttpOnly session cookie from a login POST. Without the
 * cookie, the server's double-submit CSRF check rejects every
 * mutation with 403 "Invalid CSRF token", and the client retry fails
 * the same way (the token header is fresh but the cookie is still
 * missing). So: parse Set-Cookie out of native responses and send
 * the jar back as a Cookie header on later native requests.
 */
const nativeCookieJar = new Map<string, string>();

/** CSRF cookie name — must match api/src/config.ts CSRF_COOKIE_NAME. */
const CSRF_COOKIE_NAME = 'ahdora_csrf';

function storeNativeCookies(headers: unknown): void {
  if (!headers || typeof headers !== 'object') return;
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() !== 'set-cookie') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const raw of values) {
      if (typeof raw !== 'string') continue;
      // Take name=value before the first ';' (attributes follow it).
      const pair = raw.split(';', 1)[0].trim();
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      nativeCookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

function nativeCookieHeader(): string | undefined {
  if (nativeCookieJar.size === 0) return undefined;
  return [...nativeCookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

/**
 * Native HTTP request via CapacitorHttp, adapted back to a standard
 * Response. responseType 'text' is requested, but some native layers
 * still return parsed objects — those are JSON-stringified, never
 * dropped, so error bodies (e.g. the 403 CSRF message) survive.
 * Cookies are carried manually (see nativeCookieJar): the native
 * layer does not send back cookies set by earlier responses.
 *
 * Slow 4G: 10s to connect, 30s to read, and ONE retry when no HTTP
 * response was received at all (transport error / timeout / status 0)
 * — a request that never reached the server cannot double-submit.
 * A persistent transport failure throws a specific, actionable
 * message instead of a bare Response that callers would report as a
 * generic "Request failed".
 */
async function nativeFetch(path: string, init: RequestInit): Promise<Response> {
  const plugin = getCapacitorHttp();
  if (!plugin) throw new Error(NETWORK_ERROR_MESSAGE);
  const headers = { ...(init.headers as Record<string, string> | undefined) };
  const url = resolveUrl(path);
  const method = (init.method ?? 'GET').toUpperCase();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Send the manual cookie jar: the native layer does not send
      // back cookies set by earlier responses (session + CSRF).
      const requestHeaders = { ...headers };
      if (!requestHeaders['Cookie']) {
        const cookieHeader = nativeCookieHeader();
        if (cookieHeader) requestHeaders['Cookie'] = cookieHeader;
      }
      const result = await plugin.request({
        url,
        method,
        headers: requestHeaders,
        data: init.body ?? undefined,
        responseType: 'text',
        connectTimeout: 10_000,
        readTimeout: 30_000,
      });
      // Some native layers surface a transport failure as status 0
      // instead of rejecting — treat it as a retryable failure.
      if (!result.status) throw new Error(NETWORK_ERROR_MESSAGE);
      // Persist any cookies the response set (session + CSRF).
      storeNativeCookies(result.headers);
      // The plugin may return a parsed object despite responseType
      // 'text' — never drop the body: a 403 without its error body
      // surfaces as a generic "Request failed" instead of the real
      // CSRF message.
      const body =
        typeof result.data === 'string'
          ? result.data
          : result.data == null
            ? ''
            : JSON.stringify(result.data);
      return new Response(body, {
        status: result.status,
        headers: (result.headers ?? {}) as Record<string, string>,
      });
    } catch (error) {
      lastError = error;
      // A Response object built above never throws here, so any catch
      // is a transport failure: retry once, then give up with a
      // specific message.
      if (attempt === 0 && isNetworkFailure(error)) continue;
      break;
    }
  }
  if (lastError instanceof Error && lastError.message === NETWORK_ERROR_MESSAGE) throw lastError;
  throw new Error(NETWORK_ERROR_MESSAGE);
}

async function webFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(resolveUrl(path), { ...init, credentials: 'include' });
  } catch (error) {
    // fetch only rejects on a transport failure — say so plainly
    // instead of leaking the raw "Failed to fetch".
    if (error instanceof TypeError) throw new Error(NETWORK_ERROR_MESSAGE);
    throw error;
  }
}

/** The transport for this request: CapacitorHttp inside the APK, fetch on web. */
function doRequest(path: string, init: RequestInit): Promise<Response> {
  return isNativeHttp() ? nativeFetch(path, init) : webFetch(path, init);
}

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    const promise = doRequest('/api/auth/csrf', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        const token = typeof data.csrfToken === 'string' ? data.csrfToken : null;
        // Native path: seed the manual cookie jar from the token —
        // the token IS the ahdora_csrf cookie value by construction,
        // so the login POST sends the cookie even when the native
        // layer hides Set-Cookie headers entirely.
        if (token && isNativeHttp()) nativeCookieJar.set(CSRF_COOKIE_NAME, token);
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
 * from an earlier page lifetime can already be stale (another tab
 * rotated the shared cookie), and a login that fails on a stale
 * token is the worst first impression. A failed refresh resolves to
 * null and the POST still goes ahead with the normal 403 retry.
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

function isMutation(init?: RequestInit): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
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
