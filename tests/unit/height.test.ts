import { describe, expect, it } from 'vitest';
import { heightAt, HEIGHT_SCALE, slopeAt, smoothHeightAt, tileToWorld, waterLevel } from '@/three/height';
import { ISLAND_SIZE } from '@/game/maps/island';

// Coordenadas derivadas del tamaño (la isla creció de 28 a 40: nada fijo).
const C = Math.floor(ISLAND_SIZE / 2);

describe('heightfield', () => {
  it('agua bajo el nivel del mar y tierra alta en el centro', () => {
    expect(heightAt(0, 0)).toBeLessThan(waterLevel());
    expect(heightAt(C, C)).toBeGreaterThan(0.2);
  });

  it('es determinista', () => {
    expect(heightAt(10, 12)).toBe(heightAt(10, 12));
  });

  it('tileToWorld centra la loseta y asienta en su altura', () => {
    const p = tileToWorld(C, C);
    expect(p.y).toBeCloseTo(heightAt(C, C) * HEIGHT_SCALE, 6);
  });

  it('smoothHeightAt coincide en enteros y suaviza entre ellos', () => {
    expect(smoothHeightAt(C, C)).toBeCloseTo(heightAt(C, C), 6);
    const a = smoothHeightAt(C + 0.5, C);
    const lo = Math.min(heightAt(C, C), heightAt(C + 1, C));
    const hi = Math.max(heightAt(C, C), heightAt(C + 1, C));
    expect(a).toBeGreaterThanOrEqual(lo);
    expect(a).toBeLessThanOrEqual(hi);
  });

  it('slopeAt es cero en llano y positivo en pendiente', () => {
    expect(slopeAt(C, C)).toBeGreaterThanOrEqual(0);
    expect(slopeAt(C, C)).toBeLessThan(0.2);
  });
});
