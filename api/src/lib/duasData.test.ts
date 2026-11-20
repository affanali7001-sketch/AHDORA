import { describe, expect, it } from 'vitest';
import {
  DUAS,
  DUA_TOPICS,
  filterDuasByTopic,
  isDuaTopic,
  type Dua,
} from './duasData.js';

/**
 * Duas data guarantees — no invented text, no fake "reviewed"
 * claim, every entry sourced. The route serves this data verbatim,
 * so these checks cover what the endpoint returns.
 */

describe('duasData', () => {
  it('has at least one dua for every topic', () => {
    for (const topic of DUA_TOPICS) {
      expect(
        DUAS.filter((dua) => dua.topics.includes(topic.id)),
        `no dua for topic ${topic.id}`,
      ).not.toHaveLength(0);
    }
  });

  it('has unique, non-empty ids', () => {
    const ids = DUAS.map((dua) => dua.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.trim().length).toBeGreaterThan(0);
  });

  it('every dua has a title, a when, topics and an exact source', () => {
    for (const dua of DUAS) {
      expect(dua.title.trim().length, dua.id).toBeGreaterThan(0);
      expect(dua.when.trim().length, dua.id).toBeGreaterThan(0);
      expect(dua.topics.length, dua.id).toBeGreaterThan(0);
      for (const topic of dua.topics) {
        expect(isDuaTopic(topic), `${dua.id}: unknown topic ${topic}`).toBe(true);
      }
      // An exact reference (collection + number), never a vague claim.
      expect(dua.source.trim().length, dua.id).toBeGreaterThan(0);
      expect(dua.source, `${dua.id}: source must name a collection and number`).toMatch(
        /(Bukhari|Muslim|Abi Dawud|Tirmidhi)/,
      );
      expect(dua.source, `${dua.id}: source must include a hadith number`).toMatch(/\d/);
    }
  });

  it('dua texts carry Arabic + transliteration + Hinglish meaning', () => {
    const texts = DUAS.filter((dua): dua is Dua & { kind: 'dua' } => dua.kind === 'dua');
    expect(texts.length).toBeGreaterThan(0);
    for (const dua of texts) {
      expect(dua.arabic.trim().length, dua.id).toBeGreaterThan(0);
      expect(dua.transliteration.trim().length, dua.id).toBeGreaterThan(0);
      expect(dua.meaning.trim().length, dua.id).toBeGreaterThan(0);
    }
  });

  it('quran-amal cards point at a real surah/ayah and carry no copied verse text', () => {
    const amals = DUAS.filter(
      (dua): dua is Dua & { kind: 'quran-amal' } => dua.kind === 'quran-amal',
    );
    expect(amals.length).toBeGreaterThan(0);
    for (const dua of amals) {
      expect(dua.quranSurah, dua.id).toBeGreaterThanOrEqual(1);
      expect(dua.quranSurah, dua.id).toBeLessThanOrEqual(114);
      expect(dua.quranAyahStart, dua.id).toBeGreaterThanOrEqual(1);
      expect(dua.quranAyahEnd, dua.id).toBeGreaterThanOrEqual(dua.quranAyahStart);
      expect(dua.practice.trim().length, dua.id).toBeGreaterThan(0);
      // The verse text itself is never copied into the card.
      expect(dua, dua.id).not.toHaveProperty('arabic');
    }
  });

  it('makes no "reviewed" claim anywhere in the data', () => {
    expect(JSON.stringify(DUAS).toLowerCase()).not.toContain('reviewed');
  });

  it('filterDuasByTopic returns only matching duas', () => {
    const sleep = filterDuasByTopic(DUAS, 'sleep');
    expect(sleep.length).toBeGreaterThan(0);
    expect(sleep.length).toBeLessThan(DUAS.length);
    for (const dua of sleep) expect(dua.topics).toContain('sleep');
    expect(filterDuasByTopic(DUAS, 'wudu')).toHaveLength(1);
  });

  it('isDuaTopic accepts known topics and rejects the rest', () => {
    expect(isDuaTopic('sleep')).toBe(true);
    expect(isDuaTopic('morning')).toBe(true);
    expect(isDuaTopic('daily')).toBe(true);
    expect(isDuaTopic('wudu')).toBe(true);
    expect(isDuaTopic('evening')).toBe(false);
    expect(isDuaTopic('')).toBe(false);
  });
});
