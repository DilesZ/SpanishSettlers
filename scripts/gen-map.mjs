// Generador de isla compatible con Tiled (formato JSON 1.10, orientación isométrica).
// La MISMA lógica vive en src/game/maps/island.ts; el test tilemap.test.ts
// verifica que este JSON commiteado coincide con el generador TS.
// Terreno: tileset Kenney CC0 (terrain-sheet.png), diamante 132x66.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 28;
const TW = 132;
const TH = 66;

const GID = { grass: 1, grassB: 2, grassC: 3, dirt: 4, sand: 5, water: 6, waterB: 7, waterC: 8, forest: 9, mountain: 10 };

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function terrainAt(tx, ty) {
  const d = Math.hypot(tx - SIZE / 2, ty - SIZE / 2);
  const n = hash(tx, ty);
  if (d > 12.5) return ['water', 'waterB', 'waterC'][Math.floor(hash(tx * 5, ty * 3) * 3)];
  if (d > 11.2) return 'sand';
  if (n > 0.9) return 'mountain';
  if (n > 0.72) return 'forest';
  if (n > 0.66) return 'dirt';
  const g = hash(tx * 3 + 11, ty * 7 + 5);
  return g > 0.66 ? 'grass' : g > 0.33 ? 'grassB' : 'grassC';
}

// Coordenadas de píxel del centro de un tile en proyección isométrica Tiled
const tileToPx = (tx, ty) => ({ x: (tx - ty) * (TW / 2), y: (tx + ty) * (TH / 2) });

const data = [];
for (let ty = 0; ty < SIZE; ty++) {
  for (let tx = 0; tx < SIZE; tx++) {
    data.push(GID[terrainAt(tx, ty)]);
  }
}

const c = Math.floor(SIZE / 2);
const at = (dx, dy) => {
  const p = tileToPx(c + dx, c + dy);
  return { x: Math.round(p.x), y: Math.round(p.y) };
};
let oid = 1;
const obj = (name, dx, dy, properties = {}) => {
  const p = at(dx, dy);
  return {
    gid: 0, height: 0, id: oid++, name, point: true, rotation: 0,
    type: '', visible: true, width: 0, x: p.x, y: p.y,
    properties: Object.entries(properties).map(([k, v]) => ({ name: k, type: typeof v === 'number' ? 'float' : 'string', value: v })),
  };
};
const objects = [
  obj('almacen', 0, 0, { edificio: 'almacen' }),
  obj('cabanaLenador', -3, -1, { edificio: 'cabanaLenador' }),
  obj('aserradero', -4, 2, { edificio: 'aserradero' }),
  obj('cantera', 3, -2, { edificio: 'cantera' }),
  obj('spawn_colono', -1, 3, { oficio: 'settler' }),
  obj('spawn_colono', 2, 4, { oficio: 'carrier' }),
  obj('spawn_colono', 1, 1, { oficio: 'woodcutter' }),
];

const map = {
  compressionlevel: -1, height: SIZE, width: SIZE, infinite: false,
  layers: [
    { data, height: SIZE, id: 1, name: 'Suelo', opacity: 1, type: 'tilelayer', visible: true, width: SIZE, x: 0, y: 0 },
    { draworder: 'topdown', id: 2, name: 'Logica', objects, opacity: 1, type: 'objectgroup', visible: false, x: 0, y: 0 },
  ],
  nextlayerid: 3, nextobjectid: oid,
  orientation: 'isometric', renderorder: 'right-down',
  tiledversion: '1.12', tileheight: TH,
  tilesets: [{
    columns: 5, firstgid: 1, image: '../terrain-sheet.png', imageheight: 132,
    imagewidth: 660, margin: 0, name: 'terreno', spacing: 0,
    tilecount: 10, tileheight: TH, tilewidth: TW,
  }],
  tilewidth: TW, type: 'map', version: '1.10',
};

mkdirSync(join(root, 'public', 'assets', 'maps'), { recursive: true });
writeFileSync(join(root, 'public', 'assets', 'maps', 'isla-01.json'), JSON.stringify(map));
console.log(`isla-01.json: ${SIZE}x${SIZE}, ${objects.length} objetos`);
