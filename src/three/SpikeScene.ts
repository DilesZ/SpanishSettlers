// Spike de migración 3D (Tarea 1-3 del plan): relieve suave + biomas +
// lecho marino + vegetación instanciada + agua + sol. Todo procedural.

import * as THREE from 'three';
import { ISLAND_SIZE } from '@/game/maps/island';
import { HEIGHT_SCALE, TILE, slopeAt, smoothHeightAt, tileToWorld } from './height';
import { biomeAt, surfaceColor } from './biome';
import { scatterVegetation, type ScatterItem } from './vegetation';
import { buildHome3D, lampMaterial } from './buildings3d';
import type { Owner } from '@/game/systems/rival';
import type { BuildingId } from '@/game/data/buildings';

export interface SpikeHandle {
  dispose: () => void;
  setNight: (on: boolean) => void;
}

export function createSpikeScene(container: HTMLElement): SpikeHandle {
  const W = container.clientWidth || 1280;
  const H = container.clientHeight || 720;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x87b5d6, 70, 170);

  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 600);
  const target = new THREE.Vector3(0, 1, 4);
  let dist = 58;
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

  const SIZE = ISLAND_SIZE * TILE;

  // Terreno con relieve SUAVE (bilinear) + color por bioma y pendiente.
  const SEG = 112;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const seaColors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const txf = x / TILE + ISLAND_SIZE / 2;
    const tyf = z / TILE + ISLAND_SIZE / 2;
    const h = smoothHeightAt(txf, tyf);
    const y = h * HEIGHT_SCALE;
    pos.setY(i, y);
    const slope = slopeAt(txf, tyf);
    const c = surfaceColor(biomeAt(txf, tyf), txf, tyf, slope);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
    // Lecho marino: arenoso, hundido bajo el agua.
    const depthK = Math.max(0, Math.min(1, -h * 4));
    seaColors[i * 3] = 0.76 - depthK * 0.3;
    seaColors[i * 3 + 1] = 0.68 - depthK * 0.28;
    seaColors[i * 3 + 2] = 0.47 - depthK * 0.2;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // Lecho bajo el agua (se transparenta la profundidad).
  const seaGeo = geo.clone();
  const sp = seaGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    sp.setY(i, Math.min(sp.getY(i), -0.3));
  }
  seaGeo.setAttribute('color', new THREE.BufferAttribute(seaColors, 3));
  seaGeo.computeVertexNormals();
  const seabed = new THREE.Mesh(
    seaGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }),
  );
  scene.add(seabed);

  // Agua amplia que se pierde en la niebla.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE * 20, SIZE * 20),
    new THREE.MeshStandardMaterial({ color: 0x2f6cb3, transparent: true, opacity: 0.68, roughness: 0.12, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  water.receiveShadow = true;
  scene.add(water);

  // Vegetación y rocas instanciadas.
  const scatter = scatterVegetation(7);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const placeOnGround = (it: ScatterItem): number =>
    smoothHeightAt(it.tx + it.jx / TILE, it.ty + it.jy / TILE) * HEIGHT_SCALE;

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 0.8, 6), trunkMat, Math.max(1, scatter.trees.length));
  const pineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 1.6, 7), pineMat, Math.max(1, scatter.trees.length));
  let ti = 0;
  let pi = 0;
  for (const t of scatter.trees) {
    const gy = placeOnGround(t);
    const wx = (t.tx - ISLAND_SIZE / 2) * TILE + t.jx;
    const wz = (t.ty - ISLAND_SIZE / 2) * TILE + t.jy;
    dummy.position.set(wx, gy + 0.4 * t.s, wz);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, (t.tx * 13 + t.ty * 7) % 6.28, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(ti, dummy.matrix);
    trunks.setColorAt(ti, col.setRGB(0.42, 0.29, 0.16));
    ti++;
    if (t.pine) {
      dummy.position.set(wx, gy + (0.8 + 0.8) * t.s, wz);
      dummy.updateMatrix();
      pines.setMatrixAt(pi, dummy.matrix);
      pines.setColorAt(pi, col.setRGB(0.16 + (t.tx % 3) * 0.02, 0.42, 0.16));
      pi++;
    } else {
      dummy.position.set(wx, gy + 1.15 * t.s, wz);
      dummy.updateMatrix();
      pines.setMatrixAt(pi, dummy.matrix);
      pines.setColorAt(pi, col.setRGB(0.3, 0.55, 0.2));
      pi++;
    }
  }
  trunks.count = ti;
  pines.count = pi;
  trunks.castShadow = true;
  pines.castShadow = true;
  scene.add(trunks, pines);

  const rockMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.42, 0), rockMat, Math.max(1, scatter.rocks.length));
  scatter.rocks.forEach((t, i) => {
    const gy = placeOnGround(t);
    dummy.position.set((t.tx - ISLAND_SIZE / 2) * TILE + t.jx, gy + 0.12, (t.ty - ISLAND_SIZE / 2) * TILE + t.jy);
    dummy.scale.set(t.s, t.s * 0.75, t.s);
    dummy.rotation.set(0.3, (t.tx * 5 + t.ty) % 6.28, 0.15);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, col.setRGB(0.52, 0.5, 0.46));
  });
  rocks.count = scatter.rocks.length;
  rocks.castShadow = true;
  scene.add(rocks);

  const grassMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.4, 4), grassMat, Math.max(1, scatter.grass.length));
  scatter.grass.forEach((t, i) => {
    const gy = placeOnGround(t);
    dummy.position.set((t.tx - ISLAND_SIZE / 2) * TILE + t.jx, gy + 0.16, (t.ty - ISLAND_SIZE / 2) * TILE + t.jy);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, (t.tx * 3 + t.ty * 11) % 6.28, 0);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, col.setRGB(0.42, 0.66, 0.26));
  });
  grass.count = scatter.grass.length;
  scene.add(grass);

  const flowerMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 5, 4), flowerMat, Math.max(1, scatter.flowers.length));
  scatter.flowers.forEach((t, i) => {
    const gy = placeOnGround(t);
    dummy.position.set((t.tx - ISLAND_SIZE / 2) * TILE + t.jx, gy + 0.22, (t.ty - ISLAND_SIZE / 2) * TILE + t.jy);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, (t.tx + t.ty) % 2 === 0 ? col.setRGB(1, 1, 1) : col.setRGB(1, 0.85, 0.3));
  });
  flowers.count = scatter.flowers.length;
  scene.add(flowers);

  // Sol cálido con sombras + hemisferio.
  const sun = new THREE.DirectionalLight(0xffe3b3, 2.4);
  sun.position.set(30, 42, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd7f0, 0x3d5a34, 0.9));

  // Colonia inicial (misma planta que el juego 2D).
  const town: [BuildingId, number, number, Owner, number][] = [
    ['almacen', 14, 14, 'player', 0],
    ['cabanaLenador', 11, 13, 'player', 0.5],
    ['aserradero', 10, 16, 'player', -0.4],
    ['residenciaS', 13, 17, 'player', 0.2],
    ['residenciaM', 16, 18, 'player', -0.3],
    ['cantera', 17, 12, 'player', 0.4],
    ['molino', 18, 15, 'player', 0],
    ['torre', 9, 10, 'player', 0],
    ['granja', 19, 16, 'player', 0.3],
    ['pozo', 15, 15, 'player', 0],
    ['almacen', 21, 9, 'rival', 0],
    ['cabanaLenador', 19, 8, 'rival', -0.5],
  ];
  for (const [id, tx, ty, owner, rot] of town) {
    const g = buildHome3D(id, owner);
    const p = tileToWorld(tx, ty);
    g.position.set(p.x, p.y - 0.05, p.z);
    g.rotation.y = rot;
    scene.add(g);
  }

  // Controles propios: arrastrar = pan, rueda = zoom.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = THREE.MathUtils.clamp(dist * (e.deltaY > 0 ? 1.1 : 0.9), 18, 130);
    applyCam();
  };
  let dragging = false;
  let lx = 0;
  let ly = 0;
  const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const s = dist / 700;
    const dx = (e.clientX - lx) * s;
    const dy = (e.clientY - ly) * s;
    const cx = Math.cos(angle);
    const sx = Math.sin(angle);
    target.x -= dx * cx - dy * sx;
    target.z -= dx * sx + dy * cx;
    target.x = THREE.MathUtils.clamp(target.x, -40, 40);
    target.z = THREE.MathUtils.clamp(target.z, -40, 40);
    lx = e.clientX;
    ly = e.clientY;
    applyCam();
  };
  const onUp = () => { dragging = false; };
  const el = renderer.domElement;
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  const onResize = () => {
    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 720;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  let raf = 0;
  let dead = false;
  const loop = () => {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    renderer.render(scene, camera);
  };
  loop();

  return {
    setNight: (on: boolean) => {
      lampMaterial.emissiveIntensity = on ? 2.4 : 0;
      sun.intensity = on ? 0.25 : 2.4;
      sun.color.set(on ? 0x8fb0e8 : 0xffe3b3);
      scene.background = new THREE.Color(on ? 0x0a1030 : 0x87b5d6);
      scene.fog = new THREE.Fog(on ? 0x0a1030 : 0x87b5d6, 70, 170);
    },
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
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
