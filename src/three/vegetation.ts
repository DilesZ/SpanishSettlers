// Dispersión determinista de vegetación y rocas (migración 3D, coste cero).
// La construcción de InstancedMesh vive en la escena; aquí solo datos.

import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';

export interface ScatterItem {
  tx: number;
  ty: number;
  jx: number;
  jy: number;
  s: number;
  terrain: string;
  pine: boolean;
}

export interface Scatter {
  trees: ScatterItem[];
  rocks: ScatterItem[];
  grass: ScatterItem[];
  flowers: ScatterItem[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWater(t: string): boolean {
  return t === 'water' || t === 'waterB' || t === 'waterC';
}

/** ¿Toca el agua? (para no plantar medio dentro del mar). */
function nearWater(tx: number, ty: number): boolean {
  return (
    isWater(terrainAt(tx + 1, ty)) || isWater(terrainAt(tx - 1, ty)) ||
    isWater(terrainAt(tx, ty + 1)) || isWater(terrainAt(tx, ty - 1))
  );
}

/** Reparte por bioma con semilla: pinos/robles, rocas, hierba y flores. */
export function scatterVegetation(seed: number): Scatter {
  const rnd = mulberry32(seed);
  const out: Scatter = { trees: [], rocks: [], grass: [], flowers: [] };
  for (let ty = 1; ty < ISLAND_SIZE - 1; ty++) {
    for (let tx = 1; tx < ISLAND_SIZE - 1; tx++) {
      const t = terrainAt(tx, ty);
      if (isWater(t)) continue;
      const shoreK = nearWater(tx, ty) ? 0.25 : 1;
      const jx = (rnd() - 0.5) * 1.5 * shoreK;
      const jy = (rnd() - 0.5) * 1.5 * shoreK;
      const s = 0.8 + rnd() * 0.5;
      if (t === 'forest') {
        const n = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          out.trees.push({
            tx, ty,
            jx: (rnd() - 0.5) * 1.7 * shoreK, jy: (rnd() - 0.5) * 1.7 * shoreK,
            s: 0.85 + rnd() * 0.6, terrain: t, pine: rnd() > 0.35,
          });
        }
        if (rnd() > 0.6) out.grass.push({ tx, ty, jx, jy, s, terrain: t, pine: false });
      } else if (t === 'mountain') {
        if (rnd() > 0.35) {
          out.rocks.push({ tx, ty, jx, jy, s: 0.7 + rnd() * 0.9, terrain: t, pine: false });
        }
      } else if (t === 'sand') {
        if (rnd() > 0.7) out.grass.push({ tx, ty, jx, jy, s: s * 0.7, terrain: t, pine: false });
      } else {
        // pradera/tierra: arbolado disperso, hierba y flores
        if (rnd() > 0.93) {
          out.trees.push({ tx, ty, jx, jy, s, terrain: t, pine: rnd() > 0.5 });
        }
        if (rnd() > 0.45) out.grass.push({ tx, ty, jx, jy, s, terrain: t, pine: false });
        if (rnd() > 0.8) {
          out.flowers.push({ tx, ty, jx: (rnd() - 0.5) * 1.7 * shoreK, jy: (rnd() - 0.5) * 1.7 * shoreK, s: 0.7 + rnd() * 0.5, terrain: t, pine: false });
        }
        if ((t === 'dirt' || t === 'grass' || t === 'grassB' || t === 'grassC') && rnd() > 0.965) {
          out.rocks.push({ tx, ty, jx, jy, s: 0.5 + rnd() * 0.5, terrain: t, pine: false });
        }
      }
    }
  }
  return out;
}
