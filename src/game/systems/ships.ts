// Lógica naval pura (testeable): el puerto bota barcos que pescan en altura.
// Los barcos solo navegan por agua y vuelven con pescado.
import type { BuildingId, ResourceId } from '../data/buildings';

export type TerrainKind = 'water' | 'land';

/** ¿Puede navegar un barco por esta loseta? (solo agua; la arena no es navegable) */
export function isNavigable(t: string): boolean {
  return t === 'water' || t === 'waterB' || t === 'waterC';
}

/** ¿Toca esta loseta el agua? (para colocar el puerto) */
export function touchesWater(
  tx: number, ty: number,
  terrainAt: (x: number, y: number) => string | null,
): boolean {
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return deltas.some(([dx, dy]) => {
    const t = terrainAt(tx + dx, ty + dy);
    return t !== null && isNavigable(t);
  });
}

/** Mercancía visible que lleva un portador según de dónde sale cargado. */
export function goodsFor(from: BuildingId): ResourceId {
  switch (from) {
    case 'cabanaLenador': return 'madera';
    case 'aserradero': return 'tablon';
    case 'cantera': return 'piedra';
    case 'granja': return 'grano';
    case 'molino': return 'harina';
    case 'panaderia': return 'pan';
    case 'pozo': return 'agua';
    case 'pesqueria': return 'pez';
    case 'minaCarbon': return 'carbon';
    case 'minaHierro': return 'hierro';
    case 'minaOro': return 'oro';
    case 'fundicion': return 'lingoteHierro';
    case 'herreria': return 'herramienta';
    case 'armeria': return 'espada';
    case 'puerto': return 'pez';
    default: return 'tablon';
  }
}

/** Elige hasta N caladeros (losetas de agua) en un radio dado del puerto. */
export function pickFishingCircuit(
  port: { x: number; y: number },
  isWater: (x: number, y: number) => boolean,
  width: number,
  height: number,
  radius = 9,
  count = 4,
  rand: () => number = Math.random,
): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  for (let tries = 0; tries < 200 && spots.length < count; tries++) {
    const x = Math.round(port.x + (rand() * 2 - 1) * radius);
    const y = Math.round(port.y + (rand() * 2 - 1) * radius);
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
    if (!isWater(x, y)) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < 3)) continue;
    spots.push({ x, y });
  }
  return spots;
}
