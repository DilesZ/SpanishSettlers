import { describe, expect, it } from 'vitest';
import { BUILDINGS, type ResourceId } from '@/game/data/buildings';
import { createInitialStock } from '@/game/systems/economy';
import {
  findRivalBase,
  nextRivalBuild,
  RIVAL_INITIAL_STOCK,
  RIVAL_LATE,
  RIVAL_ORDER,
} from '@/game/systems/rival';

describe('rival', () => {
  it('el orden es válido y empieza por economía', () => {
    expect(RIVAL_ORDER.length).toBeGreaterThan(10);
    for (const id of [...RIVAL_ORDER, ...RIVAL_LATE]) {
      expect(BUILDINGS[id], id).toBeTruthy();
    }
    expect(RIVAL_ORDER.slice(0, 4)).toContain('cabanaLenador');
  });

  it('pide lo primero pendiente que pueda pagar', () => {
    const stock = createInitialStock();
    expect(nextRivalBuild(RIVAL_ORDER, [], stock)).toBe(RIVAL_ORDER[0]);
    // ya construido el primero → pide el segundo
    expect(nextRivalBuild(RIVAL_ORDER, [RIVAL_ORDER[0]], stock)).toBe(RIVAL_ORDER[1]);
    // sin recursos espera (null) en vez de saltar de fase
    const pobre: Record<ResourceId, number> = { ...stock, madera: 0, piedra: 0, tablon: 0 };
    expect(nextRivalBuild(RIVAL_ORDER, [RIVAL_ORDER[0]], pobre)).toBeNull();
  });

  it('el stock inicial cubre los primeros edificios', () => {
    const s = { ...createInitialStock(), ...RIVAL_INITIAL_STOCK };
    for (const id of RIVAL_ORDER.slice(0, 3)) {
      const cost = BUILDINGS[id].coste;
      const ok = Object.entries(cost).every(([k, v]) => (s[k as ResourceId] ?? 0) >= (v ?? 0));
      expect(ok, id).toBe(true);
    }
  });

  it('encuentra base rival en tierra lejos del centro', () => {
    const terrainAt = (x: number, y: number) => {
      const d = Math.hypot(x - 14, y - 14);
      if (d > 11) return 'water';
      if (x === 20 && y === 20) return 'mountain';
      return 'grass';
    };
    const base = findRivalBase(terrainAt, 28, 14, 14);
    expect(base).not.toBeNull();
    const d = Math.hypot(base!.x - 14, base!.y - 14);
    expect(d).toBeGreaterThanOrEqual(5);
    expect(terrainAt(base!.x, base!.y)).toBe('grass');
  });

  it('sin tierra lejana no hay rival', () => {
    expect(findRivalBase(() => 'water', 28, 14, 14)).toBeNull();
  });
});
