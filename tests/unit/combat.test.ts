import { describe, expect, it } from 'vitest';
import { applyDamage, recruitCost, soldierDps, towerDps, waveSpec } from '@/game/systems/combat';

describe('combate', () => {
  it('las oleadas crecen y tienen tope', () => {
    const w1 = waveSpec(1);
    const w5 = waveSpec(5);
    const w50 = waveSpec(50);
    expect(w5.count).toBeGreaterThan(w1.count);
    expect(w5.enemyHp).toBeGreaterThan(w1.enemyHp);
    expect(w50.count).toBeLessThanOrEqual(8);
  });

  it('el daño mata al llegar a 0', () => {
    const f = { hp: 10, maxHp: 10 };
    expect(applyDamage(f, 4)).toBe(false);
    expect(f.hp).toBe(6);
    expect(applyDamage(f, 6)).toBe(true);
    expect(f.hp).toBe(0);
  });

  it('rango superior pega mas', () => {
    expect(soldierDps(3)).toBeGreaterThan(soldierDps(1));
    expect(towerDps()).toBeGreaterThan(0);
  });

  it('reclutar encarece el pan con el ejercito', () => {
    expect(recruitCost(0).pan).toBe(1);
    expect(recruitCost(8).pan).toBeGreaterThan(1);
  });
});
