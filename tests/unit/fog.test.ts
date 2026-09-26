import { describe, expect, it } from 'vitest';
import {
  createFog,
  deserializeFog,
  EXPLORED,
  exploredPercent,
  fogAt,
  HIDDEN,
  isExplored,
  revealCircle,
  settleFog,
  VISIBLE,
} from '@/game/systems/fog';

describe('niebla de guerra', () => {
  it('empieza todo oculto y fuera de mapa es oculto', () => {
    const f = createFog(8);
    expect(fogAt(f, 8, 3, 3)).toBe(HIDDEN);
    expect(fogAt(f, 8, -1, 0)).toBe(HIDDEN);
    expect(isExplored(f, 8, 3, 3)).toBe(false);
  });

  it('revelar marca visible y cuenta estrenos', () => {
    const f = createFog(10);
    const fresh = revealCircle(f, 10, 5, 5, 2);
    expect(fresh).toBeGreaterThan(0);
    expect(fogAt(f, 10, 5, 5)).toBe(VISIBLE);
    expect(fogAt(f, 10, 0, 0)).toBe(HIDDEN);
    // Re-revelar no cuenta estrenos.
    expect(revealCircle(f, 10, 5, 5, 2)).toBe(0);
  });

  it('al asentar, lo visible queda explorado (construible)', () => {
    const f = createFog(10);
    revealCircle(f, 10, 5, 5, 2);
    settleFog(f);
    expect(fogAt(f, 10, 5, 5)).toBe(EXPLORED);
    expect(isExplored(f, 10, 5, 5)).toBe(true);
    expect(isExplored(f, 10, 0, 0)).toBe(false);
  });

  it('porcentaje explorado y serialización', () => {
    const f = createFog(4);
    expect(exploredPercent(f)).toBe(0);
    revealCircle(f, 4, 1, 1, 10);
    expect(exploredPercent(f)).toBe(100);
    const g = deserializeFog(JSON.parse(JSON.stringify(Array.from(f))), 4);
    expect(exploredPercent(g)).toBe(100);
    expect(deserializeFog(null, 4).length).toBe(16);
  });
});
