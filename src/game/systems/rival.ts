// Colonia rival (lógica pura, testeable sin Phaser) — Fase 4.
// La IA juega con las mismas reglas: mismos costes, mismas recetas y
// mismos productores automáticos; solo cambia el cerebro (un orden de
// construcción con espera si no puede pagar). El pegamento visual y el
// combate viven en GameScene.

import { BUILDINGS, type BuildingId, type ResourceId } from '../data/buildings';
import { canAfford, createInitialStock, type Stock } from './economy';

export type Owner = 'player' | 'rival';

/** Orden de desarrollo del rival: economía → comida → industria → ejército. */
export const RIVAL_ORDER: BuildingId[] = [
  'cabanaLenador', 'aserradero', 'cantera', 'residenciaS',
  'granja', 'molino', 'pozo', 'panaderia',
  'residenciaM', 'minaCarbon', 'minaHierro', 'fundicion',
  'torre', 'cuartel', 'herreria', 'armeria',
  'torre', 'residenciaL', 'minaOro',
];

/** Tras completar el orden, rota defensa/vivienda/ejército. */
export const RIVAL_LATE: BuildingId[] = ['torre', 'residenciaM', 'cuartel'];

/** Arranque finito pero suficiente para los primeros edificios. */
export const RIVAL_INITIAL_STOCK: Partial<Record<ResourceId, number>> = {
  madera: 10, tablon: 4, piedra: 8, grano: 2, harina: 1, pan: 4,
  agua: 2, carbon: 1, hierro: 1, herramienta: 2,
};

export function rivalStartingStock(): Stock {
  return { ...createInitialStock(), ...RIVAL_INITIAL_STOCK };
}

/** Lo primero del orden pendiente que pueda pagar (null = esperar). */
export function nextRivalBuild(
  order: BuildingId[],
  built: BuildingId[],
  stock: Stock,
): BuildingId | null {
  const have = new Map<BuildingId, number>();
  for (const b of built) have.set(b, (have.get(b) ?? 0) + 1);
  const need = new Map<BuildingId, number>();
  for (const id of order) {
    need.set(id, (need.get(id) ?? 0) + 1);
    if ((have.get(id) ?? 0) < (need.get(id) ?? 0)) {
      return canAfford(stock, BUILDINGS[id].coste) ? id : null;
    }
  }
  return null;
}

/** Edificio tardío por rotación cuando el orden está completo. */
export function lateRivalBuild(builtCount: number, stock: Stock): BuildingId | null {
  for (let i = 0; i < RIVAL_LATE.length; i++) {
    const id = RIVAL_LATE[(builtCount + i) % RIVAL_LATE.length];
    if (canAfford(stock, BUILDINGS[id].coste)) return id;
  }
  return null;
}

function isLand(t: string): boolean {
  return t !== 'water' && t !== 'waterB' && t !== 'waterC' && t !== 'mountain';
}

/** Sitio para la base rival: tierra a 6-10 losetas del centro con barrio libre. */
export function findRivalBase(
  terrainAt: (x: number, y: number) => string,
  size: number,
  cx: number,
  cy: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestScore = -1;
  for (let ty = 2; ty < size - 2; ty++) {
    for (let tx = 2; tx < size - 2; tx++) {
      const d = Math.hypot(tx - cx, ty - cy);
      if (d < 6 || d > 10 || !isLand(terrainAt(tx, ty))) continue;
      let score = 0;
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const ax = tx + ox;
          const ay = ty + oy;
          if (ax < 1 || ay < 1 || ax >= size - 1 || ay >= size - 1) continue;
          if (isLand(terrainAt(ax, ay))) score++;
        }
      }
      // Desempate determinista: prefiere el este (loseta con x mayor).
      if (score > bestScore || (score === bestScore && best && tx > best.x)) {
        bestScore = score;
        best = { x: tx, y: ty };
      }
    }
  }
  return bestScore >= 10 ? best : null;
}
