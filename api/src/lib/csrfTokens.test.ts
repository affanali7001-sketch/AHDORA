import { describe, expect, it } from 'vitest';
import { csrfTokensEqual, generateCsrfToken } from './csrfTokens.js';

describe('generateCsrfToken', () => {
  it('returns distinct, non-empty tokens', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });
});

describe('csrfTokensEqual', () => {
  it('accepts equal tokens and rejects everything else', () => {
    expect(csrfTokensEqual('abc123', 'abc123')).toBe(true);
    expect(csrfTokensEqual('abc123', 'abc124')).toBe(false);
    expect(csrfTokensEqual('abc123', 'abc12')).toBe(false);
    expect(csrfTokensEqual('', '')).toBe(true);
    expect(csrfTokensEqual('abc123', '')).toBe(false);
  });
});
