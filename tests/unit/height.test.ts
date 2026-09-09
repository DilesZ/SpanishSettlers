import { describe, expect, it } from 'vitest';
import { heightAt, HEIGHT_SCALE, tileToWorld, waterLevel } from '@/three/height';

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
});
