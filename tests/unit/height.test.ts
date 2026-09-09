import { describe, expect, it } from 'vitest';
import { heightAt, HEIGHT_SCALE, slopeAt, smoothHeightAt, tileToWorld, waterLevel } from '@/three/height';

describe('heightfield', () => {
  it('agua bajo el nivel del mar y tierra alta en el centro', () => {
    expect(heightAt(0, 0)).toBeLessThan(waterLevel());
    expect(heightAt(14, 14)).toBeGreaterThan(0.2);
  });

  it('es determinista', () => {
    expect(heightAt(10, 12)).toBe(heightAt(10, 12));
  });

  it('tileToWorld centra la loseta y asienta en su altura', () => {
    const p = tileToWorld(14, 14);
    expect(p.y).toBeCloseTo(heightAt(14, 14) * HEIGHT_SCALE, 6);
  });

  it('smoothHeightAt coincide en enteros y suaviza entre ellos', () => {
    expect(smoothHeightAt(14, 14)).toBeCloseTo(heightAt(14, 14), 6);
    const a = smoothHeightAt(14.5, 14);
    const lo = Math.min(heightAt(14, 14), heightAt(15, 14));
    const hi = Math.max(heightAt(14, 14), heightAt(15, 14));
    expect(a).toBeGreaterThanOrEqual(lo);
    expect(a).toBeLessThanOrEqual(hi);
  });

  it('slopeAt es cero en llano y positivo en pendiente', () => {
    expect(slopeAt(14, 14)).toBeGreaterThanOrEqual(0);
    expect(slopeAt(14, 14)).toBeLessThan(0.2);
  });
});
