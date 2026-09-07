import { describe, expect, it } from 'vitest';
import { fightRound, insideTerritory, soldierPower } from '@/game/systems/territory';

describe('territorio y combate', () => {
  it('detecta dentro/fuera del borde', () => {
    expect(insideTerritory({ x: 1, y: 1 }, [{ x: 0, y: 0 }], 5)).toBe(true);
    expect(insideTerritory({ x: 10, y: 10 }, [{ x: 0, y: 0 }], 5)).toBe(false);
  });

  it('rango 3 es mas fuerte que rango 1', () => {
    const n1 = soldierPower({ id: 1, tipo: 'espada', rango: 1, hp: 100, maxHp: 100, pos: { x: 0, y: 0 } }, 1);
    const n3 = soldierPower({ id: 2, tipo: 'espada', rango: 3, hp: 100, maxHp: 100, pos: { x: 0, y: 0 } }, 1);
    expect(n3).toBeGreaterThan(n1);
  });

  it('una ronda de combate dana a ambos', () => {
    const a = { id: 1, tipo: 'espada' as const, rango: 1 as const, hp: 100, maxHp: 100, pos: { x: 0, y: 0 } };
    const b = { id: 2, tipo: 'espada' as const, rango: 1 as const, hp: 100, maxHp: 100, pos: { x: 1, y: 0 } };
    const r = fightRound(a, b, 1, 1);
    expect(r.a.hp).toBeLessThan(100);
    expect(r.b.hp).toBeLessThan(100);
  });
});
