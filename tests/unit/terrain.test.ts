import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
