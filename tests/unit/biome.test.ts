import { describe, expect, it } from 'vitest';
import { surfaceColor } from '@/three/biome';

describe('biomas 3D', () => {
  it('agua, hierba, arena y montaña se distinguen', () => {
    const water = surfaceColor('water', 0, -0.2, 0);
    const grass = surfaceColor('grass', 0, 0.5, 0);
    const sand = surfaceColor('sand', 0, 0.1, 0);
    const rock = surfaceColor('grass', 0, 0.5, 0.8);
    expect(water[2]).toBeGreaterThan(water[0]); // azulada
    expect(grass[1]).toBeGreaterThan(grass[0]); // verde
    expect(sand[0]).toBeGreaterThan(sand[2]); // arenosa
    expect(rock[0]).toBeGreaterThan(grass[0]); // la pendiente agrisa
    expect(rock[1]).toBeLessThan(grass[1]);
  });

  it('colores en rango y deterministas', () => {
    const a = surfaceColor('forest', 3, 0.6, 0.1);
    const b = surfaceColor('forest', 3, 0.6, 0.1);
    expect(a).toEqual(b);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
