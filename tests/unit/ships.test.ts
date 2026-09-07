import { describe, expect, it } from 'vitest';
import { goodsFor, isNavigable, pickFishingCircuit, touchesWater } from '@/game/systems/ships';

describe('sistema naval', () => {
  it('solo el agua es navegable', () => {
    expect(isNavigable('water')).toBe(true);
    expect(isNavigable('waterB')).toBe(true);
    expect(isNavigable('sand')).toBe(false);
    expect(isNavigable('grass')).toBe(false);
  });

  it('el puerto exige agua adyacente', () => {
    const at = (x: number, y: number) => (x === 5 && y === 5 ? 'water' : 'grass');
    expect(touchesWater(4, 5, at)).toBe(true);
    expect(touchesWater(0, 0, at)).toBe(false);
    expect(touchesWater(5, 5, () => 'grass')).toBe(false);
  });

  it('mercancia por edificio de origen', () => {
    expect(goodsFor('cabanaLenador')).toBe('madera');
    expect(goodsFor('minaOro')).toBe('oro');
    expect(goodsFor('puerto')).toBe('pez');
    expect(goodsFor('torre')).toBe('tablon');
  });

  it('el circuito pesquero cae en agua y separado', () => {
    const isWater = (x: number, y: number) => x >= 10 && y >= 10;
    let s = 42;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const spots = pickFishingCircuit({ x: 14, y: 14 }, isWater, 28, 28, 9, 4, rand);
    expect(spots.length).toBeGreaterThan(0);
    for (const p of spots) expect(isWater(p.x, p.y)).toBe(true);
  });
});
