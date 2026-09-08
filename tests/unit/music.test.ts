import { describe, expect, it } from 'vitest';
import { BASE_FREQ, DORIAN, degreeToFreq, melodyStep } from '@/game/music';

describe('musica generativa', () => {
  it('la escala doria tiene 2 octavas', () => {
    expect(DORIAN.length).toBe(15);
    expect(DORIAN[7] - DORIAN[0]).toBe(12);
  });

  it('degreeToFreq respeta la tónica', () => {
    expect(degreeToFreq(0)).toBeCloseTo(BASE_FREQ, 5);
    expect(degreeToFreq(7)).toBeCloseTo(BASE_FREQ * 2, 5);
  });

  it('el paseo se mantiene en rango', () => {
    let d = 7;
    let s = 1234;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 500; i++) {
      d = melodyStep(d, rand);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(DORIAN.length);
    }
  });
});
