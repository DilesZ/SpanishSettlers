// Lógica del generador de isla (duplicada de scripts/gen-map.mjs).
// El test tests/unit/tilemap.test.ts regenera con esto y lo compara con
// public/assets/maps/isla-01.json para garantizar que están sincronizados.

export const ISLAND_SIZE = 28;
export const TILE_W = 132;
export const TILE_H = 66;

export const GID = {
  grass: 1, grassB: 2, grassC: 3, dirt: 4, sand: 5,
  water: 6, waterB: 7, waterC: 8, forest: 9, mountain: 10,
} as const;

export type TerrainKey = keyof typeof GID;

export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function terrainAt(tx: number, ty: number): TerrainKey {
  const d = Math.hypot(tx - ISLAND_SIZE / 2, ty - ISLAND_SIZE / 2);
  const n = hash(tx, ty);
  if (d > 12.5) return (['water', 'waterB', 'waterC'] as const)[Math.floor(hash(tx * 5, ty * 3) * 3)];
  if (d > 11.2) return 'sand';
  if (n > 0.9) return 'mountain';
  if (n > 0.72) return 'forest';
  if (n > 0.66) return 'dirt';
  const g = hash(tx * 3 + 11, ty * 7 + 5);
  return g > 0.66 ? 'grass' : g > 0.33 ? 'grassB' : 'grassC';
}

export function tileToPx(tx: number, ty: number): { x: number; y: number } {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

export interface LogicObject { name: string; dx: number; dy: number; props: Record<string, string | number> }

export const LOGIC_OBJECTS: LogicObject[] = [
  { name: 'almacen', dx: 0, dy: 0, props: { edificio: 'almacen' } },
  { name: 'cabanaLenador', dx: -3, dy: -1, props: { edificio: 'cabanaLenador' } },
  { name: 'aserradero', dx: -4, dy: 2, props: { edificio: 'aserradero' } },
  { name: 'cantera', dx: 3, dy: -2, props: { edificio: 'cantera' } },
  { name: 'spawn_colono', dx: -1, dy: 3, props: { oficio: 'settler' } },
  { name: 'spawn_colono', dx: 2, dy: 4, props: { oficio: 'carrier' } },
  { name: 'spawn_colono', dx: 1, dy: 1, props: { oficio: 'woodcutter' } },
];
