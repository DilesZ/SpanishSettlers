import { describe, expect, it } from 'vitest';
import { ROLE_TUNIC, stepPhase, WALKER_ROLES } from '@/three/actors';

describe('actores 3D', () => {
  it('todos los oficios tienen túnica', () => {
    for (const role of WALKER_ROLES) {
      expect(ROLE_TUNIC[role], role).toBeGreaterThan(0);
    }
    expect(WALKER_ROLES).toContain('soldier');
    expect(WALKER_ROLES).toContain('carrier');
  });

  it('la fase avanza con la velocidad y envuelve', () => {
    expect(stepPhase(0, 1, 2)).toBeCloseTo(2);
    expect(stepPhase(6, 1, 2) % (Math.PI * 2)).toBeLessThan(Math.PI * 2);
    expect(stepPhase(1, 0, 5)).toBeCloseTo(1);
  });
});
