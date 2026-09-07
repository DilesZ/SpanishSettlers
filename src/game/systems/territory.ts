// Territorio + combate (lógica pura, testeable).
// Pioneros/torres expanden el borde; combate N1-N3 + líder con bonus económico.

export interface Vec { x: number; y: number }

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** ¿Está el punto dentro del territorio (unión de círculos de torres + base)? */
export function insideTerritory(p: Vec, centers: Vec[], radius: number): boolean {
  return centers.some((c) => dist(p, c) <= radius);
}

export type SoldierRank = 1 | 2 | 3;
export interface Soldier {
  id: number;
  tipo: 'espada' | 'arco' | 'lider';
  rango: SoldierRank;
  hp: number;
  maxHp: number;
  pos: Vec;
}

export function soldierCost(tipo: Soldier['tipo'], rango: SoldierRank): { espada?: number; arco?: number; lingoteOro?: number } {
  if (tipo === 'lider') return { espada: 1, lingoteOro: 3 };
  if (tipo === 'espada') return rango === 1 ? { espada: 1 } : rango === 2 ? { espada: 1, lingoteOro: 1 } : { espada: 1, lingoteOro: 2 };
  return rango === 1 ? { arco: 1 } : rango === 2 ? { arco: 1, lingoteOro: 1 } : { arco: 1, lingoteOro: 2 };
}

export function soldierPower(s: Soldier, strengthFactor: number): number {
  const base = s.tipo === 'lider' ? 30 : s.tipo === 'espada' ? 10 : 8;
  const rankMult = s.rango === 1 ? 1 : s.rango === 2 ? 1.5 : 2.1;
  return base * rankMult * strengthFactor;
}

export function fightRound(a: Soldier, b: Soldier, factorA: number, factorB: number): { a: Soldier; b: Soldier } {
  const dmgToB = soldierPower(a, factorA) * (0.85 + Math.random() * 0.3);
  const dmgToA = soldierPower(b, factorB) * (0.85 + Math.random() * 0.3);
  return {
    a: { ...a, hp: Math.max(0, a.hp - dmgToA) },
    b: { ...b, hp: Math.max(0, b.hp - dmgToB) },
  };
}
