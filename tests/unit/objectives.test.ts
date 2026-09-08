import { describe, expect, it } from 'vitest';
import { OBJECTIVES, isComplete } from '@/game/systems/objectives';

describe('objetivos', () => {
  it('cinco objetivos definidos con recompensa', () => {
    expect(OBJECTIVES).toHaveLength(5);
    for (const o of OBJECTIVES) {
      expect(Object.keys(o.reward).length).toBeGreaterThan(0);
    }
  });

  it('sawmill se completa con aserradero', () => {
    expect(isComplete('sawmill', { buildings: ['almacen'], army: 0, wavesRepelled: 0 })).toBe(false);
    expect(isComplete('sawmill', { buildings: ['almacen', 'aserradero'], army: 0, wavesRepelled: 0 })).toBe(true);
  });

  it('army3 y repel2 por contadores', () => {
    expect(isComplete('army3', { buildings: [], army: 2, wavesRepelled: 0 })).toBe(false);
    expect(isComplete('army3', { buildings: [], army: 3, wavesRepelled: 0 })).toBe(true);
    expect(isComplete('repel2', { buildings: [], army: 0, wavesRepelled: 2 })).toBe(true);
  });

  it('id desconocido no completa', () => {
    expect(isComplete('xxx', { buildings: [], army: 0, wavesRepelled: 0 })).toBe(false);
  });
});
