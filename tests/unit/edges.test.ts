import { describe, expect, it } from 'vitest';
import {
  computeEdges,
  edgeDirFor,
  edgeScreenAngle,
  type EdgeTile,
  type TerrainFn,
} from '@/game/fx/edges';
import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';

/** Terreno de juguete: grid[y][x]; fuera de rango o hueco → 'grass'. */
function toy(grid: string[][], fallback = 'grass'): TerrainFn {
  return (x, y) => grid[y]?.[x] ?? fallback;
}

function kinds(list: EdgeTile[]): string[] {
  return list.map((e) => `${e.tx},${e.ty}:${e.kind}`);
}

describe('bordes de terreno (vecindad de 4)', () => {
  it('orilla: arena junto a agua → shore; el agua no genera banda', () => {
    const t = toy([
      ['water', 'sand', 'grass'],
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass'],
    ]);
    expect(kinds(computeEdges(t, 3))).toContain('1,0:shore');
    expect(kinds(computeEdges(t, 3)).some((k) => k.startsWith('0,0:'))).toBe(false);
  });

  it('arena lejos del agua no genera banda', () => {
    const t = toy([
      ['sand', 'grass', 'grass'],
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'water'],
    ]);
    expect(computeEdges(t, 3)).toHaveLength(0);
  });

  it('hierba junto a bosque → treeshade; la arena junto a bosque no', () => {
    const t = toy([
      ['forest', 'grass', 'sand'],
      ['grass', 'grass', 'forest'],
      ['grass', 'grass', 'grass'],
    ]);
    const got = kinds(computeEdges(t, 3));
    expect(got).toContain('1,0:treeshade');
    expect(got).toContain('1,1:treeshade');
    // la arena junto a bosque no es receptora (las palmeras ya la visten)
    expect(got.some((k) => k.startsWith('2,0:'))).toBe(false);
    // el bosque no recibe banda de sí mismo
    expect(got.some((k) => k.startsWith('0,0:'))).toBe(false);
  });

  it('tierra/hierba/arena/bosque junto a montaña → cliffshade; el agua no', () => {
    const t = toy([
      ['grass', 'mountain', 'sand'],
      ['grass', 'forest', 'grass'],
      ['water', 'dirt', 'grass'],
    ]);
    const got = kinds(computeEdges(t, 3));
    expect(got).toContain('0,0:cliffshade');
    expect(got).toContain('2,0:cliffshade');
    expect(got).toContain('1,1:cliffshade');
    // el agua junto a montaña no recibe banda
    expect(got.some((k) => k.startsWith('0,2:'))).toBe(false);
    // la montaña en sí no recibe banda
    expect(got.some((k) => k.startsWith('1,0:'))).toBe(false);
  });

  it('prioridad determinista: cliffshade > treeshade > shore', () => {
    // hierba con montaña al este y bosque al sur: gana el relieve
    const t = toy([
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'mountain'],
      ['grass', 'forest', 'grass'],
    ]);
    expect(kinds(computeEdges(t, 3))).toContain('1,1:cliffshade');
    // arena con agua al sur y montaña al este: gana el relieve
    const t2 = toy([
      ['grass', 'grass', 'grass'],
      ['grass', 'sand', 'mountain'],
      ['grass', 'water', 'grass'],
    ]);
    expect(kinds(computeEdges(t2, 3))).toContain('1,1:cliffshade');
  });

  it('solo vecindad de 4: la diagonal no cuenta', () => {
    const t = toy([
      ['water', 'grass'],
      ['grass', 'sand'],
    ]);
    expect(computeEdges(t, 2)).toHaveLength(0);
    const t2 = toy([
      ['forest', 'grass'],
      ['grass', 'grass'],
    ]);
    // (1,1) solo toca bosque en diagonal: sin banda
    expect(computeEdges(t2, 2).some((e) => e.tx === 1 && e.ty === 1)).toBe(false);
  });

  it('bordes del mapa no lanzan y se ignoran como vecinos', () => {
    const t = toy([['sand']]);
    expect(() => computeEdges(t, 1)).not.toThrow();
    expect(computeEdges(t, 1)).toHaveLength(0);
  });

  it('determinista: dos pasadas devuelven lo mismo en el mismo orden', () => {
    const a = computeEdges(terrainAt, ISLAND_SIZE);
    const b = computeEdges(terrainAt, ISLAND_SIZE);
    expect(b).toEqual(a);
    // orden por filas
    for (let i = 1; i < a.length; i++) {
      const p = a[i - 1];
      const c = a[i];
      expect(c.ty > p.ty || (c.ty === p.ty && c.tx >= p.tx)).toBe(true);
    }
  });

  it('como máximo una banda por loseta y kinds válidos (isla real)', () => {
    const list = computeEdges(terrainAt, ISLAND_SIZE);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(ISLAND_SIZE * ISLAND_SIZE);
    const seen = new Set(list.map((e) => `${e.tx},${e.ty}`));
    expect(seen.size).toBe(list.length);
    for (const e of list) {
      expect(['shore', 'treeshade', 'cliffshade']).toContain(e.kind);
    }
  });

  it('edgeDirFor apunta al primer vecino relevante (sur primero)', () => {
    // bosque al sur y al este de la hierba: gana el sur
    const t = toy([
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'forest'],
      ['grass', 'forest', 'grass'],
    ]);
    expect(edgeDirFor(t, 3, 1, 1, 'treeshade')).toEqual({ dx: 0, dy: 1 });
    // solo agua al norte de la arena
    const t2 = toy([
      ['grass', 'water', 'grass'],
      ['grass', 'sand', 'grass'],
      ['grass', 'grass', 'grass'],
    ]);
    expect(edgeDirFor(t2, 3, 1, 1, 'shore')).toEqual({ dx: 0, dy: -1 });
  });

  it('edgeScreenAngle usa la matemática iso (como los stubs de caminos)', () => {
    // vecino este (1,0): sx=+66, sy=+33
    expect(edgeScreenAngle(1, 0)).toBeCloseTo(Math.atan2(33, 66), 10);
    // vecino sur en loseta (0,1): en pantalla es abajo-izquierda
    // (sx=-66, sy=+33), igual que en GameScene.renderRoadTile
    expect(edgeScreenAngle(0, 1)).toBeCloseTo(Math.atan2(33, -66), 10);
  });
});
