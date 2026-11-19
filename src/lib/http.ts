/**
 * Shared fetch wrapper with CSRF protection.
 *
 * Every state-changing request (POST/PUT/PATCH/DELETE) carries the
 * double-submit CSRF token as an X-CSRF-Token header. The token is
 * fetched once from GET /api/auth/csrf and cached in memory; if the
 * server rejects a request with X-CSRF-Error: invalid-token (stale
 * token, e.g. after a long idle period), the token is refreshed once
 * and the request is retried. Safe methods (GET/HEAD/OPTIONS) never
 * send a token. All API clients in src/lib/*Api.ts and App.tsx's
 * apiRequest go through here.
 */
let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        csrfToken = typeof data.csrfToken === 'string' ? data.csrfToken : null;
        return csrfToken;
      })
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

export function clearCsrfToken(): void {
  csrfToken = null;
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
    return fetch(path, { ...init, credentials: 'include', headers });
  };

  if (!isMutation(init)) return doFetch(null);

  let response = await doFetch(await fetchCsrfToken());
  if (response.status === 403 && response.headers.get('X-CSRF-Error') === 'invalid-token') {
    clearCsrfToken();
    response = await doFetch(await fetchCsrfToken());
  }
  return response;
}
