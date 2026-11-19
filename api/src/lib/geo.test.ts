import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo.js';

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(18.52, 73.85, 18.52, 73.85)).toBe(0);
  });

  it('matches known city distances', () => {
    // Delhi -> Mumbai is about 1,148 km; Pune -> Mumbai about 120 km.
    const delhiMumbai = haversineKm(28.6139, 77.209, 19.076, 72.8777);
    expect(delhiMumbai).toBeGreaterThan(1100);
    expect(delhiMumbai).toBeLessThan(1200);
    const puneMumbai = haversineKm(18.5214, 73.8545, 19.076, 72.8777);
    expect(puneMumbai).toBeGreaterThan(100);
    expect(puneMumbai).toBeLessThan(150);
  });

  it('is symmetric', () => {
    expect(haversineKm(10, 20, 30, 40)).toBeCloseTo(haversineKm(30, 40, 10, 20), 9);
  });
});
