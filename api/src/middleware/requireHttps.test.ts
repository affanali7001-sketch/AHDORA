import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireHttps } from './requireHttps.js';

/**
 * HTTP → HTTPS redirect tests (no DB, no network).
 *
 * The redirect is the fix for the Search Console finding of
 * 26 Nov 2026: http://ahdora.me/ served the full page (200) instead
 * of redirecting, so Google treated it as a separate page ("Crawled -
 * currently not indexed") and picked it as the canonical over the
 * declared https:// one. A loop here would take the whole site down,
 * so the secure/localhost cases are pinned down explicitly.
 */

function runMiddleware(overrides: {
  secure: boolean;
  hostname: string;
  hostHeader: string;
  originalUrl: string;
}) {
  const req = {
    secure: overrides.secure,
    hostname: overrides.hostname,
    originalUrl: overrides.originalUrl,
    get(name: string) {
      return name.toLowerCase() === 'host' ? overrides.hostHeader : undefined;
    },
  } as unknown as Request;
  let redirectStatus: number | undefined;
  let redirectTarget: string | undefined;
  const res = {
    redirect(status: number, target: string) {
      redirectStatus = status;
      redirectTarget = target;
    },
  } as unknown as Response;
  let nextCalled = false;
  const next = (() => {
    nextCalled = true;
  }) as NextFunction;
  requireHttps(req, res, next);
  return {
    get redirectStatus() {
      return redirectStatus;
    },
    get redirectTarget() {
      return redirectTarget;
    },
    get nextCalled() {
      return nextCalled;
    },
  };
}

describe('requireHttps', () => {
  it('301-redirects a plain-HTTP request to the same URL on https', () => {
    const result = runMiddleware({
      secure: false,
      hostname: 'ahdora.me',
      hostHeader: 'ahdora.me',
      originalUrl: '/?foo=bar',
    });
    expect(result.redirectStatus).toBe(301);
    expect(result.redirectTarget).toBe('https://ahdora.me/?foo=bar');
    expect(result.nextCalled).toBe(false);
  });

  it('lets an HTTPS request through untouched', () => {
    const result = runMiddleware({
      secure: true,
      hostname: 'ahdora.me',
      hostHeader: 'ahdora.me',
      originalUrl: '/',
    });
    expect(result.nextCalled).toBe(true);
    expect(result.redirectTarget).toBeUndefined();
  });

  it('lets plain HTTP through on localhost (local testing stays usable)', () => {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const result = runMiddleware({
        secure: false,
        hostname,
        hostHeader: hostname,
        originalUrl: '/api/health',
      });
      expect(result.nextCalled).toBe(true);
      expect(result.redirectTarget).toBeUndefined();
    }
  });
});
