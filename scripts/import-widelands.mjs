// Importa arte de Widelands (GPL-2.0+) a public/assets/wl/ + manifest TS.
// SOLO rama proto-b-widelands. Fuente (fuera del repo):
//   Temp/opencode/widelands/data/tribes
// Uso documentado en docs/ATRIBUCION.md. Formatos verificados en devlog 006:
//   edificios: idle_00.png + hotspot en init.lua + menu.png (30x30)
//   workers: walk_<dir>_<escala>.png, rejilla columns x rows del init.lua
import sharp from 'sharp';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WL = 'C:/Users/PC CASA/AppData/Local/Temp/opencode/widelands/data/tribes';
const OUT = join(root, 'public', 'assets', 'wl');

const BUILD_MAP = {
  almacen: 'buildings/warehouses/barbarians/headquarters',
  cabanaLenador: 'buildings/productionsites/barbarians/lumberjacks_hut',
  aserradero: 'buildings/productionsites/barbarians/wood_hardener',
  cantera: 'buildings/productionsites/barbarians/quarry',
  residenciaS: 'buildings/productionsites/barbarians/tavern',
  residenciaM: 'buildings/productionsites/barbarians/inn',
  residenciaL: 'buildings/productionsites/barbarians/big_inn',
  granja: 'buildings/productionsites/barbarians/farm',
  molino: 'buildings/productionsites/barbarians/warmill',
  panaderia: 'buildings/productionsites/barbarians/bakery',
  pozo: 'buildings/productionsites/barbarians/well',
  pesqueria: 'buildings/productionsites/barbarians/fishers_hut',
  minaCarbon: 'buildings/productionsites/barbarians/coalmine',
  minaHierro: 'buildings/productionsites/barbarians/ironmine',
  minaOro: 'buildings/productionsites/barbarians/goldmine',
  fundicion: 'buildings/productionsites/barbarians/smelting_works',
  herreria: 'buildings/productionsites/barbarians/ax_workshop',
  armeria: 'buildings/productionsites/barbarians/helmsmithy',
  cuartel: 'buildings/productionsites/barbarians/barracks',
  torre: 'buildings/militarysites/barbarians/tower',
  ornamento: 'buildings/productionsites/barbarians/lime_kiln',
};

const WORKER_MAP = {
  settler: 'builder', woodcutter: 'lumberjack', carrier: 'carrier', soldier: 'soldier',
  archer: 'hunter', miner: 'miner', fisher: 'fisher', baker: 'baker',
};

const fail = [];
mkdirSync(join(OUT, 'icons'), { recursive: true });
mkdirSync(join(OUT, 'people'), { recursive: true });
mkdirSync(join(OUT, 'sheets'), { recursive: true });

const hotspotOf = (lua) => {
  const pats = [
    /animations\s*=\s*\{idle\s*=\s*\{hotspot\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/s,
    /idle\s*=\s*\{[^}]*?hotspot\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/s,
    /hotspot\s*=\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}/,
  ];
  for (const p of pats) {
    const m = lua.match(p);
    if (m) return [parseInt(m[1]), parseInt(m[2])];
  }
  return null;
};
const sheetIdleOf = (lua) => {
  // Formato nuevo: bloque `idle = { fps, frames, columns, rows }` en spritesheets
  const m = lua.match(/idle\s*=\s*\{([^}]*)\}/s);
  if (!m) return null;
  const get = (k) => { const r = m[1].match(new RegExp(k + `\\s*=\\s*(\\d+)`)); return r ? parseInt(r[1]) : null; };
  const frames = get('frames'), columns = get('columns'), rows = get('rows');
  if (!frames || !columns || !rows) return null;
  return { fps: get('fps') ?? 10, frames, columns, rows, hotspot: hotspotOf(lua) };
};
const sheetOf = (lua, name) => {
  const m = lua.match(new RegExp(name + `\\s*=\\s*\\{([^}]*)\\}`, 's'));
  if (!m) return null;
  const get = (k) => { const r = m[1].match(new RegExp(k + `\\s*=\\s*(\\d+)`)); return r ? parseInt(r[1]) : null; };
  return { fps: get('fps') ?? 10, frames: get('frames') ?? 10, columns: get('columns') ?? 3, rows: get('rows') ?? 4 };
};

const buildings = {};
for (const [id, dir] of Object.entries(BUILD_MAP)) {
  const src = join(WL, dir);
  const lua = join(src, 'init.lua');
  if (!existsSync(lua)) { fail.push(`edificio ${id}: falta ${dir}/init.lua`); continue; }
  const luaText = readFileSync(lua, 'utf8');
  // Preferir spritesheet animado idle_1.png; fallback a frame único idle_00.png
  const sheetFile = ['idle_1.png', 'idle_2.png', 'idle_0.5.png'].map((f) => join(src, f)).find((f) => existsSync(f));
  const staticFile = ['idle_00.png', 'idle_0.png', 'idle.png'].map((f) => join(src, f)).find((f) => existsSync(f));
  const menu = join(src, 'menu.png');
  if (existsSync(menu)) copyFileSync(menu, join(OUT, 'icons', `${id}.png`));
  else fail.push(`edificio ${id}: sin menu.png`);
  const sheetDef = sheetFile ? sheetIdleOf(luaText) : null;
  if (sheetFile && sheetDef) {
    const meta = await sharp(sheetFile).metadata();
    const fw = Math.round(meta.width / sheetDef.columns);
    const fh = Math.round(meta.height / sheetDef.rows);
    copyFileSync(sheetFile, join(OUT, 'sheets', `${id}-idle.png`));
    await sharp(sheetFile).extract({ left: 0, top: 0, width: fw, height: fh }).png().toFile(join(OUT, `b-${id}.png`));
    const hs = sheetDef.hotspot ?? [Math.round(fw / 2), fh];
    buildings[id] = { mode: 'sheet', w: fw, h: fh, hotspot: hs, sheet: { file: `${id}-idle.png`, fw, fh, frames: sheetDef.frames, fps: sheetDef.fps }, src: dir };
    continue;
  }
  // Fallback: frame único (idle_00.png o idle_1.png suelto como barracks 87x76)
  const stills = ['idle_00.png', 'idle_0.png', 'idle_1.png', 'idle_2.png', 'idle.png'].map((f) => join(src, f));
  const stillFile = stills.find((f) => existsSync(f));
  if (stillFile) {
    copyFileSync(stillFile, join(OUT, `b-${id}.png`));
    const meta = await sharp(stillFile).metadata();
    buildings[id] = { w: meta.width, h: meta.height, hotspot: hotspotOf(luaText) ?? [Math.round(meta.width / 2), meta.height], src: dir };
  } else {
    fail.push(`edificio ${id}: sin idle en ${dir}`);
  }
}

const workers = {};
for (const [role, worker] of Object.entries(WORKER_MAP)) {
  const src = join(WL, 'workers/barbarians', worker);
  const lua = join(src, 'init.lua');
  if (!existsSync(lua)) { fail.push(`worker ${role}: falta ${worker}`); continue; }
  const grid = sheetOf(readFileSync(lua, 'utf8'), 'walk') ?? { fps: 10, frames: 10, columns: 3, rows: 4 };
  const entry = { worker, grid, dirs: {} };
  for (const d of ['e', 'w']) {
    let file = null;
    for (const s of ['2', '1', '0.5']) {
      const cand = join(src, `walk_${d}_${s}.png`);
      if (existsSync(cand)) { file = cand; break; }
    }
    if (!file) { fail.push(`worker ${role}: sin walk_${d}`); continue; }
    const meta = await sharp(file).metadata();
    const fw = Math.round(meta.width / grid.columns);
    const rh = Math.round(meta.height / grid.rows);
    copyFileSync(file, join(OUT, 'people', `${role}-${d}.png`));
    entry.dirs[d] = { file: `${role}-${d}.png`, w: meta.width, h: meta.height, fw, fh: rh };
  }
  workers[role] = entry;
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ buildings, workers }, null, 2));
const ts =
  `// Generado por scripts/import-widelands.mjs — NO EDITAR A MANO.\n` +
  `// Arte GPL-2.0+ de Widelands (ver docs/ATRIBUCION.md).\n` +
  `export interface WlSheet { file: string; fw: number; fh: number; frames: number; fps: number }\n` +
  `export interface WlBuilding { w: number; h: number; hotspot: [number, number]; src: string; mode?: 'sheet'; sheet?: WlSheet }\n` +
  `export interface WlWorkerDir { file: string; w: number; h: number; fw: number; fh: number }\n` +
  `export interface WlWorker { worker: string; grid: { fps: number; frames: number; columns: number; rows: number }; dirs: Partial<Record<'e' | 'w', WlWorkerDir>> }\n` +
  `export const WL_BUILDINGS: Record<string, WlBuilding> = ${JSON.stringify(buildings)};\n` +
  `export const WL_WORKERS: Record<string, WlWorker> = ${JSON.stringify(workers)};\n` +
  `/** Escala para que el edificio ocupe ~1 loseta sin empequeñecer minis. */\n` +
  `export function wlBuildingScale(w: number, h: number): number {\n` +
  `  return Math.min(2.4, Math.max(0.85, 110 / Math.max(w, h)));\n` +
  `}\n` +
  `export function wlWorkerScale(fh: number): number {\n` +
  `  return Math.min(1.5, Math.max(0.8, 52 / fh));\n` +
  `}\n`;
writeFileSync(join(root, 'src', 'game', 'data', 'wlArt.ts'), ts);

// contacto visual de edificios (celdas amplias: headquarters es grande)
const ids = Object.keys(buildings);
const cols = 4;
const CW = 230;
const CH = 210;
const rows = Math.ceil(ids.length / cols);
const tiles = await Promise.all(ids.map((id) => sharp(join(OUT, `b-${id}.png`)).png().toBuffer()));
const contact = await sharp({ create: { width: CW * cols, height: CH * rows, channels: 4, background: { r: 20, g: 30, b: 24, alpha: 1 } } })
  .composite(tiles.flatMap((input, i) => {
    const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
    return [
      { input, left: x + 4, top: y + Math.max(0, CH - 24 - (buildings[ids[i]].h ?? 69)) },
      { input: Buffer.from(`<svg width="${CW}" height="22"><text x="4" y="16" font-size="13" fill="white" font-family="sans-serif">${ids[i]}</text></svg>`), left: x, top: y + CH - 22 },
    ];
  }))
  .png()
  .toBuffer();
writeFileSync('C:/Users/PC CASA/AppData/Local/Temp/opencode/contact-wl.png', contact);
console.log(`widelands OK: ${ids.length} edificios, ${Object.keys(workers).length} workers`);
if (fail.length) { console.log('AVISOS:'); fail.forEach((f) => console.log(' -', f)); }
