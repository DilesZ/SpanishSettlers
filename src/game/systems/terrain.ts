// Terreno e interacción colonos-terreno (lógica pura, testeable sin Phaser).
// Council + feedback: el bosque/la arena deben notarse al andar y al talar.
// - terrainSpeed: el camino compensa; el bosque espeso y la arena frenan.
// - Árboles/rocas como nodos vivos: talar agota, el bosque rebrota.

export type TerrainKind =
  | 'grass' | 'grassB' | 'grassC' | 'dirt' | 'sand'
  | 'water' | 'waterB' | 'waterC' | 'forest' | 'mountain';

/** ¿Bloquea el paso? (agua y montaña; el bosque frena pero se atraviesa). */
export function isBlockedTerrain(t: string): boolean {
  return t === 'water' || t === 'waterB' || t === 'waterC' || t === 'mountain';
}

/**
 * Multiplicador de velocidad a pie (1.0 = hierba/tierra).
 * S4: el camino anula la penalización (ver GameScene.updateWalkers).
 */
export function terrainSpeed(t: string): number {
  switch (t) {
    case 'sand': return 0.8;
    case 'forest': return 0.65;
    case 'dirt':
    case 'grass':
    case 'grassB':
    case 'grassC':
      return 1.0;
    default:
      return 1.0;
  }
}

export interface NatureNode {
  tx: number;
  ty: number;
  alive: boolean;
}

/** ¿Queda bosque vivo cerca de (tx,ty) en un radio Manhattan? */
export function hasLivingWood(nodes: readonly NatureNode[], tx: number, ty: number, radius = 6): boolean {
  for (const n of nodes) {
    if (!n.alive) continue;
    if (Math.abs(n.tx - tx) + Math.abs(n.ty - ty) <= radius) return true;
  }
  return false;
}

/** El vivo más cercano (para que el leñador vaya a un árbol real). */
export function nearestLivingWood(
  nodes: readonly NatureNode[],
  tx: number,
  ty: number,
  maxRadius = 12,
): NatureNode | null {
  let best: NatureNode | null = null;
  let bestD = maxRadius + 1;
  for (const n of nodes) {
    if (!n.alive) continue;
    const d = Math.abs(n.tx - tx) + Math.abs(n.ty - ty);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return bestD <= maxRadius ? best : null;
}
