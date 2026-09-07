import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GID, ISLAND_SIZE, LOGIC_OBJECTS, terrainAt, tileToPx } from '@/game/maps/island';

describe('tilemap isla-01', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'assets', 'maps', 'isla-01.json'), 'utf8'));

  it('es un mapa isometrico Tiled valido de 28x28', () => {
    expect(json.orientation).toBe('isometric');
    expect(json.width).toBe(ISLAND_SIZE);
    expect(json.height).toBe(ISLAND_SIZE);
    expect(json.tilewidth).toBe(132);
    expect(json.tileheight).toBe(66);
    expect(json.layers[0].data).toHaveLength(ISLAND_SIZE * ISLAND_SIZE);
  });

  it('cada gid del JSON coincide con el generador', () => {
    const data: number[] = json.layers[0].data;
    for (let ty = 0; ty < ISLAND_SIZE; ty++) {
      for (let tx = 0; tx < ISLAND_SIZE; tx++) {
        expect(data[ty * ISLAND_SIZE + tx]).toBe(GID[terrainAt(tx, ty)]);
      }
    }
  });

  it('la capa Logica trae los objetos esperados en sus pixeles', () => {
    const layer = json.layers.find((l: { name: string }) => l.name === 'Logica');
    expect(layer.objects).toHaveLength(LOGIC_OBJECTS.length);
    const c = Math.floor(ISLAND_SIZE / 2);
    LOGIC_OBJECTS.forEach((o, i) => {
      const p = tileToPx(c + o.dx, c + o.dy);
      expect(layer.objects[i].name).toBe(o.name);
      expect(layer.objects[i].x).toBe(Math.round(p.x));
      expect(layer.objects[i].y).toBe(Math.round(p.y));
    });
  });
});
