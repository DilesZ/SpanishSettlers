import { describe, expect, it } from 'vitest';
import { questState } from '@/game/systems/quest';

describe('quest de onboarding (R1)', () => {
  it('avanza 0→1→2→3 con cabaña, tablón y oleada', () => {
    expect(questState([], 0, 0).step).toBe(0);
    expect(questState(['cabanaLenador'], 0, 0).step).toBe(1);
    expect(questState(['cabanaLenador', 'aserradero'], 1, 0).step).toBe(2);
    const done = questState(['cabanaLenador', 'aserradero'], 1, 1);
    expect(done.step).toBe(3);
    expect(done.complete).toBe(true);
  });

  it('el paso 1 exige tablón de verdad, no solo el edificio', () => {
    const q = questState(['cabanaLenador', 'aserradero'], 0, 0);
    expect(q.step).toBe(1);
    expect(q.steps[1].done).toBe(false);
  });

  it('expone el edificio objetivo del paso actual', () => {
    expect(questState([], 0, 0).target).toBe('cabanaLenador');
    expect(questState(['cabanaLenador'], 0, 0).target).toBe('aserradero');
    expect(questState(['cabanaLenador', 'aserradero'], 1, 1).target).toBeNull();
  });
});
