import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type Phaser from 'phaser';
import {
  initAtmosphere,
  updateSky,
  registerCloud,
  shutdownAtmosphere,
} from '@/game/fx/atmosphere';
import { DAY_LENGTH_MS, skyAt } from '@/game/systems/daynight';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Dobles mínimos con la forma que usa atmosphere.ts (sin Phaser en runtime).
function makeImage(x = 0, y = 0, tex = 'glow'): any {
  const o: any = {
    x, y, tex,
    alpha: 0, visible: true, active: true, depth: 10, blendMode: 1,
    tint: null as number | null,
    setAlpha(a: number) { o.alpha = a; return o; },
    setVisible(v: boolean) { o.visible = v; return o; },
    setDepth(d: number) { o.depth = d; return o; },
    setScale() { return o; },
    setBlendMode(b: number) { o.blendMode = b; return o; },
    setTint(t: number) { o.tint = t; return o; },
    clearTint() { o.tint = null; return o; },
    destroy() { o.active = false; },
  };
  return o;
}

function makeScene() {
  const created: any[] = [];
  const tweenCfgs: any[] = [];
  const scene: any = {
    lanterns: [] as any[],
    stars: [] as any[],
    textures: { exists: () => true },
    tweens: {
      add: (cfg: any) => { tweenCfgs.push(cfg); return {}; },
      killTweensOf: () => {},
    },
    add: {
      image: (x: number, y: number, tex: string) => {
        const img = makeImage(x, y, tex);
        created.push(img);
        return img;
      },
    },
    minimap: undefined,
    center: { x: 32, y: 32 },
    iso: (tx: number, ty: number) => ({ x: tx - ty, y: tx + ty }),
  };
  return { scene: scene as Phaser.Scene, raw: scene, created, tweenCfgs };
}

const MIDNIGHT = skyAt(DAY_LENGTH_MS * 0.75);
const NOON = skyAt(DAY_LENGTH_MS * 0.25);

beforeEach(() => {
  (globalThis as any).window = {};
});

afterEach(() => {
  delete (globalThis as any).window;
});

describe('atmosphere', () => {
  it('publica window.__sky aunque no haya init (el overlay HTML no se rompe)', () => {
    const { scene } = makeScene();
    updateSky(scene, MIDNIGHT);
    const sky = (globalThis as any).window.__sky;
    expect(sky.color).toBe(MIDNIGHT.overlayColor);
    expect(sky.alpha).toBeCloseTo(MIDNIGHT.overlayAlpha, 6);
    expect(sky.warm).toBe(0);
  });

  it('marca warm=1 con el tinte cálido del amanecer', () => {
    const { scene } = makeScene();
    updateSky(scene, skyAt(0));
    expect((globalThis as any).window.__sky.warm).toBe(1);
  });

  it('de noche crea halo+charco por farol y enciende el núcleo', () => {
    const { scene, raw, created } = makeScene();
    const lamp = makeImage(100, 200);
    raw.lanterns.push(lamp);
    initAtmosphere(scene);
    const fireflies = created.length;
    expect(fireflies).toBeGreaterThan(0);
    updateSky(scene, MIDNIGHT);
    // 2 FX por farol (halo + charco)
    expect(created.length).toBe(fireflies + 2);
    expect(lamp.alpha).toBeGreaterThan(0.8);
    const halo = created[fireflies];
    const pool = created[fireflies + 1];
    expect(halo.visible).toBe(true);
    expect(pool.visible).toBe(true);
    expect(pool.y).toBeGreaterThan(lamp.y);
    expect(pool.depth).toBeLessThan(lamp.depth);
    expect(halo.depth).toBeGreaterThan(lamp.depth);
  });

  it('de día apaga faroles y oculta sus FX (early-out barato)', () => {
    const { scene, raw, created } = makeScene();
    const lamp = makeImage(100, 200);
    raw.lanterns.push(lamp);
    initAtmosphere(scene);
    updateSky(scene, MIDNIGHT);
    updateSky(scene, NOON);
    expect(lamp.alpha).toBe(0);
    for (const img of created) {
      if (img === lamp) continue;
      // luciérnagas y FX ocultos de día
      expect(img.visible).toBe(false);
    }
  });

  it('limpia los FX de faroles destruidos y detecta faroles nuevos', () => {
    const { scene, raw, created } = makeScene();
    const lamp = makeImage(0, 0);
    raw.lanterns.push(lamp);
    initAtmosphere(scene);
    updateSky(scene, MIDNIGHT);
    const n0 = created.length;
    lamp.active = false; // demolición: GameScene destruye el farol
    const lamp2 = makeImage(50, 60);
    raw.lanterns = [lamp2];
    updateSky(scene, MIDNIGHT);
    // halo+charco viejos destruidos, 2 nuevos creados
    expect(created.filter((c: any) => c.active).length).toBeLessThanOrEqual(n0);
    expect(lamp2.alpha).toBeGreaterThan(0.8);
  });

  it('el parpadeo global modula halo y estrellas entre frames', () => {
    const { scene, raw, created, tweenCfgs } = makeScene();
    raw.lanterns.push(makeImage(10, 20));
    raw.stars.push(makeImage(0, 0));
    initAtmosphere(scene);
    updateSky(scene, MIDNIGHT);
    const driver = tweenCfgs.find((c: any) => c.targets && typeof c.targets.t === 'number');
    expect(driver).toBeDefined();
    const halo = created.find((c: any) => c.tex === 'lantern-halo');
    const samples = new Set<number>();
    for (const t of [0, 0.7, 1.4, 2.1, 2.8, 3.5]) {
      driver.targets.t = t;
      driver.onUpdate();
      samples.add(Math.round(halo.alpha * 1e6));
    }
    expect(samples.size).toBeGreaterThan(1);
  });

  it('las nubes registradas se tiñen de noche y se limpian de día', () => {
    const { scene } = makeScene();
    const cloud = makeImage(0, 0, 'cloud');
    const shade = { alpha: 0.1, active: true, setAlpha(a: number) { shade.alpha = a; } };
    initAtmosphere(scene);
    registerCloud(scene, cloud as unknown as Phaser.GameObjects.Image, shade as unknown as Phaser.GameObjects.Shape, 0.1);
    updateSky(scene, MIDNIGHT);
    expect(cloud.tint).toBe(0x9fb4dd);
    expect(shade.alpha).toBeLessThan(0.1);
    updateSky(scene, NOON);
    expect(cloud.tint).toBeNull();
  });

  it('usa glow si faltan las texturas nuevas (integración a medias no rompe)', () => {
    const { scene, raw, created } = makeScene();
    raw.textures = { exists: () => false };
    raw.lanterns.push(makeImage(0, 0));
    initAtmosphere(scene);
    updateSky(scene, MIDNIGHT);
    expect(created.every((c: any) => c.tex === 'glow')).toBe(true);
  });

  it('shutdown destruye FX y deja updateSky inofensivo', () => {
    const { scene, raw } = makeScene();
    raw.lanterns.push(makeImage(0, 0));
    initAtmosphere(scene);
    updateSky(scene, MIDNIGHT);
    shutdownAtmosphere(scene);
    expect(() => updateSky(scene, MIDNIGHT)).not.toThrow();
    expect(() => shutdownAtmosphere(scene)).not.toThrow();
  });
});
