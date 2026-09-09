import { describe, expect, it } from 'vitest';
import { scatterVegetation } from '@/three/vegetation';

describe('vegetación 3D', () => {
  it('reparte según bioma y es determinista', () => {
    const a = scatterVegetation(7);
    const b = scatterVegetation(7);
    expect(a).toEqual(b);
    expect(a.trees.length).toBeGreaterThan(30);
    expect(a.rocks.length).toBeGreaterThan(5);
    expect(a.grass.length).toBeGreaterThan(100);
    expect(a.flowers.length).toBeGreaterThan(5);
    for (const t of [...a.trees, ...a.rocks, ...a.flowers]) {
      expect(t.tx).toBeGreaterThanOrEqual(0);
      expect(t.tx).toBeLessThan(28);
    }
  });

  it('nada en el agua', () => {
    const s = scatterVegetation(7);
    for (const t of [...s.trees, ...s.rocks, ...s.grass, ...s.flowers]) {
      expect(t.terrain === 'water' || t.terrain === 'waterB' || t.terrain === 'waterC').toBe(false);
    }
  });
});
