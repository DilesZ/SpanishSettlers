// Genera el terreno plano estilo S4 (diamantes 132x66 SIN laterales 3D).
// Determinista (RNG con seed) para builds reproducibles.
// Salida: public/assets/terrain-sheet.png (rejilla 5x2, mismos gids) +
//         public/assets/foam-{ne,se,sw,nw}.png (orillas por vecino).
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
const DIAMOND = `M ${W / 2} 0 L ${W} ${H / 2} L ${W / 2} ${H} L 0 ${H / 2} Z`;

function diamondTile(seed, base, blotchColors, opts = {}) {
  const rnd = mulberry32(seed);
  const n = opts.blotches ?? 26;
  let blobs = '';
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (!inDiamond(x, y)) continue;
    const r = 2 + rnd() * 5;
    const c = blotchColors[Math.floor(rnd() * blotchColors.length)];
    const o = (0.22 + rnd() * 0.3).toFixed(2);
    blobs += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.55).toFixed(1)}" fill="${c}" opacity="${o}" filter="url(#soft)"/>`;
  }
  let streaks = '';
  for (let i = 0; i < (opts.streaks ?? 0); i++) {
    const x = 14 + rnd() * (W - 28);
    const y = 8 + rnd() * (H - 16);
    if (!inDiamond(x, y)) continue;
    const w = 12 + rnd() * 26;
    const c = blotchColors[Math.floor(rnd() * blotchColors.length)];
    streaks += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${w.toFixed(1)}" ry="${(2 + rnd() * 2.4).toFixed(1)}" fill="${c}" opacity="0.5" filter="url(#soft)"/>`;
  }
  let cracks = '';
  for (let i = 0; i < (opts.cracks ?? 0); i++) {
    let x = 20 + rnd() * (W - 40);
    let y = 10 + rnd() * (H - 20);
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let s = 0; s < 4; s++) {
      x += (rnd() - 0.5) * 22; y += (rnd() - 0.5) * 12;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    cracks += `<path d="${d}" stroke="${opts.crackColor ?? '#6a6458'}" stroke-width="1.4" fill="none" opacity="0.55"/>`;
  }
  const svg =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><clipPath id="d"><path d="${DIAMOND}"/></clipPath>` +
    `<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.3"/></filter></defs>` +
    `<g clip-path="url(#d)">` +
    `<rect width="${W}" height="${H}" fill="${base}"/>` +
    `<polygon points="66,0 132,33 66,40 0,33" fill="#ffffff" opacity="0.07"/>` +
    `<polygon points="0,33 66,40 66,66 0,33" fill="#000000" opacity="0.05"/>` +
    blobs + streaks + cracks +
    `</g>` +
    `<path d="${DIAMOND}" fill="none" stroke="#000000" stroke-opacity="0.04" stroke-width="1"/>` +
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

function foamEdge(edge) {
  const svg =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><clipPath id="d"><path d="${DIAMOND}"/></clipPath>` +
    `<filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>` +
    `<g clip-path="url(#d)">` +
    `<path d="${EDGES[edge]}" stroke="#ffffff" stroke-width="7" fill="none" opacity="0.55" filter="url(#b)"/>` +
    `<path d="${EDGES[edge]}" stroke="#f2f8ff" stroke-width="2.4" fill="none" opacity="0.85"/>` +
    `</g></svg>`;
  return Buffer.from(svg);
}

const TILES = [
  ['grass', 11, '#5d9b47', ['#4e8a3c', '#6cab57'], {}],
  ['grassB', 12, '#558f43', ['#487c38', '#63a251'], {}],
  ['grassC', 13, '#64a34e', ['#548739', '#74b45c'], {}],
  ['dirt', 14, '#9c7c4e', ['#8a6a40', '#b08c5c'], {}],
  ['sand', 15, '#dfc084', ['#d0af72', '#ecd096'], {}],
  ['water', 16, '#3b78c4', ['#5b96d8', '#2f66aa'], { streaks: 9 }],
  ['waterB', 17, '#3974bd', ['#5890d4', '#2d62a6'], { streaks: 9 }],
  ['waterC', 18, '#3e7cc9', ['#5e99dc', '#3068ad'], { streaks: 9 }],
  ['forest', 19, '#3d7a33', ['#32682b', '#4a8c3e'], {}],
  ['mountain', 20, '#8d8778', ['#7a7466', '#9d9788'], { cracks: 4, blotches: 20 }],
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
console.log('terreno plano OK:', TILES.map((t) => t[0]).join(','), '+ espuma ne/se/sw/nw');
