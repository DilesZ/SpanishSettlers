import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import {
  BUILDING_SHADOW_ALPHA,
  SELECT_GLOW_DEPTH,
  WEBGL_RENDERER_TYPE,
  applyGradeMatrix,
  attachBuildingShadow,
  discardSelectGlow,
  glowGhost,
  gradePlan,
  initCameraGrade,
  isWebGLScene,
  isWebGLType,
  pickFxTexture,
  selectGlow,
  setNightGrade,
  shadowLayout,
  shutdownPostFx,
  type ColorMatrixLike,
} from '@/game/fx/postfx';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeColorMatrix(): any {
  const calls: string[] = [];
  const o: any = {
    calls,
    reset() { calls.push('reset'); return o; },
    saturate(v: number, m?: boolean) { calls.push(`saturate:${v}:${m ?? false}`); return o; },
    contrast(v: number, m?: boolean) { calls.push(`contrast:${v}:${m ?? false}`); return o; },
    multiply(mat: number[], m?: boolean) {
      calls.push(`multiply:${mat.length}:${m ?? false}`);
      o.lastMatrix = mat;
      return o;
    },
  };
  return o;
}

function makeImage(x = 0, y = 0, tex = 'x'): any {
  const o: any = {
    x, y, tex, alpha: 1, scaleX: 1, scaleY: 1, depth: 0, blendMode: 0,
    active: true, destroyed: false, data: new Map<string, unknown>(),
    setAlpha(a: number) { o.alpha = a; return o; },
    setScale(sx: number, sy?: number) { o.scaleX = sx; o.scaleY = sy ?? sx; return o; },
    setDepth(d: number) { o.depth = d; return o; },
    setBlendMode(b: number) { o.blendMode = b; return o; },
    setPosition(px: number, py: number) { o.x = px; o.y = py; return o; },
    getData(k: string) { return o.data.get(k); },
    setData(k: string, v: unknown) { o.data.set(k, v); return o; },
    destroy() { o.destroyed = true; o.active = false; },
  };
  return o;
}

function makeScene(rendererType: unknown = WEBGL_RENDERER_TYPE) {
  const created: any[] = [];
  const tweenCfgs: any[] = [];
  const killed: any[] = [];
  const postFX: any = {
    addColorMatrixCalls: 0,
    addGlowCalls: [] as any[],
    removed: [] as any[],
    addColorMatrix() { postFX.addColorMatrixCalls++; return makeColorMatrix(); },
    addGlow(color?: number, outer?: number, inner?: number) {
      const ctl = { color, outer, inner };
      postFX.addGlowCalls.push(ctl);
      return ctl;
    },
    remove(ctl: unknown) { postFX.removed.push(ctl); },
  };
  const scene: any = {
    game: { renderer: { type: rendererType } },
    cameras: {
      main: {
        postFX,
        resetPostPipelineCalled: 0,
        resetPostPipeline() { scene.cameras.main.resetPostPipelineCalled++; },
      },
    },
    textures: { exists: (k: string) => k === 'soft-shadow' || k === 'lantern-halo' },
    tweens: {
      add: (cfg: any) => { tweenCfgs.push(cfg); return {}; },
      killTweensOf: (t: any) => { killed.push(t); },
    },
    add: {
      image: (x: number, y: number, tex: string) => {
        const img = makeImage(x, y, tex);
        created.push(img);
        return img;
      },
    },
  };
  return { scene: scene as Phaser.Scene, raw: scene, created, tweenCfgs, killed, postFX };
}

describe('postfx puros', () => {
  it('isWebGLType solo acepta el 2 de Phaser.WEBGL', () => {
    expect(isWebGLType(2)).toBe(true);
    expect(isWebGLType(0)).toBe(false);
    expect(isWebGLType(1)).toBe(false);
    expect(isWebGLType(3)).toBe(false);
    expect(isWebGLType('2')).toBe(false);
    expect(isWebGLType(undefined)).toBe(false);
  });

  it('gradePlan día: saturación ~1.08, contraste ~1.04 y lift cálido', () => {
    const p = gradePlan(false);
    expect(p.saturate).toBeCloseTo(0.12, 6);
    expect(p.contrast).toBeCloseTo(0.04, 6);
    expect(p.liftR).toBeGreaterThan(0);
    expect(p.liftG).toBeGreaterThanOrEqual(0);
    expect(p.liftB).toBeLessThanOrEqual(0);
  });

  it('gradePlan noche: desatura leve y empuja al azul', () => {
    const p = gradePlan(true);
    expect(p.saturate).toBeLessThan(0);
    expect(p.liftB).toBeGreaterThan(0);
    expect(p.liftR).toBeLessThanOrEqual(0);
  });

  it('applyGradeMatrix resetea y encadena saturar→contraste→lift (matriz 20)', () => {
    const cm = makeColorMatrix();
    applyGradeMatrix(cm as ColorMatrixLike, false);
    expect(cm.calls[0]).toBe('reset');
    expect(cm.calls[1]).toMatch(/^saturate:0\.12:/);
    expect(cm.calls[2]).toBe('contrast:0.04:true');
    expect(cm.calls[3]).toBe('multiply:20:true');
    // El lift diurno mete R+ y B-: cálido.
    expect((cm.lastMatrix as number[])[4]).toBeGreaterThan(0);
    expect((cm.lastMatrix as number[])[14]).toBeLessThanOrEqual(0);
  });

  it('shadowLayout desplaza al sureste, elipse ancha y alpha 0.35', () => {
    const l = shadowLayout(100, 80);
    expect(l.dx).toBeGreaterThan(0);
    expect(l.dy).toBeGreaterThanOrEqual(0);
    expect(l.scaleX).toBeGreaterThan(l.scaleY);
    expect(l.alpha).toBe(BUILDING_SHADOW_ALPHA);
    expect(l.alpha).toBeCloseTo(0.35, 6);
  });

  it('shadowLayout tolera medidas inválidas con defaults', () => {
    const l = shadowLayout(NaN, -3);
    expect(Number.isFinite(l.dx)).toBe(true);
    expect(Number.isFinite(l.scaleX)).toBe(true);
    expect(l.alpha).toBe(BUILDING_SHADOW_ALPHA);
  });

  it('pickFxTexture prefiere la primaria y cae al fallback', () => {
    expect(pickFxTexture(() => true, 'soft-shadow', 'shadow')).toBe('soft-shadow');
    expect(pickFxTexture(() => false, 'soft-shadow', 'shadow')).toBe('shadow');
    expect(pickFxTexture(() => { throw new Error('x'); }, 'a', 'b')).toBe('b');
  });
});

describe('postfx con escena mock', () => {
  it('isWebGLScene distingue WebGL de Canvas', () => {
    expect(isWebGLScene(makeScene(2).scene)).toBe(true);
    expect(isWebGLScene(makeScene(1).scene)).toBe(false);
    expect(isWebGLScene({} as Phaser.Scene)).toBe(false);
  });

  it('initCameraGrade en Canvas es no-op silencioso (false)', () => {
    const { scene, postFX } = makeScene(1);
    expect(initCameraGrade(scene)).toBe(false);
    expect(postFX.addColorMatrixCalls).toBe(0);
  });

  it('initCameraGrade en WebGL aplica la matriz diurna e idempotente', () => {
    const { scene, postFX } = makeScene(2);
    expect(initCameraGrade(scene)).toBe(true);
    expect(postFX.addColorMatrixCalls).toBe(1);
    expect(initCameraGrade(scene)).toBe(true);
    expect(postFX.addColorMatrixCalls).toBe(1);
  });

  it('setNightGrade sin init es no-op; con init alterna día/noche', () => {
    const { scene } = makeScene(2);
    expect(setNightGrade(scene, true)).toBe(false);
    expect(initCameraGrade(scene)).toBe(true);
    expect(setNightGrade(scene, true)).toBe(true);
    expect(setNightGrade(scene, true)).toBe(true); // mismo estado: barato
    expect(setNightGrade(scene, false)).toBe(true);
  });

  it('initCameraGrade sin postFX real devuelve false sin lanzar', () => {
    const { scene, raw } = makeScene(2);
    raw.cameras.main.postFX = null;
    expect(initCameraGrade(scene)).toBe(false);
  });

  it('attachBuildingShadow inserta la sombra la primera (índice 0) con alpha 0.35', () => {
    const { scene, created } = makeScene(2);
    const added: any[] = [];
    const container: any = {
      scene,
      addAt: (child: any, index: number) => { added.push({ child, index }); },
    };
    const img = attachBuildingShadow(container as Phaser.GameObjects.Container, 100, 80);
    expect(img).not.toBeNull();
    expect(added).toHaveLength(1);
    expect(added[0].index).toBe(0);
    expect(img!.alpha).toBeCloseTo(0.35, 6);
    expect(img!.x).toBeGreaterThan(0); // desplazada al este (sureste)
    expect(img!.scaleX).toBeGreaterThan(img!.scaleY); // elipse, no círculo
    expect(created[0].tex).toBe('soft-shadow');
  });

  it('attachBuildingShadow cae a shadow si falta soft-shadow', () => {
    const { scene, raw, created } = makeScene(2);
    raw.textures.exists = () => false;
    const container: any = { scene, addAt: () => {} };
    attachBuildingShadow(container as Phaser.GameObjects.Container, 100, 80);
    expect(created[0].tex).toBe('shadow');
  });

  it('selectGlow crea UN halo bajo el anillo con UN solo tween', () => {
    const { scene, created, tweenCfgs } = makeScene(2);
    const img = selectGlow(scene, 10, 20);
    expect(img).not.toBeNull();
    expect(created).toHaveLength(1);
    expect(img!.depth).toBe(SELECT_GLOW_DEPTH);
    expect(img!.blendMode).toBe(1); // ADD
    expect(tweenCfgs).toHaveLength(1);
    expect(tweenCfgs[0].repeat).toBe(-1);
    expect(tweenCfgs[0].targets).toBe(img);
  });

  it('discardSelectGlow mata el tween y destruye; null-safe', () => {
    const { scene, killed } = makeScene(2);
    const img = selectGlow(scene, 0, 0);
    expect(() => discardSelectGlow(scene, null)).not.toThrow();
    discardSelectGlow(scene, img);
    expect(killed).toContain(img);
    expect((img as any).destroyed).toBe(true);
  });

  it('glowGhost en Canvas no toca postFX (el tint ya basta)', () => {
    const { scene, postFX } = makeScene(1);
    const ghost: any = { active: true, postFX, getData: () => undefined, setData: () => {} };
    glowGhost(scene, ghost as Phaser.GameObjects.Image, true);
    expect(postFX.addGlowCalls).toHaveLength(0);
  });

  it('glowGhost en WebGL añade glow una vez y solo re-actúa al cambiar ok', () => {
    const { scene, postFX } = makeScene(2);
    const store = new Map<string, unknown>();
    const ghost: any = {
      active: true, postFX,
      getData: (k: string) => store.get(k),
      setData: (k: string, v: unknown) => { store.set(k, v); },
    };
    glowGhost(scene, ghost as Phaser.GameObjects.Image, true);
    glowGhost(scene, ghost as Phaser.GameObjects.Image, true);
    expect(postFX.addGlowCalls).toHaveLength(1);
    expect(postFX.addGlowCalls[0].color).toBe(0x88ff88);
    glowGhost(scene, ghost as Phaser.GameObjects.Image, false);
    expect(postFX.addGlowCalls).toHaveLength(2);
    expect(postFX.removed).toHaveLength(1);
    expect(postFX.addGlowCalls[1].color).toBe(0xff6666);
  });

  it('shutdownPostFx limpia el estado y resetea la cámara sin lanzar', () => {
    const { scene, raw } = makeScene(2);
    initCameraGrade(scene);
    expect(() => shutdownPostFx(scene)).not.toThrow();
    expect(raw.cameras.main.resetPostPipelineCalled).toBe(1);
    expect(setNightGrade(scene, true)).toBe(false); // estado olvidado
  });
});
