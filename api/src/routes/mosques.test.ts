import { describe, expect, it } from 'vitest';
import {
  NOMINATIM_TIMEOUT_MS,
  OVERPASS_QUERY_TIMEOUT_SECONDS,
  OVERPASS_TIMEOUT_MS,
  mosqueUpstreamError,
} from './mosques.js';

/**
 * Mosque finder timeout tests (pure — no network, no DB).
 *
 * P4 (overnight check 2026-11-20): searching "Pune" hung on
 * "Searching OpenStreetMap…" for 20+ s with no result, no
 * timeout and no error. Measured 2026-11-21: Nominatim ~1.4 s,
 * but a 10 km Overpass query around Pune takes ~36 s — and the
 * old code allowed 10 s + 50 s with no client timeout at all.
 * These tests pin the bounded budgets and the honest timeout
 * response (504 with a retry hint, not a silent spinner or a
 * generic 502).
 */
describe('mosque upstream timeout budgets', () => {
  it('bounds a city search at ~35 s worst case (geocode + Overpass)', () => {
    expect(NOMINATIM_TIMEOUT_MS + OVERPASS_TIMEOUT_MS).toBeLessThanOrEqual(40_000);
  });

  it('gives the Overpass server a shorter query timeout than the fetch timeout', () => {
    expect(OVERPASS_QUERY_TIMEOUT_SECONDS * 1000).toBeLessThan(OVERPASS_TIMEOUT_MS);
  });
});

describe('mosqueUpstreamError', () => {
  it('maps an upstream timeout to 504 with a retry hint', () => {
    const result = mosqueUpstreamError(new Error('UPSTREAM_TIMEOUT'));
    expect(result.status).toBe(504);
    expect(result.error).toMatch(/took too long/i);
    expect(result.error).toMatch(/try again/i);
  });

  it('maps other upstream failures to 502', () => {
    for (const error of [
      new Error('UPSTREAM_UNREACHABLE'),
      new Error('UPSTREAM_FAILED'),
      new Error('boom'),
    ]) {
      const result = mosqueUpstreamError(error);
      expect(result.status).toBe(502);
      expect(result.error).toMatch(/could not be loaded/i);
    }
  });
});
