// FX de agua para el mapa isométrico (Phaser 3.90).
// Obra original: destellos y ondas procedurales con primitivas de Phaser,
// sin parpadeo de tiles. La animación la mueven tweens + un temporizador;
// updateWaterFX existe como gancho estable pero no requiere trabajo por
// fotograma.
//
// Presupuesto: NUNCA más de ~30 objetos vivos creados por este módulo
// (destellos persistentes + ondas transitorias con vida limitada).
// Capas: espuma 50 > suelo 0, destellos 51, ondas 52; todo por debajo de
// caminos (90) y decoración (100+). Ver GameScene.buildTilemap/placeFoam.
import type Phaser from 'phaser';

/** El parpadeo legado (animateWater: gid 6 <-> 7) queda DESACTIVADO. */
export const LEGACY_WATER_BLINK_ENABLED = false;

/** Tope total de objetos vivos de este módulo. */
export const MAX_WATER_FX = 30;

/** Profundidades reservadas por los FX de agua. */
export const WATER_FX_DEPTHS = { foam: 50, sparkle: 51, ripple: 52 } as const;

export interface WaterCell {
  x: number;
  y: number;
}

export type IsoProjector = (tx: number, ty: number) => { x: number; y: number };

export interface WaterFXOptions {
  /** Presupuesto total (persistentes + transitorias). Por defecto 30. */
  maxSparkles?: number;
  /** Profundidad de los destellos. Por defecto 51. */
  sparkleDepth?: number;
  /** Profundidad de las ondas. Por defecto 52. */
  rippleDepth?: number;
  /** Semilla del muestreo determinista. Por defecto 1234. */
  seed?: number;
  /** Intervalo del generador de ondas (ms). Por defecto 1100. */
  rippleIntervalMs?: number;
}

export interface WaterFX {
  /** Objetos persistentes vivos (destellos). */
  readonly persistent: number;
  /** Ondas transitorias vivas ahora mismo. */
  readonly transient: number;
  /** Presupuesto total configurado. */
  readonly budget: number;
  /** Detiene el temporizador y destruye lo creado. Idempotente. */
  stop: () => void;
  /** True tras stop(). */
  readonly stopped: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isWaterKey(t: string): boolean {
  return t === 'water' || t === 'waterB' || t === 'waterC';
}

/**
 * Muestreo determinista de celdas para destellos: baraja con seed y corta
 * a `max`. Puro y testeable (sin Phaser ni Math.random).
 */
export function pickSparkleCells(cells: readonly WaterCell[], max: number, seed = 1234): WaterCell[] {
  if (max <= 0 || cells.length === 0) return [];
  const rnd = mulberry32(seed);
  const idx = cells.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(max, idx.length)).map((i) => cells[i]);
}

type SceneLike = Phaser.Scene;

export function initWaterFX(
  scene: SceneLike,
  waterCells: readonly WaterCell[],
  iso: IsoProjector,
  opts: WaterFXOptions = {},
): WaterFX {
  const budget = Math.min(opts.maxSparkles ?? MAX_WATER_FX, MAX_WATER_FX);
  const sparkleDepth = opts.sparkleDepth ?? WATER_FX_DEPTHS.sparkle;
  const rippleDepth = opts.rippleDepth ?? WATER_FX_DEPTHS.ripple;
  const seed = opts.seed ?? 1234;
  const interval = opts.rippleIntervalMs ?? 1100;

  const created: Phaser.GameObjects.GameObject[] = [];
  let transient = 0;
  let stopped = false;
  const rnd = mulberry32(seed ^ 0x9e3779b9);

  // Destellos persistentes: como máximo la mitad del presupuesto, para
  // dejar sitio a las ondas transitorias sin superar nunca el tope.
  const persistentBudget = Math.min(waterCells.length, Math.max(0, Math.floor(budget / 2)));
  const chosen = pickSparkleCells(waterCells, persistentBudget, seed);

  for (const cell of chosen) {
    if (stopped) break;
    const p = iso(cell.x, cell.y);
    const jx = (rnd() - 0.5) * 60;
    const jy = (rnd() - 0.5) * 24;
    const w = 3 + rnd() * 5;
    const h = 1.6 + rnd() * 1.8;
    const glint = scene.add.ellipse(p.x + jx, p.y + jy, w, h, 0xeaf4ff, 0);
    glint.setDepth(sparkleDepth);
    created.push(glint);
    scene.tweens.add({
      targets: glint,
      alpha: 0.55 + rnd() * 0.3,
      duration: 700 + rnd() * 1100,
      delay: rnd() * 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  const transientBudget = Math.max(0, budget - created.length);
  const timer =
    waterCells.length > 0 && transientBudget > 0
      ? scene.time.addEvent({
          delay: interval,
          loop: true,
          callback: () => {
            if (stopped) return;
            if (transient >= transientBudget) return;
            // 1-2 ondas por pulso, sin pasar el presupuesto.
            const n = 1 + (rnd() > 0.6 ? 1 : 0);
            for (let k = 0; k < n; k++) {
              if (transient >= transientBudget) break;
              const cell = waterCells[Math.floor(rnd() * waterCells.length)];
              if (!cell) break;
              const p = iso(cell.x, cell.y);
              const ripple = scene.add.ellipse(
                p.x + (rnd() - 0.5) * 56,
                p.y + (rnd() - 0.5) * 22,
                6 + rnd() * 6,
                2.5 + rnd() * 2,
                0xffffff,
                0.4,
              );
              ripple.setDepth(rippleDepth);
              transient++;
              const life = 1200 + rnd() * 700;
              scene.tweens.add({
                targets: ripple,
                alpha: 0,
                scaleX: 2,
                scaleY: 1.6,
                duration: life,
                ease: 'Sine.easeOut',
                onComplete: () => {
                  transient = Math.max(0, transient - 1);
                  ripple.destroy();
                },
              });
            }
          },
        })
      : undefined;

  return {
    get persistent() {
      return created.length;
    },
    get transient() {
      return transient;
    },
    budget,
    get stopped() {
      return stopped;
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      timer?.remove(false);
      for (const o of created) {
        try {
          scene.tweens.killTweensOf(o);
        } catch {
          /* noop */
        }
        o.destroy();
      }
      created.length = 0;
    },
  };
}

/**
 * Gancho por fotograma. La animación es tween-driven y no necesita trabajo
 * aquí; se mantiene para que el integrador tenga un punto estable si en el
 * futuro se añaden ondas atadas a cámara/tiempo. No-op intencionado.
 */
export function updateWaterFX(_fx: WaterFX | null | undefined, _dtMs?: number): void {
  // noop: los tweens y el temporizador de initWaterFX hacen el trabajo.
}
