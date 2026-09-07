// Combate defensivo (lógica pura, testeable): oleadas de incursores,
// torres que disparan, soldados que responden y edificios con PV.
export interface WaveSpec {
  count: number;
  enemyHp: number;
  enemyDmg: number;
}

/** Oleada N (1-based): crece en número y dureza. */
export function waveSpec(n: number): WaveSpec {
  return {
    count: Math.min(2 + n, 8),
    enemyHp: 18 + n * 6,
    enemyDmg: 2 + Math.floor(n / 2),
  };
}

/** Daño de torre por nivel de munición (siempre disponible). */
export function towerDps(): number {
  return 4;
}

/** Daño cuerpo a cuerpo de soldado propio por rango. */
export function soldierDps(rank: 1 | 2 | 3): number {
  return rank === 1 ? 2 : rank === 2 ? 3 : 5;
}

export interface Fighter {
  hp: number;
  maxHp: number;
}

export function applyDamage(f: Fighter, dmg: number): boolean {
  f.hp = Math.max(0, f.hp - dmg);
  return f.hp <= 0;
}

/** Coste de reclutar un soldado en el cuartel. */
export function recruitCost(count: number): { espada: number; pan: number } {
  return { espada: 1, pan: 1 + Math.floor(count / 4) };
}
