// Spike de migración 3D (Tarea 1 del plan): terreno con relieve + agua + sol.
// Todo procedural y original. Si la captura headless muestra relieve y agua,
// la migración sigue (GO); si no, se aborta aquí.

import * as THREE from 'three';
import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';
import { heightAt, HEIGHT_SCALE, TILE } from './height';

export interface SpikeHandle {
  dispose: () => void;
}

const BIOME: Record<string, [number, number, number]> = {
  grass: [0.36, 0.6, 0.28],
  grassB: [0.33, 0.56, 0.26],
  grassC: [0.39, 0.64, 0.3],
  dirt: [0.61, 0.48, 0.3],
  sand: [0.87, 0.75, 0.51],
  water: [0.23, 0.47, 0.77],
  waterB: [0.22, 0.45, 0.74],
  waterC: [0.24, 0.49, 0.79],
  forest: [0.24, 0.48, 0.2],
  mountain: [0.55, 0.53, 0.47],
};

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
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
  scene.fog = new THREE.Fog(0x87b5d6, 70, 160);

  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);
  const target = new THREE.Vector3(0, 1, 4);
  let dist = 58;
  let angle = Math.PI / 4;
  const applyCam = () => {
    const el = 0.955; // ~55° elevación estilo isométrico
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.cos(angle),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.sin(angle),
    );
    camera.lookAt(target);
  };
  applyCam();

  // Terreno con relieve real.
  const SEG = 112;
  const geo = new THREE.PlaneGeometry(ISLAND_SIZE * TILE, ISLAND_SIZE * TILE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const txf = x / TILE + ISLAND_SIZE / 2;
    const tyf = z / TILE + ISLAND_SIZE / 2;
    const tx = Math.max(0, Math.min(ISLAND_SIZE - 1, Math.round(txf)));
    const ty = Math.max(0, Math.min(ISLAND_SIZE - 1, Math.round(tyf)));
    pos.setY(i, heightAt(txf, tyf) * HEIGHT_SCALE);
    const c = BIOME[terrainAt(tx, ty)] ?? BIOME.grass;
    const v = 0.92 + hash2(tx, ty) * 0.16;
    colors[i * 3] = Math.min(1, c[0] * v);
    colors[i * 3 + 1] = Math.min(1, c[1] * v);
    colors[i * 3 + 2] = Math.min(1, c[2] * v);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // Agua semitransparente sobre el nivel del mar.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(ISLAND_SIZE * TILE * 1.6, ISLAND_SIZE * TILE * 1.6),
    new THREE.MeshStandardMaterial({ color: 0x2f6cb3, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  water.receiveShadow = true;
  scene.add(water);

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
