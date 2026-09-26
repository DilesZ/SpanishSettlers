import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasLivingWood, isBlockedTerrain, nearestLivingWood, terrainSpeed } from '@/game/systems/terrain';

// El terreno plano lo genera scripts/make-terrain.mjs (determinista).
// Estos tests garantizan que los PNG commiteados son los esperados.

function pngSize(p: string): { w: number; h: number } {
  const b = readFileSync(p);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('terreno plano S4', () => {
  const assets = join(__dirname, '..', '..', 'public', 'assets');

  it('sheet 5x2 de diamantes 132x66', () => {
    expect(pngSize(join(assets, 'terrain-sheet.png'))).toEqual({ w: 660, h: 132 });
  });

  it('espuma en los 4 bordes, del mismo tamaño que el tile', () => {
    for (const e of ['ne', 'se', 'sw', 'nw']) {
      const p = join(assets, `foam-${e}.png`);
      expect(existsSync(p)).toBe(true);
      expect(pngSize(p)).toEqual({ w: 132, h: 66 });
    }
  });
});

describe('terreno e interacción (systems/terrain.ts)', () => {
  it('agua y montaña bloquean, el bosque frena pero pasa', () => {
    expect(isBlockedTerrain('water')).toBe(true);
    expect(isBlockedTerrain('mountain')).toBe(true);
    expect(isBlockedTerrain('forest')).toBe(false);
    expect(isBlockedTerrain('sand')).toBe(false);
  });

  it('velocidades: hierba 1, arena frena, bosque frena más', () => {
    expect(terrainSpeed('grass')).toBe(1.0);
    expect(terrainSpeed('dirt')).toBe(1.0);
    expect(terrainSpeed('sand')).toBeLessThan(1.0);
    expect(terrainSpeed('forest')).toBeLessThan(terrainSpeed('sand'));
  });

  it('el bosque vivo cerca permite talar; talado no', () => {
    const nodes = [
      { tx: 5, ty: 5, alive: true },
      { tx: 20, ty: 20, alive: false },
    ];
    expect(hasLivingWood(nodes, 6, 5, 6)).toBe(true);
    expect(hasLivingWood([{ tx: 20, ty: 20, alive: false }], 20, 20, 6)).toBe(false);
  });

  it('el leñador encuentra el árbol vivo más cercano', () => {
    const nodes = [
      { tx: 10, ty: 10, alive: false },
      { tx: 7, ty: 5, alive: true },
      { tx: 6, ty: 5, alive: true },
    ];
    expect(nearestLivingWood(nodes, 5, 5, 12)).toMatchObject({ tx: 6, ty: 5 });
    expect(nearestLivingWood(nodes, 0, 0, 2)).toBeNull();
  });
});
