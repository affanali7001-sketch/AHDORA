import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { issueCsrfToken, requireCsrf } from './csrf.js';

/**
 * CSRF middleware tests (no DB, no network).
 *
 * The no-store assertions are the regression test for the
 * intermittent login failure of 2026-11-21: a cached token body can
 * hold a token the cookie no longer matches (another tab rotated
 * it), so even the client's one retry fetched the same stale token
 * from cache and failed again.
 */

function mockResponse() {
  const headers = new Map<string, string>();
  const cookies = new Map<string, { value: string; options: unknown }>();
  let body: unknown;
  let statusCode: number | undefined;
  const res = {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    cookie(name: string, value: string, options: unknown) {
      cookies.set(name, { value, options });
    },
    json(value: unknown) {
      body = value;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
  };
  return {
    res: res as unknown as Response,
    headers,
    cookies,
    get body() {
      return body;
    },
    get statusCode() {
      return statusCode;
    },
  };
}

function mockRequest(init: {
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}) {
  const headers = new Map(
    Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const req = {
    method: init.method ?? 'POST',
    cookies: init.cookies ?? {},
    get(name: string) {
      return headers.get(name.toLowerCase());
    },
  };
  return req as unknown as Request;
}

describe('issueCsrfToken', () => {
  it('issues a token that matches the cookie and is never cached', () => {
    const mock = mockResponse();
    issueCsrfToken({} as Request, mock.res);
    const issued = (mock.body as { csrfToken?: unknown }).csrfToken;
    expect(typeof issued).toBe('string');
    expect((issued as string).length).toBeGreaterThan(20);
    expect(mock.headers.get('cache-control')).toBe('no-store');
    expect(mock.headers.get('pragma')).toBe('no-cache');
    const cookie = mock.cookies.get('ahdora_csrf');
    expect(cookie?.value).toBe(issued);
  });
});

describe('requireCsrf', () => {
  it('lets safe methods through without a token', () => {
    const next = (() => {
      let called = false;
      const fn = (() => {
        called = true;
      }) as unknown as NextFunction;
      return { fn, get called() { return called; } };
    })();
    requireCsrf(mockRequest({ method: 'GET' }), mockResponse().res, next.fn);
    expect(next.called).toBe(true);
  });

  it('accepts a header that matches the cookie', () => {
    const next = (() => {
      let called = false;
      const fn = (() => {
        called = true;
      }) as unknown as NextFunction;
      return { fn, get called() { return called; } };
    })();
    requireCsrf(
      mockRequest({
        headers: { 'x-csrf-token': 'tok123' },
        cookies: { ahdora_csrf: 'tok123' },
      }),
      mockResponse().res,
      next.fn,
    );
    expect(next.called).toBe(true);
  });

  it('rejects a stale header with 403 and X-CSRF-Error: invalid-token', () => {
    const mock = mockResponse();
    let nextCalled = false;
    requireCsrf(
      mockRequest({
        headers: { 'x-csrf-token': 'old-token' },
        cookies: { ahdora_csrf: 'new-token' },
      }),
      mock.res,
      (() => {
        nextCalled = true;
      }) as unknown as NextFunction,
    );
    expect(nextCalled).toBe(false);
    expect(mock.statusCode).toBe(403);
    expect(mock.headers.get('x-csrf-error')).toBe('invalid-token');
  });
});
