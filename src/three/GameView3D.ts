// Vista 3D viva del juego (nuevo motor gráfico, arte 100% propio procedural).
// Renderiza la MISMA simulación que el 2D (ver three/sim3d.ts): economía,
// transporte causal, recetas y A*. Sin rival/oleadas/niebla (hoja de ruta).
// Controles: arrastrar = pan, rueda = zoom, clic edificio = info,
// clic suelo con herramienta = construir, clic derecho = soltar.

import * as THREE from 'three';
import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';
import { HEIGHT_SCALE, TILE, slopeAt, smoothHeightAt, tileToWorld } from './height';
import { biomeAt, surfaceColor } from './biome';
import { scatterVegetation } from './vegetation';
import { buildHome3D, lampMaterial } from './buildings3d';
import { createBoat, createSettler, poseWalker, type WalkerRig } from './actors';
import { findPath, type GridPos } from '@/game/systems/pathfinding';
import { DAY_LENGTH_MS, skyAt } from '@/game/systems/daynight';
import { sunAngle } from './sky';
import { BUILDINGS, type BuildingId } from '@/game/data/buildings';
import { createSim3D, initialTown, place3D, tickSim3D, type Sim3D } from './sim3d';
import { pickCarrierJob, takeFromBuffer } from '@/game/systems/transport';
import type { ResourceId } from '@/game/data/buildings';

export interface Hud3D {
  stock: Record<string, number>;
  counts: number;
  tickNo: number;
}

export interface Select3D {
  id: BuildingId;
  nombre: string;
  descripcion: string;
}

export interface GameViewHandle {
  dispose: () => void;
  /** Herramienta de construcción activa (null = inspeccionar). */
  setTool: (id: BuildingId | null) => void;
  setSpeed: (n: number) => void;
  snapshot: () => Hud3D;
}

function isLand(t: string): boolean {
  return t !== 'water' && t !== 'waterB' && t !== 'waterC' && t !== 'mountain';
}

function tileCenter(tx: number, ty: number): { x: number; z: number } {
  return { x: (tx - ISLAND_SIZE / 2) * TILE, z: (ty - ISLAND_SIZE / 2) * TILE };
}

export function createGameView3D(
  container: HTMLElement,
  opts: { onHud: (h: Hud3D) => void; onSelect: (s: Select3D | null) => void },
): GameViewHandle {
  const sim: Sim3D = createSim3D();
  const C = Math.floor(ISLAND_SIZE / 2);
  initialTown(sim, terrainAt, ISLAND_SIZE, C, C);
  const almacen = sim.placed.find((p) => p.id === 'almacen')!;
  const centralKey = `${almacen.tx},${almacen.ty}`;

  const W = container.clientWidth || 1280;
  const H = container.clientHeight || 720;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const dayBg = new THREE.Color(0x87b5d6);
  const nightBg = new THREE.Color(0x0a1030);
  const tmpBg = new THREE.Color();
  scene.background = new THREE.Color(0x87b5d6);
  const WORLD = ISLAND_SIZE * TILE;
  scene.fog = new THREE.Fog(0x87b5d6, WORLD * 0.55, WORLD * 1.35);

  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 1200);
  const home = tileToWorld(C, C);
  const target = new THREE.Vector3(home.x, 1, home.z);
  let dist = 38;
  const angle = Math.PI / 4;
  const applyCam = () => {
    const el = 0.955;
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.cos(angle),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.sin(angle),
    );
    camera.lookAt(target);
  };
  applyCam();

  // --- Terreno con relieve + color por bioma ---
  const SEG = 80;
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const txf = x / TILE + ISLAND_SIZE / 2;
    const tyf = z / TILE + ISLAND_SIZE / 2;
    pos.setY(i, smoothHeightAt(txf, tyf) * HEIGHT_SCALE);
    const c = surfaceColor(biomeAt(txf, tyf), txf, tyf, slopeAt(txf, tyf));
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  ground.userData.ground = true;
  scene.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 8, WORLD * 8),
    new THREE.MeshStandardMaterial({ color: 0x2f6cb3, transparent: true, opacity: 0.68, roughness: 0.12, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  scene.add(water);

  // --- Vegetación y rocas instanciadas ---
  const scatter = scatterVegetation(7);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const gyOf = (tx: number, ty: number, jx: number, jy: number) =>
    smoothHeightAt(tx + jx / TILE, ty + jy / TILE) * HEIGHT_SCALE;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 0.8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, scatter.trees.length));
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 1.6, 7), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, scatter.trees.length));
  let ti = 0;
  let pi = 0;
  for (const t of scatter.trees) {
    const gy = gyOf(t.tx, t.ty, t.jx, t.jy);
    const wx = (t.tx - ISLAND_SIZE / 2) * TILE + t.jx;
    const wz = (t.ty - ISLAND_SIZE / 2) * TILE + t.jy;
    dummy.position.set(wx, gy + 0.4 * t.s, wz);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, (t.tx * 13 + t.ty * 7) % 6.28, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(ti, dummy.matrix);
    trunks.setColorAt(ti, col.setRGB(0.42, 0.29, 0.16));
    ti++;
    dummy.position.set(wx, gy + (t.pine ? 1.6 : 1.15) * t.s, wz);
    dummy.updateMatrix();
    pines.setMatrixAt(pi, dummy.matrix);
    pines.setColorAt(pi, t.pine ? col.setRGB(0.16, 0.42, 0.16) : col.setRGB(0.3, 0.55, 0.2));
    pi++;
  }
  trunks.count = ti;
  pines.count = pi;
  trunks.castShadow = true;
  pines.castShadow = true;
  scene.add(trunks, pines);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.42, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, scatter.rocks.length));
  scatter.rocks.forEach((t, i) => {
    dummy.position.set((t.tx - ISLAND_SIZE / 2) * TILE + t.jx, gyOf(t.tx, t.ty, t.jx, t.jy) + 0.12, (t.ty - ISLAND_SIZE / 2) * TILE + t.jy);
    dummy.scale.set(t.s, t.s * 0.75, t.s);
    dummy.rotation.set(0.3, (t.tx * 5 + t.ty) % 6.28, 0.15);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, col.setRGB(0.52, 0.5, 0.46));
  });
  rocks.count = scatter.rocks.length;
  rocks.castShadow = true;
  scene.add(rocks);

  // --- Sol, hemisferio, estrellas, nubes ---
  const sun = new THREE.DirectionalLight(0xffe3b3, 2.4);
  sun.position.set(30, 42, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const SB = WORLD / 2 + 12;
  sun.shadow.camera.left = -SB;
  sun.shadow.camera.right = SB;
  sun.shadow.camera.top = SB;
  sun.shadow.camera.bottom = -SB;
  sun.shadow.camera.far = WORLD * 2;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd7f0, 0x3d5a34, 0.9));
  const starGeo = new THREE.BufferGeometry();
  {
    const N = 160;
    const sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.15 + Math.random() * 1.3;
      const r = WORLD * 2;
      sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
      sp[i * 3 + 1] = Math.sin(e) * r;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
  scene.add(new THREE.Points(starGeo, starMat));
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, flatShading: true });
  const clouds: { g: THREE.Group; speed: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const n = 3 + (i % 2);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.6 + ((i + k) % 3), 6, 5), cloudMat);
      s.position.set(k * 2.0 - n, (k % 2) * 0.7, ((i + k) % 2) * 1.2 - 0.6);
      s.scale.y = 0.55;
      g.add(s);
    }
    g.position.set(-WORLD / 3 + i * 22, 20 + (i % 3) * 2.5, -20 + (i % 4) * 9);
    scene.add(g);
    clouds.push({ g, speed: 0.5 + (i % 3) * 0.25 });
  }

  // --- Edificios (sincronizados con la sim) ---
  const rendered = new Map<string, { g: THREE.Group; born: number; id: BuildingId }>();
  const meshToKey = new Map<number, string>();
  const syncBuildings = (nowMs: number) => {
    for (const p of sim.placed) {
      const key = `${p.tx},${p.ty}`;
      if (rendered.has(key)) continue;
      const g = buildHome3D(p.id, 'player');
      const w = tileToWorld(p.tx, p.ty);
      g.position.set(w.x, w.y - 0.05, w.z);
      g.traverse((o) => {
        o.userData.buildingKey = key;
        if ((o as THREE.Mesh).isMesh) meshToKey.set((o as THREE.Mesh).id, key);
      });
      g.scale.setScalar(0.1);
      scene.add(g);
      rendered.set(key, { g, born: nowMs, id: p.id });
    }
  };
  syncBuildings(performance.now());

  // --- Colonos con oficios (misma gramática que el 2D) ---
  const landBlocked = (gx: number, gy: number) => (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= ISLAND_SIZE - 1 || y >= ISLAND_SIZE - 1) return true;
    if (x === gx && y === gy) return false;
    return !isLand(terrainAt(x, y));
  };
  const forestTiles: GridPos[] = [];
  for (let ty = 2; ty < ISLAND_SIZE - 2; ty += 2) {
    for (let tx = 2; tx < ISLAND_SIZE - 2; tx += 2) {
      if (terrainAt(tx, ty) === 'forest') forestTiles.push({ x: tx, y: ty });
    }
  }
  interface Agent {
    rig: WalkerRig;
    role: 'carrier' | 'woodcutter' | 'settler' | 'miner';
    path: GridPos[];
    wp: { x: number; z: number } | null;
    wait: number;
    speed: number;
    loaded: ResourceId | null;
    job: { from: string; res: ResourceId } | null;
    phase: 'idle' | 'toSource' | 'toHome' | 'toWork';
  }
  const agents: Agent[] = [];
  const spawnAt = (tx: number, ty: number) => {
    const p = tileToWorld(tx, ty);
    return { x: p.x, z: p.z };
  };
  const mkAgent = (role: Agent['role'], loaded: boolean): Agent => {
    const rig = createSettler(role === 'miner' ? 'miner' : role === 'woodcutter' ? 'woodcutter' : role === 'carrier' ? 'carrier' : 'settler', loaded);
    const s = spawnAt(almacen.tx + Math.floor(Math.random() * 5) - 2, almacen.ty + Math.floor(Math.random() * 5) - 2);
    const p = tileToWorld(almacen.tx, almacen.ty);
    rig.position.set(s.x, p.y, s.z);
    scene.add(rig);
    return { rig, role, path: [], wp: null, wait: Math.random() * 2, speed: role === 'carrier' ? 2.6 : 2.0 + Math.random() * 0.5, loaded: null, job: null, phase: 'idle' };
  };
  const crew: Agent['role'][] = ['carrier', 'carrier', 'carrier', 'woodcutter', 'woodcutter', 'settler', 'settler', 'settler', 'settler', 'miner'];
  for (const r of crew) agents.push(mkAgent(r, r === 'carrier'));
  const setLoaded = (a: Agent, res: ResourceId | null) => {
    a.loaded = res;
    const want = res !== null;
    const has = (a.rig.userData as { loaded?: boolean }).loaded === true;
    if (want === has) return;
    const base = a.role === 'miner' ? 'miner' : a.role === 'woodcutter' ? 'woodcutter' : a.role === 'carrier' ? 'carrier' : 'settler';
    const pos = a.rig.position.clone();
    const rot = a.rig.rotation.y;
    scene.remove(a.rig);
    const rig = createSettler(base as 'carrier' | 'woodcutter' | 'miner' | 'settler', want);
    rig.position.copy(pos);
    rig.rotation.y = rot;
    (rig.userData as { loaded?: boolean }).loaded = want;
    scene.add(rig);
    a.rig = rig;
  };
  const walkTo = (a: Agent, tx: number, ty: number): boolean => {
    const cur = { x: Math.round(a.rig.position.x / TILE + ISLAND_SIZE / 2), y: Math.round(a.rig.position.z / TILE + ISLAND_SIZE / 2) };
    const raw = findPath(cur, { x: tx, y: ty }, ISLAND_SIZE, ISLAND_SIZE, landBlocked(tx, ty), 8000);
    if (!raw || raw.length < 2) return false;
    a.path = raw.slice(1);
    const next = a.path.shift()!;
    const p = tileCenter(next.x, next.y);
    a.wp = { x: p.x, z: p.z };
    return true;
  };
  const wander = (a: Agent) => {
    for (let i = 0; i < 10; i++) {
      const tx = 2 + Math.floor(Math.random() * (ISLAND_SIZE - 4));
      const ty = 2 + Math.floor(Math.random() * (ISLAND_SIZE - 4));
      if (!isLand(terrainAt(tx, ty))) continue;
      if (walkTo(a, tx, ty)) return;
    }
    a.wait = 1 + Math.random() * 2;
  };
  const stepAgent = (a: Agent, dt: number) => {
    // Lógica de oficio cada vez que queda libre.
    if (!a.wp) {
      if (a.role === 'carrier' && a.phase === 'idle') {
        const job = pickCarrierJob(sim.transport, centralKey);
        if (job) {
          const [jx, jy] = job.fromKey.split(',').map(Number);
          a.job = { from: job.fromKey, res: job.resource };
          a.phase = 'toSource';
          if (!walkTo(a, jx, jy)) { a.job = null; a.phase = 'idle'; a.wait = 1; }
          return;
        }
        wander(a);
        return;
      }
      if (a.role === 'carrier' && a.phase === 'toSource' && !a.wp) {
        // Llegó a la pila: carga 1 ud. real y vuelve al almacén.
        const got = a.job ? takeFromBuffer(sim.transport, a.job.from, a.job.res, 1) : 0;
        if (got > 0 && a.job) {
          setLoaded(a, a.job.res);
          a.phase = 'toHome';
          if (!walkTo(a, almacen.tx, almacen.ty)) { a.phase = 'idle'; a.wait = 1; }
        } else {
          a.job = null;
          a.phase = 'idle';
          a.wait = 1 + Math.random();
        }
        return;
      }
      if (a.role === 'woodcutter' && a.phase === 'idle') {
        const cab = sim.placed.find((p) => p.id === 'cabanaLenador');
        if (cab && forestTiles.length) {
          const t = forestTiles[Math.floor(Math.random() * forestTiles.length)];
          a.phase = 'toWork';
          if (!walkTo(a, t.x, t.y)) { a.phase = 'idle'; a.wait = 1; }
          return;
        }
      }
      poseWalker(a.rig, dt, false);
      a.wait -= dt;
      if (a.wait > 0) return;
      if (a.phase === 'toWork') {
        // Tala/chamba: pausa y vuelta a casa.
        a.wait = 2.5 + Math.random() * 1.5;
        a.phase = 'toHome';
        const cab = sim.placed.find((p) => p.id === 'cabanaLenador');
        if (cab) walkTo(a, cab.tx, cab.ty);
        return;
      }
      if (a.phase === 'toHome' && a.role !== 'carrier') {
        a.phase = 'idle';
        a.wait = 1 + Math.random() * 2;
        return;
      }
      wander(a);
      return;
    }
    const dx = a.wp.x - a.rig.position.x;
    const dz = a.wp.z - a.rig.position.z;
    const d = Math.hypot(dx, dz);
    const step = a.speed * dt;
    if (d <= Math.max(0.15, step)) {
      const next = a.path.shift();
      if (!next) {
        a.wp = null;
        if (a.role === 'carrier' && a.phase === 'toHome' && a.job) {
          sim.stock[a.job.res] = (sim.stock[a.job.res] ?? 0) + 1;
          setLoaded(a, null);
          a.job = null;
          a.phase = 'idle';
          a.wait = 0.2;
          hudDirty = true;
        }
      } else {
        const p = tileCenter(next.x, next.y);
        a.wp = { x: p.x, z: p.z };
      }
    } else {
      a.rig.position.x += (dx / d) * step;
      a.rig.position.z += (dz / d) * step;
      a.rig.rotation.y = Math.atan2(dx, dz);
      poseWalker(a.rig, dt, true);
    }
    a.rig.position.y = smoothHeightAt(
      a.rig.position.x / TILE + ISLAND_SIZE / 2,
      a.rig.position.z / TILE + ISLAND_SIZE / 2,
    ) * HEIGHT_SCALE;
  };

  // --- Barco de altura en circuito ---
  const boat = createBoat();
  scene.add(boat);
  let boatA = Math.random() * Math.PI * 2;
  const boatR = WORLD * 0.32;

  // --- Controles: pan, zoom, clic (construir/inspeccionar), derecho = soltar ---
  let tool: BuildingId | null = null;
  let speed = 1;
  let hudDirty = true;
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = THREE.MathUtils.clamp(dist * (e.deltaY > 0 ? 1.1 : 0.9), 14, WORLD * 1.4);
    applyCam();
  };
  let dragging = false;
  let moved = 0;
  let lx = 0;
  let ly = 0;
  let downX = 0;
  let downY = 0;
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    moved = 0;
    lx = e.clientX;
    ly = e.clientY;
    downX = e.clientX;
    downY = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    const s = dist / 700;
    const dx = (e.clientX - lx) * s;
    const dy = (e.clientY - ly) * s;
    const cx = Math.cos(angle);
    const sx = Math.sin(angle);
    target.x = THREE.MathUtils.clamp(target.x - (dx * cx - dy * sx), -WORLD / 2, WORLD / 2);
    target.z = THREE.MathUtils.clamp(target.z - (dx * sx + dy * cx), -WORLD / 2, WORLD / 2);
    lx = e.clientX;
    ly = e.clientY;
    applyCam();
  };
  const groundToTile = (wx: number, wz: number): GridPos => ({
    x: Math.round(wx / TILE + ISLAND_SIZE / 2),
    y: Math.round(wz / TILE + ISLAND_SIZE / 2),
  });
  const pick = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hitsB = ray.intersectObjects([...rendered.values()].map((v) => v.g), true);
    if (hitsB.length) {
      let o: THREE.Object3D | null = hitsB[0].object;
      while (o && o.userData.buildingKey === undefined) o = o.parent;
      const key = o?.userData.buildingKey as string | undefined;
      const rec = key ? rendered.get(key) : undefined;
      if (rec) {
        const def = BUILDINGS[rec.id];
        opts.onSelect({ id: rec.id, nombre: def.nombre, descripcion: def.descripcion });
        return;
      }
    }
    const hitsG = ray.intersectObject(ground, false);
    if (!hitsG.length) return;
    const t = groundToTile(hitsG[0].point.x, hitsG[0].point.z);
    if (tool) {
      if (place3D(sim, terrainAt, ISLAND_SIZE, tool, t.x, t.y)) {
        syncBuildings(performance.now());
        hudDirty = true;
      }
      return;
    }
    opts.onSelect(null);
  };
  const onUp = (e: PointerEvent) => {
    if (dragging && moved < 6 && e.button === 0) pick(e);
    dragging = false;
  };
  const onCtx = (e: Event) => {
    e.preventDefault();
    tool = null;
    opts.onSelect(null);
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  el.addEventListener('contextmenu', onCtx);
  const onResize = () => {
    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 720;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  // --- Bucle: sim a 1 tick/s de pared + render ---
  const t0 = performance.now();
  let acc = 0;
  let last = t0;
  let raf = 0;
  let dead = false;
  // Reloj manual (THREE.Clock está deprecado): deltas acotados.
  let clockLast = performance.now();
  let elapsedAcc = 0;
  const distOf = (fromKey: string) => {
    const [fx, fy] = fromKey.split(',').map(Number);
    return { connected: true, distance: Math.abs(fx - almacen.tx) + Math.abs(fy - almacen.ty) };
  };
  const loop = () => {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const nowMs = performance.now();
    const dt = Math.min((nowMs - clockLast) / 1000, 0.1);
    clockLast = nowMs;
    elapsedAcc += dt;
    const now = nowMs;
    acc += Math.min(now - last, 250);
    last = now;
    const interval = 1000 / speed;
    let n = 0;
    while (acc >= interval && n < 3 * speed) {
      const carriers = agents.filter((a) => a.role === 'carrier').length;
      tickSim3D(sim, { carriers, distanceOf: distOf, centralKey });
      acc -= interval;
      n++;
      hudDirty = true;
    }
    if (n === 3 * speed) acc = 0;
    const elapsed = (now - t0 + DAY_LENGTH_MS * 0.1) % DAY_LENGTH_MS;
    const sky = skyAt(elapsed, DAY_LENGTH_MS);
    const ang = sunAngle(elapsed, DAY_LENGTH_MS);
    const dark = sky.darkness;
    const sr = WORLD * 0.5;
    if (dark < 0.5) {
      sun.position.set(Math.cos(ang.azim) * sr * 0.8, Math.max(10, Math.sin(ang.elev) * sr * 0.9 + 18), 20);
      sun.color.set(0xffe3b3);
      sun.intensity = 2.4 * (1 - dark * 0.7);
    } else {
      sun.position.set(-20, 42, 10);
      sun.color.set(0x8fb0e8);
      sun.intensity = 0.35;
    }
    tmpBg.copy(dayBg).lerp(nightBg, dark);
    (scene.background as THREE.Color).copy(tmpBg);
    (scene.fog as THREE.Fog).color.copy(tmpBg);
    lampMaterial.emissiveIntensity = sky.lanternAlpha * 2.4;
    starMat.opacity = sky.starsAlpha;
    for (const a of agents) stepAgent(a, dt);
    // Edificios nuevos crecen (escala de obra).
    for (const rec of rendered.values()) {
      const g = rec.g;
      if (g.scale.x < 1) {
        const s = Math.min(1, g.scale.x + dt * 1.5);
        g.scale.setScalar(s);
      }
    }
    boatA += dt * 0.05;
    boat.position.set(Math.cos(boatA) * boatR, 0.35 + Math.sin(elapsedAcc * 1.4) * 0.08, Math.sin(boatA) * boatR);
    boat.rotation.y = -boatA;
    for (const c of clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > WORLD / 2) c.g.position.x = -WORLD / 2;
    }
    water.position.y = 0.15 + Math.sin(now * 0.0006) * 0.05;
    if (hudDirty) {
      hudDirty = false;
      opts.onHud({ stock: { ...sim.stock }, counts: sim.placed.length, tickNo: sim.tickNo });
    }
    renderer.render(scene, camera);
  };
  loop();

  return {
    setTool: (id: BuildingId | null) => {
      tool = id;
    },
    setSpeed: (n: number) => {
      speed = n === 2 ? 2 : 1;
    },
    snapshot: () => ({ stock: { ...sim.stock }, counts: sim.placed.length, tickNo: sim.tickNo }),
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('contextmenu', onCtx);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      el.remove();
    },
  };
}

