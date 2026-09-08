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
  puerto: 'buildings/productionsites/barbarians/shipyard',
};

const WORKER_MAP = {
  settler: 'builder', woodcutter: 'lumberjack', carrier: 'carrier', soldier: 'soldier',
  archer: 'hunter', miner: 'miner', fisher: 'fisher', baker: 'baker',
};

// Extrae el bloque `name = {...}` balanceando llaves (tolera hotspot interno)
const blockOf = (lua, name) => {
  const i = lua.indexOf(`${name} = {`);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i + name.length + 3; j < lua.length; j++) {
    if (lua[j] === '{') depth++;
    else if (lua[j] === '}') {
      depth--;
      if (depth === 0) return lua.slice(i, j + 1);
    }
  }
  return null;
};
const getNum = (block, k) => {
  if (!block) return null;
  const r = block.match(new RegExp(k + `\\s*=\\s*(\\d+)`));
  return r ? parseInt(r[1]) : null;
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
  const luaText = readFileSync(lua, 'utf8');
  const grid = sheetOf(luaText, 'walk') ?? { fps: 10, frames: 10, columns: 3, rows: 4 };
  const entry = { worker, grid, dirs: {}, loads: {} };
  const pick = (prefix) => ['2', '1', '0.5'].map((s) => join(src, `${prefix}_${s}.png`)).find((f) => existsSync(f));
  const kinds = [['', 'dirs', 'walk']];
  if (pick('walkload_e')) kinds.push(['load-', 'loads', 'walkload']);
  const DIRS6 = ['e', 'se', 'sw', 'w', 'nw', 'ne'];
  for (const [prefix, slot, base] of kinds) {
    for (const d of DIRS6) {
      let file = null;
      for (const s of ['2', '1', '0.5']) {
        const cand = join(src, `${base}_${d}_${s}.png`);
        if (existsSync(cand)) { file = cand; break; }
      }
      if (!file) { fail.push(`worker ${role}: sin ${base}_${d}`); continue; }
      const meta = await sharp(file).metadata();
      const fw = Math.round(meta.width / grid.columns);
      const rh = Math.round(meta.height / grid.rows);
      copyFileSync(file, join(OUT, 'people', `${role}-${prefix}${d}.png`));
      entry[slot][d] = { file: `${role}-${prefix}${d}.png`, w: meta.width, h: meta.height, fw, fh: rh };
    }
  }
  // idle omnidireccional + hack (trabajo) si existen
  for (const anim of ['idle', 'hack']) {
    const f = pick(anim);
    if (!f) continue;
    const blk = blockOf(luaText, anim);
    const cols = blk ? getNum(blk, 'columns') ?? 3 : 3;
    const rows = blk ? getNum(blk, 'rows') ?? 4 : 4;
    const frames = blk ? getNum(blk, 'frames') ?? cols * rows : cols * rows;
    const fps = blk ? getNum(blk, 'fps') ?? 8 : 8;
    const meta = await sharp(f).metadata();
    copyFileSync(f, join(OUT, 'people', `${role}-${anim}.png`));
    entry[anim] = { file: `${role}-${anim}.png`, w: meta.width, h: meta.height, fw: Math.round(meta.width / cols), fh: Math.round(meta.height / rows), frames, fps };
  }
  workers[role] = entry;
}

const WLW = 'C:/Users/PC CASA/AppData/Local/Temp/opencode/widelands/data/world';
mkdirSync(join(OUT, 'nature'), { recursive: true });
mkdirSync(join(OUT, 'critters'), { recursive: true });

// --- Naturaleza: árboles (etapa mature), rocas greenland, arbustos ---
const nature = { trees: {}, rocks: {}, bushes: {} };
for (const t of ['alder', 'birch', 'beech']) {
  const dir = join(WLW, 'immovables/trees', t, 'mature');
  const lua = join(dir, 'init.lua');
  const img = join(dir, 'mature_1.png');
  if (!existsSync(lua) || !existsSync(img)) { fail.push(`arbol ${t}`); continue; }
  const text = readFileSync(lua, 'utf8');
  // sheet si hay metadatos (balanceo del árbol), si no frame único
  const blk = blockOf(text, 'idle');
  copyFileSync(img, join(OUT, 'nature', `tree-${t}.png`));
  const meta = await sharp(img).metadata();
  const sheet = blk && getNum(blk, 'frames') && getNum(blk, 'columns') && getNum(blk, 'rows')
    ? { fps: getNum(blk, 'fps') ?? 8, frames: getNum(blk, 'frames'), columns: getNum(blk, 'columns'), rows: getNum(blk, 'rows') }
    : null;
  nature.trees[t] = { w: meta.width, h: meta.height, hotspot: hotspotOf(text) ?? [Math.round(meta.width / 2), meta.height], sheet };
}
for (let i = 1; i <= 6; i++) {
  const dir = join(WLW, `immovables/rocks/greenland/${i}`);
  const lua = join(dir, 'init.lua');
  if (!existsSync(lua)) { fail.push(`roca ${i}`); continue; }
  const text = readFileSync(lua, 'utf8');
  const bm = text.match(/basename\s*=\s*"([^"]+)"/);
  const img = join(dir, `${bm ? bm[1] : 'rocks' + i}.png`);
  if (!existsSync(img)) { fail.push(`roca ${i}: sin png`); continue; }
  copyFileSync(img, join(OUT, 'nature', `rock-${i}.png`));
  const meta = await sharp(img).metadata();
  nature.rocks[i] = { w: meta.width, h: meta.height, hotspot: hotspotOf(text) ?? [Math.round(meta.width / 2), meta.height] };
}
for (let i = 1; i <= 5; i++) {
  const dir = join(WLW, `immovables/plants/bush${i}`);
  const lua = join(dir, 'init.lua');
  const img = join(dir, 'idle.png');
  if (!existsSync(lua) || !existsSync(img)) { fail.push(`arbusto ${i}`); continue; }
  copyFileSync(img, join(OUT, 'nature', `bush-${i}.png`));
  const meta = await sharp(img).metadata();
  nature.bushes[i] = { w: meta.width, h: meta.height, hotspot: hotspotOf(readFileSync(lua, 'utf8')) ?? [Math.round(meta.width / 2), meta.height] };
}
// matas de hierba y setas (detalle de suelo)
nature.grass = {};
for (let i = 1; i <= 3; i++) {
  const dir = join(WLW, `immovables/plants/grass${i}`);
  const lua = join(dir, 'init.lua');
  const img = join(dir, 'idle.png');
  if (!existsSync(lua) || !existsSync(img)) { fail.push(`mata ${i}`); continue; }
  copyFileSync(img, join(OUT, 'nature', `grass-${i}.png`));
  const meta = await sharp(img).metadata();
  nature.grass[i] = { w: meta.width, h: meta.height, hotspot: hotspotOf(readFileSync(lua, 'utf8')) ?? [Math.round(meta.width / 2), meta.height] };
}
nature.shrooms = {};
for (let i = 1; i <= 2; i++) {
  const dir = join(WLW, `immovables/miscellaneous/mushroom${i}`);
  const lua = join(dir, 'init.lua');
  const img = join(dir, 'idle.png');
  if (!existsSync(lua) || !existsSync(img)) { fail.push(`seta ${i}`); continue; }
  copyFileSync(img, join(OUT, 'nature', `shroom-${i}.png`));
  const meta = await sharp(img).metadata();
  nature.shrooms[i] = { w: meta.width, h: meta.height, hotspot: hotspotOf(readFileSync(lua, 'utf8')) ?? [Math.round(meta.width / 2), meta.height] };
}

// --- Critters: mismo formato que workers ---
const critters = {};
for (const n of ['bunny', 'deer', 'sheep', 'duck']) {
  const src = join(WLW, 'critters', n);
  const lua = join(src, 'init.lua');
  if (!existsSync(lua)) { fail.push(`critter ${n}`); continue; }
  const grid = sheetOf(readFileSync(lua, 'utf8'), 'walk') ?? { fps: 8, frames: 8, columns: 3, rows: 4 };
  const entry = { grid, dirs: {} };
  for (const d of ['e', 'w', 'idle']) {
    const cand = d === 'idle' ? join(src, 'idle.png') : ['2', '1', '0.5', '00'].map((s) => join(src, `walk_${d}_${s}.png`)).find((f) => existsSync(f));
    if (!cand || !existsSync(cand)) continue;
    const meta = await sharp(cand).metadata();
    const fw = d === 'idle' ? meta.width : Math.round(meta.width / grid.columns);
    const fh = d === 'idle' ? meta.height : Math.round(meta.height / grid.rows);
    copyFileSync(cand, join(OUT, 'critters', `${n}-${d}.png`));
    entry.dirs[d] = { file: `${n}-${d}.png`, w: meta.width, h: meta.height, fw, fh };
  }
  critters[n] = entry;
}

// --- Barcos bárbaros (velas en 6 direcciones + idle) ---
const ships = {};
mkdirSync(join(OUT, 'ships'), { recursive: true });
{
  const src = join(WL, 'ships/barbarians');
  const lua = join(src, 'init.lua');
  if (existsSync(lua)) {
    const text = readFileSync(lua, 'utf8');
    const entry = { dirs: {} };
    for (const d of ['e', 'se', 'sw', 'w', 'nw', 'ne']) {
      const cand = join(src, `sail_${d}_1.png`);
      if (!existsSync(cand)) { fail.push(`barco: sin sail_${d}`); continue; }
      const meta = await sharp(cand).metadata();
      // tira vertical de frames: rejilla del init (sail: frames/columns/rows)
      const blk = blockOf(text, 'sail');
      const cols = blk ? getNum(blk, 'columns') ?? 1 : 1;
      const rows = blk ? getNum(blk, 'rows') ?? 1 : 1;
      copyFileSync(cand, join(OUT, 'ships', `ship-${d}.png`));
      entry.dirs[d] = { file: `ship-${d}.png`, w: meta.width, h: meta.height, fw: Math.round(meta.width / cols), fh: Math.round(meta.height / rows), frames: blk ? getNum(blk, 'frames') ?? 1 : 1, fps: blk ? getNum(blk, 'fps') ?? 6 : 6 };
    }
    const idle = join(src, 'idle_1.png');
    if (existsSync(idle)) {
      const meta = await sharp(idle).metadata();
      copyFileSync(idle, join(OUT, 'ships', 'ship-idle.png'));
      entry.idle = { file: 'ship-idle.png', w: meta.width, h: meta.height };
    }
    ships.barbarian = entry;
  } else {
    fail.push('barco: sin init.lua');
  }
}
const wheat = {};
mkdirSync(join(OUT, 'crops'), { recursive: true });
for (const stage of ['tiny', 'small', 'medium', 'ripe', 'harvested']) {
  const dir = join(WL, 'immovables/wheatfield', stage);
  const lua = join(dir, 'init.lua');
  const img = join(dir, 'idle_1.png');
  if (!existsSync(lua) || !existsSync(img)) { fail.push(`trigo ${stage}`); continue; }
  const text = readFileSync(lua, 'utf8');
  const blk = blockOf(text, 'idle');
  const grid = blk ? { fps: getNum(blk, 'fps') ?? 8, frames: getNum(blk, 'frames') ?? 1, columns: getNum(blk, 'columns') ?? 1, rows: getNum(blk, 'rows') ?? 1 } : { fps: 8, frames: 1, columns: 1, rows: 1 };
  const meta = await sharp(img).metadata();
  copyFileSync(img, join(OUT, 'crops', `wheat-${stage}.png`));
  wheat[stage] = {
    file: `wheat-${stage}.png`, w: meta.width, h: meta.height,
    fw: Math.round(meta.width / grid.columns), fh: Math.round(meta.height / grid.rows),
    ...grid, hotspot: hotspotOf(text) ?? [Math.round(meta.width / 2), meta.height],
  };
}

// --- Iconos de recursos para el HUD ---
const RES_ICONS = {
  madera: 'log', tablon: 'planks', piedra: 'granite', grano: 'wheat', harina: 'flour',
  pan: 'bread_barbarians', agua: 'water', pez: 'fish', carbon: 'coal', hierro: 'iron_ore',
  lingoteHierro: 'iron', oro: 'gold_ore', lingoteOro: 'gold', herramienta: 'shovel',
  espada: 'sword_short', arco: 'hunting_bow',
};
const resIcons = {};
for (const [res, ware] of Object.entries(RES_ICONS)) {
  const menu = join(WL, 'wares', ware, 'menu.png');
  if (!existsSync(menu)) { fail.push(`icono ${res} (${ware})`); continue; }
  copyFileSync(menu, join(OUT, 'icons', `res-${res}.png`));
  resIcons[res] = `res-${res}.png`;
}

// --- Etapas de construcción: build_1.png + metadatos build ---
for (const [id, dir] of Object.entries(BUILD_MAP)) {
  const src = join(WL, dir);
  const lua = join(src, 'init.lua');
  const sheet = join(src, 'build_1.png');
  if (!existsSync(lua) || !existsSync(sheet)) continue;
  const text = readFileSync(lua, 'utf8');
  const m = text.match(/build\s*=\s*\{([^}]*)\}/s);
  if (!m) continue;
  const get = (k) => { const r = m[1].match(new RegExp(k + `\\s*=\\s*(\\d+)`)); return r ? parseInt(r[1]) : null; };
  const frames = get('frames'), columns = get('columns'), rows = get('rows');
  if (!frames || !columns || !rows) continue;
  const meta = await sharp(sheet).metadata();
  copyFileSync(sheet, join(OUT, 'sheets', `${id}-build.png`));
  buildings[id].build = {
    file: `${id}-build.png`, fw: Math.round(meta.width / columns), fh: Math.round(meta.height / rows),
    frames, fps: get('fps') ?? 6, hotspot: hotspotOf(text) ?? buildings[id].hotspot,
  };
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ buildings, workers, nature, critters, resIcons, wheat, ships }, null, 2));
const ts =
  `// Generado por scripts/import-widelands.mjs — NO EDITAR A MANO.\n` +
  `// Arte GPL-2.0+ de Widelands (ver docs/ATRIBUCION.md).\n` +
  `export interface WlSheet { file: string; fw: number; fh: number; frames: number; fps: number }\n` +
  `export interface WlBuilding { w: number; h: number; hotspot: [number, number]; src: string; mode?: 'sheet'; sheet?: WlSheet; build?: WlSheet & { hotspot: [number, number] } }\n` +
  `export interface WlWorkerDir { file: string; w: number; h: number; fw: number; fh: number }\n` +
  `export interface WlWorkerAnim { file: string; w: number; h: number; fw: number; fh: number; frames: number; fps: number }\n` +
  `export interface WlWorker { worker: string; grid: { fps: number; frames: number; columns: number; rows: number }; dirs: Partial<Record<string, WlWorkerDir>>; loads?: Partial<Record<string, WlWorkerDir>>; idle?: WlWorkerAnim; hack?: WlWorkerAnim }\n` +
  `export const WL_BUILDINGS: Record<string, WlBuilding> = ${JSON.stringify(buildings)};\n` +
  `export const WL_WORKERS: Record<string, WlWorker> = ${JSON.stringify(workers)};\n` +
  `export interface WlNatureItem { w: number; h: number; hotspot: [number, number]; sheet?: { fps: number; columns: number; rows: number; frames: number } | null }\n` +
  `export const WL_TREES: Record<string, WlNatureItem> = ${JSON.stringify(nature.trees)};\n` +
  `export const WL_ROCKS: Record<string, WlNatureItem> = ${JSON.stringify(nature.rocks)};\n` +
  `export const WL_BUSHES: Record<string, WlNatureItem> = ${JSON.stringify(nature.bushes)};\n` +
  `export const WL_GRASS: Record<string, WlNatureItem> = ${JSON.stringify(nature.grass)};\n` +
  `export const WL_SHROOMS: Record<string, WlNatureItem> = ${JSON.stringify(nature.shrooms)};\n` +
  `export interface WlCritterDir { file: string; w: number; h: number; fw: number; fh: number }\n` +
  `export interface WlCritter { grid: { fps: number; frames: number; columns: number; rows: number }; dirs: Record<string, WlCritterDir> }\n` +
  `export const WL_CRITTERS: Record<string, WlCritter> = ${JSON.stringify(critters)};\n` +
  `export interface WlShipDir { file: string; w: number; h: number; fw: number; fh: number; frames: number; fps: number }\n` +
  `export interface WlShip { dirs: Partial<Record<string, WlShipDir>>; idle?: { file: string; w: number; h: number } }\n` +
  `export const WL_SHIPS: Record<string, WlShip> = ${JSON.stringify(ships)};\n` +
  `export interface WlWheatStage { file: string; w: number; h: number; fw: number; fh: number; fps: number; frames: number; columns: number; rows: number; hotspot: [number, number] }\n` +
  `export const WL_WHEAT: Record<string, WlWheatStage> = ${JSON.stringify(wheat)};\n` +
  `export const WL_WHEAT_ORDER = ['tiny', 'small', 'medium', 'ripe'];\n` +
  `export const WL_RES_ICONS: Record<string, string> = ${JSON.stringify(resIcons)};\n` +
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
