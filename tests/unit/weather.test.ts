import { describe, expect, it } from 'vitest';
import {
  FIRST_SHOWER_DELAY_MS,
  MAX_RAIN_DROPS,
  MAX_RAIN_RIPPLES,
  MAX_RAIN_SPLASHES,
  MAX_SHOWER_DURATION_MS,
  MAX_SHOWER_GAP_MS,
  MIN_SHOWER_DURATION_MS,
  MIN_SHOWER_GAP_MS,
  isRainForced,
  nextShowerDelayMs,
  showerDurationMs,
} from '@/game/fx/weather';

describe('weather: planificación pura de chubascos', () => {
  it('el primer chubasco es fijo (~90 s), ignore la rng', () => {
    expect(nextShowerDelayMs(true, () => 0)).toBe(FIRST_SHOWER_DELAY_MS);
    expect(nextShowerDelayMs(true, () => 0.9999)).toBe(FIRST_SHOWER_DELAY_MS);
    expect(FIRST_SHOWER_DELAY_MS).toBe(90_000);
  });

  it('los siguientes caen en [3, 6] min según la rng', () => {
    expect(nextShowerDelayMs(false, () => 0)).toBe(MIN_SHOWER_GAP_MS);
    expect(nextShowerDelayMs(false, () => 1)).toBe(MAX_SHOWER_GAP_MS);
    expect(nextShowerDelayMs(false, () => 0.5)).toBe(270_000);
    expect(MIN_SHOWER_GAP_MS).toBe(180_000);
    expect(MAX_SHOWER_GAP_MS).toBe(360_000);
  });

  it('la duración cae en [25, 45] s', () => {
    expect(showerDurationMs(() => 0)).toBe(MIN_SHOWER_DURATION_MS);
    expect(showerDurationMs(() => 1)).toBe(MAX_SHOWER_DURATION_MS);
    expect(MIN_SHOWER_DURATION_MS).toBe(25_000);
    expect(MAX_SHOWER_DURATION_MS).toBe(45_000);
  });

  it('la planificación es determinista con la misma rng', () => {
    const seq = [0.1, 0.7, 0.3];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const a = [nextShowerDelayMs(false, rng), showerDurationMs(rng)];
    i = 0;
    const b = [nextShowerDelayMs(false, rng), showerDurationMs(rng)];
    expect(a).toEqual(b);
  });

  it('sujeta rng degeneradas al rango (sin NaN ni negativos)', () => {
    expect(nextShowerDelayMs(false, () => NaN)).toBe(MIN_SHOWER_GAP_MS);
    expect(nextShowerDelayMs(false, () => -5)).toBe(MIN_SHOWER_GAP_MS);
    expect(nextShowerDelayMs(false, () => 99)).toBe(MAX_SHOWER_GAP_MS);
    expect(showerDurationMs(() => NaN)).toBe(MIN_SHOWER_DURATION_MS);
  });

  it('presupuesto estricto de objetos vivos', () => {
    expect(MAX_RAIN_DROPS).toBe(90);
    expect(MAX_RAIN_SPLASHES).toBeLessThanOrEqual(24);
    expect(MAX_RAIN_RIPPLES).toBeLessThanOrEqual(12);
    expect(MAX_RAIN_DROPS + MAX_RAIN_SPLASHES + MAX_RAIN_RIPPLES).toBeLessThanOrEqual(130);
  });
});

describe('weather: forzado con ?lluvia=1', () => {
  it('detecta ?lluvia=1 solo y combinada', () => {
    expect(isRainForced('?lluvia=1')).toBe(true);
    expect(isRainForced('?dia=1&lluvia=1')).toBe(true);
    expect(isRainForced('?lluvia=1&noche=1')).toBe(true);
  });

  it('no llueve sin el parámetro (patrón ?dia/?noche intacto)', () => {
    expect(isRainForced('?dia=1')).toBe(false);
    expect(isRainForced('?noche=1')).toBe(false);
    expect(isRainForced('?demo=puerto')).toBe(false);
    expect(isRainForced('?lluvia=0')).toBe(false);
    expect(isRainForced('')).toBe(false);
    expect(isRainForced(null)).toBe(false);
    expect(isRainForced(undefined)).toBe(false);
  });
});
