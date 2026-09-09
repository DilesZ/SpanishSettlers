// Heightfield procedural 100% original (migración 3D, coste cero).
// Rejilla cuadrada: 1 loseta = TILE unidades; la cámara isométrica da el look.

import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';

export const TILE = 2;
export const HEIGHT_SCALE = 4;

export function waterLevel(): number {
  return 0;
}

/** Altura lógica: <0 agua, tierra 0..~1 (montaña ~1). Determinista. */
export function heightAt(tx: number, ty: number): number {
  const d = Math.hypot(tx - ISLAND_SIZE / 2, ty - ISLAND_SIZE / 2);
  let h = 0.55 - d * 0.075;
  const t = terrainAt(Math.round(tx), Math.round(ty));
  if (t === 'mountain') h += 0.45;
  else if (t === 'forest') h += 0.06;
  else if (t === 'sand') h -= 0.12;
  return h;
}

export interface WorldPos { x: number; y: number; z: number }

/** Centro de la loseta asentado en su altura. */
export function tileToWorld(tx: number, ty: number): WorldPos {
  return {
    x: (tx - ISLAND_SIZE / 2) * TILE,
    y: heightAt(tx, ty) * HEIGHT_SCALE,
    z: (ty - ISLAND_SIZE / 2) * TILE,
  };
}
