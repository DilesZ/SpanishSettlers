// Edificios low-poly procedurales 100% originales (migración 3D, coste cero).
// 6 familias paramétricas cubren los 22 edificios con la misma planta
// legible del 2D: casa, cabaña, nave, torre, mina, granja + HQ y puerto.
// Ventanas/braseros usan UN material emisivo compartido (la noche se
// enciende con una línea). Aspas y banderines van en userData.

import * as THREE from 'three';
import type { BuildingId } from '@/game/data/buildings';
import type { Owner } from '@/game/systems/rival';

/** Separación mínima entre edificios al fundar el pueblo. */
export const BUILDING_SPACING = 2.6;

const WALLS = {
  plaster: 0xe8dcc0,
  wood: 0x8a6538,
  darkWood: 0x5e4426,
  stone: 0x9a958a,
  darkStone: 0x6f6a60,
  thatch: 0xc9a86a,
  roofRed: 0xa8442f,
  roofSlate: 0x5a6b7d,
} as const;

/** Un material emisivo compartido: toda la luz nocturna de ventanas. */
export const lampMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a3a3a,
  emissive: 0xffb45e,
  emissiveIntensity: 0,
  roughness: 0.6,
});
const wallMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });
const glowMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xff7a2e, emissiveIntensity: 1.6, roughness: 0.6 });

export interface Home3D extends THREE.Group {
  userData: {
    footprint: number;
    height: number;
    pennant: number;
    sails?: THREE.Object3D[];
    brazier?: boolean;
    chimney?: THREE.Vector3;
  };
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Prisma triangular (tejado) de longitud `len`, base `w`, alto `h`. */
function prism(w: number, h: number, len: number, color: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.01, 1, len, 3, 1);
  const m = new THREE.Mesh(geo, wallMat(color));
  // Cilindro triangular: escalar a la sección deseada y tumbarlo.
  m.scale.set(w / 1.75, 1, h / 0.87);
  m.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function window_(w = 0.28): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 1.2, 0.06), lampMaterial);
  return m;
}

function door(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.7, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.9 }),
  );
  return m;
}

function chimney(x: number, y: number, z: number, g: THREE.Group) {
  const c = box(0.22, 0.9, 0.22, WALLS.darkStone, x, y, z);
  g.add(c);
  return new THREE.Vector3(x, y + 0.5, z);
}

function pennant(g: THREE.Group, color: number, x: number, y: number, z: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.55, -0.14);
  shape.lineTo(0, -0.28);
  shape.lineTo(0, 0);
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }),
  );
  flag.position.set(x, y, z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5),
    wallMat(WALLS.darkWood),
  );
  pole.position.set(x, y - 0.45, z);
  pole.castShadow = true;
  g.add(pole, flag);
}

/** Casa de `plantas` pisos con tejado a dos aguas. */
function house(w: number, d: number, wallH: number, roofH: number, wall: number, roof: number, plantas = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, wallH, d, wall, 0, wallH / 2, 0));
  const r = prism(w + 0.35, roofH, d + 0.35, roof);
  r.position.y = wallH + roofH / 2 - 0.05;
  g.add(r);
  const dr = door();
  dr.position.set(0, 0.35, d / 2 + 0.02);
  g.add(dr);
  for (let f = 0; f < plantas; f++) {
    const y = 0.55 + f * 0.75;
    if (y > wallH - 0.2) break;
    for (const sx of [-w / 4, w / 4]) {
      const win = window_();
      win.position.set(sx, y, d / 2 + 0.02);
      g.add(win);
    }
  }
  return g;
}

/** Cabaña pequeña de madera con techo de paja. */
function hut(w = 1.2, d = 1.1, h = 0.9): THREE.Group {
  const g = house(w, d, h, 0.55, WALLS.wood, WALLS.thatch, 1);
  return g;
}

/** Nave de trabajo con chimenea y puerta ancha. */
function hall(w: number, d: number, h: number, wall: number, roof: number, chimneySmoke: THREE.Vector3 | null): THREE.Group {
  const g = house(w, d, h, h * 0.55, wall, roof, 1);
  const gate = box(w * 0.4, h * 0.55, 0.08, WALLS.darkWood, 0, (h * 0.55) / 2, d / 2 + 0.02);
  g.add(gate);
  let chim: THREE.Vector3 | undefined;
  if (chimneySmoke) {
    chim = chimney(w * 0.28, h + 0.2, 0, g);
  }
  if (chim) (g as Home3D).userData.chimney = chim;
  return g;
}

function finalize(g: THREE.Group, id: BuildingId, owner: Owner, height: number): Home3D {
  const h = g as Home3D;
  const bb = new THREE.Box3().setFromObject(g);
  const size = bb.getSize(new THREE.Vector3());
  h.userData.footprint = Math.max(size.x, size.z);
  h.userData.height = height || size.y;
  h.userData.pennant = owner === 'rival' ? 0xb3402e : 0xfbbf24;
  // Banderín solo en edificios señalados (ver tryPlace 3D): HQ, cuartel, torre, puerto.
  if (id === 'almacen' || id === 'cuartel' || id === 'torre' || id === 'puerto') {
    pennant(g, h.userData.pennant, size.x / 2 + 0.1, size.y + 0.75, 0);
    const bb2 = new THREE.Box3().setFromObject(g);
    const s2 = bb2.getSize(new THREE.Vector3());
    h.userData.height = s2.y;
  }
  return h;
}

/** Altura aproximada por edificio (urbanismo y cámara). */
export function BUILDING_HEIGHT(id: BuildingId): number {
  if (id === 'torre') return 4.6;
  if (id === 'molino') return 4.2;
  if (id === 'almacen') return 3.2;
  if (id === 'residenciaL') return 2.9;
  if (id === 'minaCarbon' || id === 'minaHierro' || id === 'minaOro') return 1.8;
  if (id === 'pozo' || id === 'ornamento') return 1.1;
  return 2.2;
}

/** Construye el edificio low-poly. `owner` tiñe el banderín. */
export function buildHome3D(id: BuildingId, owner: Owner): Home3D {
  let g: THREE.Group;
  let height = 0;
  switch (id) {
    case 'almacen': {
      g = hall(2.4, 1.9, 1.7, WALLS.plaster, WALLS.roofRed, null);
      const t = box(1.0, 2.6, 1.0, WALLS.stone, -0.9, 1.3, -0.5);
      g.add(t);
      height = 3.2;
      break;
    }
    case 'residenciaS': g = house(1.3, 1.2, 1.1, 0.6, WALLS.plaster, WALLS.roofRed, 1); height = 2.0; break;
    case 'residenciaM': g = house(1.6, 1.4, 1.7, 0.7, WALLS.plaster, WALLS.roofSlate, 2); height = 2.6; break;
    case 'residenciaL': g = house(1.9, 1.6, 2.2, 0.8, WALLS.stone, WALLS.roofSlate, 2); height = 2.9; break;
    case 'cabanaLenador': {
      g = hut();
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 6), wallMat(WALLS.darkWood));
        log.rotation.z = Math.PI / 2;
        log.position.set(0.9, 0.12 + i * 0.2, -0.3 + i * 0.12);
        log.castShadow = true;
        g.add(log);
      }
      height = 1.7;
      break;
    }
    case 'aserradero': {
      g = hall(1.9, 1.5, 1.3, WALLS.wood, WALLS.thatch, null);
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 12), wallMat(0xb8bcc2));
      blade.rotation.x = Math.PI / 2;
      blade.position.set(0, 0.55, 0.85);
      g.add(blade);
      height = 2.2;
      break;
    }
    case 'cantera': {
      g = hut(1.1, 1.0, 0.8);
      for (let i = 0; i < 4; i++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + (i % 2) * 0.1, 0), wallMat(WALLS.darkStone));
        rock.position.set(0.8 + (i % 2) * 0.35, 0.15, -0.4 + i * 0.22);
        rock.castShadow = true;
        g.add(rock);
      }
      height = 1.6;
      break;
    }
    case 'granja': {
      g = new THREE.Group();
      const field = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 2.0), wallMat(0x6b4f2a));
      field.position.set(0.9, 0.04, 0.3);
      field.receiveShadow = true;
      g.add(field);
      for (let r = 0; r < 4; r++) {
        const row = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.18), wallMat(0x8a6a3a));
        row.position.set(0.9, 0.08, -0.4 + r * 0.45);
        g.add(row);
        for (let k = 0; k < 6; k++) {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), wallMat(0xd9b34c));
          tuft.position.set(0.0 + k * 0.36, 0.26, -0.4 + r * 0.45);
          g.add(tuft);
        }
      }
      const casa = hut(1.1, 1.0, 0.9);
      casa.position.set(-1.1, 0, -0.5);
      g.add(casa);
      height = 1.7;
      break;
    }
    case 'molino': {
      g = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.8, 8), wallMat(WALLS.plaster));
      tower.position.y = 1.4;
      tower.castShadow = true;
      g.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.7, 8), wallMat(WALLS.roofRed));
      cap.position.y = 3.1;
      cap.castShadow = true;
      g.add(cap);
      const sails = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.7, 0.05), wallMat(0xe8dcc0));
        blade.position.y = 0.95;
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        arm.add(blade);
        sails.add(arm);
      }
      sails.position.set(0, 2.6, 0.62);
      g.add(sails);
      (g as Home3D).userData.sails = [sails];
      const win = window_();
      win.position.set(0, 1.2, 0.72);
      g.add(win);
      height = 4.2;
      break;
    }
    case 'panaderia': g = hall(1.5, 1.3, 1.2, WALLS.plaster, WALLS.thatch, new THREE.Vector3()); height = 2.1; break;
    case 'pozo': {
      g = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.5, 8), wallMat(WALLS.stone));
      rim.position.y = 0.25;
      rim.castShadow = true;
      g.add(rim);
      for (const sx of [-0.4, 0.4]) {
        const post = box(0.08, 0.9, 0.08, WALLS.darkWood, sx, 0.7, 0);
        g.add(post);
      }
      const roof = prism(1.1, 0.35, 1.0, WALLS.thatch);
      roof.position.y = 1.3;
      g.add(roof);
      height = 1.5;
      break;
    }
    case 'pesqueria': {
      g = hut(1.2, 1.0, 0.85);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), wallMat(WALLS.darkWood));
      rod.rotation.z = 1.1;
      rod.position.set(0.9, 0.6, 0.3);
      g.add(rod);
      height = 1.6;
      break;
    }
    case 'minaCarbon':
    case 'minaHierro':
    case 'minaOro': {
      const ore = id === 'minaOro' ? 0xd9b34c : id === 'minaHierro' ? 0xb06a3a : 0x2e2a28;
      g = new THREE.Group();
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0x090909 }));
      mouth.position.set(0, 0.6, 0.51);
      g.add(mouth);
      const hill = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), wallMat(WALLS.darkStone));
      hill.scale.set(1.1, 0.85, 0.7);
      hill.position.set(0, 0.35, -0.25);
      hill.castShadow = true;
      g.add(hill);
      for (const sx of [-0.55, 0.55]) {
        g.add(box(0.1, 1.0, 0.1, WALLS.darkWood, sx, 0.5, 0.5));
      }
      g.add(box(1.3, 0.1, 0.1, WALLS.darkWood, 0, 1.0, 0.5));
      const pile = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), wallMat(ore));
      pile.position.set(0.9, 0.2, 0.5);
      pile.castShadow = true;
      g.add(pile);
      height = 1.8;
      break;
    }
    case 'fundicion':
    case 'herreria': {
      g = hall(1.8, 1.5, 1.4, WALLS.stone, WALLS.roofSlate, new THREE.Vector3());
      const mouthGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.08), glowMat);
      mouthGlow.position.set(0, 0.35, 0.78);
      g.add(mouthGlow);
      height = 2.4;
      break;
    }
    case 'armeria': {
      g = hall(1.9, 1.5, 1.4, WALLS.wood, WALLS.roofRed, null);
      const rack = box(0.9, 0.5, 0.15, WALLS.darkWood, 0, 0.45, 0.8);
      g.add(rack);
      height = 2.3;
      break;
    }
    case 'cuartel': {
      g = hall(2.2, 1.7, 1.5, WALLS.plaster, WALLS.roofRed, null);
      const yard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.4), wallMat(0x9c7c4e));
      yard.position.set(0, 0.03, 1.5);
      yard.receiveShadow = true;
      g.add(yard);
      height = 2.5;
      break;
    }
    case 'torre': {
      g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 3.4, 8), wallMat(WALLS.stone));
      shaft.position.y = 1.7;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      g.add(shaft);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const merlon = box(0.22, 0.3, 0.22, WALLS.darkStone, Math.cos(a) * 0.62, 3.55, Math.sin(a) * 0.62);
        g.add(merlon);
      }
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.25, 8), wallMat(0x3a3a3a));
      brazier.position.y = 3.35;
      g.add(brazier);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), glowMat);
      flame.position.y = 3.55;
      g.add(flame);
      (g as Home3D).userData.brazier = true;
      height = 4.6;
      break;
    }
    case 'ornamento': {
      g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.3, 8), wallMat(WALLS.stone));
      base.position.y = 0.15;
      base.castShadow = true;
      g.add(base);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), wallMat(0xd9b34c));
      orb.position.y = 0.6;
      orb.castShadow = true;
      g.add(orb);
      height = 1.1;
      break;
    }
    case 'puerto': {
      g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        g.add(box(0.16, 0.5, 0.16, WALLS.darkWood, -0.9 + i * 0.6, 0.1, 1.6));
      }
      const deck = box(2.4, 0.12, 1.6, WALLS.wood, 0, 0.35, 1.0);
      deck.receiveShadow = true;
      g.add(deck);
      const hut2 = hut(1.0, 0.9, 0.8);
      hut2.position.set(-0.4, 0.4, -0.6);
      g.add(hut2);
      const hull = box(1.4, 0.4, 0.5, WALLS.darkWood, 0.9, 0.1, 1.9);
      g.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 5), wallMat(WALLS.darkWood));
      mast.position.set(0.9, 0.8, 1.9);
      g.add(mast);
      height = 2.0;
      break;
    }
  }
  return finalize(g, id, owner, height);
}
