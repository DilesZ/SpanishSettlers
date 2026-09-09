// Actores low-poly procedurales (migración 3D, coste cero).
// Colono con brazos oscilantes + caja al cargar; fauna simple; barco.
// La animación es procedural (fase), sin esqueletos ni texturas.

import * as THREE from 'three';

export const WALKER_ROLES = [
  'settler', 'woodcutter', 'carrier', 'miner', 'fisher',
  'soldier', 'archer', 'baker',
] as const;

export type WalkerRole = (typeof WALKER_ROLES)[number];

/** Túnica por oficio (identidad legible a distancia). */
export const ROLE_TUNIC: Record<WalkerRole, number> = {
  settler: 0xc9b48a,
  woodcutter: 0x4a7a3a,
  carrier: 0xb08a4a,
  miner: 0x6a6a72,
  fisher: 0x3a6a9a,
  soldier: 0x9a2f28,
  archer: 0x3f6b3a,
  baker: 0xe8e0d0,
};

const SKIN = 0xe0b088;
const HAT = 0xc9a86a;

/** Avanza la fase de marcha (pura y testeable). */
export function stepPhase(phase: number, dt: number, speed: number): number {
  return (phase + dt * speed) % (Math.PI * 2);
}

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
}

export interface WalkerRig extends THREE.Group {
  userData: {
    armL: THREE.Object3D;
    armR: THREE.Object3D;
    body: THREE.Object3D;
    carryBox: THREE.Object3D | null;
    phase: number;
  };
}

/** Colono articulado: cuerpo, cabeza, brazos con pivote, sombrero. */
export function createSettler(role: WalkerRole, loaded: boolean): WalkerRig {
  const g = new THREE.Group() as WalkerRig;
  const tunic = mat(ROLE_TUNIC[role]);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 3, 8), tunic);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat(SKIN));
  head.position.y = 1.08;
  head.castShadow = true;
  g.add(head);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 8), mat(HAT));
  hat.position.y = 1.24;
  g.add(hat);

  const mkArm = (sx: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.28, 0.82, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 3, 6), tunic);
    arm.position.y = -0.24;
    arm.castShadow = true;
    pivot.add(arm);
    g.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // Casco / capucha militar.
  if (role === 'soldier' || role === 'archer') {
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(role === 'soldier' ? 0x8a8f96 : 0x3f6b3a),
    );
    helm.position.y = 1.1;
    g.add(helm);
  }

  let carryBox: THREE.Object3D | null = null;
  if (loaded) {
    carryBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.3), mat(0x8a6538));
    carryBox.position.set(0, 0.72, 0.32);
    carryBox.castShadow = true;
    g.add(carryBox);
  }

  g.userData = { armL, armR, body, carryBox, phase: Math.random() * 6.28 };
  return g;
}

/** Postura de marcha: brazos alternos + balanceo. */
export function poseWalker(g: WalkerRig, dt: number, moving: boolean): void {
  const u = g.userData;
  if (moving) {
    u.phase = stepPhase(u.phase, dt, 9);
    const s = Math.sin(u.phase);
    u.armL.rotation.x = s * 0.7;
    u.armR.rotation.x = -s * 0.7;
    u.body.position.y = 0.55 + Math.abs(Math.cos(u.phase)) * 0.05;
  } else {
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
    u.body.position.y = 0.55;
  }
}

/** Oveja: esponja blanca + cara y patas oscuras. */
export function createSheep(): THREE.Group {
  const g = new THREE.Group();
  const wool = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), mat(0xf0ece0));
  wool.scale.set(1.15, 0.9, 0.9);
  wool.position.y = 0.42;
  wool.castShadow = true;
  g.add(wool);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), mat(0x3a3230));
  head.position.set(0.38, 0.42, 0);
  g.add(head);
  return g;
}

/** Conejo: cuerpo + orejas. */
export function createBunny(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), mat(0xd8cfc0));
  body.scale.set(1.2, 0.9, 0.9);
  body.position.y = 0.14;
  body.castShadow = true;
  g.add(body);
  for (const sx of [-0.05, 0.05]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 5), mat(0xd8cfc0));
    ear.position.set(0.08, 0.3, sx);
    g.add(ear);
  }
  return g;
}

/** Ciervo: cuerpo esbelto + patas + cuello. */
export function createDeer(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 3, 6), mat(0x9a6a42));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 3, 6), mat(0x9a6a42));
  neck.position.set(0.38, 0.9, 0);
  neck.rotation.z = -0.5;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), mat(0x9a6a42));
  head.position.set(0.5, 1.1, 0);
  g.add(head);
  for (const [lx, lz] of [[-0.2, -0.1], [-0.2, 0.1], [0.2, -0.1], [0.2, 0.1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), mat(0x7a5232));
    leg.position.set(lx, 0.28, lz);
    g.add(leg);
  }
  return g;
}

/** Barco: casco + mástil + vela cuadrada. */
export function createBoat(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(0x6b4a2a);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.7), wood);
  hull.position.y = 0.25;
  hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.35, 0.7, 4), wood);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.position.set(1.0, 0.25, 0);
  g.add(bow);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), wood);
  mast.position.y = 1.2;
  g.add(mast);
  const sail = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.8, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9, side: THREE.DoubleSide }),
  );
  sail.position.y = 1.5;
  sail.castShadow = true;
  g.add(sail);
  return g;
}
