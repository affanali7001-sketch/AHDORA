import { describe, expect, it } from 'vitest';
import { RECITERS, audioFallbackUrl, audioUrl } from './quranUpstream.js';

/**
 * Quran audio URL tests (pure — no network).
 *
 * P3 (overnight check 2026-11-20): "Play audio" failed on
 * Al-Faatiha ayahs 1–2. The EveryAyah URL format itself was
 * verified live with curl (200, audio/mpeg, incl. browser UA +
 * Referer + Range requests), so these tests pin the exact format
 * that was verified, plus the AlQuran Cloud CDN fallback URL
 * (same reciter, GLOBAL ayah number) that the client now tries
 * when EveryAyah fails to load. The fallback bitrates are part
 * of the contract: ar.abdulbasitmurattal returns 403 at 128 kbps,
 * so Abdul Basit's fallback must be 64 kbps.
 */
describe('audioUrl (EveryAyah, primary)', () => {
  it('pads surah and ayah to 3 digits: Al-Faatiha ayah 1 -> 001001', () => {
    expect(audioUrl('Alafasy_128kbps', 1, 1)).toBe(
      'https://everyayah.com/data/Alafasy_128kbps/001001.mp3',
    );
  });

  it('pads surah and ayah to 3 digits: Al-Faatiha ayah 2 -> 001002', () => {
    expect(audioUrl('Alafasy_128kbps', 1, 2)).toBe(
      'https://everyayah.com/data/Alafasy_128kbps/001002.mp3',
    );
  });

  it('handles the last ayah of the Quran: surah 114 ayah 6 -> 114006', () => {
    expect(audioUrl('Alafasy_128kbps', 114, 6)).toBe(
      'https://everyayah.com/data/Alafasy_128kbps/114006.mp3',
    );
  });

  it('builds a URL for every offered reciter folder', () => {
    for (const reciter of RECITERS) {
      const url = audioUrl(reciter.id, 1, 1);
      expect(url).toBe(`https://everyayah.com/data/${reciter.id}/001001.mp3`);
    }
  });
});

describe('audioFallbackUrl (AlQuran Cloud CDN)', () => {
  it('uses the global ayah number, not surah+ayah', () => {
    expect(audioFallbackUrl('Alafasy_128kbps', 1)).toBe(
      'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
    );
    // Surah 114 ayah 6 is global ayah 6236.
    expect(audioFallbackUrl('Alafasy_128kbps', 6236)).toBe(
      'https://cdn.islamic.network/quran/audio/128/ar.alafasy/6236.mp3',
    );
  });

  it('uses 128 kbps for Alafasy, Husary and Maher Al-Muaiqly', () => {
    expect(audioFallbackUrl('Alafasy_128kbps', 2)).toContain('/audio/128/ar.alafasy/2.mp3');
    expect(audioFallbackUrl('Husary_128kbps', 2)).toContain('/audio/128/ar.husary/2.mp3');
    expect(audioFallbackUrl('Maher_AlMuaiqly_64kbps', 2)).toContain(
      '/audio/128/ar.mahermuaiqly/2.mp3',
    );
  });

  it('uses 64 kbps for Abdul Basit — 128 kbps returns 403 for that edition', () => {
    expect(audioFallbackUrl('Abdul_Basit_Murattal_192kbps', 1)).toBe(
      'https://cdn.islamic.network/quran/audio/64/ar.abdulbasitmurattal/1.mp3',
    );
  });

  it('falls back to Alafasy for an unknown reciter id instead of a broken URL', () => {
    expect(audioFallbackUrl('NoSuchReciter', 1)).toBe(
      'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
    );
  });
});
