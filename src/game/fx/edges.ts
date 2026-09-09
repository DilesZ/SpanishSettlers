// Transiciones suaves de terreno: relieve sin geometría extra (obra original).
//
// Problema: cada loseta terminaba de golpe en su vecina (arena/agua,
// hierba/bosque, tierra/montaña). Este módulo aporta la lógica PURA de
// vecindad (testeable sin Phaser) + un dibujado barato (una imagen
// estática por loseta afectada, sin update ni tweens).
//
// Reglas (vecindad de 4, deterministas, una sola banda por loseta):
//   shore      receptor 'sand' junto a agua (water/waterB/waterC)
//   treeshade  receptor hierba/tierra ('grass','grassB','grassC','dirt')
//              junto a 'forest' (degradado de sotobosque)
//   cliffshade receptor tierra/bosque ('grass*','dirt','sand','forest')
//              junto a 'mountain' (sombra de relieve)
// Prioridad ante solape: cliffshade > treeshade > shore.
// Los bordes fuera del mapa se ignoran (no cuentan como vecinos).
//
// Capas (ver GameScene.buildTilemap): suelo 0 < bandas 20-40 < espuma 50 <
// caminos 90 < decor 100+. Las bandas nunca tapan caminos ni decorados.
//
// Presupuesto: escaneo 28x28 una sola vez al crear; como máximo un objeto
// por loseta afectada (cientos, estáticos, sin update).
//
// NOTA Phaser: solo `import type` (sin coste en runtime, testeable en
// vitest/node), igual que fx/water.ts y fx/atmosphere.ts.

import type Phaser from 'phaser';
import { ISLAND_SIZE, TILE_H, TILE_W, terrainAt } from '../maps/island';

export type EdgeKind = 'shore' | 'treeshade' | 'cliffshade';

export interface EdgeTile {
  tx: number;
  ty: number;
  kind: EdgeKind;
}

/** Función de terreno inyectable (producción: terrainAt de maps/island). */
export type TerrainFn = (tx: number, ty: number) => string;

export type IsoProjector = (tx: number, ty: number) => { x: number; y: number };

/** Texturas procedurales generadas en BootScene.makeEdges (100% originales). */
export const EDGE_TEXTURE: Record<EdgeKind, string> = {
  shore: 'shore-shade',
  treeshade: 'forest-shade',
  cliffshade: 'cliff-shade',
};

/** Profundidades: entre suelo (0) y espuma (50), lejos de caminos (90). */
export const EDGE_DEPTH: Record<EdgeKind, number> = {
  shore: 20,
  treeshade: 30,
  cliffshade: 35,
};

/** Alfa sutil por banda (rango pedido: 0.25-0.45). */
export const EDGE_ALPHA: Record<EdgeKind, number> = {
  shore: 0.35,
  treeshade: 0.3,
  cliffshade: 0.4,
};

export function isWaterTerrain(t: string): boolean {
  return t === 'water' || t === 'waterB' || t === 'waterC';
}

export function isGrassTerrain(t: string): boolean {
  return t === 'grass' || t === 'grassB' || t === 'grassC';
}

/** Receptor de sombra de bosque: hierba o tierra suelta junto a arbolado. */
function isTreeshadeReceptor(t: string): boolean {
  return isGrassTerrain(t) || t === 'dirt';
}

/** Receptor de sombra de relieve: tierra/arena/bosque junto a montaña. */
function isCliffshadeReceptor(t: string): boolean {
  return isGrassTerrain(t) || t === 'dirt' || t === 'sand' || t === 'forest';
}

/**
 * Deltas ortogonales en orden determinista SUR, ESTE, NORTE, OESTE.
 * El sur va primero porque en isometría es el frente visible: ante dos
 * vecinos opuestos la banda mira al sur (la más legible).
 */
export const DIRS_4: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** Vecino dentro del mapa o null fuera de él (los bordes no dan sombra). */
function neighborOf(
  terrain: TerrainFn,
  size: number,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
): string | null {
  const nx = tx + dx;
  const ny = ty + dy;
  if (nx < 0 || ny < 0 || nx >= size || ny >= size) return null;
  return terrain(nx, ny);
}

/**
 * Escaneo puro 4-vecindad: una entrada por loseta de transición.
 * Determinista: mismo terreno → misma lista en el mismo orden (por filas).
 */
export function computeEdges(terrain: TerrainFn, size: number): EdgeTile[] {
  const out: EdgeTile[] = [];
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const t = terrain(tx, ty);
      // ¿Toca montaña algún vecino? (máxima prioridad: relieve)
      let touchesMountain = false;
      let touchesForest = false;
      let touchesWater = false;
      for (const [dx, dy] of DIRS_4) {
        const nb = neighborOf(terrain, size, tx, ty, dx, dy);
        if (nb === null) continue;
        if (nb === 'mountain') touchesMountain = true;
        else if (nb === 'forest') touchesForest = true;
        else if (isWaterTerrain(nb)) touchesWater = true;
      }
      if (touchesMountain && isCliffshadeReceptor(t)) {
        out.push({ tx, ty, kind: 'cliffshade' });
      } else if (touchesForest && isTreeshadeReceptor(t)) {
        out.push({ tx, ty, kind: 'treeshade' });
      } else if (t === 'sand' && touchesWater) {
        out.push({ tx, ty, kind: 'shore' });
      }
    }
  }
  return out;
}

/**
 * Desplazamiento en loseta hacia el vecino relevante (el primero en orden
 * SUR,ESTE,NORTE,OESTE). Puro y determinista; si no hay vecino relevante
 * (no debería pasar con listas de computeEdges) mira al sur.
 */
export function edgeDirFor(
  terrain: TerrainFn,
  size: number,
  tx: number,
  ty: number,
  kind: EdgeKind,
): { dx: number; dy: number } {
  const wants = (nb: string): boolean =>
    kind === 'cliffshade'
      ? nb === 'mountain'
      : kind === 'treeshade'
        ? nb === 'forest'
        : isWaterTerrain(nb);
  for (const [dx, dy] of DIRS_4) {
    const nb = neighborOf(terrain, size, tx, ty, dx, dy);
    if (nb !== null && wants(nb)) return { dx, dy };
  }
  return { dx: 0, dy: 1 };
}

/**
 * Ángulo en pantalla hacia el vecino, con la misma matemática iso que los
 * caminos (ver GameScene.renderRoadTile): sx=(dx-dy)*TILE_W/2,
 * sy=(dx+dy)*TILE_H/2, ángulo=atan2(sy,sx).
 */
export function edgeScreenAngle(dx: number, dy: number): number {
  const sx = (dx - dy) * (TILE_W / 2);
  const sy = (dx + dy) * (TILE_H / 2);
  return Math.atan2(sy, sx);
}

/**
 * Dibuja UNA imagen estática por loseta: textura BootScene correspondiente,
 * desplazada hacia el vecino relevante y rotada hacia él (setRotation con
 * el ángulo pantalla, como los stubs de los caminos). Sin tweens ni update.
 *
 * @param terrainFn Terreno para orientar (por defecto el real de la isla).
 * @param mapSize   Tamaño del mapa (por defecto ISLAND_SIZE).
 */
export function placeEdges(
  scene: Phaser.Scene,
  list: readonly EdgeTile[],
  iso: IsoProjector,
  terrainFn: TerrainFn = terrainAt,
  mapSize: number = ISLAND_SIZE,
): void {
  for (const e of list) {
    const { dx, dy } = edgeDirFor(terrainFn, mapSize, e.tx, e.ty, e.kind);
    const sx = (dx - dy) * (TILE_W / 2);
    const sy = (dx + dy) * (TILE_H / 2);
    const p = iso(e.tx, e.ty);
    // La banda vive desplazada ~1/4 de loseta hacia el vecino que la causa.
    const px = p.x + sx * 0.22;
    const py = p.y + sy * 0.22;
    scene.add
      .image(px, py, EDGE_TEXTURE[e.kind])
      .setDepth(EDGE_DEPTH[e.kind])
      .setAlpha(EDGE_ALPHA[e.kind])
      .setRotation(Math.atan2(sy, sx))
      .setScale(2.0, 1.35);
  }
}
