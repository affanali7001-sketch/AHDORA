import { describe, expect, it } from 'vitest';
import { sanitizeInPlace, sanitizeValue } from './sanitize.js';

describe('sanitizeValue', () => {
  it('strips $ keys and dotted keys at any depth', () => {
    const input = {
      email: 'a@b.com',
      $ne: null,
      'a.b': 1,
      nested: { $where: 'x', ok: 2, deep: { $gt: 3, keep: true } },
      list: [{ $or: [], fine: 'yes' }],
    };
    expect(sanitizeValue(input)).toEqual({
      email: 'a@b.com',
      nested: { ok: 2, deep: { keep: true } },
      list: [{ fine: 'yes' }],
    });
  });

  it('passes primitives and clean objects through', () => {
    expect(sanitizeValue('hello')).toBe('hello');
    expect(sanitizeValue(42)).toBe(42);
    expect(sanitizeValue(null)).toBeNull();
    expect(sanitizeValue({ a: 1, b: [1, 2] })).toEqual({ a: 1, b: [1, 2] });
  });
});

describe('sanitizeInPlace', () => {
  it('mutates the object instead of replacing it (Express 5 query getter)', () => {
    const target = { q: 'x', $ne: 1 } as Record<string, unknown>;
    sanitizeInPlace(target);
    expect(target).toEqual({ q: 'x' });
  });
});
