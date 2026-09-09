import { describe, expect, it } from 'vitest';
import {
  foodPerTick,
  growthPerTick,
  housingFor,
  moraleOf,
} from '@/game/systems/population';

describe('población', () => {
  it('vivienda suma almacén + casas', () => {
    expect(housingFor(['almacen'])).toBe(10);
    expect(housingFor(['almacen', 'residenciaS', 'residenciaM', 'residenciaL'])).toBe(90);
    expect(housingFor(['cabanaLenador', 'torre'])).toBe(0);
  });

  it('moral máxima con techo y comida, mínima sin nada', () => {
    expect(moraleOf({ population: 20, housing: 40, food: 10 })).toBe(100);
    expect(moraleOf({ population: 20, housing: 0, food: 0 })).toBeLessThan(40);
    const mid = moraleOf({ population: 20, housing: 40, food: 0 });
    expect(mid).toBeGreaterThan(moraleOf({ population: 20, housing: 0, food: 0 }));
    expect(mid).toBeLessThan(100);
  });

  it('sin techo no hay crecimiento; con todo a favor sí', () => {
    expect(growthPerTick({ population: 40, housing: 40, food: 10, morale: 100 })).toBe(0);
    expect(growthPerTick({ population: 20, housing: 40, food: 10, morale: 100 })).toBeGreaterThan(0);
  });

  it('hambre y hacinamiento restan (emigración)', () => {
    expect(growthPerTick({ population: 20, housing: 40, food: 0, morale: 30 })).toBeLessThan(0);
    expect(growthPerTick({ population: 50, housing: 40, food: 10, morale: 80 })).toBeLessThan(0);
  });

  it('a mejor moral, más crecimiento', () => {
    const base = { population: 20, housing: 40, food: 10 };
    expect(growthPerTick({ ...base, morale: 100 })).toBeGreaterThan(
      growthPerTick({ ...base, morale: 50 }),
    );
  });

  it('el apetito escala con la población', () => {
    expect(foodPerTick(0)).toBe(0);
    expect(foodPerTick(20)).toBeCloseTo(0.1);
    expect(foodPerTick(40)).toBeGreaterThan(foodPerTick(20));
  });
});
