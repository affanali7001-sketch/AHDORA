import { describe, expect, it } from 'vitest';
import {
  DUAS,
  DUA_TOPICS,
  filterDuasByTopic,
  isDuaTopic,
  type Dua,
  type DuaTopic,
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
      // Collections used across the library: the original six plus
      // Ibn Majah, an-Nasa'i and Ibn Hibban (2026-11-23 expansion).
      expect(dua.source, `${dua.id}: source must name a collection and number`).toMatch(
        /(Bukhari|Muslim|Abi Dawud|Tirmidhi|Ahmad|Quran|Ibn Majah|Nasa|Ibn Hibban)/,
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
    expect(filterDuasByTopic(DUAS, 'wudu')).toHaveLength(4);
  });

  it('isDuaTopic accepts known topics and rejects the rest', () => {
    expect(isDuaTopic('sleep')).toBe(true);
    expect(isDuaTopic('morning')).toBe(true);
    expect(isDuaTopic('daily')).toBe(true);
    expect(isDuaTopic('wudu')).toBe(true);
    expect(isDuaTopic('anxiety')).toBe(true);
    expect(isDuaTopic('overthinking')).toBe(true);
    // Topics added in the 2026-11-23 expansion (22 -> 100+ duas).
    expect(isDuaTopic('evening')).toBe(true);
    expect(isDuaTopic('prayer')).toBe(true);
    expect(isDuaTopic('adhan')).toBe(true);
    expect(isDuaTopic('mosque')).toBe(true);
    expect(isDuaTopic('food')).toBe(true);
    expect(isDuaTopic('travel')).toBe(true);
    expect(isDuaTopic('distress')).toBe(true);
    expect(isDuaTopic('gratitude')).toBe(true);
    expect(isDuaTopic('protection')).toBe(true);
    expect(isDuaTopic('sickness')).toBe(true);
    expect(isDuaTopic('forgiveness')).toBe(true);
    expect(isDuaTopic('knowledge')).toBe(true);
    expect(isDuaTopic('family')).toBe(true);
    expect(isDuaTopic('work')).toBe(true);
    expect(isDuaTopic('rain')).toBe(true);
    expect(isDuaTopic('notatopic')).toBe(false);
    expect(isDuaTopic('')).toBe(false);
  });

  it('keeps the original 11 duas first, in their original order', () => {
    expect(DUAS.slice(0, 11).map((dua) => dua.id)).toEqual([
      'sone-se-pehle',
      'bistar-par-lete-waqt',
      'neend-na-aaye-ayat-kursi',
      'neend-na-aaye-baqarah-aakhri',
      'jaagne-par',
      'khana-shuru-karne-se-pehle',
      'khane-ke-baad',
      'ghar-se-nikalte-waqt',
      'pareshani-mein',
      'toilet-jane-se-pehle',
      'wuzu-ke-baad',
    ]);
  });

  it('has the Phase 13 anxiety / overthinking / sleep duas', () => {
    // The Phase 13 entries stay first in each topic; the 2026-11-23
    // expansion appends more entries to the same topics afterwards.
    expect(filterDuasByTopic(DUAS, 'anxiety').map((dua) => dua.id).slice(0, 3)).toEqual([
      'pareshani-ghabrahat',
      'allahumma-inni-abduka',
      'rehmat-ki-ummed',
    ]);
    expect(filterDuasByTopic(DUAS, 'overthinking').map((dua) => dua.id)).toEqual([
      'yunus-ki-dua',
      'hasbunallahu',
      'amantu-billahi',
      'taawwudh',
      'namaz-mein-waswasa',
    ]);
    expect(filterDuasByTopic(DUAS, 'sleep')).toHaveLength(12);
    expect(DUAS.map((dua) => dua.id)).toContain('aslamtu-nafsi');
    expect(DUAS.map((dua) => dua.id)).toContain('sone-se-pehle-teen-qul');
    expect(DUAS.map((dua) => dua.id)).toContain('tasbeeh-e-fatimah');
  });

  it('does not duplicate duas that already existed', () => {
    // Distress dua (Bukhari 6346 / Muslim 2730) stays a single entry.
    expect(DUAS.filter((dua) => dua.id === 'pareshani-mein')).toHaveLength(1);
    expect(DUAS.filter((dua) => dua.source.includes('6346'))).toHaveLength(1);
    // Sleep duas from the original list stay single entries too.
    for (const id of ['sone-se-pehle', 'bistar-par-lete-waqt', 'jaagne-par']) {
      expect(DUAS.filter((dua) => dua.id === id)).toHaveLength(1);
    }
  });

  it('has at least 100 verified duas after the 2026-11-23 expansion', () => {
    expect(DUAS.length).toBeGreaterThanOrEqual(100);
    // The original 22 are all still present, byte-identical ids.
    for (const id of [
      'sone-se-pehle',
      'bistar-par-lete-waqt',
      'neend-na-aaye-ayat-kursi',
      'neend-na-aaye-baqarah-aakhri',
      'jaagne-par',
      'khana-shuru-karne-se-pehle',
      'khane-ke-baad',
      'ghar-se-nikalte-waqt',
      'pareshani-mein',
      'toilet-jane-se-pehle',
      'wuzu-ke-baad',
      'pareshani-ghabrahat',
      'allahumma-inni-abduka',
      'rehmat-ki-ummed',
      'yunus-ki-dua',
      'hasbunallahu',
      'amantu-billahi',
      'taawwudh',
      'namaz-mein-waswasa',
      'aslamtu-nafsi',
      'sone-se-pehle-teen-qul',
      'tasbeeh-e-fatimah',
    ]) {
      expect(DUAS.map((dua) => dua.id), `missing original dua ${id}`).toContain(id);
    }
    // Every new category has real coverage, not a single token entry.
    for (const topic of ['evening', 'prayer', 'adhan', 'mosque', 'food', 'travel']) {
      expect(filterDuasByTopic(DUAS, topic as DuaTopic).length).toBeGreaterThanOrEqual(3);
    }
    for (const topic of ['distress', 'gratitude', 'protection', 'sickness', 'forgiveness']) {
      expect(filterDuasByTopic(DUAS, topic as DuaTopic).length).toBeGreaterThanOrEqual(4);
    }
    for (const topic of ['knowledge', 'family', 'work', 'rain']) {
      expect(filterDuasByTopic(DUAS, topic as DuaTopic).length).toBeGreaterThanOrEqual(4);
    }
    // The expansion's key sources are present with their exact numbers.
    const byId = new Map(DUAS.map((dua) => [dua.id, dua]));
    expect(byId.get('sayyid-al-istighfar')?.source).toContain('Bukhari 6306');
    expect(byId.get('subah-asbahna')?.source).toContain('Muslim 2723');
    expect(byId.get('bika-asbahna')?.source).toContain('Tirmidhi 3391');
    expect(byId.get('adhan-ke-baad')?.source).toContain('Bukhari 614');
    expect(byId.get('safar-ki-dua')?.source).toContain('Muslim 1342');
    expect(byId.get('ya-hayyu-ya-qayyum')?.source).toContain('Tirmidhi 3524');
    expect(byId.get('istikhara')?.source).toContain('Bukhari 1166');
    expect(byId.get('baarish-par')?.source).toContain('Bukhari 1032');
    expect(byId.get('rabbana-atina')?.source).toContain('Quran 2:201');
    expect(byId.get('la-ba-sa-tahurun')?.source).toContain('Bukhari 5656');
  });

  it('keeps the weak-chain insomnia dua out', () => {
    const text = JSON.stringify(DUAS).toLowerCase();
    expect(text).not.toContain('gharat');
    expect(text).not.toContain('gharatin-nujum');
    expect(text).not.toContain('gharat an-nujum');
  });

  it('every new dua carries its exact reference', () => {
    const byId = new Map(DUAS.map((dua) => [dua.id, dua]));
    expect(byId.get('pareshani-ghabrahat')?.source).toContain('Bukhari 6369');
    expect(byId.get('allahumma-inni-abduka')?.source).toContain('Ahmad 3712');
    expect(byId.get('rehmat-ki-ummed')?.source).toContain('Abi Dawud 5090');
    expect(byId.get('yunus-ki-dua')?.source).toContain('Quran 21:87');
    expect(byId.get('hasbunallahu')?.source).toContain('Quran 3:173');
    expect(byId.get('amantu-billahi')?.source).toContain('Muslim 134');
    expect(byId.get('taawwudh')?.source).toContain('Quran 7:200');
    expect(byId.get('namaz-mein-waswasa')?.source).toContain('Muslim 2203');
    expect(byId.get('aslamtu-nafsi')?.source).toContain('Bukhari 247');
    expect(byId.get('sone-se-pehle-teen-qul')?.source).toContain('Bukhari 5017');
    expect(byId.get('tasbeeh-e-fatimah')?.source).toContain('Bukhari 3705');
  });
});
