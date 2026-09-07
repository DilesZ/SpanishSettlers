// Colonos originales con 3 frames de marcha (SVG→PNG 26x28).
// Salida: public/assets/people/<rol>-f<0..2>.png
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'assets', 'people');
const W = 26;
const H = 28;

function person(o, frame) {
  const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const bob = frame === 0 ? 0 : -1;
  const legL = step * 2.2;
  const legR = -step * 2.2;
  const y = (v) => v + bob;
  let s = `<ellipse cx="13" cy="26" rx="8" ry="2.4" fill="#000000" opacity="0.25"/>`;
  // piernas + botas
  s += `<rect x="${6 + legL}" y="${y(18)}" width="3.4" height="5.6" fill="${o.pants}"/>` +
    `<rect x="${11.6 + legR}" y="${y(18)}" width="3.4" height="5.6" fill="${o.pants}"/>` +
    `<rect x="${5.6 + legL}" y="${y(23)}" width="4.2" height="2.8" rx="1" fill="#2E1D10"/>` +
    `<rect x="${11.2 + legR}" y="${y(23)}" width="4.2" height="2.8" rx="1" fill="#2E1D10"/>`;
  // túnica con pliegues + cinturón
  s += `<rect x="4" y="${y(10)}" width="13" height="9.4" rx="3" fill="${o.tunic}"/>` +
    `<polygon points="8,${y(11)} 10.4,${y(11)} 9.2,${y(18.6)}" fill="#000000" opacity="0.16"/>` +
    `<polygon points="12,${y(11)} 14,${y(11)} 13.4,${y(18.6)}" fill="#000000" opacity="0.16"/>` +
    `<rect x="4" y="${y(16)}" width="13" height="2" fill="${o.belt}"/>` +
    `<rect x="9.6" y="${y(16)}" width="2.4" height="2" fill="#D9A441"/>`;
  // brazos
  const armSwing = -step * 1.4;
  s += `<rect x="1.6" y="${y(11 + armSwing * 0.3)}" width="2.8" height="6.4" rx="1" fill="${o.tunic}"/>` +
    `<rect x="16.6" y="${y(11 - armSwing * 0.3)}" width="2.8" height="6.4" rx="1" fill="${o.tunic}"/>` +
    `<circle cx="3" cy="${y(18)}" r="1.5" fill="${o.skin}"/>`;
  // cabeza
  s += `<circle cx="10.5" cy="${y(6)}" r="4.4" fill="${o.skin}"/>` +
    `<circle cx="6.6" cy="${y(5)}" r="1.8" fill="#5B3A1E"/><circle cx="14.4" cy="${y(5)}" r="1.8" fill="#5B3A1E"/>` +
    `<circle cx="8.9" cy="${y(5.6)}" r="0.8" fill="#3A2415"/><circle cx="12.1" cy="${y(5.6)}" r="0.8" fill="#3A2415"/>` +
    `<line x1="9.2" y1="${y(8.2)}" x2="11.8" y2="${y(8.2)}" stroke="#8A5A3B" stroke-width="0.9"/>`;
  if (o.hat) {
    s += `<polygon points="5.4,${y(4.4)} 15.6,${y(4.4)} 10.5,${y(-2.4)}" fill="${o.hat}"/>` +
      `<polygon points="10.5,${y(-2.4)} 15.6,${y(4.4)} 10.5,${y(4.4)}" fill="#000000" opacity="0.15"/>`;
  }
  // herramienta en mano derecha
  const hx = 18, hy = y(18) - armSwing * 0.5;
  if (o.tool === 'axe') {
    s += `<line x1="${hx}" y1="${hy}" x2="${hx + 3.6}" y2="${hy - 9}" stroke="#6B4A2A" stroke-width="1.8"/>` +
      `<polygon points="${hx + 1.4},${hy - 11.4} ${hx + 6},${hy - 9.6} ${hx + 2.2},${hy - 6}" fill="#B9BEC7" stroke="#6E737C" stroke-width="0.8"/>`;
  } else if (o.tool === 'sack') {
    s += `<ellipse cx="${hx + 0.4}" cy="${y(12)}" rx="3.6" ry="4.8" fill="#D9B36A" stroke="#8B5A2B"/>` +
      `<rect x="${hx - 1.6}" y="${y(6.4)}" width="4" height="1.8" fill="#8B5A2B"/>`;
  } else if (o.tool === 'sword') {
    s += `<line x1="${hx}" y1="${hy - 2}" x2="${hx + 4}" y2="${hy - 12}" stroke="#C4C9D1" stroke-width="2"/>` +
      `<line x1="${hx - 1.6}" y1="${hy - 4}" x2="${hx + 1.4}" y2="${hy - 2.8}" stroke="#8B5A2B" stroke-width="2"/>`;
  } else if (o.tool === 'spear') {
    s += `<line x1="${hx}" y1="${y(24)}" x2="${hx + 2}" y2="${y(0)}" stroke="#6B4A2A" stroke-width="1.6"/>` +
      `<polygon points="${hx + 0.2},${y(-3)} ${hx + 3.8},${y(-3)} ${hx + 2},${y(1.4)}" fill="#D6D9DE"/>`;
  } else if (o.tool === 'hammer') {
    s += `<line x1="${hx}" y1="${hy - 3}" x2="${hx + 3}" y2="${hy - 11}" stroke="#6B4A2A" stroke-width="1.8"/>` +
      `<rect x="${hx}" y="${hy - 14.6}" width="7" height="4" rx="1" fill="#6E737C"/>`;
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

const ROLES = {
  settler: { tunic: '#2F6FB4', pants: '#4A3220', skin: '#F2C89B', belt: '#3A2415', hat: null, tool: null },
  woodcutter: { tunic: '#8B5A2B', pants: '#4A3220', skin: '#F2C89B', belt: '#3A2415', hat: '#5B3A1E', tool: 'axe' },
  carrier: { tunic: '#3F7D33', pants: '#4A3220', skin: '#F2C89B', belt: '#3A2415', hat: null, tool: 'sack' },
  soldier: { tunic: '#B91C1C', pants: '#3A3A3A', skin: '#F2C89B', belt: '#1F2937', hat: '#9AA0AA', tool: 'sword' },
  archer: { tunic: '#6D28D9', pants: '#3A2A1A', skin: '#F2C89B', belt: '#3A2415', hat: '#4C1D95', tool: 'spear' },
  miner: { tunic: '#4B5563', pants: '#33291F', skin: '#F2C89B', belt: '#3A2415', hat: '#FDE68A', tool: 'hammer' },
  fisher: { tunic: '#0284C7', pants: '#4A3220', skin: '#F2C89B', belt: '#3A2415', hat: '#134E4A', tool: null },
  baker: { tunic: '#F5EAD2', pants: '#4A3220', skin: '#F2C89B', belt: '#3A2415', hat: '#F8FAFC', tool: null },
};

mkdirSync(OUT, { recursive: true });
const contactTiles = [];
for (const [role, o] of Object.entries(ROLES)) {
  for (let f = 0; f < 3; f++) {
    const buf = await sharp(Buffer.from(person(o, f))).png().toBuffer();
    writeFileSync(join(OUT, `${role}-f${f}.png`), buf);
    if (f === 1) contactTiles.push({ role, buf });
  }
}
// contacto para revisión
const contact = await sharp({ create: { width: 60 * contactTiles.length, height: 60, channels: 4, background: { r: 20, g: 30, b: 24, alpha: 1 } } })
  .composite(contactTiles.flatMap(({ role, buf }, i) => ([
    { input: buf, left: i * 60 + 17, top: 4 },
    { input: Buffer.from(`<svg width="60" height="16"><text x="2" y="12" font-size="9" fill="white" font-family="sans-serif">${role}</text></svg>`), left: i * 60, top: 42 },
  ])))
  .png()
  .toBuffer();
writeFileSync('C:/Users/PC CASA/AppData/Local/Temp/opencode/contact-people.png', contact);
console.log('colonos OK:', Object.keys(ROLES).join(','));
