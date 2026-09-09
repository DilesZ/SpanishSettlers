// Genera el terreno estilo S4 (diamantes 132x66 SIN laterales 3D).
// Determinista (RNG con seed) para builds reproducibles.
// Salida: public/assets/terrain-sheet.png (rejilla 5x2, mismos gids) +
//         public/assets/foam-{ne,se,sw,nw}.png (orillas por vecino).
//
// Obra 100% original y procedural (SVG -> PNG via sharp). No contiene
// material de terceros ni de The Settlers IV.
//
// Notas anti-rejilla: el relieve es radial y centrado, NUNCA trazos en el
// borde del diamante; los moteados se atenúan cerca del borde (edgeFade)
// para que dos tiles iguales adyacentes no dibujen una cuadrícula.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'assets');
const W = 132;
const H = 66;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inDiamond = (x, y) => Math.abs(x - W / 2) / (W / 2) + Math.abs(y - H / 2) / (H / 2) <= 1;
// Distancia normalizada al borde (0 centro, 1 borde). Sirve para atenuar.
const edgeDist = (x, y) => Math.abs(x - W / 2) / (W / 2) + Math.abs(y - H / 2) / (H / 2);
const edgeFade = (x, y) => {
  const d = edgeDist(x, y);
  if (d > 0.92) return 0;
  if (d > 0.78) return 0.35;
  return 1;
};
const inInner = (x, y, m = 9) => x > m && x < W - m && y > m * 0.55 && y < H - m * 0.55 && inDiamond(x, y);
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
const f1 = (n) => n.toFixed(1);
const f2 = (n) => n.toFixed(2);

const DIAMOND = `M ${W / 2} 0 L ${W} ${H / 2} L ${W / 2} ${H} L 0 ${H / 2} Z`;

function reliefBase() {
  // Luz cenital suave centrada + sombra inferior centrada. Nada toca el borde.
  return (
    `<ellipse cx="66" cy="26" rx="50" ry="20" fill="#ffffff" opacity="0.08" filter="url(#soft)"/>` +
    `<ellipse cx="66" cy="41" rx="50" ry="20" fill="#0a1a08" opacity="0.09" filter="url(#soft)"/>`
  );
}

function blotches(rnd, colors, n, rMin, rMax, oMin, oMax) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 8 + rnd() * (W - 16);
    const y = 5 + rnd() * (H - 10);
    if (!inDiamond(x, y)) continue;
    const fade = edgeFade(x, y);
    if (fade === 0) continue;
    const r = rMin + rnd() * (rMax - rMin);
    const c = pick(rnd, colors);
    const o = (oMin + rnd() * (oMax - oMin)) * fade;
    s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * 0.55)}" fill="${c}" opacity="${f2(o)}" filter="url(#soft)"/>`;
  }
  return s;
}

function grainTwoOctaves(rnd, colors, fineN, coarseN) {
  // Grano fino (crisp, rompe el plano en zoom) + grano grueso suave.
  let s = '';
  for (let i = 0; i < fineN; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (!inInner(x, y)) continue;
    const fade = edgeFade(x, y);
    if (fade === 0) continue;
    const c = pick(rnd, colors);
    const o = (0.3 + rnd() * 0.35) * fade;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(0.6 + rnd() * 1.0)}" fill="${c}" opacity="${f2(o)}"/>`;
  }
  for (let i = 0; i < coarseN; i++) {
    const x = 8 + rnd() * (W - 16);
    const y = 5 + rnd() * (H - 10);
    if (!inDiamond(x, y)) continue;
    const fade = edgeFade(x, y);
    if (fade === 0) continue;
    const c = pick(rnd, colors);
    const o = (0.1 + rnd() * 0.16) * fade;
    const r = 4 + rnd() * 7;
    s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * 0.5)}" fill="${c}" opacity="${f2(o)}" filter="url(#soft)"/>`;
  }
  return s;
}

function grassBlades(rnd, dark, light, n) {
  // Briznas: trazos cortos verticales/diagonales, nítidos, interiores.
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 10 + rnd() * (W - 20);
    const y = 6 + rnd() * (H - 12);
    if (!inInner(x, y, 12)) continue;
    const h = 2 + rnd() * 3.2;
    const lean = (rnd() - 0.5) * 2.4;
    const c = rnd() > 0.45 ? dark : light;
    const o = 0.4 + rnd() * 0.35;
    s += `<path d="M ${f1(x)} ${f1(y)} l ${f1(lean)} ${f2(-h)}" stroke="${c}" stroke-width="${f2(0.8 + rnd() * 0.6)}" stroke-linecap="round" fill="none" opacity="${f2(o)}"/>`;
  }
  return s;
}

function pebbles(rnd, shadow, light, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 10 + rnd() * (W - 20);
    const y = 6 + rnd() * (H - 12);
    if (!inInner(x, y, 12)) continue;
    const r = 0.9 + rnd() * 1.6;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" fill="${shadow}" opacity="0.5"/>`;
    s += `<circle cx="${f1(x - r * 0.3)}" cy="${f1(y - r * 0.35)}" r="${f2(r * 0.55)}" fill="${light}" opacity="0.6"/>`;
  }
  return s;
}

function cracks(rnd, n, dark, light) {
  // Grietas con realce: línea oscura + eco claro desplazado 1px (relieve).
  let s = '';
  for (let i = 0; i < n; i++) {
    let x = 24 + rnd() * (W - 48);
    let y = 12 + rnd() * (H - 24);
    if (!inInner(x, y, 16)) continue;
    let d = `M ${f1(x)} ${f1(y)}`;
    let dHi = `M ${f1(x + 1)} ${f1(y + 1)}`;
    let px = x;
    let py = y;
    const segs = 3 + Math.floor(rnd() * 3);
    for (let sg = 0; sg < segs; sg++) {
      px += (rnd() - 0.5) * 24;
      py += (rnd() - 0.5) * 13;
      d += ` L ${f1(px)} ${f1(py)}`;
      dHi += ` L ${f1(px + 1)} ${f1(py + 1)}`;
    }
    s += `<path d="${dHi}" stroke="${light}" stroke-width="1.6" fill="none" opacity="0.35"/>`;
    s += `<path d="${d}" stroke="${dark}" stroke-width="1.3" fill="none" opacity="0.6"/>`;
  }
  return s;
}

function streaks(rnd, colors, n, wMin, wMax, oMax) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 14 + rnd() * (W - 28);
    const y = 8 + rnd() * (H - 16);
    if (!inDiamond(x, y)) continue;
    const fade = edgeFade(x, y);
    if (fade === 0) continue;
    const w = wMin + rnd() * (wMax - wMin);
    const c = pick(rnd, colors);
    const o = (0.25 + rnd() * oMax) * fade;
    s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w)}" ry="${f2(1.6 + rnd() * 2.2)}" fill="${c}" opacity="${f2(o)}" filter="url(#soft)"/>`;
  }
  return s;
}

function waterGlints(rnd, n) {
  // Destellos dentro del tile: mota de profundidad + brillo superficial.
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 12 + rnd() * (W - 24);
    const y = 7 + rnd() * (H - 14);
    if (!inInner(x, y, 13)) continue;
    const rx = 1.8 + rnd() * 3.6;
    const ry = 0.7 + rnd() * 0.9;
    const c = rnd() > 0.35 ? '#e8f3ff' : '#cfe6ff';
    const o = 0.3 + rnd() * 0.45;
    s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f2(ry)}" fill="${c}" opacity="${f2(o)}"/>`;
  }
  return s;
}

function depthMottle(rnd, darks, n) {
  // Moteado de profundidad: manchas oscuras azuladas, suaves.
  return blotches(rnd, darks, n, 5, 13, 0.16, 0.34);
}

function sandWetHollow(rnd) {
  // Arena: hondonada húmeda al sur (centrada, se difumina antes de las
  // esquinas para no dibujar rejilla en arena-adyacente) + moteado.
  let s = `<ellipse cx="66" cy="52" rx="44" ry="11" fill="#a88454" opacity="0.22" filter="url(#soft)"/>`;
  s += `<ellipse cx="66" cy="56" rx="30" ry="7" fill="#96713f" opacity="0.18" filter="url(#soft)"/>`;
  // Conchitas / granos gruesos claros.
  for (let i = 0; i < 12; i++) {
    const x = 12 + rnd() * (W - 24);
    const y = 8 + rnd() * (H - 16);
    if (!inInner(x, y, 12)) continue;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(0.8 + rnd() * 1.2)}" fill="#f7e8c4" opacity="${f2(0.4 + rnd() * 0.3)}"/>`;
  }
  return s;
}

function mountainFacets() {
  // Facetas de roca: cara iluminada N + cara en sombra S, centradas.
  return (
    `<polygon points="66,8 104,31 66,44 28,31" fill="#aaa496" opacity="0.5" filter="url(#soft)"/>` +
    `<polygon points="28,31 66,44 66,58 28,38" fill="#5f594d" opacity="0.45" filter="url(#soft)"/>` +
    `<polygon points="66,44 104,31 104,38 66,58" fill="#6e685b" opacity="0.4" filter="url(#soft)"/>` +
    `<path d="M 66 8 L 104 31" stroke="#c9c3b2" stroke-width="1.6" opacity="0.5" fill="none"/>`
  );
}

function diamondTile(seed, base, blotchColors, opts = {}) {
  const rnd = mulberry32(seed);
  const kind = opts.kind ?? 'grass';
  const n = opts.blotches ?? 46;

  let inner = `<rect width="${W}" height="${H}" fill="${base}"/>`;
  inner += reliefBase();
  inner += blotches(rnd, blotchColors, n, 1.6, 7, 0.18, 0.5);

  if (kind === 'grass' || kind === 'forest') {
    inner += grainTwoOctaves(rnd, blotchColors, 110, 10);
    inner += grassBlades(rnd, opts.bladeDark ?? '#3c7030', opts.bladeLight ?? '#86c06e', kind === 'forest' ? 46 : 72);
    if (kind === 'forest') {
      // Sotobosque: manchas muy oscuras + agujas.
      inner += blotches(rnd, ['#274d22', '#2f5c28', '#1f4220'], 16, 3, 8, 0.25, 0.5);
      inner += pebbles(rnd, '#223d1f', '#5d9b4a', 10);
    } else {
      inner += pebbles(rnd, opts.pebbleDark ?? '#476e39', opts.pebbleLight ?? '#8cc47a', 8);
    }
  } else if (kind === 'dirt') {
    inner += grainTwoOctaves(rnd, blotchColors, 120, 12);
    inner += pebbles(rnd, '#6e573a', '#c49c66', 22);
    inner += streaks(rnd, blotchColors, 6, 8, 22, 0.3);
  } else if (kind === 'sand') {
    inner += grainTwoOctaves(rnd, blotchColors, 130, 10);
    inner += sandWetHollow(rnd);
    inner += streaks(rnd, ['#c8a166', '#f2dca8'], 5, 10, 24, 0.3);
  } else if (kind === 'water') {
    inner += depthMottle(rnd, opts.deep ?? ['#2c5f9e', '#26538c', '#1e4e8a'], 14);
    inner += streaks(rnd, blotchColors, opts.streaks ?? 9, 12, 30, 0.35);
    inner += waterGlints(rnd, 26);
    inner += grainTwoOctaves(rnd, blotchColors, 40, 6);
  } else if (kind === 'mountain') {
    inner += mountainFacets();
    inner += grainTwoOctaves(rnd, blotchColors, 90, 12);
    inner += cracks(rnd, 7, opts.crackColor ?? '#5d574b', '#b3ac9c');
    inner += pebbles(rnd, '#5f594d', '#b0aa9a', 16);
  }

  const svg =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><clipPath id="d"><path d="${DIAMOND}"/></clipPath>` +
    `<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.3"/></filter></defs>` +
    `<g clip-path="url(#d)">` +
    inner +
    `</g>` +
    `</svg>`;
  return Buffer.from(svg);
}

// Bordes del diamante (para espuma según vecino con tierra)
const EDGES = {
  ne: `M 66 2 L 130 33`,
  se: `M 130 33 L 66 64`,
  sw: `M 66 64 L 2 33`,
  nw: `M 2 33 L 66 2`,
};
// Punto inicial/final de cada borde para interpolar espuma orgánica.
const EDGE_ENDS = {
  ne: [[66, 2], [130, 33]],
  se: [[130, 33], [66, 64]],
  sw: [[66, 64], [2, 33]],
  nw: [[2, 33], [66, 2]],
};
const EDGE_SEED = { ne: 101, se: 202, sw: 303, nw: 404 };

function foamEdge(edge) {
  const rnd = mulberry32(EDGE_SEED[edge] ?? 7);
  const [[x0, y0], [x1, y1]] = EDGE_ENDS[edge];
  // Hacia el interior del diamante (su centro 66,33).
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  let nx = 66 - mx;
  let ny = 33 - my;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  let lace = '';
  // Encaje: segmentos cortos discontinuos paralelos al borde, lado agua.
  for (let i = 0; i < 11; i++) {
    const t = 0.06 + (i / 11) * 0.88 + (rnd() - 0.5) * 0.04;
    const px = x0 + (x1 - x0) * t + nx * (2 + rnd() * 7);
    const py = y0 + (y1 - y0) * t + ny * (2 + rnd() * 7);
    const len = 5 + rnd() * 9;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl;
    const uy = dy / dl;
    const w = 2.2 + rnd() * 2.4;
    lace += `<line x1="${f1(px - (ux * len) / 2)}" y1="${f1(py - (uy * len) / 2)}" x2="${f1(px + (ux * len) / 2)}" y2="${f1(py + (uy * len) / 2)}" stroke="#ffffff" stroke-width="${f2(w)}" stroke-linecap="round" opacity="${f2(0.3 + rnd() * 0.35)}" filter="url(#b)"/>`;
  }
  let bubbles = '';
  for (let i = 0; i < 16; i++) {
    const t = rnd();
    const px = x0 + (x1 - x0) * t + nx * (3 + rnd() * 11);
    const py = y0 + (y1 - y0) * t + ny * (3 + rnd() * 11);
    if (!inDiamond(px, py)) continue;
    bubbles += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f2(0.8 + rnd() * 1.6)}" fill="#f4faff" opacity="${f2(0.4 + rnd() * 0.4)}"/>`;
  }
  const svg =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><clipPath id="d"><path d="${DIAMOND}"/></clipPath>` +
    `<filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<filter id="b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>` +
    `<g clip-path="url(#d)">` +
    `<path d="${EDGES[edge]}" stroke="#ffffff" stroke-width="9" fill="none" opacity="0.32" filter="url(#b)"/>` +
    lace +
    `<path d="${EDGES[edge]}" stroke="#f2f8ff" stroke-width="2.4" fill="none" opacity="0.9" filter="url(#b2)"/>` +
    bubbles +
    `</g></svg>`;
  return Buffer.from(svg);
}

// MISMO orden y mismos 10 GIDs que antes (tests/unit/tilemap.test.ts).
const TILES = [
  ['grass', 11, '#5d9b47', ['#4e8a3c', '#6cab57'], { kind: 'grass', bladeDark: '#3e7532', bladeLight: '#8cc47a', pebbleDark: '#476e39', pebbleLight: '#8cc47a' }],
  ['grassB', 12, '#558f43', ['#487c38', '#63a251'], { kind: 'grass', bladeDark: '#38682c', bladeLight: '#7fb86c', pebbleDark: '#3f6534', pebbleLight: '#7fb86c' }],
  ['grassC', 13, '#64a34e', ['#548739', '#74b45c'], { kind: 'grass', bladeDark: '#457a36', bladeLight: '#95cc82', pebbleDark: '#4a7440', pebbleLight: '#95cc82' }],
  ['dirt', 14, '#9c7c4e', ['#8a6a40', '#b08c5c'], { kind: 'dirt' }],
  ['sand', 15, '#dfc084', ['#d0af72', '#ecd096'], { kind: 'sand' }],
  ['water', 16, '#3b78c4', ['#5b96d8', '#7fb2e8'], { kind: 'water', streaks: 10, deep: ['#2c5f9e', '#26538c', '#1e4e8a'] }],
  ['waterB', 17, '#3974bd', ['#5890d4', '#7caede'], { kind: 'water', streaks: 10, deep: ['#2a5b99', '#244f87', '#1c4a85'] }],
  ['waterC', 18, '#3e7cc9', ['#5e99dc', '#84b6e8'], { kind: 'water', streaks: 10, deep: ['#2e639f', '#285790', '#20508c'] }],
  ['forest', 19, '#3d7a33', ['#32682b', '#4a8c3e'], { kind: 'forest', bladeDark: '#26491f', bladeLight: '#5da24e' }],
  ['mountain', 20, '#8d8778', ['#7a7466', '#9d9788'], { kind: 'mountain', cracks: 4, blotches: 20, crackColor: '#5d574b' }],
];

const cols = 5;
const rows = 2;
const bufs = TILES.map(([name, seed, base, colors, opts]) => diamondTile(seed, base, colors, opts));
const sheet = await sharp({ create: { width: W * cols, height: H * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(bufs.map((input, i) => ({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .png()
  .toBuffer();

mkdirSync(OUT, { recursive: true });
const { writeFileSync } = await import('node:fs');
writeFileSync(join(OUT, 'terrain-sheet.png'), sheet);
for (const e of Object.keys(EDGES)) {
  const png = await sharp(foamEdge(e)).png().toBuffer();
  writeFileSync(join(OUT, `foam-${e}.png`), png);
}
console.log('terreno rico OK:', TILES.map((t) => t[0]).join(','), '+ espuma ne/se/sw/nw');
