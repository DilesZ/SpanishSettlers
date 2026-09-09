// Clima: chubascos periódicos que venden "mundo vivo" (lluvia + salpicaduras).
//
// API para el integrador (GameScene es el único que la llama):
//   initWeather(scene, iso, { waterCells })  en create(), junto a initWaterFX
//   registerWeatherCloud(scene, cloud)       en setupAmbient(), por nube
//   stopWeather(scene)                       en SHUTDOWN (una vez)
//   isRainForced / nextShowerDelayMs / showerDurationMs  puras y testeables
//
// Qué hace:
// - Programa chubascos cada 3-6 min (el primero a los ~90 s): las nubes
//   registradas se tiñen gris, cae una cortina de lluvia (streaks finos en
//   diagonal, máx. 40 vivos) con anillos de salpicadura en el suelo, y suben
//   ondas extra sobre el agua. Al terminar escampa solo: todo se destruye
//   y las nubes recuperan su tinte.
// - Forzado con `?lluvia=1` en la URL (mismo patrón que `?dia=1`/`?noche=1`/
//   `?demo=`): si está presente, llueve desde el inicio (a los ~1.5 s, para
//   encuadrar capturas). Publica window.__weather = { raining: 0|1 } para QA.
// - Presupuesto estricto: 40 gotas + 24 salpicaduras + 12 ondas de agua.
//   Sin agua (sin waterCells) el tope real es 64 objetos transitorios.
//
// Rendimiento: 1 timer de spawneo (~90 ms) + 1 de ondas (700 ms) + 1 de fin
// de chubasco; las gotas son Rectangles (la primitiva más barata) movidos
// por tweens que se autodestruyen. Sin assets de terceros: todo procedural
// con primitivas de Phaser (sin texturas nuevas en BootScene).
//
// NOTA Phaser: este fichero solo usa `import type` de 'phaser' (sin coste en
// runtime y testeable en vitest/node). APIs verificadas en 3.90:
// add.rectangle (types línea 21437), add.ellipse/add.circle (usados en
// GameScene.setupParticles), setStrokeStyle en Shape (buildTilemap),
// cameras.main.worldView (drawMapFrame), TimerEvent.remove (fx/water.ts).

import type Phaser from 'phaser';

/** Primer chubasco a los ~90 s de partida (salvo `?lluvia=1`: ~1.5 s). */
export const FIRST_SHOWER_DELAY_MS = 90_000;
/** Pausa entre chubascos: 3-6 min. */
export const MIN_SHOWER_GAP_MS = 180_000;
export const MAX_SHOWER_GAP_MS = 360_000;
/** Duración de cada chubasco: 25-45 s. */
export const MIN_SHOWER_DURATION_MS = 25_000;
export const MAX_SHOWER_DURATION_MS = 45_000;
/** Gotas de lluvia vivas a la vez (cortina). */
export const MAX_RAIN_DROPS = 90;
/** Anillos de salpicadura vivos a la vez. */
export const MAX_RAIN_SPLASHES = 24;
/** Ondas extra sobre el agua vivas a la vez. */
export const MAX_RAIN_RIPPLES = 12;
/** Tinte gris de tormenta para las nubes registradas. */
export const RAIN_CLOUD_TINT = 0x8f9bb0;

export const RAIN_DROP_DEPTH = 9450;
export const RAIN_SPLASH_DEPTH = 60;
export const RAIN_RIPPLE_DEPTH = 53;

const SPAWNER_DELAY_MS = 90;
const RIPPLE_DELAY_MS = 700;
/** Re-afirmar el tinte gris cada N ticks del spawner (~2 s): skyTick de
 *  atmosphere.ts retoca las nubes cada 1 s y si no, nos pisaría el gris. */
const TINT_REASSERT_EVERY = 22;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * ¿Lluvia forzada? Patrón existente del juego (`?dia=1`, `?noche=1`).
 * Pura: `isRainForced('?dia=1&lluvia=1') === true`.
 */
export function isRainForced(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    const q = search.startsWith('?') ? search.slice(1) : search;
    return new URLSearchParams(q).get('lluvia') === '1';
  } catch {
    return false;
  }
}

/**
 * Pausa hasta el próximo chubasco (ms). Pura e inyectable (`rng`) para tests.
 * El primero es fijo (~90 s); los siguientes, uniforme en [3, 6] min.
 */
export function nextShowerDelayMs(first: boolean, rng: () => number = Math.random): number {
  if (first) return FIRST_SHOWER_DELAY_MS;
  const r = clamp01(rng());
  return Math.round(MIN_SHOWER_GAP_MS + r * (MAX_SHOWER_GAP_MS - MIN_SHOWER_GAP_MS));
}

/** Duración de un chubasco (ms), uniforme en [25, 45] s. Pura y testeable. */
export function showerDurationMs(rng: () => number = Math.random): number {
  const r = clamp01(rng());
  return Math.round(MIN_SHOWER_DURATION_MS + r * (MAX_SHOWER_DURATION_MS - MIN_SHOWER_DURATION_MS));
}

export type IsoProjector = (tx: number, ty: number) => { x: number; y: number };

export interface WeatherCell {
  x: number;
  y: number;
}

export interface WeatherOptions {
  /** Celdas de agua para las ondas extra (las de GameScene.waterCells). */
  waterCells?: readonly WeatherCell[];
  /** Sobrescribe el retardo del primer chubasco (QA/tests manuales). */
  firstDelayMs?: number;
}

export interface Weather {
  /** True mientras llueve. */
  readonly raining: boolean;
  /** True tras stop(). */
  readonly stopped: boolean;
  /** Detiene timers y destruye lo creado. Idempotente. */
  stop: () => void;
}

interface WeatherState {
  dead: boolean;
  raining: boolean;
  iso: IsoProjector;
  waterCells: readonly WeatherCell[];
  clouds: Phaser.GameObjects.Image[];
  tinted: Phaser.GameObjects.Image[];
  live: Phaser.GameObjects.GameObject[];
  timers: Phaser.Time.TimerEvent[];
  drops: number;
  splashes: number;
  ripples: number;
  spawnerTick: number;
}

const states = new WeakMap<Phaser.Scene, WeatherState>();

type LooseScene = Phaser.Scene & {
  minimap?: { ignore: (objs: Phaser.GameObjects.GameObject[]) => void };
};

function ignoreOnMinimap(scene: Phaser.Scene, objs: Phaser.GameObjects.GameObject[]): void {
  try {
    (scene as LooseScene).minimap?.ignore(objs);
  } catch {
    /* sin minimapa: nada que hacer */
  }
}

function readForced(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return isRainForced(window.location.search);
  } catch {
    return false;
  }
}

function publish(st: WeatherState): void {
  try {
    if (typeof window === 'undefined') return;
    (window as unknown as { __weather?: { raining: number } }).__weather = {
      raining: st.raining ? 1 : 0,
    };
  } catch {
    /* SSR o sin window: QA simplemente no lo lee */
  }
}

/**
 * Inicializa el clima. Llamar UNA vez en create(), junto a initWaterFX
 * (necesita `waterCells` ya relleno por buildTilemap). Re-inicio seguro:
 * si ya había clima en esta escena, lo detiene primero.
 */
export function initWeather(
  scene: Phaser.Scene,
  iso: IsoProjector,
  opts: WeatherOptions = {},
): Weather {
  const preClouds = states.get(scene)?.clouds ?? [];
  stopWeather(scene);
  const forced = readForced();
  const st: WeatherState = {
    dead: false,
    raining: false,
    iso,
    waterCells: opts.waterCells ?? [],
    // Conservar nubes registradas antes de init (el integrador puede
    // registrar en setupAmbient, que corre antes que este init).
    clouds: [...preClouds],
    tinted: [],
    live: [],
    timers: [],
    drops: 0,
    splashes: 0,
    ripples: 0,
    spawnerTick: 0,
  };
  states.set(scene, st);
  publish(st);
  const firstDelay = forced ? 1500 : (opts.firstDelayMs ?? nextShowerDelayMs(true));
  later(scene, st, firstDelay, () => startShower(scene, st));
  return handleOf(scene);
}

/** Registra una nube para el tinte gris de tormenta (ver setupAmbient). */
export function registerWeatherCloud(scene: Phaser.Scene, cloud: Phaser.GameObjects.Image): void {
  let st = states.get(scene);
  if (!st) {
    // Registro previo a init (setupAmbient corre antes que create() llame a
    // initWeather si el integrador ordena distinto): estado mínimo que
    // initWeather conservará al re-inicializar.
    st = {
      dead: false,
      raining: false,
      iso: (tx, ty) => ({ x: tx - ty, y: tx + ty }),
      waterCells: [],
      clouds: [],
      tinted: [],
      live: [],
      timers: [],
      drops: 0,
      splashes: 0,
      ripples: 0,
      spawnerTick: 0,
    };
    states.set(scene, st);
  }
  if (!st.clouds.includes(cloud)) st.clouds.push(cloud);
  // Si ya llueve (lluvia forzada + nube tardía), teñir al momento.
  if (st.raining) {
    try {
      cloud.setTint(RAIN_CLOUD_TINT);
      if (!st.tinted.includes(cloud)) st.tinted.push(cloud);
    } catch {
      /* nube a medio destruir */
    }
  }
}

/** Detiene el clima y destruye todo lo suyo. Idempotente (para SHUTDOWN). */
export function stopWeather(scene: Phaser.Scene): void {
  const st = states.get(scene);
  if (!st) return;
  st.dead = true;
  st.raining = false;
  for (const t of st.timers) {
    try {
      t.remove(false);
    } catch {
      /* reloj ya destruido */
    }
  }
  st.timers.length = 0;
  destroyLive(scene, st);
  clearTints(st);
  states.delete(scene);
  publish(st);
}

// ---------- internas ----------

function handleOf(scene: Phaser.Scene): Weather {
  return {
    get raining() {
      return states.get(scene)?.raining ?? false;
    },
    get stopped() {
      return !states.get(scene);
    },
    stop: () => stopWeather(scene),
  };
}

function later(scene: Phaser.Scene, st: WeatherState, delay: number, fn: () => void): void {
  try {
    const t = scene.time.delayedCall(Math.max(0, Math.round(delay)), () => {
      if (st.dead) return;
      fn();
    });
    st.timers.push(t);
  } catch {
    /* sin reloj en este tick */
  }
}

function startShower(scene: Phaser.Scene, st: WeatherState): void {
  if (st.dead || st.raining) return;
  st.raining = true;
  st.spawnerTick = 0;
  tintClouds(scene, st);
  publish(st);
  try {
    st.timers.push(
      scene.time.addEvent({
        delay: SPAWNER_DELAY_MS,
        loop: true,
        callback: () => spawnTick(scene, st),
      }),
    );
    if (st.waterCells.length > 0) {
      st.timers.push(
        scene.time.addEvent({
          delay: RIPPLE_DELAY_MS,
          loop: true,
          callback: () => rippleTick(scene, st),
        }),
      );
    }
  } catch {
    /* sin reloj: el chubasco queda solo visual-estático hasta escampar */
  }
  later(scene, st, showerDurationMs(), () => endShower(scene, st, false));
}

/** Fin del chubasco: destruye TODO (gotas, salpicaduras, ondas) y reprograma. */
function endShower(scene: Phaser.Scene, st: WeatherState, _forced: boolean): void {
  if (st.dead || !st.raining) return;
  st.raining = false;
  for (const t of st.timers) {
    try {
      t.remove(false);
    } catch {
      /* ya fuera */
    }
  }
  st.timers.length = 0;
  destroyLive(scene, st);
  clearTints(st);
  publish(st);
  if (!st.dead) later(scene, st, nextShowerDelayMs(false), () => startShower(scene, st));
}

function destroyLive(scene: Phaser.Scene, st: WeatherState): void {
  for (const o of st.live) {
    try {
      scene.tweens.killTweensOf(o);
    } catch {
      /* sin tweens */
    }
    try {
      o.destroy();
    } catch {
      /* ya destruido */
    }
  }
  st.live.length = 0;
  st.drops = 0;
  st.splashes = 0;
  st.ripples = 0;
}

function knownClouds(scene: Phaser.Scene, st: WeatherState): Phaser.GameObjects.Image[] {
  const out = st.clouds.filter((c) => {
    try {
      return !!c && c.active !== false;
    } catch {
      return false;
    }
  });
  if (out.length > 0) return out;
  // Fallback: auto-descubrir nubes por textura (integración sin registros).
  try {
    const list = scene.children?.list ?? [];
    for (const o of list) {
      const tex = (o as unknown as { texture?: { key?: unknown } }).texture?.key;
      if (tex !== 'cloud') continue;
      const img = o as unknown as Phaser.GameObjects.Image;
      try {
        if (img && img.active !== false && typeof img.setTint === 'function') out.push(img);
      } catch {
        /* objeto raro: se ignora */
      }
      if (out.length >= 12) break;
    }
  } catch {
    /* sin display list accesible */
  }
  return out;
}

function tintClouds(scene: Phaser.Scene, st: WeatherState): void {
  for (const c of knownClouds(scene, st)) {
    try {
      c.setTint(RAIN_CLOUD_TINT);
      if (!st.tinted.includes(c)) st.tinted.push(c);
    } catch {
      /* nube a medio destruir */
    }
  }
}

function clearTints(st: WeatherState): void {
  for (const c of st.tinted) {
    try {
      c.clearTint();
    } catch {
      /* ya destruida */
    }
  }
  st.tinted.length = 0;
}

function viewOf(scene: Phaser.Scene): { x: number; y: number; width: number; height: number } {
  try {
    const wv = scene.cameras.main.worldView;
    if (wv && Number.isFinite(wv.width) && wv.width > 0) {
      return { x: wv.x, y: wv.y, width: wv.width, height: wv.height };
    }
  } catch {
    /* sin cámara: fallback */
  }
  return { x: -800, y: -600, width: 1600, height: 1200 };
}

function track(st: WeatherState, o: Phaser.GameObjects.GameObject): void {
  st.live.push(o);
}

function untrackDestroy(scene: Phaser.Scene, st: WeatherState, o: Phaser.GameObjects.GameObject): void {
  const i = st.live.indexOf(o);
  if (i >= 0) st.live.splice(i, 1);
  try {
    o.destroy();
  } catch {
    /* ya destruido */
  }
}

function spawnTick(scene: Phaser.Scene, st: WeatherState): void {
  if (st.dead || !st.raining) return;
  st.spawnerTick++;
  if (st.spawnerTick % TINT_REASSERT_EVERY === 0) tintClouds(scene, st);
  if (st.drops >= MAX_RAIN_DROPS) return;
  // 3-5 gotas por tick (~45/s a 60fps): cortina legible sin pasar el tope.
  const n = Math.min(3 + (Math.random() > 0.4 ? 2 : 0), MAX_RAIN_DROPS - st.drops);
  for (let k = 0; k < n; k++) spawnDrop(scene, st);
}

function spawnDrop(scene: Phaser.Scene, st: WeatherState): void {
  const v = viewOf(scene);
  const x = v.x + Math.random() * v.width;
  const y = v.y - 20 + Math.random() * v.height * 0.25;
  let drop: Phaser.GameObjects.Rectangle;
  try {
    drop = scene.add.rectangle(x, y, 2.6, 15, 0xcfe2f7, 0.75);
  } catch {
    return;
  }
  try {
    drop.setDepth(RAIN_DROP_DEPTH);
    drop.setRotation(0.16); // caída en diagonal
  } catch {
    /* primitiva mínima viable */
  }
  ignoreOnMinimap(scene, [drop]);
  track(st, drop);
  st.drops++;
  const fall = 300 + Math.random() * 90;
  try {
    scene.tweens.add({
      targets: drop,
      y: y + fall,
      duration: 480 + Math.random() * 260,
      onComplete: () => {
        st.drops = Math.max(0, st.drops - 1);
        const lx = drop.x + 50; // deriva por la inclinación
        const ly = drop.y;
        untrackDestroy(scene, st, drop);
        spawnSplash(scene, st, lx, ly);
      },
    });
  } catch {
    st.drops = Math.max(0, st.drops - 1);
    untrackDestroy(scene, st, drop);
  }
}

function spawnSplash(scene: Phaser.Scene, st: WeatherState, x: number, y: number): void {
  if (st.dead || !st.raining || st.splashes >= MAX_RAIN_SPLASHES) return;
  let ring: Phaser.GameObjects.Ellipse;
  try {
    ring = scene.add.ellipse(x, y, 8, 3.5, 0xffffff, 0);
    ring.setStrokeStyle(1.6, 0xe2f0fb, 0.75);
    ring.setDepth(RAIN_SPLASH_DEPTH);
  } catch {
    return;
  }
  ignoreOnMinimap(scene, [ring]);
  track(st, ring);
  st.splashes++;
  try {
    scene.tweens.add({
      targets: ring,
      scaleX: 2.4,
      scaleY: 1.8,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        st.splashes = Math.max(0, st.splashes - 1);
        untrackDestroy(scene, st, ring);
      },
    });
  } catch {
    st.splashes = Math.max(0, st.splashes - 1);
    untrackDestroy(scene, st, ring);
  }
}

/**
 * Ondas extra sobre el agua durante el chubasco. NO toca water.ts (ese
 * módulo no expone ningún generador de ondas reutilizable): son elipses
 * propias, acotadas y destruidas al escampar.
 */
function rippleTick(scene: Phaser.Scene, st: WeatherState): void {
  if (st.dead || !st.raining || st.ripples >= MAX_RAIN_RIPPLES) return;
  if (st.waterCells.length === 0) return;
  const cell = st.waterCells[Math.floor(Math.random() * st.waterCells.length)];
  if (!cell) return;
  let p: { x: number; y: number };
  try {
    p = st.iso(cell.x, cell.y);
  } catch {
    return;
  }
  let ripple: Phaser.GameObjects.Ellipse;
  try {
    ripple = scene.add.ellipse(
      p.x + (Math.random() - 0.5) * 56,
      p.y + (Math.random() - 0.5) * 22,
      8 + Math.random() * 6,
      3 + Math.random() * 2,
      0xffffff,
      0.4,
    );
    ripple.setDepth(RAIN_RIPPLE_DEPTH);
  } catch {
    return;
  }
  ignoreOnMinimap(scene, [ripple]);
  track(st, ripple);
  st.ripples++;
  try {
    scene.tweens.add({
      targets: ripple,
      alpha: 0,
      scaleX: 2,
      scaleY: 1.6,
      duration: 950,
      ease: 'Sine.easeOut',
      onComplete: () => {
        st.ripples = Math.max(0, st.ripples - 1);
        untrackDestroy(scene, st, ripple);
      },
    });
  } catch {
    st.ripples = Math.max(0, st.ripples - 1);
    untrackDestroy(scene, st, ripple);
  }
}
