// Paleta y color de superficie procedural (migración 3D, coste cero).
// surfaceColor mezcla bioma + variación hash + roca por pendiente.

import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';

export type RGB = [number, number, number];

const BASE: Record<string, RGB> = {
  grass: [0.36, 0.6, 0.28],
  grassB: [0.33, 0.56, 0.26],
  grassC: [0.4, 0.65, 0.3],
  dirt: [0.61, 0.48, 0.3],
  sand: [0.87, 0.75, 0.51],
  water: [0.23, 0.47, 0.77],
  waterB: [0.22, 0.45, 0.74],
  waterC: [0.24, 0.49, 0.79],
  forest: [0.24, 0.48, 0.2],
  mountain: [0.55, 0.53, 0.47],
};

const ROCK: RGB = [0.5, 0.49, 0.45];

function hash2(x: number, y: number): number {
  let h = (Math.round(x * 7) * 374761393 + Math.round(y * 7) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Color final de un punto: bioma en (tx,ty) + variación + roca por pendiente. */
export function surfaceColor(t: string, tx: number, ty: number, slope: number): RGB {
  const base = BASE[t] ?? BASE.grass;
  const v = 0.9 + hash2(tx, ty) * 0.2;
  let r = Math.min(1, base[0] * v);
  let g = Math.min(1, base[1] * v);
  let b = Math.min(1, base[2] * v);
  // Cantiles: a partir de cierta pendiente manda la roca gris.
  const k = Math.max(0, Math.min(1, (slope - 0.18) / 0.25));
  r += (ROCK[0] - r) * k;
  g += (ROCK[1] - g) * k;
  b += (ROCK[2] - b) * k;
  return [r, g, b];
}

/** Bioma en una posición fraccional (para vértices de la malla). */
export function biomeAt(txf: number, tyf: number): string {
  return terrainAt(
    Math.max(0, Math.min(ISLAND_SIZE - 1, Math.round(txf))),
    Math.max(0, Math.min(ISLAND_SIZE - 1, Math.round(tyf))),
  );
}
