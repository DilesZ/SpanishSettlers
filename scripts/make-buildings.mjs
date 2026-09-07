// Genera los 21 edificios originales estilo "terracota ibérica" en SVG→PNG.
// Canvas 128x128, suelo en y=118, determinista. Salida:
//   public/assets/buildings/b-<id>.png + mill-blades.png + icons/<id>.png (30x30)
//   public/assets/buildings.json (manifest: humo, brillos, aspas)
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'assets', 'buildings');
const ICONS = join(OUT, 'icons');
const S = 128;
const GROUND = 118;
let uid = 0;
const U = () => `u${uid++}`;

const P = {
  plaster: '#F5EAD2', plaster2: '#EFE0C2', timber: '#6B4A2A', timberD: '#4A3220',
  roof: '#B3402E', roofD: '#7F1D1D', roofB: '#7C4A21', stone: '#9AA0AA', stoneD: '#6E737C',
  stoneL: '#C4C9D1', wood: '#8A6538', woodL: '#D9B36A', dark: '#2E1D10',
  iron: '#4B5563', glow: '#FFC861', gold: '#FDE047', leaf: '#3F7D33', rock: '#78716C',
};

const shadow = (cx, w = 64) =>
  `<ellipse cx="${cx}" cy="${GROUND + 3}" rx="${w / 2}" ry="7" fill="#000000" opacity="0.22"/>`;

function foundation(cx, w) {
  const n = Math.max(2, Math.floor(w / 15));
  const x0 = cx - (n * 15) / 2;
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 15;
    s += `<rect x="${x}" y="${GROUND - 9}" width="14" height="9" rx="2" fill="${P.stone}"/>` +
      `<rect x="${x + 1}" y="${GROUND - 9}" width="12" height="2.6" rx="1" fill="${P.stoneL}"/>` +
      `<rect x="${x}" y="${GROUND - 9}" width="14" height="9" rx="2" fill="none" stroke="#5B6068" stroke-width="1"/>`;
  }
  return s;
}

function walls(x, y, w, h, color = P.plaster, timber = true) {
  const id = U();
  let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.14"/></linearGradient></defs>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>`;
  if (timber) {
    s += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" fill="none" stroke="${P.timber}" stroke-width="1.8"/>` +
      `<line x1="${x + w / 2}" y1="${y + 2}" x2="${x + w / 2}" y2="${y + h - 2}" stroke="${P.timber}" stroke-width="1.6"/>` +
      `<line x1="${x + 2}" y1="${y + h / 2}" x2="${x + w - 2}" y2="${y + h / 2}" stroke="${P.timber}" stroke-width="1.4"/>`;
  }
  return s;
}

function roofTiles(x, y, w, rh, color, clipId) {
  let s = '';
  for (let r = 1; r <= 4; r++) {
    const yy = y - rh + (rh / 5) * r;
    const spread = ((w / 2 + 6) / 5) * r;
    s += `<line x1="${x + w / 2 - spread}" y1="${yy}" x2="${x + w / 2 + spread}" y2="${yy}" stroke="#000000" stroke-opacity="0.22" stroke-width="1"/>`;
    for (let tx = -spread + 5; tx < spread - 3; tx += 8) {
      s += `<path d="M ${x + w / 2 + tx} ${yy} q 4 -4.6 8 0" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="1"/>`;
    }
  }
  return `<g clip-path="url(#${clipId})">${s}</g>`;
}

function roof(x, y, w, rh, color = P.roof) {
  const cx = x + w / 2;
  const id = U();
  const dark = color === P.roof ? '#8E3222' : color === P.roofD ? '#5F1414' : '#5E3A1A';
  return `<defs><clipPath id="${id}"><polygon points="${x - 6},${y + 2} ${cx},${y - rh} ${x + w + 6},${y + 2}"/></clipPath></defs>` +
    `<polygon points="${x - 6},${y + 2} ${cx},${y - rh} ${cx},${y + 2}" fill="${color}"/>` +
    `<polygon points="${cx},${y - rh} ${x + w + 6},${y + 2} ${cx},${y + 2}" fill="${dark}"/>` +
    roofTiles(x, y, w, rh, color, id) +
    `<line x1="${cx - 4}" y1="${y - rh}" x2="${cx + 4}" y2="${y - rh}" stroke="${dark}" stroke-width="2.4"/>` +
    `<rect x="${x - 6}" y="${y}" width="${w + 12}" height="3" fill="#000000" opacity="0.18"/>`;
}

function door(cx, baseY, w = 14, h = 22) {
  let s = `<rect x="${cx - w / 2 - 2}" y="${baseY - h - 2}" width="${w + 4}" height="${h + 2}" rx="6" fill="#000000" opacity="0.3"/>` +
    `<path d="M ${cx - w / 2} ${baseY} L ${cx - w / 2} ${baseY - h + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${baseY - h + w / 2} L ${cx + w / 2} ${baseY} Z" fill="#4A3220"/>`;
  for (let i = 0; i < 3; i++) {
    const yy = baseY - h + 6 + i * ((h - 8) / 3);
    s += `<line x1="${cx - w / 2 + 1.4}" y1="${yy}" x2="${cx + w / 2 - 1.4}" y2="${yy}" stroke="#2E1D10" stroke-width="1.1"/>`;
  }
  s += `<line x1="${cx}" y1="${baseY - h + w / 2}" x2="${cx}" y2="${baseY - 2}" stroke="#2E1D10" stroke-width="1.2"/>` +
    `<rect x="${cx - w / 2}" y="${baseY - h + 3}" width="${w}" height="2.2" fill="#1F2937"/>` +
    `<circle cx="${cx + w / 2 - 3.4}" cy="${baseY - 8}" r="1.3" fill="#FBBF24"/>` +
    `<rect x="${cx - w / 2 - 4}" y="${baseY - 1.6}" width="${w + 8}" height="3.6" rx="1.6" fill="${P.stone}"/>`;
  return s;
}

function win(x, y, lit = false, shutters = true) {
  let s = '';
  if (shutters) {
    s += `<rect x="${x - 6}" y="${y}" width="6" height="12" fill="${P.timber}"/>` +
      `<rect x="${x + 12}" y="${y}" width="6" height="12" fill="${P.timber}"/>`;
  }
  const id = U();
  s += `<defs><radialGradient id="${id}" cx="0.35" cy="0.3" r="0.9">` +
    `<stop offset="0" stop-color="${lit ? '#FFE9B0' : '#E8F4FF'}"/><stop offset="1" stop-color="${lit ? '#FF9A2E' : '#9CC4E8'}"/></radialGradient></defs>` +
    `<rect x="${x}" y="${y}" width="12" height="12" fill="url(#${id})" stroke="#3A2415" stroke-width="1.4"/>` +
    `<line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y + 12}" stroke="#3A2415" stroke-width="1"/>` +
    `<line x1="${x}" y1="${y + 6}" x2="${x + 12}" y2="${y + 6}" stroke="#3A2415" stroke-width="1"/>`;
  return s;
}

function chimney(x, y, h = 22) {
  let s = `<rect x="${x}" y="${y - h}" width="10" height="${h}" fill="#7C6A5E"/>` +
    `<rect x="${x}" y="${y - h}" width="3.6" height="${h}" fill="#8D7A6A"/>`;
  for (let yy = y - h + 5; yy < y - 2; yy += 6) {
    s += `<line x1="${x}" y1="${yy}" x2="${x + 10}" y2="${yy}" stroke="#4A3F35" stroke-width="1"/>`;
  }
  s += `<rect x="${x - 1.6}" y="${y - h - 3}" width="13.2" height="3.6" fill="#4A3F35"/>`;
  return { svg: s, top: [x + 5, y - h - 3] };
}

function grassTufts(cx) {
  return `<g stroke="#3E7D33" stroke-width="1.6">` +
    `<line x1="${cx - 52}" y1="${GROUND}" x2="${cx - 54}" y2="${GROUND - 7}"/>` +
    `<line x1="${cx - 49}" y1="${GROUND}" x2="${cx - 49}" y2="${GROUND - 9}"/>` +
    `<line x1="${cx + 50}" y1="${GROUND}" x2="${cx + 52}" y2="${GROUND - 7}"/>` +
    `<line x1="${cx + 53}" y1="${GROUND}" x2="${cx + 53}" y2="${GROUND - 9}"/></g>` +
    `<circle cx="${cx - 44}" cy="${GROUND - 3}" r="2" fill="#F472B6"/>` +
    `<circle cx="${cx + 45}" cy="${GROUND - 3}" r="2" fill="#FDE68A"/>`;
}

function house(wall, roofC, W, opts = {}) {
  const cx = S / 2;
  const bw = W;
  const bh = opts.bh ?? 32;
  const bx = cx - bw / 2;
  const by = GROUND - 9 - bh;
  let s = shadow(cx, bw + 18) + foundation(cx, bw + 8) + walls(bx, by, bw, bh, wall) +
    door(cx, GROUND - 9, opts.doorW, opts.doorH) +
    win(bx + 8, by + 9, !!opts.litL) + win(bx + bw - 20, by + 9, !!opts.litR) +
    roof(bx, by, bw, opts.rh ?? 26, roofC) + grassTufts(cx);
  let smoke = null;
  if (opts.chimney) {
    const ch = chimney(cx + (opts.chimneyX ?? 24), by - 14, opts.chimneyH ?? 24);
    s += ch.svg;
    smoke = ch.top;
  }
  return { svg: s, smoke };
}

// ---------- Edificios ----------
const B = {};
const META = {};
function def(id, svg, meta = {}) {
  B[id] = `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  META[id] = meta;
}
const CX = S / 2;

// Almacén grande con anexo y cartel
{
  const bw = 76, bh = 36, bx = CX - bw / 2 - 6, by = GROUND - 9 - bh;
  let s = shadow(CX, 100) + foundation(CX, 96);
  s += walls(bx + bw - 8, by + 13, 28, 23, '#D9C49A');
  s += `<polygon points="${bx + bw - 10},${by + 13} ${bx + bw + 22},${by + 13} ${bx + bw + 6},${by - 1}" fill="${P.roofB}"/>`;
  s += walls(bx, by, bw, bh, P.plaster) + door(CX - 6, GROUND - 9, 16, 24) +
    win(bx + 8, by + 10, true) + win(bx + bw - 20, by + 10) + roof(bx, by, bw, 30, P.roof);
  const ch = chimney(CX + 24, by - 16, 26);
  s += ch.svg;
  s += `<line x1="${CX - 34}" y1="${by + 8}" x2="${CX - 34}" y2="${by + 18}" stroke="#3A2415" stroke-width="1.6"/>` +
    `<line x1="${CX - 20}" y1="${by + 8}" x2="${CX - 20}" y2="${by + 18}" stroke="#3A2415" stroke-width="1.6"/>` +
    `<rect x="${CX - 38}" y="${by + 18}" width="22" height="12" rx="2" fill="#8B5A2B"/>` +
    `<circle cx="${CX - 31}" cy="${by + 24}" r="2.6" fill="#FDE68A"/><rect x="${CX - 28}" y="${by + 22}" width="9" height="2" fill="#FDE68a"/>`.replace('#FDE68a', '#FDE68A') +
    `<rect x="${CX - 28}" y="${by + 25}" width="7" height="2" fill="#FDE68A"/>`;
  // cajas y barril
  s += `<rect x="${bx + bw + 4}" y="${GROUND - 24}" width="15" height="15" fill="#A9804F" stroke="#5E4426"/>` +
    `<ellipse cx="${bx - 12}" cy="${GROUND - 16}" rx="6" ry="8" fill="#7C4A21" stroke="#3A2415"/>` + grassTufts(CX);
  def('almacen', s, { smoke: ch.top });
}
// Cabaña leñador + leña + tocón
{
  const h = house(P.plaster, P.roofB, 56, { chimney: true, chimneyX: 22 });
  let s = h.svg;
  s += `<g><rect x="${CX - 52}" y="${GROUND - 14}" width="20" height="6" rx="3" fill="#7C4A21"/><circle cx="${CX - 32}" cy="${GROUND - 11}" r="3" fill="#D9B36A"/><rect x="${CX - 52}" y="${GROUND - 20}" width="20" height="6" rx="3" fill="#7C4A21"/><circle cx="${CX - 32}" cy="${GROUND - 17}" r="3" fill="#D9B36A"/></g>`;
  s += `<ellipse cx="${CX + 44}" cy="${GROUND - 4}" rx="8" ry="4" fill="#A9804F"/><ellipse cx="${CX + 44}" cy="${GROUND - 6}" rx="7" ry="3" fill="#C49A63"/>`;
  def('cabanaLenador', s, { smoke: h.smoke });
}
// Aserradero: cobertizo + sierra + tronco
{
  const bw = 84, by = GROUND - 9 - 40;
  let s = shadow(CX, 96) + foundation(CX, 92);
  s += `<rect x="${CX - 42}" y="${by}" width="6" height="40" fill="${P.wood}"/><rect x="${CX + 36}" y="${by}" width="6" height="40" fill="${P.wood}"/>`;
  s += `<polygon points="${CX - 48},${by} ${CX + 48},${by} ${CX},${by - 22}" fill="${P.roofB}"/>` +
    `<polygon points="${CX},${by - 22} ${CX + 48},${by} ${CX},${by}" fill="#5E3A1A"/>`;
  s += `<circle cx="${CX - 10}" cy="${GROUND - 32}" r="12" fill="#C4C9D1"/><circle cx="${CX - 10}" cy="${GROUND - 32}" r="7.4" fill="#8A8F98"/><circle cx="${CX - 10}" cy="${GROUND - 32}" r="2.2" fill="#4B5563"/>`;
  for (let a = 0; a < 8; a++) {
    const an = (a * Math.PI) / 4;
    s += `<line x1="${CX - 10 + Math.cos(an) * 7}" y1="${GROUND - 32 + Math.sin(an) * 7}" x2="${CX - 10 + Math.cos(an) * 12}" y2="${GROUND - 32 + Math.sin(an) * 12}" stroke="#6E737C" stroke-width="1.6"/>`;
  }
  s += `<rect x="${CX + 2}" y="${GROUND - 30}" width="40" height="8" rx="4" fill="#7C4A21"/><circle cx="${CX + 42}" cy="${GROUND - 26}" r="4" fill="#D9B36A"/>`;
  s += `<ellipse cx="${CX - 10}" cy="${GROUND - 8}" rx="12" ry="3" fill="#E8C988"/>` + grassTufts(CX);
  def('aserradero', s);
}
// Cantera: roca + grúa + bloques
{
  const bx = CX - 38, by = GROUND - 9 - 44;
  let s = shadow(CX, 92) + foundation(CX, 84);
  s += `<rect x="${bx}" y="${by}" width="48" height="44" rx="5" fill="#8D929B"/>` +
    `<polygon points="${bx},${by} ${bx + 48},${by} ${bx + 24},${by - 16}" fill="#9AA0AA"/>`;
  for (let y = by + 10; y < GROUND - 14; y += 9) {
    s += `<line x1="${bx + 3}" y1="${y}" x2="${bx + 45}" y2="${y}" stroke="#5B6068" stroke-width="1" opacity="0.8"/>`;
  }
  s += `<line x1="${CX + 24}" y1="${GROUND - 9}" x2="${CX + 24}" y2="${by - 18}" stroke="#6B4A2A" stroke-width="3.4"/>` +
    `<line x1="${CX + 24}" y1="${by - 18}" x2="${CX - 6}" y2="${by - 18}" stroke="#6B4A2A" stroke-width="3"/>` +
    `<line x1="${CX - 6}" y1="${by - 18}" x2="${CX - 6}" y2="${by - 2}" stroke="#3A2415" stroke-width="1.2"/>` +
    `<rect x="${CX - 12}" y="${by - 2}" width="12" height="9" rx="2" fill="#B9BEC7" stroke="#5B6068"/>`;
  s += `<rect x="${CX + 14}" y="${GROUND - 25}" width="16" height="11" rx="2" fill="#B9BEC7" stroke="#5B6068"/><rect x="${CX + 31}" y="${GROUND - 22}" width="13" height="8" rx="2" fill="#9AA0AA" stroke="#5B6068"/>` + grassTufts(CX);
  def('cantera', s);
}
// Residencias
{
  const s = house(P.plaster, P.roof, 52, {}).svg;
  def('residenciaS', s);
}
{
  const h = house(P.plaster, '#9C2F22', 62, { chimney: true, chimneyX: 26, litL: true });
  let s = h.svg;
  s += `<rect x="${CX - 34}" y="${GROUND - 34}" width="18" height="5" fill="#6B4A2A"/><circle cx="${CX - 31}" cy="${GROUND - 36}" r="1.8" fill="#F472B6"/><circle cx="${CX - 26}" cy="${GROUND - 37}" r="1.8" fill="#FDE68A"/><circle cx="${CX - 21}" cy="${GROUND - 36}" r="1.8" fill="#F8FAFC"/>`;
  def('residenciaM', s, { smoke: h.smoke });
}
{
  const h = house('#F7EFDC', P.roofD, 78, { bh: 36, rh: 30, chimney: true, chimneyX: -32, litL: true, litR: true });
  let s = h.svg;
  const ch2 = chimney(CX + 32, GROUND - 9 - 36 - 14 - 44, 22);
  s += ch2.svg;
  s += `<rect x="${CX - 17}" y="${GROUND - 55}" width="34" height="4" fill="#6B4A2A"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${CX - 17 + i * 6}" y="${GROUND - 63}" width="2.6" height="8" fill="#6B4A2A"/>`;
  def('residenciaL', s, { smoke: h.smoke });
}
// Granja con campo y espantapájaros
{
  const bw = 52, bh = 26, bx = CX - 40, by = GROUND - 9 - bh;
  let s = shadow(CX, 104) + foundation(CX - 14, 60);
  s += walls(bx, by, bw, bh, '#EFE3C2') + roof(bx, by, bw, 22, '#C47B2B') + door(CX - 14, GROUND - 9, 12, 18);
  s += `<ellipse cx="${CX + 30}" cy="${GROUND - 4}" rx="28" ry="8" fill="#6B4A2A"/><ellipse cx="${CX + 30}" cy="${GROUND - 6}" rx="26" ry="6.5" fill="#7A5A34"/>`;
  for (let i = -2; i <= 2; i++) {
    s += `<line x1="${CX + 8}" y1="${GROUND - 6 + i * 2.6}" x2="${CX + 52}" y2="${GROUND - 6 + i * 2.6}" stroke="#4E3822" stroke-width="1.1"/>`;
  }
  for (let i = 0; i < 9; i++) {
    s += `<polygon points="${CX + 12 + i * 5},${GROUND - 8} ${CX + 14 + i * 5},${GROUND - 8} ${CX + 13 + i * 5},${GROUND - 13}" fill="#65B34E"/>`;
  }
  s += `<line x1="${CX + 30}" y1="${GROUND - 6}" x2="${CX + 30}" y2="${GROUND - 26}" stroke="#5B3A1E" stroke-width="2"/>` +
    `<line x1="${CX + 22}" y1="${GROUND - 20}" x2="${CX + 38}" y2="${GROUND - 20}" stroke="#5B3A1E" stroke-width="2"/>` +
    `<polygon points="${CX + 22},${GROUND - 20} ${CX + 38},${GROUND - 20} ${CX + 30},${GROUND - 12}" fill="#B3402E"/>` +
    `<circle cx="${CX + 30}" cy="${GROUND - 29}" r="3.4" fill="#F2C89B"/>` +
    `<polygon points="${CX + 25},${GROUND - 32} ${CX + 35},${GROUND - 32} ${CX + 30},${GROUND - 36}" fill="#D9A441"/>` + grassTufts(CX);
  def('granja', s);
}
// Molino de torre (aspas aparte)
{
  const bw = 46, bh = 70, bx = CX - bw / 2, by = GROUND - 9 - bh;
  let s = shadow(CX, 60) + foundation(CX, 54);
  s += `<path d="M ${bx} ${GROUND - 9} L ${bx + bw} ${GROUND - 9} L ${bx + bw - 8} ${by} L ${bx + 8} ${by} Z" fill="#E8E0CD"/>` +
    `<path d="M ${CX} ${GROUND - 9} L ${bx + bw} ${GROUND - 9} L ${bx + bw - 8} ${by} L ${CX} ${by} Z" fill="#000000" opacity="0.1"/>`;
  for (let y = GROUND - 20; y > by + 6; y -= 10) {
    s += `<line x1="${bx + 3}" y1="${y}" x2="${bx + bw - 3}" y2="${y}" stroke="#B9AC8F" stroke-width="1"/>`;
  }
  s += `<polygon points="${bx - 3},${by} ${bx + bw + 3},${by} ${CX},${by - 20}" fill="#7C4A21"/>` +
    door(CX, GROUND - 9, 13, 20) + win(CX - 8, by + 26, true, false) + grassTufts(CX);
  def('molino', s, { blades: true });
}
// Panadería con cartel de pan
{
  const h = house(P.plaster, '#D9A441', 64, { chimney: true, chimneyX: 26, chimneyH: 26, litL: true });
  let s = h.svg;
  s += `<rect x="${CX + 4}" y="${GROUND - 52}" width="24" height="14" rx="2" fill="#6B4A2A"/>` +
    `<ellipse cx="${CX + 11}" cy="${GROUND - 45}" rx="4" ry="2.6" fill="#E8B45A"/><ellipse cx="${CX + 21}" cy="${GROUND - 45}" rx="4" ry="2.6" fill="#E8B45A"/>`;
  def('panaderia', s, { smoke: h.smoke, glow: [[CX - 20, GROUND - 40]] });
}
// Pozo
{
  let s = shadow(CX, 56);
  s += `<ellipse cx="${CX}" cy="${GROUND - 8}" rx="21" ry="11" fill="#8D929B"/>` +
    `<ellipse cx="${CX}" cy="${GROUND - 9}" rx="14" ry="6.6" fill="#2B3A4A"/>` +
    `<ellipse cx="${CX}" cy="${GROUND - 7}" rx="14" ry="3" fill="#B9BEC7"/>` +
    `<ellipse cx="${CX}" cy="${GROUND - 8}" rx="21" ry="11" fill="none" stroke="#5B6068"/>`;
  s += `<rect x="${CX - 21}" y="${GROUND - 54}" width="4.6" height="38" fill="#6B4A2A"/><rect x="${CX + 16}" y="${GROUND - 54}" width="4.6" height="38" fill="#6B4A2A"/>` +
    `<polygon points="${CX - 26},${GROUND - 52} ${CX + 26},${GROUND - 52} ${CX},${GROUND - 70}" fill="${P.roof}"/>`;
  s += `<line x1="${CX}" y1="${GROUND - 54}" x2="${CX}" y2="${GROUND - 32}" stroke="#3A2415" stroke-width="1.2"/>` +
    `<rect x="${CX - 5}" y="${GROUND - 32}" width="10" height="9" fill="#8B5A2B" stroke="#3A2415"/>` + grassTufts(CX);
  def('pozo', s);
}
// Pesquería palafito con muelle y redes
{
  let s = `<ellipse cx="${CX + 8}" cy="${GROUND + 2}" rx="50" ry="11" fill="#2F6FB4" opacity="0.55"/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${CX - 42 + i * 23}" y="${GROUND - 18}" width="5" height="18" fill="#6B4A2A"/>`;
  s += `<rect x="${CX - 48}" y="${GROUND - 22}" width="96" height="6" fill="#8A6538"/>`;
  for (let x = CX - 48; x < CX + 48; x += 9) s += `<line x1="${x}" y1="${GROUND - 22}" x2="${x}" y2="${GROUND - 16}" stroke="#4A3220" stroke-width="1"/>`;
  s += walls(CX - 26, GROUND - 54, 44, 30, '#CFE0EA') + roof(CX - 26, GROUND - 54, 44, 20, '#0284C7') + door(CX - 4, GROUND - 24, 12, 16);
  s += `<g stroke="#E8E0CD" stroke-width="0.8" opacity="0.95">`;
  for (let i = 0; i < 6; i++) s += `<line x1="${CX + 24}" y1="${GROUND - 46}" x2="${CX + 20 + i * 4}" y2="${GROUND - 26}"/>`;
  s += `<line x1="${CX + 18}" y1="${GROUND - 34}" x2="${CX + 46}" y2="${GROUND - 34}"/></g>`;
  s += `<ellipse cx="${CX + 30}" cy="${GROUND - 29}" rx="4" ry="2" fill="#94C7E8"/><ellipse cx="${CX + 38}" cy="${GROUND - 29}" rx="4" ry="2" fill="#94C7E8"/>`;
  def('pesqueria', s);
}
// Minas (bocamina + vagoneta + farol; vetas por tipo)
function mine(id, rockC, vein) {
  const bw = 84, bh = 58, bx = CX - bw / 2, by = GROUND - 9 - bh;
  let s = shadow(CX, 92) + foundation(CX, 92);
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="7" fill="${rockC}"/>` +
    `<rect x="${bx}" y="${GROUND - 31}" width="${bw}" height="22" rx="7" fill="#000000" opacity="0.18"/>` +
    `<polygon points="${bx + 8},${by} ${bx + 34},${by} ${bx + 21},${by - 14}" fill="#FFFFFF" opacity="0.14"/>`;
  if (vein) {
    const spots = [[-32, -46], [-14, -50], [4, -42], [22, -48], [-24, -26], [14, -20], [30, -34]];
    for (const [dx, dy] of spots) {
      s += `<circle cx="${CX + dx}" cy="${GROUND + dy}" r="2.4" fill="${vein}"/><circle cx="${CX + dx - 0.8}" cy="${GROUND + dy - 0.8}" r="0.9" fill="#FFFFFF" opacity="0.85"/>`;
    }
  }
  s += `<rect x="${CX - 15}" y="${GROUND - 37}" width="30" height="28" rx="7" fill="#140F08"/>` +
    `<rect x="${CX - 15}" y="${GROUND - 37}" width="30" height="28" rx="7" fill="none" stroke="#6B4A2A" stroke-width="3.2"/>` +
    `<line x1="${CX - 15}" y1="${GROUND - 27}" x2="${CX + 15}" y2="${GROUND - 27}" stroke="#6B4A2A" stroke-width="2.6"/>` +
    `<line x1="${CX - 15}" y1="${GROUND - 19}" x2="${CX + 15}" y2="${GROUND - 19}" stroke="#6B4A2A" stroke-width="2.6"/>`;
  s += `<rect x="${CX + 20}" y="${GROUND - 36}" width="2.6" height="9" fill="#3A2415"/><circle cx="${CX + 21.3}" cy="${GROUND - 28}" r="3.6" fill="#FFC861"/><circle cx="${CX + 21.3}" cy="${GROUND - 28}" r="1.5" fill="#FFF3C4"/>`;
  s += `<line x1="${CX - 36}" y1="${GROUND - 5}" x2="${CX + 36}" y2="${GROUND - 5}" stroke="#4B5563" stroke-width="2"/>`;
  for (let x = CX - 34; x < CX + 36; x += 8) s += `<line x1="${x}" y1="${GROUND - 7.4}" x2="${x}" y2="${GROUND - 2.6}" stroke="#6E737C" stroke-width="1"/>`;
  s += `<rect x="${CX - 36}" y="${GROUND - 19}" width="21" height="12" rx="2" fill="#5B6068"/><rect x="${CX - 36}" y="${GROUND - 19}" width="21" height="4" rx="2" fill="#2E3338"/>` +
    `<circle cx="${CX - 31}" cy="${GROUND - 6}" r="2.8" fill="#1F2937"/><circle cx="${CX - 21}" cy="${GROUND - 6}" r="2.8" fill="#1F2937"/>` + grassTufts(CX);
  def(id, s, { glow: [[CX + 21, GROUND - 28]] });
}
mine('minaCarbon', '#57534E', '#1C1917');
mine('minaHierro', '#78716C', '#D97742');
mine('minaOro', '#8A7A5C', '#FDE047');
// Fundición con horno incandescente
{
  const bw = 90, bh = 38, bx = CX - bw / 2, by = GROUND - 9 - bh;
  let s = shadow(CX, 104) + foundation(CX, 104);
  s += walls(bx, by, bw, bh, '#8A6A45');
  const glows = [];
  for (const dx of [-30, -7, 16]) {
    s += `<rect x="${bx + bw / 2 + dx}" y="${by + 8}" width="17" height="17" rx="3" fill="#1F2937"/>` +
      `<rect x="${bx + bw / 2 + dx + 2}" y="${by + 10}" width="13" height="13" rx="2" fill="#FF7A1A"/>` +
      `<rect x="${bx + bw / 2 + dx + 5}" y="${by + 13}" width="7" height="7" rx="1" fill="#FFD23E"/>`;
    glows.push([bx + bw / 2 + dx + 8.5, by + 16.5]);
  }
  s += roof(bx, by, bw, 26, '#44403C');
  const ch = chimney(CX + 26, by - 18, 42);
  s += ch.svg;
  s += `<rect x="${bx + 4}" y="${GROUND - 27}" width="23" height="18" rx="4" fill="#140F08"/>` +
    `<rect x="${bx + 6}" y="${GROUND - 25}" width="19" height="14" rx="3" fill="#FF7A1A"/>` +
    `<rect x="${bx + 10}" y="${GROUND - 22}" width="11" height="8" rx="2" fill="#FFD23E"/>`;
  s += door(CX + 24, GROUND - 9, 13, 18) + grassTufts(CX);
  def('fundicion', s, { smoke: ch.top, glow: glows });
}
// Herrería con yunque
{
  const h = house('#E8D5AE', '#57534E', 66, { chimney: true, chimneyX: 28, litL: true });
  let s = h.svg;
  s += `<rect x="${CX + 14}" y="${GROUND - 31}" width="19" height="6" fill="#6E737C"/>` +
    `<polygon points="${CX + 14},${GROUND - 31} ${CX + 8},${GROUND - 27} ${CX + 14},${GROUND - 25}" fill="#6E737C"/>` +
    `<rect x="${CX + 20}" y="${GROUND - 25}" width="6" height="8" fill="#3A3F45"/>`;
  s += `<path d="M ${CX - 30} ${GROUND - 58} A 5.4 5.4 0 1 0 ${CX - 19} ${GROUND - 58}" fill="none" stroke="#3A3F45" stroke-width="2.6"/>`;
  def('herreria', s, { smoke: h.smoke, glow: [[CX - 22, GROUND - 40]] });
}
// Armería y cuartel
function martial(id, big, shieldC) {
  const bw = big ? 80 : 66, bh = 34, bx = CX - bw / 2, by = GROUND - 9 - bh;
  let s = shadow(CX, bw + 24) + foundation(CX, bw + 12);
  s += walls(bx, by, bw, bh, '#E9DCC0') + door(CX, GROUND - 9, 15, 23) +
    win(bx + 7, by + 9) + win(bx + bw - 19, by + 9);
  for (const dx of [-21, 21]) {
    s += `<circle cx="${CX + dx}" cy="${by - 1}" r="7.4" fill="${shieldC}" stroke="#F5EAD2" stroke-width="1.4"/>` +
      `<line x1="${CX + dx - 4.4}" y1="${by - 1}" x2="${CX + dx + 4.4}" y2="${by - 1}" stroke="#F5EAD2" stroke-width="1.4"/>` +
      `<line x1="${CX + dx}" y1="${by - 5.4}" x2="${CX + dx}" y2="${by + 3.4}" stroke="#F5EAD2" stroke-width="1.4"/>`;
  }
  s += roof(bx, by, bw, 26, P.roofD);
  s += `<line x1="${CX}" y1="${by - 26}" x2="${CX}" y2="${by - 50}" stroke="#4A3220" stroke-width="2.6"/>` +
    `<polygon points="${CX},${by - 50} ${CX + 23},${by - 45} ${CX},${by - 40}" fill="#DC2626"/>` +
    `<polygon points="${CX},${by - 50} ${CX + 8},${by - 48.4} ${CX},${by - 46.8}" fill="#FFFFFF" opacity="0.35"/>` + grassTufts(CX);
  def(id, s);
}
martial('armeria', false, '#1F2937');
martial('cuartel', true, '#7F1D1D');
// Torre alta
{
  const tw = 34, tx = CX - tw / 2, top = 22, base = GROUND - 9;
  let s = shadow(CX, 52) + foundation(CX, 46);
  s += `<rect x="${tx}" y="${top + 8}" width="${tw}" height="${base - top - 8}" fill="#9AA0AA"/>` +
    `<rect x="${CX}" y="${top + 8}" width="${tw / 2}" height="${base - top - 8}" fill="#000000" opacity="0.14"/>`;
  for (let y = top + 20; y < base - 14; y += 10) {
    s += `<line x1="${tx + 2}" y1="${y}" x2="${tx + tw - 2}" y2="${y}" stroke="#5B6068" stroke-width="1" opacity="0.8"/>`;
  }
  s += `<rect x="${tx - 5}" y="${top - 2}" width="${tw + 10}" height="12" fill="#6B4A2A"/>`;
  for (let i = 0; i <= 5; i++) {
    s += `<line x1="${tx - 5 + (i * (tw + 10)) / 5}" y1="${top - 2}" x2="${tx - 5 + (i * (tw + 10)) / 5}" y2="${top + 10}" stroke="#3A2415" stroke-width="1.4"/>`;
  }
  for (let i = 0; i < 4; i++) s += `<rect x="${tx - 5 + i * 11}" y="${top - 10}" width="6.6" height="9" fill="#9AA0AA"/>`;
  s += `<rect x="${CX - 2.6}" y="${top + 28}" width="5.2" height="13" fill="#1F2937"/><rect x="${CX - 2.6}" y="${top + 28}" width="5.2" height="3.4" fill="#FFC861"/>` +
    `<rect x="${CX - 2.6}" y="${top + 48}" width="5.2" height="13" fill="#1F2937"/>`;
  s += door(CX, base, 12, 18);
  s += `<polygon points="${tx - 6},${top - 8} ${tx + tw + 6},${top - 8} ${CX},${top - 22}" fill="${P.roof}"/>` +
    `<line x1="${CX}" y1="${top - 22}" x2="${CX}" y2="${top - 40}" stroke="#4A3220" stroke-width="2.2"/>` +
    `<polygon points="${CX},${top - 40} ${CX + 19},${top - 35.4} ${CX},${top - 31}" fill="#FBBF24"/>` +
    `<polygon points="${CX},${top - 40} ${CX + 7},${top - 38.4} ${CX},${top - 36.8}" fill="#FFFFFF" opacity="0.35"/>` + grassTufts(CX);
  def('torre', s, { glow: [[CX, top + 30]] });
}
// Fuente ornamental
{
  let s = shadow(CX, 92);
  s += `<ellipse cx="${CX - 32}" cy="${GROUND - 2}" rx="13" ry="6" fill="#3A7A33"/><ellipse cx="${CX + 32}" cy="${GROUND - 2}" rx="13" ry="6" fill="#3A7A33"/>`;
  for (const [dx, c] of [[-38, '#F472B6'], [-32, '#FDE68A'], [-26, '#F8FAFC'], [26, '#F8FAFC'], [32, '#F472B6'], [38, '#FDE68A']]) {
    s += `<circle cx="${CX + dx}" cy="${GROUND - 6}" r="2" fill="${c}"/>`;
  }
  s += `<ellipse cx="${CX}" cy="${GROUND - 8}" rx="27" ry="10.5" fill="#B9BEC7"/>` +
    `<ellipse cx="${CX}" cy="${GROUND - 9}" rx="23" ry="8" fill="#7CC4F2"/>` +
    `<ellipse cx="${CX - 8}" cy="${GROUND - 11}" rx="9" ry="3" fill="#D8EDFD"/>` +
    `<rect x="${CX - 4}" y="${GROUND - 40}" width="8" height="26" fill="#9AA0AA"/>` +
    `<ellipse cx="${CX}" cy="${GROUND - 40}" rx="15" ry="5.5" fill="#B9BEC7"/>` +
    `<ellipse cx="${CX}" cy="${GROUND - 41}" rx="12" ry="4" fill="#7CC4F2"/>` +
    `<polygon points="${CX - 3},${GROUND - 56} ${CX + 3},${GROUND - 56} ${CX},${GROUND - 42}" fill="#D8EDFD"/>` +
    `<circle cx="${CX}" cy="${GROUND - 57}" r="2.4" fill="#D8EDFD"/>`;
  def('ornamento', s);
}
// Aspas del molino (giran en el juego)
{
  const R = 40, C = 48;
  let s = '';
  for (const [dx, dy] of [[0, -R], [R, 0], [0, R], [-R, 0]]) {
    s += `<line x1="${C}" y1="${C}" x2="${C + dx}" y2="${C + dy}" stroke="#4A3220" stroke-width="3.4"/>`;
  }
  s += `<polygon points="${C},${C} ${C + 8},${C - R} ${C - 2},${C - R + 4}" fill="#F5EAD2" opacity="0.95"/>` +
    `<polygon points="${C},${C} ${C + R},${C + 8} ${C + R - 4},${C - 2}" fill="#F5EAD2" opacity="0.95"/>` +
    `<polygon points="${C},${C} ${C - 8},${C + R} ${C + 2},${C + R - 4}" fill="#F5EAD2" opacity="0.95"/>` +
    `<polygon points="${C},${C} ${C - R},${C - 8} ${C - R + 4},${C + 2}" fill="#F5EAD2" opacity="0.95"/>` +
    `<circle cx="${C}" cy="${C}" r="4.4" fill="#6B4A2A"/>`;
  B['__blades'] = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

// ---------- Render ----------
mkdirSync(OUT, { recursive: true });
mkdirSync(ICONS, { recursive: true });
for (const [id, svg] of Object.entries(B)) {
  if (id === '__blades') {
    await sharp(Buffer.from(svg)).png().toFile(join(OUT, 'mill-blades.png'));
    continue;
  }
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, `b-${id}.png`));
  // icono 30x30 para el HUD (recorte central superior reescalado)
  await sharp(Buffer.from(svg)).extract({ left: 24, top: 20, width: 80, height: 80 }).resize(30, 30).png().toFile(join(ICONS, `${id}.png`));
}
writeFileSync(join(OUT, 'buildings.json'), JSON.stringify(META, null, 2));
// manifest TS para el juego (mismas coords PNG 128px, suelo y=118)
const ts =
  `// Generado por scripts/make-buildings.mjs — NO EDITAR A MANO.\n` +
  `export interface BuildingArt { smoke?: [number, number]; glow?: [number, number][]; blades?: boolean }\n` +
  `export const BUILDING_ART: Record<string, BuildingArt> = ${JSON.stringify(META)};\n`;
writeFileSync(join(root, 'src', 'game', 'data', 'buildingArt.ts'), ts);
// hoja de contacto para revisión visual
const ids = Object.keys(B).filter((k) => k !== '__blades');
const cols = 7;
const rows = Math.ceil(ids.length / cols);
const tiles = await Promise.all(ids.map((id) => sharp(Buffer.from(B[id])).png().toBuffer()));
const contact = await sharp({ create: { width: 128 * cols, height: (128 + 22) * rows, channels: 4, background: { r: 20, g: 30, b: 24, alpha: 1 } } })
  .composite(tiles.flatMap((input, i) => {
    const x = (i % cols) * 128, y = Math.floor(i / cols) * 150;
    return [
      { input, left: x, top: y },
      { input: Buffer.from(`<svg width="128" height="22"><text x="4" y="16" font-size="13" fill="white" font-family="sans-serif">${ids[i]}</text></svg>`), left: x, top: y + 128 },
    ];
  }))
  .png()
  .toBuffer();
writeFileSync('C:/Users/PC CASA/AppData/Local/Temp/opencode/contact-buildings.png', contact);
console.log('edificios OK:', ids.join(','));
