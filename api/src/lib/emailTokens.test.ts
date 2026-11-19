import { describe, expect, it } from 'vitest';
import { emailTokenExpiry, generateEmailToken, hashEmailToken } from './emailTokens.js';

describe('hashEmailToken', () => {
  it('is a deterministic 64-char SHA-256 hex digest', () => {
    const hash = hashEmailToken('some-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEmailToken('some-token')).toBe(hash);
    expect(hashEmailToken('other-token')).not.toBe(hash);
  });
});

describe('generateEmailToken', () => {
  it('returns distinct tokens', () => {
    expect(generateEmailToken()).not.toBe(generateEmailToken());
  });
});

describe('emailTokenExpiry', () => {
  it('gives verification 24h and reset 1h', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');
    expect(emailTokenExpiry('email_verification', now).toISOString()).toBe('2026-11-20T12:00:00.000Z');
    expect(emailTokenExpiry('password_reset', now).toISOString()).toBe('2026-11-19T13:00:00.000Z');
  });
});
