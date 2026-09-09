import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import {
  VFX_MAX,
  builtBurst,
  dustBurst,
  harvestSparkle,
  hitFlash,
  recruitRing,
  smokeColumn,
} from '@/game/fx/vfx';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Primitiva simulada con la forma que usa vfx.ts.
function makeObj(x = 0, y = 0): any {
  const o: any = {
    x, y,
    active: true,
    destroyed: false,
    alpha: 1,
    tintFill: null as number | null,
    cleared: 0,
    scene: null as any,
    setDepth() { return o; },
    setScale() { return o; },
    setAlpha(a: number) { o.alpha = a; return o; },
    setRotation() { return o; },
    setBlendMode() { return o; },
    setStrokeStyle() { return o; },
    setTintFill(c: number) { o.tintFill = c; return o; },
    clearTint() { o.tintFill = null; o.cleared++; return o; },
    destroy() { o.active = false; o.destroyed = true; },
  };
  return o;
}

function makeScene() {
  const created: any[] = [];
  const tweenCfgs: any[] = [];
  const delayed: any[] = [];
  const mk = (x: number, y: number) => {
    const o = makeObj(x, y);
    o.scene = scene;
    created.push(o);
    return o;
  };
  const scene: any = {
    textures: { exists: () => true },
    minimap: undefined,
    tweens: {
      add: (cfg: any) => { tweenCfgs.push(cfg); return {}; },
      killTweensOf: () => {},
    },
    time: {
      delayedCall: (_ms: number, fn: () => void) => { delayed.push(fn); return {}; },
    },
    add: {
      circle: (x: number, y: number) => mk(x, y),
      ellipse: (x: number, y: number) => mk(x, y),
      image: (x: number, y: number) => mk(x, y),
      rectangle: (x: number, y: number) => mk(x, y),
    },
  };
  return { scene: scene as Phaser.Scene, created, tweenCfgs, delayed };
}

/** Ejecuta los onComplete de tweens y delayedCalls pendientes. */
function settle(tweenCfgs: any[], delayed: any[]) {
  for (const d of delayed) d();
  // Los onComplete pueden encadenar (no aquí), pero se reintentan en bucle.
  for (let pass = 0; pass < 3; pass++) {
    for (const c of tweenCfgs.splice(0)) c.onComplete?.();
  }
}

describe('vfx: presupuesto y limpieza', () => {
  it('dustBurst crea como mucho tope+1 y todo se destruye', () => {
    const { scene, created, tweenCfgs, delayed } = makeScene();
    dustBurst(scene, 10, 20, { count: 10 });
    expect(created.length).toBeLessThanOrEqual(11);
    settle(tweenCfgs, delayed);
    expect(created.every((c: any) => c.destroyed)).toBe(true);
  });

  it('builtBurst respeta su tope y limpia flashes y chispas', () => {
    const { scene, created, tweenCfgs, delayed } = makeScene();
    builtBurst(scene, 0, 0);
    expect(created.length).toBeLessThanOrEqual(VFX_MAX.built + VFX_MAX.sparkle);
    settle(tweenCfgs, delayed);
    expect(created.every((c: any) => c.destroyed)).toBe(true);
  });

  it('recruitRing / harvestSparkle / smokeColumn acotados y sin fugas', () => {
    for (const fn of [recruitRing, harvestSparkle, smokeColumn]) {
      const { scene, created, tweenCfgs, delayed } = makeScene();
      fn(scene, 5, 5);
      expect(created.length).toBeGreaterThan(0);
      expect(created.length).toBeLessThanOrEqual(6);
      settle(tweenCfgs, delayed);
      expect(created.every((c: any) => c.destroyed)).toBe(true);
    }
  });

  it('ningún tween es infinito (sin repeat -1 colgado)', () => {
    const { scene, tweenCfgs, delayed } = makeScene();
    dustBurst(scene, 0, 0);
    builtBurst(scene, 0, 0);
    recruitRing(scene, 0, 0);
    harvestSparkle(scene, 0, 0);
    smokeColumn(scene, 0, 0);
    void delayed;
    expect(tweenCfgs.length).toBeGreaterThan(0);
    for (const c of tweenCfgs) {
      expect(c.repeat ?? 0).not.toBe(-1);
      expect(Number.isFinite(c.duration)).toBe(true);
    }
  });

  it('sin texturas usa círculos y no rompe', () => {
    const { scene, created, tweenCfgs, delayed } = makeScene();
    (scene as any).textures = { exists: () => false };
    expect(() => {
      dustBurst(scene, 0, 0);
      builtBurst(scene, 0, 0);
      harvestSparkle(scene, 0, 0);
      smokeColumn(scene, 0, 0);
    }).not.toThrow();
    settle(tweenCfgs, delayed);
    expect(created.every((c: any) => c.destroyed)).toBe(true);
  });
});

describe('vfx: hitFlash', () => {
  it('tiñe de blanco un sprite y lo limpia a los 90 ms', () => {
    const { scene, created, tweenCfgs, delayed } = makeScene();
    const target: any = makeObj(100, 200);
    target.scene = scene;
    hitFlash(target as unknown as Parameters<typeof hitFlash>[0]);
    expect(target.tintFill).toBe(0xffffff);
    for (const d of delayed) d();
    expect(target.tintFill).toBeNull();
    for (const c of tweenCfgs.splice(0)) c.onComplete?.();
    expect(created.every((c: any) => c.destroyed)).toBe(true);
  });

  it('vale para contenedores (edificios: sin setTintFill) sin lanzar', () => {
    const { scene, created } = makeScene();
    const container: any = { x: 10, y: 20, scene };
    expect(() => hitFlash(container)).not.toThrow();
    // Solo el destello 'glow', sin tinte.
    expect(created.length).toBe(1);
  });

  it('objetivo nulo o sin escena: no-op silencioso', () => {
    expect(() => hitFlash(null)).not.toThrow();
    expect(() => hitFlash(undefined)).not.toThrow();
    expect(() => hitFlash({ x: 0, y: 0 })).not.toThrow();
  });
});
