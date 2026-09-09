// Atmósfera y luz nocturna (rama luz-atmósfera, docs/devlog/026).
//
// API para el integrador (GameScene es el único que la llama):
//   initAtmosphere(scene)        en create(), DESPUÉS de setupAmbient/setupNight
//   updateSky(scene, skyState)   en skyTick(), en lugar del bucle manual viejo
//   registerCloud(scene, cloud, shade?)  (opcional) en setupAmbient(), por nube
//   shutdownAtmosphere(scene)    (opcional) al resetear la escena
//
// Qué hace:
// - Publica window.__sky (tinte HTML suave, ver GameCanvas) con color/alpha/warm.
// - Faroles vivos: cada farol de `scene.lanterns` recibe halo grande + charco
//   de luz en el suelo (texturas 'lantern-halo' y 'light-pool' de BootScene,
//   con fallback a 'glow') y parpadeo suave vía UN SOLO tween global.
// - Estrellas de `scene.stars` con titileo suave (antes saltaban cada 1 s).
// - Luciérnagas nocturnas (máx. 24) ancladas a los faroles, errantes.
// - Nubes registradas: sombra que se atenúa de noche + tinte cálido al
//   amanecer/atardecer y frío de noche.
//
// Rendimiento: 1 tween global para parpadeo/titileo (O(faroles+estrellas) con
// early-out de día), 1 tween de deriva por luciérnaga, sin objetos temporales
// por frame. Todo lo temporal se destruye (ver shutdown + syncLanterns).
// Sin assets de terceros: todo procedural y original.
//
// NOTA Phaser: este fichero solo usa `import type` de 'phaser' (sin coste en
// runtime y testeable en vitest/node). El blend ADD se copia del farol
// existente (nunca se importa el enum en runtime).

import type Phaser from 'phaser';
import type { SkyState } from '../systems/daynight';

/** Color cálido de amanecer/atardecer según systems/daynight.ts. */
export const DAWN_COLOR = 0xd86a2e;

/** Tinte frío nocturno para las nubes registradas. */
export const NIGHT_CLOUD_TINT = 0x9fb4dd;

/** Tinte cálido de amanecer/atardecer para las nubes registradas. */
export const DAWN_CLOUD_TINT = 0xffd9b0;

/** Forma publicada a GameCanvas vía window.__sky (compatible con lo anterior). */
export interface SkyOverlay {
  color: number;
  alpha: number;
  /** 1 cuando el tinte es el cálido del amanecer/atardecer, 0 en otro caso. */
  warm: number;
}

export interface AtmosphereOptions {
  /** Nº de luciérnagas (0 desactiva). Tope 24 por rendimiento. Por defecto 14. */
  fireflyCount?: number;
}

interface LanternFx {
  lamp: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  /** Escala base del halo (el parpadeo la modula ±3.5%). */
  haloBase: number;
  /** Fase propia para que no parpadeen al unísono. */
  phase: number;
  /** Brillo 0..1 del último updateSky. */
  base: number;
}

interface Firefly {
  img: Phaser.GameObjects.Image;
  anchorX: number;
  anchorY: number;
  phase: number;
}

interface CloudReg {
  cloud: Phaser.GameObjects.Image;
  shade?: Phaser.GameObjects.Shape;
  shadeBase: number;
}

interface AtmoState {
  dead: boolean;
  lanterns: Map<Phaser.GameObjects.Image, LanternFx>;
  fireflies: Firefly[];
  starObjs: Phaser.GameObjects.Arc[];
  starPhase: number[];
  starBase: number;
  lanternBase: number;
  nightBase: number;
  proxy: { t: number };
  clouds: CloudReg[];
  /** Contador para re-anclar una luciérnaga por tick. */
  anchorCursor: number;
  /** true tras el primer anclaje masivo. */
  anchored: boolean;
}

/** Campos de GameScene que este módulo necesita (sin importarla: sin ciclos). */
type LooseScene = Phaser.Scene & {
  lanterns?: Phaser.GameObjects.Image[];
  stars?: Phaser.GameObjects.Arc[];
  minimap?: Phaser.Cameras.Scene2D.Camera;
  center?: { x: number; y: number };
  iso?: (tx: number, ty: number) => { x: number; y: number };
};

const states = new WeakMap<Phaser.Scene, AtmoState>();

const MAX_STARS = 120;
const MAX_CLOUDS = 12;
const MAX_FIREFLIES = 24;
const POOL_DY = 26;

function asLoose(scene: Phaser.Scene): LooseScene {
  return scene as LooseScene;
}

/** Estado existente o uno mínimo (sin FX) para registros previos a init. */
function ensureState(scene: Phaser.Scene): AtmoState {
  let st = states.get(scene);
  if (!st) {
    st = {
      dead: false,
      lanterns: new Map(),
      fireflies: [],
      starObjs: [],
      starPhase: [],
      starBase: 0,
      lanternBase: 0,
      nightBase: 0,
      proxy: { t: 0 },
      clouds: [],
      anchorCursor: 0,
      anchored: false,
    };
    states.set(scene, st);
  }
  return st;
}

/** Marca una imagen como aditiva sin importar el enum Phaser en runtime. */
function markAdditive(
  img: Phaser.GameObjects.Image,
  refBlend?: number,
): void {
  try {
    // ADD = 1 en Phaser 3.x (estable desde 3.0.0, ver renderer/BlendModes.js).
    // Se prefiere copiar el blend del farol existente si está disponible.
    img.setBlendMode(typeof refBlend === 'number' ? refBlend : 1);
  } catch {
    /* sin blend: se sigue viendo, solo menos "luz" */
  }
}

/** Normaliza el blend de un objeto a número (ADD=1) o undefined. */
function blendOf(obj: { blendMode?: unknown }): number | undefined {
  return typeof obj.blendMode === 'number' ? obj.blendMode : undefined;
}

function ignoreOnMinimap(scene: Phaser.Scene, objs: Phaser.GameObjects.GameObject[]): void {
  try {
    asLoose(scene).minimap?.ignore(objs);
  } catch {
    /* sin minimapa: nada que hacer */
  }
}

function pickTexture(scene: Phaser.Scene, key: string): string {
  try {
    return scene.textures.exists(key) ? key : 'glow';
  } catch {
    return 'glow';
  }
}

/**
 * Inicializa la atmósfera. Llamar UNA vez en create(), después de
 * setupAmbient() y setupNight() (necesita `lanterns`/`stars` ya creados;
 * los faroles futuros se auto-detectan en updateSky de todos modos).
 */
export function initAtmosphere(scene: Phaser.Scene, opts: AtmosphereOptions = {}): void {
  shutdownAtmosphere(scene);
  const st = ensureState(scene);
  const count = Math.max(0, Math.min(MAX_FIREFLIES, Math.floor(opts.fireflyCount ?? 14)));

  const loose = asLoose(scene);
  const firstLamp = Array.isArray(loose.lanterns) ? loose.lanterns[0] : undefined;
  const refBlend = firstLamp ? blendOf(firstLamp) : undefined;
  const tex = pickTexture(scene, 'firefly');

  for (let i = 0; i < count; i++) {
    const img = scene.add.image(0, 0, tex);
    img.setDepth(8600);
    img.setScale(tex === 'glow' ? 0.28 : 1.6);
    img.setAlpha(0);
    img.setVisible(false);
    markAdditive(img, refBlend);
    ignoreOnMinimap(scene, [img]);
    const f: Firefly = {
      img,
      anchorX: 0,
      anchorY: 0,
      phase: Math.random() * Math.PI * 2,
    };
    st.fireflies.push(f);
    wanderFirefly(scene, st, f);
  }

  // Un solo tween global: parpadeo de faroles + titileo de estrellas +
  // guiños de luciérnagas. Sawtooth 0..2π (sin(0) = sin(2π): sin salto).
  scene.tweens.add({
    targets: st.proxy,
    t: Math.PI * 2,
    duration: 1500,
    repeat: -1,
    onUpdate: () => applyFrame(scene),
  });
}

/**
 * Registra una nube (y opcionalmente su sombra) para la mejora barata:
 * la sombra se atenúa de noche y la nube se tiñe cálida/fría.
 * Llamar desde setupAmbient() por cada nube creada, DESPUÉS de initAtmosphere.
 */
export function registerCloud(
  scene: Phaser.Scene,
  cloud: Phaser.GameObjects.Image,
  shade?: Phaser.GameObjects.Shape,
  shadeBaseAlpha = 0.1,
): void {
  const st = ensureState(scene);
  if (st.clouds.length >= MAX_CLOUDS) st.clouds.shift();
  st.clouds.push({ cloud, shade, shadeBase: shadeBaseAlpha });
}

/**
 * Aplica el estado del cielo. Sustituye al bucle manual de skyTick():
 * publica el overlay, sincroniza FX de faroles (altas/bajas automáticas),
 * guarda bases de estrellas/luciérnagas y retoca nubes registradas.
 */
export function updateSky(scene: Phaser.Scene, sky: SkyState): void {
  publishSky(sky);
  const st = states.get(scene);
  if (!st || st.dead) return;
  syncLanterns(scene, st, sky.lanternAlpha);
  st.lanternBase = sky.lanternAlpha;
  st.starBase = sky.starsAlpha;
  refreshStars(scene, st);
  updateFireflies(scene, st, sky);
  updateClouds(st, sky);
}

/** Libera halo/charcos/luciérnagas y el tween global. Idempotente. */
export function shutdownAtmosphere(scene: Phaser.Scene): void {
  const st = states.get(scene);
  if (!st) return;
  st.dead = true;
  try {
    for (const fx of st.lanterns.values()) {
      try {
        scene.tweens.killTweensOf(fx.halo);
        scene.tweens.killTweensOf(fx.pool);
        fx.halo.destroy();
        fx.pool.destroy();
      } catch {
        /* ya destruido por la escena */
      }
    }
    for (const f of st.fireflies) {
      try {
        scene.tweens.killTweensOf(f.img);
        f.img.destroy();
      } catch {
        /* ya destruido por la escena */
      }
    }
    try {
      scene.tweens.killTweensOf(st.proxy);
    } catch {
      /* sin tweens */
    }
  } finally {
    states.delete(scene);
  }
}

// ---------- internas ----------

function publishSky(sky: SkyState): void {
  try {
    if (typeof window === 'undefined') return;
    const overlay: SkyOverlay = {
      color: sky.overlayColor,
      alpha: sky.overlayAlpha,
      warm: sky.overlayColor === DAWN_COLOR ? 1 : 0,
    };
    (window as unknown as { __sky?: SkyOverlay }).__sky = overlay;
  } catch {
    /* SSR o sin window: el overlay HTML simplemente no se actualiza */
  }
}

/** Altas automáticas de faroles nuevos + limpieza de destruidos/huérfanos. */
function syncLanterns(scene: Phaser.Scene, st: AtmoState, lanternAlpha: number): void {
  const loose = asLoose(scene);
  const raw = Array.isArray(loose.lanterns) ? loose.lanterns : [];
  const alive = new Set<Phaser.GameObjects.Image>();
  for (const lamp of raw) {
    if (!lamp || lamp.active === false) continue;
    alive.add(lamp);
    if (!st.lanterns.has(lamp)) attachLanternFx(scene, st, lamp);
  }
  for (const [lamp, fx] of st.lanterns) {
    if (!alive.has(lamp)) {
      try {
        fx.halo.destroy();
        fx.pool.destroy();
      } catch {
        /* ya destruido */
      }
      st.lanterns.delete(lamp);
    }
  }
  const vis = lanternAlpha > 0.02;
  for (const fx of st.lanterns.values()) {
    fx.base = lanternAlpha;
    try {
      fx.lamp.setAlpha(lanternAlpha);
      fx.halo.setVisible(vis);
      fx.pool.setVisible(vis);
      if (vis) {
        fx.halo.setAlpha(lanternAlpha * 0.5);
        fx.pool.setAlpha(lanternAlpha * 0.42);
      }
    } catch {
      /* farol a medio destruir: se limpiará en el próximo tick */
    }
  }
}

function attachLanternFx(scene: Phaser.Scene, st: AtmoState, lamp: Phaser.GameObjects.Image): void {
  try {
    const refBlend: number | undefined = blendOf(lamp);
    const halo = scene.add.image(lamp.x, lamp.y, pickTexture(scene, 'lantern-halo'));
    halo.setDepth(lamp.depth + 0.2);
    halo.setScale(1.15);
    markAdditive(halo, refBlend);
    halo.setAlpha(0);
    halo.setVisible(false);
    const pool = scene.add.image(lamp.x, lamp.y + POOL_DY, pickTexture(scene, 'light-pool'));
    pool.setDepth(lamp.depth - 1.5);
    pool.setScale(1.7, 1.25);
    markAdditive(pool, refBlend);
    pool.setAlpha(0);
    pool.setVisible(false);
    ignoreOnMinimap(scene, [halo, pool]);
    st.lanterns.set(lamp, {
      lamp,
      halo,
      pool,
      haloBase: 1.15,
      phase: Math.random() * Math.PI * 2,
      base: 0,
    });
  } catch {
    /* sin FX para este farol: el núcleo 'glow' sigue funcionando */
  }
}

function refreshStars(scene: Phaser.Scene, st: AtmoState): void {
  const raw = asLoose(scene).stars;
  if (!Array.isArray(raw)) return;
  st.starObjs = raw.filter((s) => s && s.active !== false).slice(0, MAX_STARS);
  while (st.starPhase.length < st.starObjs.length) {
    st.starPhase.push(Math.random() * Math.PI * 2);
  }
  st.starPhase.length = st.starObjs.length;
}

function updateFireflies(scene: Phaser.Scene, st: AtmoState, sky: SkyState): void {
  const night = sky.isNight ? Math.min(1, Math.max(sky.starsAlpha, sky.lanternAlpha) * 1.2) : 0;
  st.nightBase = night;
  const show = night > 0.03;
  if (!st.anchored) {
    for (const f of st.fireflies) anchorFirefly(scene, st, f);
    st.anchored = true;
  } else if (show && st.fireflies.length > 0) {
    // Rotar un re-anclaje por tick: siguen a los faroles sin coste.
    st.anchorCursor = (st.anchorCursor + 1) % st.fireflies.length;
    anchorFirefly(scene, st, st.fireflies[st.anchorCursor]);
  }
  for (const f of st.fireflies) {
    try {
      f.img.setVisible(show);
      if (!show) f.img.setAlpha(0);
    } catch {
      /* luciérnaga destruida: se ignora */
    }
  }
}

/** Ancla una luciérnaga junto a un farol aleatorio (o al centro del mapa). */
function anchorFirefly(scene: Phaser.Scene, st: AtmoState, f: Firefly): void {
  void st;
  const loose = asLoose(scene);
  const lamps = (Array.isArray(loose.lanterns) ? loose.lanterns : []).filter(
    (l) => l && l.active !== false,
  );
  if (lamps.length > 0) {
    const lamp = lamps[Math.floor(Math.random() * lamps.length)];
    f.anchorX = lamp.x + (Math.random() * 160 - 80);
    f.anchorY = lamp.y + (Math.random() * 90 - 45);
    return;
  }
  try {
    if (loose.center && loose.iso) {
      const p = loose.iso(loose.center.x, loose.center.y);
      f.anchorX = p.x + (Math.random() * 400 - 200);
      f.anchorY = p.y + (Math.random() * 200 - 100);
      return;
    }
  } catch {
    /* sin centro: ancla en el origen */
  }
  f.anchorX = Math.random() * 400 - 200;
  f.anchorY = Math.random() * 200 - 100;
}

/** Deriva errante: solo mueve x/y (el alpha lo gobierna applyFrame). */
function wanderFirefly(scene: Phaser.Scene, st: AtmoState, f: Firefly): void {
  if (st.dead || !f.img.active) return;
  try {
    scene.tweens.add({
      targets: f.img,
      x: f.anchorX + (Math.random() * 180 - 90),
      y: f.anchorY + (Math.random() * 100 - 50),
      duration: 1400 + Math.random() * 1200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!st.dead && f.img.active) wanderFirefly(scene, st, f);
      },
    });
  } catch {
    /* sin motor de tweens en este tick */
  }
}

function updateClouds(st: AtmoState, sky: SkyState): void {
  for (const c of st.clouds) {
    try {
      if (!c.cloud || c.cloud.active === false) continue;
      if (c.shade) c.shade.setAlpha(Math.max(0, c.shadeBase * (1 - sky.darkness * 0.75)));
      if (sky.isNight) c.cloud.setTint(NIGHT_CLOUD_TINT);
      else if (sky.overlayColor === DAWN_COLOR) c.cloud.setTint(DAWN_CLOUD_TINT);
      else c.cloud.clearTint();
    } catch {
      /* nube destruida: se ignora */
    }
  }
}

/**
 * Frame suave del tween global: parpadeo ±13% desfasado por farol,
 * titileo de estrellas y guiño de luciérnagas. Early-out de día.
 */
function applyFrame(scene: Phaser.Scene): void {
  const st = states.get(scene);
  if (!st || st.dead) return;
  if (st.lanternBase <= 0.02 && st.starBase <= 0.02 && st.nightBase <= 0.02) return;
  const t = st.proxy.t;
  try {
    for (const fx of st.lanterns.values()) {
      if (fx.base <= 0.02) continue;
      const f = Math.sin(t + fx.phase);
      const f2 = Math.sin(t * 1.31 + fx.phase * 1.7);
      fx.halo.setAlpha(fx.base * (0.5 + 0.13 * f));
      fx.pool.setAlpha(fx.base * (0.42 + 0.1 * f2));
      fx.halo.setScale(fx.haloBase * (1 + 0.035 * f));
    }
    for (let i = 0; i < st.starObjs.length; i++) {
      const s = st.starObjs[i];
      const tw = Math.abs(Math.sin(t * 1.6 + st.starPhase[i]));
      s.setAlpha(st.starBase * (0.35 + 0.65 * tw));
    }
    for (const f of st.fireflies) {
      if (!f.img.visible) continue;
      const blink = Math.sin(t * 0.8 + f.phase);
      f.img.setAlpha(st.nightBase * (0.15 + 0.85 * blink * blink));
    }
  } catch {
    /* objetos a medio destruir: el próximo sync los limpia */
  }
}
