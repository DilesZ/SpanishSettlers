// VFX de juego: polvo, construcción, impactos, cosecha y reclutamiento.
//
// API para el integrador (GameScene es el único que la llama):
//   dustBurst(scene, x, y, { count? })  polvo al demoler / al caer un enemigo
//   builtBurst(scene, x, y)             destello + anillo al terminar una obra
//   hitFlash(target)                    fogonazo sobre lo golpeado (la escena
//                                       sale de target.scene: vale para sprites
//                                       E contenedores como los edificios)
//   recruitRing(scene, x, y)            doble anillo dorado al reclutar
//   harvestSparkle(scene, x, y)         chispas al cosechar trigo
//   smokeColumn(scene, x, y)            3 bocanadas (edificio a poca vida)
//
// Todo con texturas existentes ('glow', 'shadow', con fallback a círculos)
// + tweens ACOTADOS (ninguno con repeat: -1: cada objeto se autodestruye).
// Presupuesto por llamada: 1-11 objetos, vida < 1.2 s. 100% procedural y
// original, sin assets de terceros.
//
// NOTA Phaser: solo `import type` (testeable en vitest/node). APIs
// verificadas en 3.90: add.circle/add.ellipse (GameScene.setupParticles),
// graphics-free ellipse.setStrokeStyle (buildTilemap), sprite/image
// setTintFill (types), scene.add.image + setBlendMode numérico (ADD = 1,
// ver fx/atmosphere.ts), time.delayedCall (combatTick).

import type Phaser from 'phaser';

/** Profundidades: sobre tropas/edificios (≤ 8000+) y bajo nubes (9300). */
export const VFX_DEPTHS = {
  burst: 8650,
  ring: 8700,
  flash: 8660,
  sparkle: 8650,
  smoke: 8640,
} as const;

/** Tope de objetos por llamada (incluido el puff/flash central). */
export const VFX_MAX = {
  dust: 7,
  built: 7,
  ring: 3,
  sparkle: 5,
  smoke: 3,
} as const;

export interface DustOptions {
  /** Motas de polvo (1-12). Por defecto 6. */
  count?: number;
}

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

function hasTexture(scene: Phaser.Scene, key: string): boolean {
  try {
    return scene.textures.exists(key);
  } catch {
    return false;
  }
}

/** ADD = 1 en Phaser 3.x (ver fx/atmosphere.ts): sin importar el enum. */
function markAdditive(obj: Phaser.GameObjects.Image): void {
  try {
    obj.setBlendMode(1);
  } catch {
    /* sin blend: se sigue viendo, solo menos "luz" */
  }
}

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Un tween acotado que destruye su objetivo al terminar (sin fugas). */
function fadeOut(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  cfg: {
    duration: number;
    delay?: number;
    x?: number;
    y?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
  },
): void {
  scene.tweens.add({
    targets: target,
    alpha: 0,
    ...(cfg.x !== undefined ? { x: cfg.x } : {}),
    ...(cfg.y !== undefined ? { y: cfg.y } : {}),
    ...(cfg.scale !== undefined ? { scale: cfg.scale } : {}),
    ...(cfg.scaleX !== undefined ? { scaleX: cfg.scaleX } : {}),
    ...(cfg.scaleY !== undefined ? { scaleY: cfg.scaleY } : {}),
    duration: cfg.duration,
    ...(cfg.delay !== undefined ? { delay: cfg.delay } : {}),
    onComplete: () => {
      try {
        target.destroy();
      } catch {
        /* ya destruido por la escena */
      }
    },
  });
}

/**
 * Ráfaga de polvo marrón + nube que se expande.
 * Enganches: destroyBuilding (count 10) y killEnemy (defecto).
 */
export function dustBurst(scene: Phaser.Scene, x: number, y: number, opts: DustOptions = {}): void {
  try {
    const n = Math.max(1, Math.min(12, Math.floor(opts.count ?? 6)));
    // Nube central que se expande ('shadow' existe siempre: BootScene).
    if (hasTexture(scene, 'shadow')) {
      const puff = scene.add.image(x, y - 6, 'shadow');
      puff.setDepth(VFX_DEPTHS.burst);
      puff.setScale(1.4);
      puff.setAlpha(0.5);
      ignoreOnMinimap(scene, [puff]);
      fadeOut(scene, puff, { duration: 550, scale: 3.2 });
    }
    for (let i = 0; i < n; i++) {
      const mote = scene.add.circle(x + rnd(-10, 10), y + rnd(-8, 4), rnd(2, 3.5), 0xcbb58f, 0.9);
      mote.setDepth(VFX_DEPTHS.burst);
      ignoreOnMinimap(scene, [mote]);
      fadeOut(scene, mote, {
        duration: rnd(450, 650),
        x: mote.x + rnd(-42, 42),
        y: mote.y + rnd(-55, -18),
      });
    }
  } catch {
    /* VFX nunca debe romper el juego */
  }
}

/**
 * Destello + anillo dorado + chispas al terminar una obra.
 * Enganche: tryPlace, tween onComplete donde ya suena playSfx('built').
 */
export function builtBurst(scene: Phaser.Scene, x: number, y: number): void {
  try {
    const ring = scene.add.ellipse(x, y - 10, 90, 36, 0xffffff, 0);
    ring.setStrokeStyle(3, 0xfde68a, 0.95);
    ring.setDepth(VFX_DEPTHS.ring);
    ignoreOnMinimap(scene, [ring]);
    fadeOut(scene, ring, { duration: 600, scaleX: 1.5, scaleY: 1.5 });
    if (hasTexture(scene, 'glow')) {
      const flash = scene.add.image(x, y - 30, 'glow');
      flash.setDepth(VFX_DEPTHS.flash);
      flash.setScale(0.9);
      flash.setAlpha(0.9);
      markAdditive(flash);
      ignoreOnMinimap(scene, [flash]);
      fadeOut(scene, flash, { duration: 350, scale: 2.4 });
    }
    for (let i = 0; i < VFX_MAX.sparkle; i++) {
      const sp = scene.add.circle(x + rnd(-26, 26), y - rnd(8, 30), rnd(1.5, 2.5), 0xffe9b0, 0.95);
      sp.setDepth(VFX_DEPTHS.sparkle);
      ignoreOnMinimap(scene, [sp]);
      fadeOut(scene, sp, { duration: rnd(400, 600), y: sp.y - rnd(28, 55) });
    }
  } catch {
    /* noop */
  }
}

/** Mínimo que hitFlash necesita (vale Sprite, Image y Container). */
export interface FlashTarget {
  x: number;
  y: number;
  scene?: Phaser.Scene | null;
  setTintFill?: (color: number) => void;
  clearTint?: () => void;
}

/**
 * Fogonazo blanco sobre lo golpeado + destello 'glow' que se apaga.
 * Enganches: combatTick (daño de torre y de soldado a enemigo; daño a
 * edificio propio/rival). No lanza si el objetivo ya no tiene escena.
 */
export function hitFlash(target: FlashTarget | null | undefined): void {
  try {
    if (!target) return;
    const scene = target.scene ?? null;
    if (!scene) return;
    const x = typeof target.x === 'number' ? target.x : 0;
    const y = (typeof target.y === 'number' ? target.y : 0) - 18;
    if (typeof target.setTintFill === 'function') {
      try {
        target.setTintFill(0xffffff);
        scene.time.delayedCall(90, () => {
          try {
            target.clearTint?.();
          } catch {
            /* objetivo destruido entre medias */
          }
        });
      } catch {
        /* contenedor u objeto sin tinte: solo el destello */
      }
    }
    if (hasTexture(scene, 'glow')) {
      const flash = scene.add.image(x, y, 'glow');
      flash.setDepth(VFX_DEPTHS.flash);
      flash.setScale(1.2);
      flash.setAlpha(0.85);
      markAdditive(flash);
      ignoreOnMinimap(scene, [flash]);
      fadeOut(scene, flash, { duration: 180, scale: 2 });
    }
  } catch {
    /* noop */
  }
}

/**
 * Doble anillo dorado expansivo al reclutar.
 * Enganche: recruit(), en los dos caminos de éxito (voluntario y nuevo).
 */
export function recruitRing(scene: Phaser.Scene, x: number, y: number): void {
  try {
    const mk = (w: number, h: number, delay: number, dur: number) => {
      const ring = scene.add.ellipse(x, y, w, h, 0xffffff, 0);
      ring.setStrokeStyle(2.5, 0xfde68a, 0.95);
      ring.setDepth(VFX_DEPTHS.ring);
      ignoreOnMinimap(scene, [ring]);
      fadeOut(scene, ring, { duration: dur, delay, scaleX: 1.6, scaleY: 1.6 });
    };
    mk(110, 44, 0, 650);
    mk(70, 28, 120, 680);
    if (hasTexture(scene, 'glow')) {
      const core = scene.add.image(x, y - 6, 'glow');
      core.setDepth(VFX_DEPTHS.flash);
      core.setScale(0.7);
      core.setAlpha(0.8);
      markAdditive(core);
      ignoreOnMinimap(scene, [core]);
      fadeOut(scene, core, { duration: 500, scale: 1.8 });
    }
  } catch {
    /* noop */
  }
}

/**
 * Chispas doradas que suben al cosechar.
 * Enganche: wheatTick, donde la parcela se reinicia (una llamada por
 * parcela cosechada; con 3 parcelas por granja el pico es trivial).
 */
export function harvestSparkle(scene: Phaser.Scene, x: number, y: number): void {
  try {
    const tex = hasTexture(scene, 'firefly') ? 'firefly' : hasTexture(scene, 'glow') ? 'glow' : null;
    for (let i = 0; i < VFX_MAX.sparkle; i++) {
      const sx = x + rnd(-14, 14);
      const sy = y + rnd(-6, 6);
      if (tex) {
        const img = scene.add.image(sx, sy, tex);
        img.setDepth(VFX_DEPTHS.sparkle);
        img.setScale(tex === 'glow' ? 0.3 : 1.4);
        img.setAlpha(0.95);
        markAdditive(img);
        ignoreOnMinimap(scene, [img]);
        fadeOut(scene, img, { duration: rnd(450, 650), y: sy - rnd(24, 48) });
      } else {
        const sp = scene.add.circle(sx, sy, 2, 0xffe9b0, 0.95);
        sp.setDepth(VFX_DEPTHS.sparkle);
        ignoreOnMinimap(scene, [sp]);
        fadeOut(scene, sp, { duration: rnd(450, 650), y: sy - rnd(24, 48) });
      }
    }
  } catch {
    /* noop */
  }
}

/**
 * Columna de humo de 3 bocanadas (one-shot, ~1.1 s de vida).
 * Enganche: combatTick cuando un edificio baja del 35% de vida y
 * destroyBuilding (junto a dustBurst). No es un emisor continuo: llamar
 * una vez por tick a lo sumo deja ~9 objetos vivos en el peor caso.
 */
export function smokeColumn(scene: Phaser.Scene, x: number, y: number): void {
  try {
    for (let i = 0; i < VFX_MAX.smoke; i++) {
      const px = x + rnd(-6, 6);
      const py = y - rnd(0, 10);
      const puff = scene.add.circle(px, py, rnd(5, 7), 0x6b7280, 0.45);
      puff.setDepth(VFX_DEPTHS.smoke);
      puff.setScale(1);
      ignoreOnMinimap(scene, [puff]);
      fadeOut(scene, puff, {
        duration: 1100,
        delay: i * 180,
        x: px + 12,
        y: py - rnd(40, 60),
        scale: 2.2,
      });
    }
  } catch {
    /* noop */
  }
}
