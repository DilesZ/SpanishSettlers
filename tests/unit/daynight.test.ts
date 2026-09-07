import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_MS, skyAt } from '@/game/systems/daynight';

describe('ciclo dia/noche', () => {
  it('mediodia sin oscuridad ni faroles', () => {
    const s = skyAt(DAY_LENGTH_MS * 0.25);
    expect(s.darkness).toBeCloseTo(0, 2);
    expect(s.lanternAlpha).toBe(0);
    expect(s.isNight).toBe(false);
  });

  it('medianoche oscura con faroles y estrellas', () => {
    const s = skyAt(DAY_LENGTH_MS * 0.75);
    expect(s.darkness).toBeCloseTo(1, 2);
    expect(s.lanternAlpha).toBeGreaterThan(0.8);
    expect(s.starsAlpha).toBeGreaterThan(0.5);
    expect(s.isNight).toBe(true);
  });

  it('el ciclo es periodico', () => {
    expect(skyAt(0)).toEqual(skyAt(DAY_LENGTH_MS));
    expect(skyAt(12345)).toEqual(skyAt(12345 + DAY_LENGTH_MS * 3));
  });

  it('amanecer/atardecer tienen tinte calido', () => {
    expect(skyAt(0).overlayColor).toBe(0xd86a2e);
    expect(skyAt(DAY_LENGTH_MS * 0.5).overlayColor).toBe(0xd86a2e);
  });
});
