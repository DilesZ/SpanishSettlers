// PostFX fílmico barato (docs/devlog/029-postfx.md).
//
// API para el integrador (GameScene es el único que la llama):
//   initCameraGrade(scene, { night })  en create(), SOLO sobre cameras.main
//   setNightGrade(scene, on)           en skyTick(), si initCameraGrade aplicó
//   attachBuildingShadow(container,w,h) en tryPlace(), SUSTITUYENDO la sombra
//   selectGlow(scene, x, y)            en showSelectRing(), junto al anillo
//   discardSelectGlow(scene, img)      en hideSelectRing(), con el anillo
//   glowGhost(scene, ghost, ok)        en updateGhost(), tras setTint
//   shutdownPostFx(scene)              (opcional) al resetear la escena
//
// Qué hace:
// - Gradación cálida global vía camera.postFX.addColorMatrix (WebGL): saturar
//   ~1.08 + contraste ~1.04 + lift cálido. En Canvas: no-op silencioso (la
//   viñeta y el tinte día/noche ya viven en CSS/GameCanvas).
// - Sombras direccionales: elipse 'soft-shadow' desplazada al sureste (luz
//   del noroeste), alpha 0.35, insertada la primera del container.
// - Glow: halo 'lantern-halo' pulsante para la selección (Graphics no admite
//   postFX) + postFX.addGlow en el fantasma (Image sí lo admite).
//
// Rendimiento: 1 pass de ColorMatrix en cámara (solo WebGL), 1 tween por halo
// (anillo/fantasma: 1 instancia viva cada uno), 0 allocations por frame, 0
// update loops. Sin assets de terceros: solo texturas de BootScene.
//
// NOTA Phaser: este fichero solo usa `import type` de 'phaser' (sin coste en
// runtime y testeable en vitest/node). El blend ADD es el número 1
// (estable desde 3.0.0; mismo patrón que fx/atmosphere.ts).

import type Phaser from 'phaser';

/** Valor numérico de Phaser.WEBGL (verificado en node_modules/phaser/src/const.js). */
export const WEBGL_RENDERER_TYPE = 2;

/** Saturación diurna: x = v*2/3+1 => 0.12 => ~1.08 (ver display/ColorMatrix.js). */
export const DAY_SATURATE = 0.12;
/** Contraste diurno: v = value+1 => 0.04 => ~1.04. */
export const DAY_CONTRAST = 0.04;

/** Alpha de la sombra direccional bajo edificios. */
export const BUILDING_SHADOW_ALPHA = 0.35;
/** Lado (px) de la textura cuadrada 'soft-shadow' de BootScene. */
export const SOFT_SHADOW_SIZE = 64;

/** Profundidad del halo de selección: justo bajo el anillo (9490 en GameScene). */
export const SELECT_GLOW_DEPTH = 9489;

/** Clave de datos del fantasma donde se guarda el controlador glow. */
export const GHOST_GLOW_DATA_KEY = 'postfx:glow';

/** Escala base del halo de selección según la textura resuelta. */
export const SELECT_GLOW_SCALE: Record<string, { x: number; y: number }> = {
  'lantern-halo': { x: 1.15, y: 0.6 },
  glow: { x: 2.6, y: 1.3 },
};

/** Descriptor puro de la gradación (testeable sin Phaser). */
export interface GradePlan {
  saturate: number;
  contrast: number;
  /** Lift cálido/frío por canal, en escala 0-255 del shader ColorMatrix. */
  liftR: number;
  liftG: number;
  liftB: number;
}

/** Interfaz mínima del controlador ColorMatrix (evita depender del .d.ts exacto). */
export interface ColorMatrixLike {
  saturate(value?: number, multiply?: boolean): unknown;
  contrast(value?: number, multiply?: boolean): unknown;
  multiply(matrix: number[], multiply?: boolean): unknown;
  reset(): unknown;
}

/** Geometría pura de la sombra direccional (testeable sin Phaser). */
export interface ShadowLayout {
  /** Desplazamiento este (+) desde el centro: la luz viene del noroeste. */
  dx: number;
  /** Desplazamiento sur (+) desde la base. */
  dy: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}

interface GradeState {
  grade: ColorMatrixLike;
  night: boolean;
}

const gradeStates = new WeakMap<Phaser.Scene, GradeState>();

/** Predicado puro: ¿es el tipo numérico de renderer el WebGL de Phaser? */
export function isWebGLType(t: unknown): boolean {
  return t === WEBGL_RENDERER_TYPE;
}

/** ¿Renderiza esta escena con WebGL? false en Canvas/headless/mocks: no-op. */
export function isWebGLScene(scene: Phaser.Scene): boolean {
  try {
    const renderer = (scene as Phaser.Scene & { game?: { renderer?: { type?: unknown } } })
      .game?.renderer;
    return isWebGLType(renderer?.type);
  } catch {
    return false;
  }
}

/** Elige textura existente con fallback (nunca lanza). */
export function pickFxTexture(
  exists: (key: string) => boolean,
  primary: string,
  fallback = 'glow',
): string {
  try {
    if (exists(primary)) return primary;
  } catch {
    /* sin catálogo: fallback */
  }
  return fallback;
}

function pickSceneTexture(scene: Phaser.Scene, primary: string, fallback: string): string {
  try {
    return pickFxTexture((k) => scene.textures.exists(k), primary, fallback);
  } catch {
    return fallback;
  }
}

/** Plan de gradación puro: día cálido sutil / noche azulada contenida. */
export function gradePlan(night: boolean): GradePlan {
  return night
    ? { saturate: -0.12, contrast: 0.02, liftR: -4, liftG: 0, liftB: 7 }
    : { saturate: DAY_SATURATE, contrast: DAY_CONTRAST, liftR: 5, liftG: 2.5, liftB: -1 };
}

/**
 * Aplica un plan al controlador (reset + saturar + contraste + lift).
 * Barato: solo actualiza uniforms, sin reallocs. No lanza.
 */
export function applyGradeMatrix(cm: ColorMatrixLike, night: boolean): void {
  try {
    const p = gradePlan(night);
    cm.reset();
    cm.saturate(p.saturate);
    cm.contrast(p.contrast, true);
    cm.multiply(
      [1, 0, 0, 0, p.liftR, 0, 1, 0, 0, p.liftG, 0, 0, 1, 0, p.liftB, 0, 0, 0, 1, 0],
      true,
    );
  } catch {
    /* gradación opcional: nunca debe romper create() */
  }
}

/** Geometría pura de la sombra: elipse al sureste, más ancha que alta. */
export function shadowLayout(w: unknown, h: unknown): ShadowLayout {
  const W = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 96;
  const H = typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : 64;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    dx: r3(W * 0.14),
    dy: r3(H * 0.05),
    scaleX: r3((W * 1.3) / SOFT_SHADOW_SIZE),
    scaleY: r3((W * 0.52) / SOFT_SHADOW_SIZE),
    alpha: BUILDING_SHADOW_ALPHA,
  };
}

/**
 * Gradación global en la cámara principal. Idempotente.
 * Solo WebGL + camera.postFX real (verificado en la 3.90 instalada):
 * en Canvas devuelve false sin tocar nada.
 */
export function initCameraGrade(scene: Phaser.Scene, opts: { night?: boolean } = {}): boolean {
  try {
    if (!isWebGLScene(scene)) return false;
    const cam = scene.cameras?.main;
    if (!cam) return false;
    const prev = gradeStates.get(scene);
    if (prev?.grade) {
      setNightGrade(scene, opts.night ?? prev.night);
      return true;
    }
    const fx = (cam as unknown as {
      postFX?: { addColorMatrix?: () => ColorMatrixLike } | null;
    }).postFX;
    if (typeof fx?.addColorMatrix !== 'function') return false;
    const grade = fx.addColorMatrix();
    if (!grade || typeof grade.saturate !== 'function') return false;
    const night = opts.night ?? false;
    applyGradeMatrix(grade, night);
    gradeStates.set(scene, { grade, night });
    return true;
  } catch {
    return false;
  }
}

/**
 * Refuerzo azulado nocturno (o vuelta al día). Solo si initCameraGrade aplicó;
 * si no, no-op que devuelve false. Reutiliza el controlador: sin reallocs.
 */
export function setNightGrade(scene: Phaser.Scene, on: boolean): boolean {
  try {
    const st = gradeStates.get(scene);
    if (!st?.grade) return false;
    if (st.night === on) return true;
    applyGradeMatrix(st.grade, on);
    st.night = on;
    return true;
  } catch {
    return false;
  }
}

/**
 * Sombra elíptica suave al sureste para un container de edificio.
 * El INTEGRADOR debe SUSTITUIR (no complementar) la sombra centrada actual
 * de tryPlace (`parts.push(this.add.image(0, -2, 'shadow')...)`): sumar ambas
 * duplicaría la oscuridad (0.75 + 0.35). Devuelve la imagen o null.
 */
export function attachBuildingShadow(
  container: Phaser.GameObjects.Container,
  w: number,
  h: number,
): Phaser.GameObjects.Image | null {
  try {
    const scene = container.scene;
    const tex = pickSceneTexture(scene, 'soft-shadow', 'shadow');
    const lay = shadowLayout(w, h);
    const img = scene.add.image(lay.dx, lay.dy, tex);
    img.setAlpha(lay.alpha);
    img.setScale(lay.scaleX, lay.scaleY);
    // addAt verificado en Container (types/phaser.d.ts): índice 0 = detrás.
    container.addAt(img, 0);
    return img;
  } catch {
    return null;
  }
}

function markAdditive(img: Phaser.GameObjects.Image): void {
  try {
    // ADD = 1 en Phaser 3.x (mismo patrón que fx/atmosphere.ts).
    img.setBlendMode(1);
  } catch {
    /* sin blend: se sigue viendo, solo menos "luz" */
  }
}

/**
 * Halo pulsante para el anillo de selección. Graphics (el anillo) NO admite
 * postFX (solo Image/Sprite/Text/...), así que el glow es un sprite
 * 'lantern-halo' (fallback 'glow'). Un solo tween; 0 trabajo por frame.
 * El llamador lo destruye con discardSelectGlow. Devuelve la imagen o null.
 */
export function selectGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { depth?: number; scale?: number } = {},
): Phaser.GameObjects.Image | null {
  try {
    const tex = pickSceneTexture(scene, 'lantern-halo', 'glow');
    const base = SELECT_GLOW_SCALE[tex] ?? SELECT_GLOW_SCALE.glow;
    const k = typeof opts.scale === 'number' && Number.isFinite(opts.scale) && opts.scale > 0
      ? opts.scale
      : 1;
    const sx = base.x * k;
    const sy = base.y * k;
    const img = scene.add.image(x, y, tex);
    img.setDepth(opts.depth ?? SELECT_GLOW_DEPTH);
    img.setScale(sx, sy);
    img.setAlpha(0.5);
    markAdditive(img);
    scene.tweens.add({
      targets: img,
      alpha: 0.26,
      scaleX: sx * 1.07,
      scaleY: sy * 1.07,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return img;
  } catch {
    return null;
  }
}

/** Mata el tween del halo y lo destruye. Idempotente, null-safe. */
export function discardSelectGlow(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image | null | undefined,
): void {
  if (!img) return;
  try {
    scene.tweens.killTweensOf(img);
  } catch {
    /* sin motor de tweens */
  }
  try {
    img.destroy();
  } catch {
    /* ya destruido por la escena */
  }
}

/**
 * Glow del fantasma de construcción. El fantasma es un Image: admite
 * postFX.addGlow en WebGL. En Canvas es no-op (el setTint verde/rojo de
 * updateGhost ya comunica validez). Solo actúa cuando `ok` cambia, así que
 * llamarlo en cada pointermove no cuesta nada. No lanza.
 */
export function glowGhost(
  scene: Phaser.Scene,
  ghost: Phaser.GameObjects.Image | null | undefined,
  ok: boolean,
): void {
  try {
    if (!ghost || (ghost as Phaser.GameObjects.Image).active === false) return;
    if (!isWebGLScene(scene)) return;
    const fx = (ghost as unknown as {
      postFX?: {
        addGlow?: (color?: number, outerStrength?: number, innerStrength?: number) => unknown;
        remove?: (ctl: unknown) => unknown;
      } | null;
    }).postFX;
    if (!fx || typeof fx.addGlow !== 'function') return;
    const prev = (
      ghost as Phaser.GameObjects.Image & { getData?: (k: string) => unknown }
    ).getData?.(GHOST_GLOW_DATA_KEY) as { ok: boolean; ctl: unknown } | undefined;
    if (prev && prev.ok === ok && prev.ctl) return;
    if (prev?.ctl && typeof fx.remove === 'function') {
      try {
        fx.remove(prev.ctl);
      } catch {
        /* controlador huérfano */
      }
    }
    const ctl = fx.addGlow(ok ? 0x88ff88 : 0xff6666, 3, 0);
    try {
      (ghost as Phaser.GameObjects.Image & { setData?: (k: string, v: unknown) => void })
        .setData?.(GHOST_GLOW_DATA_KEY, { ok, ctl });
    } catch {
      /* sin DataManager: el glow queda fijo hasta el próximo cambio */
    }
  } catch {
    /* FX opcional: nunca rompe el input */
  }
}

/** Limpia la gradación de cámara. Idempotente. */
export function shutdownPostFx(scene: Phaser.Scene): void {
  gradeStates.delete(scene);
  try {
    // resetPostPipeline verificado en el mixin PostPipeline (cámara lo mezcla).
    scene.cameras?.main?.resetPostPipeline(true);
  } catch {
    /* cámara ya destruida */
  }
}
