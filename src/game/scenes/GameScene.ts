import Phaser from 'phaser';
import { playSfx } from '../audio';
import { BUILDINGS, INITIAL_STOCK, RECIPES, type BuildingId, type ResourceId } from '../data/buildings';
import { WL_BUILDINGS, WL_BUSHES, WL_CRITTERS, WL_RES_ICONS, WL_ROCKS, WL_SHIPS, WL_TREES, WL_WHEAT, WL_WHEAT_ORDER, WL_WORKERS, wlBuildingScale, wlWorkerScale } from '../data/wlArt';
import { DAY_LENGTH_MS, skyAt } from '../systems/daynight';
import { findPath, smoothPath, type GridPos } from '../systems/pathfinding';
import { goodsFor, isNavigable, pickFishingCircuit, touchesWater } from '../systems/ships';
import { ISLAND_SIZE, TILE_H, TILE_W, terrainAt } from '../maps/island';
import { tickJob, type ProductionJob, type Stock } from '../systems/economy';

// Rama B: arte GPL de Widelands (ver docs/ATRIBUCION.md + wlArt.ts).
const WL_TEX: Record<BuildingId, string> = {
  almacen: 'wl-b-almacen', cabanaLenador: 'wl-b-cabanaLenador', aserradero: 'wl-b-aserradero',
  cantera: 'wl-b-cantera', residenciaS: 'wl-b-residenciaS', residenciaM: 'wl-b-residenciaM',
  residenciaL: 'wl-b-residenciaL', granja: 'wl-b-granja', molino: 'wl-b-molino',
  panaderia: 'wl-b-panaderia', pozo: 'wl-b-pozo', pesqueria: 'wl-b-pesqueria',
  minaCarbon: 'wl-b-minaCarbon', minaHierro: 'wl-b-minaHierro', minaOro: 'wl-b-minaOro',
  fundicion: 'wl-b-fundicion', herreria: 'wl-b-herreria', armeria: 'wl-b-armeria',
  cuartel: 'wl-b-cuartel', torre: 'wl-b-torre', ornamento: 'wl-b-ornamento',
  puerto: 'wl-b-puerto',
};

const WL_SMOKE: Set<BuildingId> = new Set(['fundicion', 'herreria', 'panaderia', 'minaCarbon', 'minaHierro', 'minaOro', 'cabanaLenador']);
const MAP = ISLAND_SIZE;

interface Placed { id: BuildingId; tx: number; ty: number; sprite: Phaser.GameObjects.Container; done: number; total: number }

type WlDir6 = 'e' | 'se' | 'sw' | 'w' | 'nw' | 'ne';

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  role: string;
  kind: 'settler' | 'critter';
  path: GridPos[];
  targetPx: { x: number; y: number } | null;
  speed: number;
  state: 'idle' | 'walk' | 'work';
  stateT: number;
  onArrive: (() => void) | null;
  loaded: boolean;
  goods: ResourceId | null;
  goodsIcon: Phaser.GameObjects.Image | null;
}

interface Ship {
  sprite: Phaser.GameObjects.Sprite;
  path: GridPos[];
  targetPx: { x: number; y: number } | null;
  circuit: GridPos[];
  leg: number;
  home: GridPos;
  wakeT: number;
}

/** Receta principal por edificio productor (para el panel info y la sim). */
const RECIPE_BY_BUILDING: Partial<Record<BuildingId, string>> = {
  aserradero: 'tablon', molino: 'harina', panaderia: 'pan',
  fundicion: 'lingote-hierro', herreria: 'herramienta', armeria: 'espada',
};

export class GameScene extends Phaser.Scene {
  stock: Stock = { ...INITIAL_STOCK };
  placed: Placed[] = [];
  walkers: Walker[] = [];
  ships: Ship[] = [];
  buildingTiles = new Set<string>();
  pendingBuild: BuildingId | null = null;
  territoryRadius = 7;
  center = { x: MAP / 2, y: MAP / 2 };
  jobs: ProductionJob[] = [];
  private hudText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private waterCells: { x: number; y: number; alt: boolean }[] = [];
  private forestTiles: { x: number; y: number }[] = [];
  private shoreTiles: { x: number; y: number }[] = [];
  private hillTiles: { x: number; y: number }[] = [];
  private hoverMarker!: Phaser.GameObjects.Graphics;
  private minimap?: Phaser.Cameras.Scene2D.Camera;
  private wheatPlots: { sprite: Phaser.GameObjects.Sprite; stageIdx: number }[] = [];
  private stars: Phaser.GameObjects.Arc[] = [];
  private lanterns: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('game');
  }

  preload() {
    this.load.tilemapTiledJSON('isla-01', '/assets/maps/isla-01.json');
    this.load.image('terreno', '/assets/terrain-sheet.png');
    this.load.image('foam-ne', '/assets/foam-ne.png');
    this.load.image('foam-se', '/assets/foam-se.png');
    this.load.image('foam-sw', '/assets/foam-sw.png');
    this.load.image('foam-nw', '/assets/foam-nw.png');
    for (const id of Object.keys(WL_TEX)) {
      const art = WL_BUILDINGS[id];
      if (!art) continue;
      this.load.image(WL_TEX[id as BuildingId], `/assets/wl/b-${id}.png`);
      if (art.mode === 'sheet' && art.sheet) {
        this.load.spritesheet(`wl-sheet-${id}`, `/assets/wl/sheets/${art.sheet.file}`, {
          frameWidth: art.sheet.fw, frameHeight: art.sheet.fh,
        });
      }
      if (art.build) {
        this.load.spritesheet(`wl-buildsheet-${id}`, `/assets/wl/sheets/${art.build.file}`, {
          frameWidth: art.build.fw, frameHeight: art.build.fh,
        });
      }
    }
    for (const [role, w] of Object.entries(WL_WORKERS)) {
      for (const [dir, d] of Object.entries(w.dirs)) {
        if (!d) continue;
        this.load.spritesheet(`wl-${role}-${dir}`, `/assets/wl/people/${d.file}`, {
          frameWidth: d.fw, frameHeight: d.fh,
        });
      }
      for (const [dir, d] of Object.entries(w.loads ?? {})) {
        if (!d) continue;
        this.load.spritesheet(`wl-${role}-load-${dir}`, `/assets/wl/people/${d.file}`, {
          frameWidth: d.fw, frameHeight: d.fh,
        });
      }
      if (w.idle) {
        this.load.spritesheet(`wl-${role}-idle`, `/assets/wl/people/${w.idle.file}`, {
          frameWidth: w.idle.fw, frameHeight: w.idle.fh,
        });
      }
      if (w.hack) {
        this.load.spritesheet(`wl-${role}-hack`, `/assets/wl/people/${w.hack.file}`, {
          frameWidth: w.hack.fw, frameHeight: w.hack.fh,
        });
      }
    }
    for (const [name, t] of Object.entries(WL_TREES)) {
      if (t.sheet) {
        this.load.spritesheet(`wl-tree-${name}`, `/assets/wl/nature/tree-${name}.png`, {
          frameWidth: Math.round(t.w / t.sheet.columns), frameHeight: Math.round(t.h / t.sheet.rows),
        });
      } else {
        this.load.image(`wl-tree-${name}`, `/assets/wl/nature/tree-${name}.png`);
      }
    }
    for (const [name] of Object.entries(WL_ROCKS)) {
      this.load.image(`wl-rock-${name}`, `/assets/wl/nature/rock-${name}.png`);
    }
    for (const [name] of Object.entries(WL_BUSHES)) {
      this.load.image(`wl-bush-${name}`, `/assets/wl/nature/bush-${name}.png`);
    }
    for (const [name, c] of Object.entries(WL_CRITTERS)) {
      for (const [dir, d] of Object.entries(c.dirs)) {
        if (dir === 'idle') {
          this.load.image(`wl-crit-${name}-idle`, `/assets/wl/critters/${d.file}`);
        } else {
          this.load.spritesheet(`wl-crit-${name}-${dir}`, `/assets/wl/critters/${d.file}`, {
            frameWidth: d.fw, frameHeight: d.fh,
          });
        }
      }
    }
    for (const [dir, d] of Object.entries(WL_SHIPS.barbarian?.dirs ?? {})) {
      if (!d) continue;
      this.load.spritesheet(`wl-ship-${dir}`, `/assets/wl/ships/${d.file}`, {
        frameWidth: d.fw, frameHeight: d.fh,
      });
    }
    for (const f of Object.values(WL_RES_ICONS)) {
      this.load.image(`wl-icon-${f.replace('.png', '')}`, `/assets/wl/icons/${f}`);
    }
    for (const [stage, w] of Object.entries(WL_WHEAT)) {
      this.load.spritesheet(`wl-wheat-${stage}`, `/assets/wl/crops/${w.file}`, {
        frameWidth: w.fw, frameHeight: w.fh,
      });
    }
  }

  /** Frames utilizables: mínimo entre declarados y celdas físicas del sheet. */
  private capFrames(declared: number, w: number, h: number, fw: number, fh: number): number {
    if (!fw || !fh) return Math.max(1, declared);
    const cells = Math.floor(w / fw) * Math.floor(h / fh);
    return Math.max(1, Math.min(declared, cells));
  }

  private createWlAnims() {
    for (const [id, art] of Object.entries(WL_BUILDINGS)) {
      if (art.mode !== 'sheet' || !art.sheet || this.anims.exists(`wl-b-${id}`)) continue;
      const total = art.sheet.fw && art.sheet.fh ? 24 : art.sheet.frames;
      this.anims.create({
        key: `wl-b-${id}`,
        frames: this.anims.generateFrameNumbers(`wl-sheet-${id}`, { start: 0, end: Math.min(art.sheet.frames, total) - 1 }),
        frameRate: art.sheet.fps,
        repeat: -1,
      });
    }
    for (const [id, art] of Object.entries(WL_BUILDINGS)) {
      if (!art.build || this.anims.exists(`wl-build-${id}`)) continue;
      this.anims.create({
        key: `wl-build-${id}`,
        frames: this.anims.generateFrameNumbers(`wl-buildsheet-${id}`, { start: 0, end: art.build.frames - 1 }),
        frameRate: art.build.fps,
        repeat: -1,
      });
    }
    for (const [role, w] of Object.entries(WL_WORKERS)) {
      for (const [dir, d] of Object.entries(w.dirs)) {
        const key = `wl-walk-${role}-${dir}`;
        if (!d || this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-${role}-${dir}`, { start: 0, end: this.capFrames(w.grid.frames, d.w, d.h, d.fw, d.fh) - 1 }),
          frameRate: w.grid.fps,
          repeat: -1,
        });
      }
      for (const [dir, d] of Object.entries(w.loads ?? {})) {
        const key = `wl-walkload-${role}-${dir}`;
        if (!d || this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-${role}-load-${dir}`, { start: 0, end: this.capFrames(w.grid.frames, d.w, d.h, d.fw, d.fh) - 1 }),
          frameRate: w.grid.fps,
          repeat: -1,
        });
      }
      if (w.idle && !this.anims.exists(`wl-idle-${role}`)) {
        this.anims.create({
          key: `wl-idle-${role}`,
          frames: this.anims.generateFrameNumbers(`wl-${role}-idle`, { start: 0, end: this.capFrames(w.idle.frames, w.idle.w, w.idle.h, w.idle.fw, w.idle.fh) - 1 }),
          frameRate: Math.min(w.idle.fps, 6),
          repeat: -1,
        });
      }
      if (w.hack && !this.anims.exists(`wl-hack-${role}`)) {
        this.anims.create({
          key: `wl-hack-${role}`,
          frames: this.anims.generateFrameNumbers(`wl-${role}-hack`, { start: 0, end: this.capFrames(w.hack.frames, w.hack.w, w.hack.h, w.hack.fw, w.hack.fh) - 1 }),
          frameRate: Math.min(w.hack.fps, 10),
          repeat: -1,
        });
      }
    }
    for (const [name, t] of Object.entries(WL_TREES)) {
      if (!t.sheet || this.anims.exists(`wl-tree-${name}`)) continue;
      this.anims.create({
        key: `wl-tree-${name}`,
        frames: this.anims.generateFrameNumbers(`wl-tree-${name}`, { start: 0, end: t.sheet.frames - 1 }),
        frameRate: 2,
        repeat: -1,
      });
    }
    for (const [name, c] of Object.entries(WL_CRITTERS)) {
      for (const [dir, d] of Object.entries(c.dirs)) {
        if (dir === 'idle' || !d) continue;
        const key = `wl-crit-${name}-${dir}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-crit-${name}-${dir}`, { start: 0, end: this.capFrames(c.grid.frames, d.w, d.h, d.fw, d.fh) - 1 }),
          frameRate: Math.min(c.grid.fps, 12),
          repeat: -1,
        });
      }
    }
    const ship = WL_SHIPS.barbarian;
    if (ship) {
      for (const dir of Object.keys(ship.dirs)) {
        const key = `wl-ship-${dir}`;
        if (this.anims.exists(key)) continue;
        const d = ship.dirs[dir as keyof typeof ship.dirs];
        if (!d) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-ship-${dir}`, { start: 0, end: Math.min(19, Math.floor((d.w / d.fw) * (d.h / d.fh)) - 1) }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
    for (const [stage, w] of Object.entries(WL_WHEAT)) {
      const key = `wl-wheat-${stage}`;
      if (this.anims.exists(key)) continue;
      const total = w.columns * w.rows;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(`wl-wheat-${stage}`, { start: 0, end: Math.min(w.frames, total) - 1 }),
        frameRate: Math.min(w.fps, 6),
        repeat: -1,
      });
    }
  }

  create() {
    this.createWlAnims();
    this.buildTilemap();
    this.setupCamera();
    this.setupInput();
    this.placeFromLogicLayer();
    this.placeExtraInitial();
    this.spawnPopulation();
    this.spawnCritters();
    this.setupAmbient();
    this.setupNight();
    this.exposeBridge();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickEconomy() });
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.animateWater() });
    this.time.addEvent({ delay: 6000, loop: true, callback: () => this.wheatTick() });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.skyTick() });
    this.scale.on('resize', () => this.layoutMinimap());
    // demo para fotos/tests: ?demo=puerto coloca un puerto junto al agua
    try {
      if (new URLSearchParams(window.location.search).get('demo') === 'puerto') {
        this.time.delayedCall(2500, () => this.demoPort());
      }
    } catch { /* noop */ }
  }

  private demoPort() {
    const at = (ax: number, ay: number) => (ax < 0 || ay < 0 || ax >= MAP || ay >= MAP ? null : terrainAt(ax, ay));
    let best: GridPos | null = null;
    let bestD = Infinity;
    for (let ty = 2; ty < MAP - 2; ty++) {
      for (let tx = 2; tx < MAP - 2; tx++) {
        const t = terrainAt(tx, ty);
        if (t === 'water' || t === 'waterB' || t === 'waterC') continue;
        if (this.buildingTiles.has(`${tx},${ty}`)) continue;
        if (!touchesWater(tx, ty, at)) continue;
        const d = Math.hypot(tx - this.center.x, ty - this.center.y);
        if (d < bestD) { bestD = d; best = { x: tx, y: ty }; }
      }
    }
    if (best) {
      // stock de sobra para la demo y cámara al puerto
      this.stock.madera += 20;
      this.stock.tablon += 20;
      this.stock.piedra += 20;
      if (this.tryPlace('puerto', best.x, best.y, false)) {
        const p = this.iso(best.x, best.y);
        this.cameras.main.centerOn(p.x, p.y);
      }
    }
  }

  iso(tx: number, ty: number) {
    return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
  }

  private buildTilemap() {
    const map = this.make.tilemap({ key: 'isla-01' });
    const tileset = map.addTilesetImage('terreno', 'terreno');
    if (!tileset) throw new Error('Tileset terreno no encontrado en isla-01.json');
    const layer = map.createLayer('Suelo', tileset, 0, 0);
    if (!layer) throw new Error('Capa Suelo no encontrada en isla-01.json');
    layer.setDepth(0);
    this.groundLayer = layer;

    for (let ty = 0; ty < MAP; ty++) {
      for (let tx = 0; tx < MAP; tx++) {
        const t = terrainAt(tx, ty);
        const { x, y } = this.iso(tx, ty);
        if (t === 'water' || t === 'waterB' || t === 'waterC') this.waterCells.push({ x: tx, y: ty, alt: false });
        if (t === 'forest') this.forestTiles.push({ x: tx, y: ty });
        if (t === 'mountain') this.hillTiles.push({ x: tx, y: ty });
        if (t === 'sand') this.shoreTiles.push({ x: tx, y: ty });
        this.decorate(tx, ty, t, x, y);
      }
    }
    // marcador hover (diamante)
    this.hoverMarker = this.add.graphics().setDepth(9400);
    this.hoverMarker.lineStyle(2, 0xfde68a, 0.9);
    this.hoverMarker.beginPath();
    this.hoverMarker.moveTo(0, -TILE_H / 2);
    this.hoverMarker.lineTo(TILE_W / 2, 0);
    this.hoverMarker.lineTo(0, TILE_H / 2);
    this.hoverMarker.lineTo(-TILE_W / 2, 0);
    this.hoverMarker.closePath();
    this.hoverMarker.strokePath();
    this.hoverMarker.setVisible(false);

    const c = this.iso(this.center.x, this.center.y);
    this.add.circle(c.x, c.y - 8, this.territoryRadius * 68, 0xfbbf24, 0.07).setDepth(9390).setStrokeStyle(2, 0xfbbf24, 0.45);
    this.placeFoam();
    this.placeMountainShades();
    this.placeSparkles();
  }

  /** Sombra al sur de cada montaña: relieve sin geometría extra. */
  private placeMountainShades() {
    for (let ty = 0; ty < MAP; ty++) {
      for (let tx = 0; tx < MAP; tx++) {
        if (terrainAt(tx, ty) !== 'mountain') continue;
        if (ty + 1 >= MAP) continue;
        const { x, y } = this.iso(tx, ty + 1);
        this.add.image(x, y - 6, 'shadow').setDepth(49).setAlpha(0.4).setScale(3.2, 1.6);
      }
    }
  }

  /** Destellos sobre el agua. */
  private placeSparkles() {
    const cells = this.waterCells.filter(() => Math.random() > 0.6).slice(0, 30);
    for (const cell of cells) {
      const { x, y } = this.iso(cell.x, cell.y);
      const sp = this.add.circle(
        x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-12, 12),
        1.6, 0xffffff, 0,
      ).setDepth(51);
      this.tweens.add({
        targets: sp, alpha: 0.8, duration: Phaser.Math.Between(700, 1800),
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  private isWater(t: string): boolean {
    return t === 'water' || t === 'waterB' || t === 'waterC';
  }

  /** Espuma en los bordes donde el agua toca tierra (estilo S4). */
  private placeFoam() {
    const at = (tx: number, ty: number): string | null =>
      tx < 0 || ty < 0 || tx >= MAP || ty >= MAP ? null : terrainAt(tx, ty);
    for (let ty = 0; ty < MAP; ty++) {
      for (let tx = 0; tx < MAP; tx++) {
        if (!this.isWater(terrainAt(tx, ty))) continue;
        const { x, y } = this.iso(tx, ty);
        const edges: [number, number, string][] = [
          [1, 0, 'foam-se'], [-1, 0, 'foam-nw'], [0, 1, 'foam-sw'], [0, -1, 'foam-ne'],
        ];
        for (const [dx, dy, tex] of edges) {
          const nb = at(tx + dx, ty + dy);
          if (nb !== null && !this.isWater(nb)) {
            const f = this.add.image(x, y, tex).setDepth(50);
            this.tweens.add({ targets: f, alpha: 0.55, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        }
      }
    }
  }

  private decorate(tx: number, ty: number, t: string, x: number, y: number) {
    const depth = 100 + ty * MAP + tx + 0.5;
    // hash local para variar (misma función que island.ts)
    let h = (tx * 374761393 + ty * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const n = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    const treeNames = Object.keys(WL_TREES);
    const rockNames = Object.keys(WL_ROCKS);
    const bushNames = Object.keys(WL_BUSHES);
    if (t === 'forest' && n > 0.2 && treeNames.length) {
      const name = treeNames[Math.floor(n * treeNames.length) % treeNames.length];
      const art = WL_TREES[name];
      const ox = art.hotspot[0] / art.w;
      const oy = art.hotspot[1] / art.h;
      if (art.sheet) {
        const tree = this.add.sprite(x + Phaser.Math.Between(-20, 20), y - 6, `wl-tree-${name}`, 0)
          .setOrigin(ox, oy).setDepth(depth).setScale(1.1 + n * 0.5);
        tree.play(`wl-tree-${name}`);
      } else {
        this.add.image(x + Phaser.Math.Between(-20, 20), y - 6, `wl-tree-${name}`)
          .setOrigin(ox, oy).setDepth(depth).setScale(1.1 + n * 0.5);
      }
    } else if (t === 'mountain' && n > 0.3 && rockNames.length) {
      const name = rockNames[Math.floor(n * rockNames.length) % rockNames.length];
      const art = WL_ROCKS[name];
      this.add.image(x, y - 4, `wl-rock-${name}`)
        .setOrigin(art.hotspot[0] / art.w, art.hotspot[1] / art.h)
        .setDepth(depth).setScale(1.2 + n * 0.6);
    } else if ((t === 'grass' || t === 'grassB' || t === 'grassC') && n > 0.88 && bushNames.length) {
      const name = bushNames[Math.floor(n * bushNames.length) % bushNames.length];
      const art = WL_BUSHES[name];
      this.add.image(x + 14, y + 2, `wl-bush-${name}`)
        .setOrigin(art.hotspot[0] / art.w, art.hotspot[1] / art.h)
        .setDepth(depth).setAlpha(0.95);
    } else if (t === 'sand' && n > 0.55) {
      this.add.image(x, y - 24, 'palm').setDepth(depth).setScale(1.7 + n * 0.5);
    }
  }

  private animateWater() {
    if (!this.groundLayer) return;
    for (const w of this.waterCells) {
      if ((w.x + w.y) % 2 === 0) continue; // solo la mitad: parpadeo sutil
      const tile = this.groundLayer.getTileAt(w.x, w.y);
      if (!tile) continue;
      w.alt = !w.alt;
      // gid 6 (water) <-> 7 (waterB)
      this.groundLayer.putTileAt(w.alt ? 7 : 6, w.x, w.y);
    }
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(0.7);
    cam.centerOn(0, 450);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 2));
    });
    let dragging = false;
    let last = { x: 0, y: 0 };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) { dragging = true; last = { x: p.x, y: p.y }; }
      else if (p.leftButtonDown()) {
        const wx = p.worldX;
        const wy = p.worldY;
        const t = this.groundLayer.worldToTileXY(wx, wy);
        if (t && t.x >= 0 && t.y >= 0 && t.x < MAP && t.y < MAP) this.onTileClicked(t.x, t.y);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragging && p.isDown) { cam.scrollX -= (p.x - last.x) / cam.zoom; cam.scrollY -= (p.y - last.y) / cam.zoom; last = { x: p.x, y: p.y }; }
      if (!p.isDown) {
        const t = this.groundLayer.worldToTileXY(p.worldX, p.worldY);
        if (t && t.x >= 0 && t.y >= 0 && t.x < MAP && t.y < MAP) {
          const { x, y } = this.iso(t.x, t.y);
          this.hoverMarker.setPosition(x, y).setVisible(true);
        } else this.hoverMarker.setVisible(false);
      }
    });
    this.input.on('pointerup', () => { dragging = false; });
    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBounds(-2200, -600, 4400, 3200);

    this.hudText = this.add.text(12, 10, '', { fontSize: '12px', color: '#fff', backgroundColor: '#00000099', padding: { x: 8, y: 6 } })
      .setScrollFactor(0).setDepth(9950);
    this.hintText = this.add.text(12, 0, '', { fontSize: '12px', color: '#fde68a', backgroundColor: '#00000099', padding: { x: 8, y: 6 } })
      .setScrollFactor(0).setDepth(9950);

    this.minimap = this.cameras.add(0, 0, 190, 140).setZoom(0.055).centerOn(0, 450);
    this.minimap.setBackgroundColor('#0d1f16');
    this.layoutMinimap();
  }

  private layoutMinimap() {
    if (!this.minimap) return;
    const w = this.scale.width;
    const h = this.scale.height;
    this.minimap.setViewport(Math.max(8, w - 202), Math.max(8, h - 152), 190, 140);
  }

  private wasd?: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  private setupInput() {
    this.input.keyboard?.on('keydown-ESC', () => { this.pendingBuild = null; this.hintText?.setText(''); });
    if (this.input.keyboard) {
      this.wasd = this.input.keyboard.addKeys('W,A,S,D') as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    }
  }

  // ---------- Población con oficios y zonas ----------
  private spawnPopulation() {
    const crew: [string, number][] = [
      ['woodcutter', 3], ['carrier', 6], ['settler', 3],
      ['miner', 2], ['fisher', 2], ['soldier', 2], ['archer', 1], ['baker', 1],
    ];
    for (const [tex, n] of crew) {
      for (let i = 0; i < n; i++) this.spawnPerson(tex);
    }
  }

  /** Estrellas + faroles (el tinte va en un div HTML: ver GameCanvas). */
  private setupNight() {
    for (let i = 0; i < 80; i++) {
      const sx = Phaser.Math.Between(-1600, 1600);
      const sy = Phaser.Math.Between(-500, 1100);
      const st = this.add.circle(sx, sy, Math.random() * 1.6 + 0.5, 0xffffff, 0)
        .setDepth(9601);
      this.stars.push(st);
    }
    if (this.minimap) {
      this.minimap.ignore([this.hudText, this.hintText]);
    }
    this.skyTick();
  }

  private skyTick() {
    let elapsed = this.time.now;
    let forceDay = false;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('noche') === '1') {
        elapsed = DAY_LENGTH_MS * 0.75; // medianoche fija para fotos y curiosos
      }
      forceDay = q.get('dia') === '1';
    } catch { /* sin window en SSR: nunca ocurre aquí */ }
    const s = skyAt(elapsed, DAY_LENGTH_MS);
    if (forceDay) {
      s.overlayAlpha = 0;
      s.lanternAlpha = 0;
      s.starsAlpha = 0;
    }
    // el div HTML de GameCanvas lee esto para el tinte (evita misterios de cámara)
    (window as unknown as { __sky?: object }).__sky = { color: s.overlayColor, alpha: s.overlayAlpha };
    for (const st of this.stars) st.setAlpha(s.starsAlpha * (0.4 + Math.random() * 0.6));
    for (const l of this.lanterns) l.setAlpha(s.lanternAlpha);
  }

  /** Parcelas de trigo alrededor de cada granja: crecen y se cosechan (+1 grano). */
  private plantWheat(x: number, y: number, depth: number) {
    const spots: [number, number][] = [[-72, 14], [0, 30], [72, 14]];
    for (const [dx, dy] of spots) {
      const stage = WL_WHEAT_ORDER[0];
      const art = WL_WHEAT[stage];
      if (!art) continue;
      const sp = this.add.sprite(x + dx, y + dy, `wl-wheat-${stage}`, 0)
        .setOrigin(art.hotspot[0] / art.fw, art.hotspot[1] / art.fh).setDepth(depth - 2);
      sp.play(`wl-wheat-${stage}`);
      this.wheatPlots.push({ sprite: sp, stageIdx: 0 });
    }
  }

  private wheatTick() {
    let harvested = 0;
    for (const p of this.wheatPlots) {
      if (!p.sprite.active) continue;
      p.stageIdx++;
      if (p.stageIdx >= WL_WHEAT_ORDER.length) {
        p.stageIdx = 0;
        harvested++;
      }
      const stage = WL_WHEAT_ORDER[p.stageIdx];
      const art = WL_WHEAT[stage];
      if (!art) continue;
      p.sprite.setTexture(`wl-wheat-${stage}`, 0);
      p.sprite.setOrigin(art.hotspot[0] / art.fw, art.hotspot[1] / art.fh);
      p.sprite.play(`wl-wheat-${stage}`);
    }
    if (harvested > 0) {
      this.stock.grano += harvested;
      this.updateHud();
      playSfx('pluck');
    }
  }

  /** Fauna ambiente: conejos, ovejas, ciervos y patos en sus zonas. */
  private spawnCritters() {
    const crew: [string, number][] = [['bunny', 3], ['sheep', 2], ['deer', 1], ['duck', 2]];
    for (const [name, n] of crew) {
      const c = WL_CRITTERS[name];
      if (!c || !c.dirs.e) continue;
      for (let i = 0; i < n; i++) {
        let tx = this.center.x;
        let ty = this.center.y;
        if (name === 'duck' && this.waterCells.length) {
          const wcell = this.waterCells[Phaser.Math.Between(0, this.waterCells.length - 1)];
          tx = Phaser.Math.Clamp(wcell.x + Phaser.Math.Between(-2, 2), 2, MAP - 3);
          ty = Phaser.Math.Clamp(wcell.y + Phaser.Math.Between(-2, 2), 2, MAP - 3);
        } else {
          tx = Phaser.Math.Clamp(Math.round(this.center.x + Phaser.Math.Between(-7, 7)), 2, MAP - 3);
          ty = Phaser.Math.Clamp(Math.round(this.center.y + Phaser.Math.Between(-7, 7)), 2, MAP - 3);
        }
        const { x, y } = this.iso(tx, ty);
        const s = this.add.sprite(x, y - 8, `wl-crit-${name}-e`, 0).setDepth(7400);
        s.setScale(name === 'bunny' ? 1.2 : 1.1);
        s.play(`wl-crit-${name}-e`);
        const shadow = this.add.image(x, y - 1, 'shadow').setDepth(7399).setAlpha(0.5).setScale(0.8);
        const w = this.makeWalker(s, shadow, name, 'critter');
        w.speed = name === 'bunny' ? 85 : 45;
        this.assignJob(w);
      }
    }
  }

  private pickTile(list: { x: number; y: number }[], nearX: number, nearY: number, maxD: number): { x: number; y: number } {
    let best = { x: Math.round(nearX), y: Math.round(nearY) };
    let bestD = Infinity;
    for (let i = 0; i < 12; i++) {
      const c = list[Phaser.Math.Between(0, list.length - 1)];
      if (!c) break;
      const d = Math.hypot(c.x - nearX, c.y - nearY);
      if (d < maxD && d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  private spawnPerson(tex: string) {
    const tx = Phaser.Math.Clamp(Math.round(this.center.x + Phaser.Math.Between(-5, 5)), 3, MAP - 4);
    const ty = Phaser.Math.Clamp(Math.round(this.center.y + Phaser.Math.Between(-5, 5)), 3, MAP - 4);
    const { x, y } = this.iso(tx, ty);
    const s = this.add.sprite(x, y - 15, `wl-${tex}-e`, 0).setDepth(8000);
    const fh = WL_WORKERS[tex]?.dirs.e?.fh ?? 42;
    s.setScale(wlWorkerScale(fh));
    const shadow = this.add.image(x, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
    const w = this.makeWalker(s, shadow, tex, 'settler');
    this.assignJob(w);
  }

  // ============ Motor de movimiento real (A* + waypoints + 6 dirs) ============
  private dir6(dx: number, dy: number): 'e' | 'se' | 'sw' | 'w' | 'nw' | 'ne' {
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (a >= -30 && a < 30) return 'e';
    if (a >= 30 && a < 90) return 'se';
    if (a >= 90 && a < 150) return 'sw';
    if (a >= 150 || a < -150) return 'w';
    if (a >= -150 && a < -90) return 'nw';
    return 'ne';
  }

  private tileBlocked(tx: number, ty: number, gx: number, gy: number, allowWater = false): boolean {
    if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1) return true;
    if (tx === gx && ty === gy) return false; // el destino siempre vale
    const t = terrainAt(tx, ty);
    if (!allowWater && (t === 'water' || t === 'waterB' || t === 'waterC')) return true;
    if (t === 'mountain') return true;
    if (this.buildingTiles.has(`${tx},${ty}`)) return true;
    return false;
  }

  private walkerTile(w: Walker): GridPos {
    const t = this.groundLayer.worldToTileXY(w.sprite.x, w.sprite.y);
    return { x: Phaser.Math.Clamp(t?.x ?? this.center.x, 0, MAP - 1), y: Phaser.Math.Clamp(t?.y ?? this.center.y, 0, MAP - 1) };
  }

  private makeWalker(sprite: Phaser.GameObjects.Sprite, shadow: Phaser.GameObjects.Image, role: string, kind: 'settler' | 'critter'): Walker {
    const w: Walker = {
      sprite, shadow, role, kind, path: [], targetPx: null,
      speed: kind === 'critter' ? 55 : 68, state: 'idle', stateT: Math.random() * 1.5,
      onArrive: null, loaded: false, goods: null, goodsIcon: null,
    };
    this.walkers.push(w);
    return w;
  }

  private sendWalker(w: Walker, tx: number, ty: number, onArrive: (() => void) | null = null): boolean {
    const from = this.walkerTile(w);
    const allowWater = w.kind === 'critter' && w.role === 'duck';
    const blocked = (x: number, y: number) => this.tileBlocked(x, y, tx, ty, allowWater);
    const raw = findPath(from, { x: tx, y: ty }, MAP, MAP, blocked);
    if (!raw || raw.length < 2) {
      w.state = 'idle';
      w.stateT = 0.5 + Math.random();
      w.onArrive = null;
      this.playIdle(w);
      return false;
    }
    w.path = smoothPath(raw, blocked).slice(1);
    w.onArrive = onArrive;
    w.state = 'walk';
    const next = w.path.shift()!;
    const p = this.iso(next.x, next.y);
    w.targetPx = { x: p.x, y: p.y - 15 };
    return true;
  }

  private playWalk(w: Walker, dx: number, dy: number) {
    const dir = this.dir6(dx, dy);
    const role = w.role;
    if (w.kind === 'critter') {
      const key = `wl-crit-${role}-${dir}`;
      if (WL_CRITTERS[role]?.dirs[dir] && this.anims.exists(key)) {
        w.sprite.setTexture(`wl-crit-${role}-${dir}`);
        w.sprite.play(key, true);
        return;
      }
    }
    const prefix = w.loaded && WL_WORKERS[role]?.loads?.[dir] ? `wl-${role}-load-${dir}` : `wl-${role}-${dir}`;
    const key = w.loaded && WL_WORKERS[role]?.loads?.[dir] ? `wl-walkload-${role}-${dir}` : `wl-walk-${role}-${dir}`;
    const has = w.loaded
      ? WL_WORKERS[role]?.loads?.[dir as 'e' | 'se' | 'sw' | 'w' | 'nw' | 'ne']
      : WL_WORKERS[role]?.dirs[dir as 'e' | 'se' | 'sw' | 'w' | 'nw' | 'ne'];
    if (has && this.anims.exists(key)) {
      w.sprite.setTexture(prefix);
      w.sprite.play(key, true);
    } else if (WL_WORKERS[role]?.dirs.e && this.anims.exists(`wl-walk-${role}-e`)) {
      // fallback este/oeste si falta alguna diagonal
      const fb = dx >= 0 ? 'e' : 'w';
      w.sprite.setTexture(`wl-${role}-${fb}`);
      w.sprite.play(`wl-walk-${role}-${fb}`, true);
    }
  }

  private playIdle(w: Walker) {
    if (w.kind === 'critter') return;
    const key = `wl-idle-${w.role}`;
    if (WL_WORKERS[w.role]?.idle && this.anims.exists(key)) {
      w.sprite.setTexture(`wl-${w.role}-idle`);
      w.sprite.play(key, true);
    }
  }

  private playWork(w: Walker) {
    const key = `wl-hack-${w.role}`;
    if (WL_WORKERS[w.role]?.hack && this.anims.exists(key)) {
      w.sprite.setTexture(`wl-${w.role}-hack`);
      w.sprite.play(key, true);
      return true;
    }
    this.playIdle(w);
    return false;
  }

  private rest(w: Walker, secs: number, then: (() => void) | null = null) {
    w.state = 'idle';
    w.stateT = secs;
    w.onArrive = then;
    this.playIdle(w);
  }

  private updateWalkers(deltaMs: number) {
    const dt = deltaMs / 1000;
    for (const w of this.walkers) {
      if (!w.sprite.active) continue;
      if (w.state === 'idle' || w.state === 'work') {
        w.stateT -= dt;
        if (w.stateT <= 0) {
          const cb = w.onArrive;
          w.onArrive = null;
          w.state = 'idle';
          if (cb) cb();
          else this.assignJob(w);
        }
        continue;
      }
      // walk
      if (!w.targetPx) {
        const cb = w.onArrive;
        w.onArrive = null;
        w.state = 'idle';
        this.playIdle(w);
        if (cb) cb();
        else this.assignJob(w);
        continue;
      }
      const s = w.sprite;
      const dx = w.targetPx.x - s.x;
      const dy = w.targetPx.y - s.y;
      const dist = Math.hypot(dx, dy);
      const step = w.speed * dt;
      if (dist <= Math.max(4, step)) {
        s.x = w.targetPx.x;
        s.y = w.targetPx.y;
        const next = w.path.shift();
        if (!next) {
          w.targetPx = null;
          const cb = w.onArrive;
          w.onArrive = null;
          w.state = 'idle';
          this.playIdle(w);
          if (cb) cb();
          else this.assignJob(w);
        } else {
          const p = this.iso(next.x, next.y);
          w.targetPx = { x: p.x, y: p.y - 15 };
        }
      } else {
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
        this.playWalk(w, dx, dy);
      }
      w.shadow.setPosition(s.x, s.y + 13);
      s.setDepth(7500 + Math.round(s.y / 4));
      w.shadow.setDepth(7499 + Math.round(s.y / 4));
      if (w.goodsIcon) {
        w.goodsIcon.setPosition(s.x + 10, s.y - 30);
        w.goodsIcon.setDepth(7501 + Math.round(s.y / 4));
      }
    }
  }

  // ============ Barcos: circuitos de pesca desde el puerto ============
  private waterBlocked(tx: number, ty: number, gx: number, gy: number): boolean {
    if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1) return true;
    if (tx === gx && ty === gy) return false;
    return !isNavigable(terrainAt(tx, ty));
  }

  private spawnShip(portTx: number, portTy: number) {
    const mine = this.ships.filter((s) => s.home.x === portTx && s.home.y === portTy).length;
    if (mine >= 2) return;
    // agua adyacente al puerto para botar
    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    let start: GridPos | null = null;
    for (const [dx, dy] of deltas) {
      const t = terrainAt(portTx + dx, portTy + dy);
      if (isNavigable(t)) { start = { x: portTx + dx, y: portTy + dy }; break; }
    }
    if (!start) return;
    const { x, y } = this.iso(start.x, start.y);
    const sprite = this.add.sprite(x, y, 'wl-ship-e', 0).setDepth(4500).setScale(0.9);
    sprite.play('wl-ship-e');
    const ship: Ship = {
      sprite, path: [], targetPx: null, circuit: [], leg: 0,
      home: { x: portTx, y: portTy }, wakeT: 0,
    };
    this.ships.push(ship);
    playSfx('splash');
    this.sendShip(ship);
  }

  private sendShip(ship: Ship) {
    ship.circuit = pickFishingCircuit(
      ship.home,
      (x, y) => isNavigable(terrainAt(x, y)),
      MAP, MAP, 9, 4,
    );
    ship.circuit.push({ ...ship.home });
    ship.leg = 0;
    this.sailTo(ship, ship.circuit[0]);
  }

  private sailTo(ship: Ship, dest: GridPos) {
    const from = this.groundLayer.worldToTileXY(ship.sprite.x, ship.sprite.y) ?? ship.home;
    const fx = Phaser.Math.Clamp(from.x, 0, MAP - 1);
    const fy = Phaser.Math.Clamp(from.y, 0, MAP - 1);
    const raw = findPath({ x: fx, y: fy }, dest, MAP, MAP, (x, y) => this.waterBlocked(x, y, dest.x, dest.y));
    if (!raw || raw.length < 2) {
      ship.path = [];
      ship.targetPx = null;
      return;
    }
    ship.path = smoothPath(raw, (x, y) => this.waterBlocked(x, y, dest.x, dest.y)).slice(1);
    const next = ship.path.shift()!;
    const p = this.iso(next.x, next.y);
    ship.targetPx = { x: p.x, y: p.y - 6 };
  }

  private updateShips(dt: number) {
    for (const ship of this.ships) {
      const s = ship.sprite;
      if (!s.active) continue;
      if (!ship.targetPx) {
        // fin de tramo: pescar o volver
        if (ship.leg < ship.circuit.length - 1) {
          ship.leg++;
          this.sailTo(ship, ship.circuit[ship.leg]);
        } else {
          // travesía completa: pescado al almacén
          this.stock.pez += 2;
          this.updateHud();
          playSfx('splash');
          this.sendShip(ship);
        }
        continue;
      }
      const dx = ship.targetPx.x - s.x;
      const dy = ship.targetPx.y - s.y;
      const dist = Math.hypot(dx, dy);
      const step = 95 * dt;
      if (dist <= Math.max(5, step)) {
        s.x = ship.targetPx.x;
        s.y = ship.targetPx.y;
        const next = ship.path.shift();
        if (!next) {
          ship.targetPx = null;
        } else {
          const p = this.iso(next.x, next.y);
          ship.targetPx = { x: p.x, y: p.y - 6 };
        }
      } else {
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
        const dir = this.dir6(dx, dy);
        const key = `wl-ship-${dir}`;
        if (this.anims.exists(key) && s.anims.currentAnim?.key !== key) {
          s.setTexture(`wl-ship-${dir}`);
          s.play(key, true);
        }
      }
      // estela
      ship.wakeT -= dt;
      if (ship.wakeT <= 0) {
        ship.wakeT = 0.35;
        const foam = this.add.circle(s.x - 10, s.y + 8, 4, 0xffffff, 0.4).setDepth(4499);
        this.tweens.add({ targets: foam, alpha: 0, scale: 2.4, duration: 1200, onComplete: () => foam.destroy() });
      }
      s.setDepth(4500);
    }
  }

  /** Cerebro por oficio: encadena ir → trabajar → volver. */
  private assignJob(w: Walker) {
    if (!w.sprite.active || w.state === 'walk' || w.state === 'work') return;
    const role = w.role;
    if (w.kind === 'critter') {
      const cur = this.walkerTile(w);
      const nx = Phaser.Math.Clamp(cur.x + Phaser.Math.Between(-4, 4), 2, MAP - 3);
      const ny = Phaser.Math.Clamp(cur.y + Phaser.Math.Between(-4, 4), 2, MAP - 3);
      if (!this.sendWalker(w, nx, ny)) this.rest(w, 1 + Math.random() * 2);
      return;
    }
    const cabana = this.placed.find((p) => p.id === 'cabanaLenador');
    const almacen = this.placed[0];
    const mina = this.placed.find((p) => p.id === 'minaCarbon' || p.id === 'minaHierro' || p.id === 'minaOro');
    const near = (tiles: { x: number; y: number }[], maxD: number) => {
      if (!tiles.length) return null;
      return this.pickTile(tiles, this.center.x, this.center.y, maxD);
    };
    switch (role) {
      case 'woodcutter': {
        if (!cabana) { this.stroll(w); break; }
        const t = near(this.forestTiles, 12);
        if (!t) { this.stroll(w); break; }
        if (!this.sendWalker(w, t.x, t.y, () => {
          w.state = 'work';
          w.stateT = 3.5 + Math.random() * 1.5;
          w.onArrive = () => this.sendWalker(w, cabana.tx, cabana.ty, () => this.assignJob(w));
          if (this.playWork(w)) {
            this.time.delayedCall(900, () => playSfx('chop'));
            this.time.delayedCall(2400, () => playSfx('chop'));
          }
        })) this.stroll(w);
        break;
      }
      case 'miner': {
        if (!mina || !almacen) { this.stroll(w); break; }
        if (!this.sendWalker(w, mina.tx, mina.ty, () => {
          w.state = 'work'; w.stateT = 3 + Math.random() * 2;
          w.onArrive = () => this.sendWalker(w, almacen.tx, almacen.ty, () => this.assignJob(w));
          this.playWork(w);
        })) this.stroll(w);
        break;
      }
      case 'fisher': {
        const t = near(this.shoreTiles, 13);
        if (!t) { this.stroll(w); break; }
        if (!this.sendWalker(w, t.x, t.y, () => {
          w.state = 'work'; w.stateT = 4 + Math.random() * 3;
          w.onArrive = () => this.assignJob(w);
          this.playWork(w);
        })) this.stroll(w);
        break;
      }
      case 'carrier': {
        if (this.placed.length < 2 || !almacen) { this.stroll(w); break; }
        const b = this.placed[Phaser.Math.Between(1, this.placed.length - 1)];
        w.loaded = false;
        this.setGoods(w, null);
        if (!this.sendWalker(w, b.tx, b.ty, () => {
          w.loaded = true; // carga mercancía del edificio y vuelve al almacén
          this.setGoods(w, goodsFor(b.id));
          this.sendWalker(w, almacen.tx, almacen.ty, () => {
            w.loaded = false;
            this.setGoods(w, null);
            this.assignJob(w);
          });
        })) this.stroll(w);
        break;
      }
      case 'soldier':
      case 'archer': {
        const towers = this.placed.filter((p) => p.id === 'torre' || p.id === 'cuartel');
        const t = towers.length ? towers[Phaser.Math.Between(0, towers.length - 1)] : almacen;
        if (!t) { this.stroll(w); break; }
        const gx = Phaser.Math.Clamp(t.tx + Phaser.Math.Between(-3, 3), 2, MAP - 3);
        const gy = Phaser.Math.Clamp(t.ty + Phaser.Math.Between(-3, 3), 2, MAP - 3);
        if (!this.sendWalker(w, gx, gy, () => this.rest(w, 2 + Math.random() * 3))) this.stroll(w);
        break;
      }
      default:
        this.stroll(w);
    }
  }

  /** Icono de mercancía sobre el portador cargado. */
  private setGoods(w: Walker, goods: ResourceId | null) {
    w.goods = goods;
    if (w.goodsIcon) {
      w.goodsIcon.destroy();
      w.goodsIcon = null;
    }
    if (goods) {
      w.goodsIcon = this.add.image(w.sprite.x + 10, w.sprite.y - 30, `wl-icon-res-${goods}`)
        .setScale(0.62).setDepth(8000);
    }
  }

  private stroll(w: Walker) {
    const nx = Phaser.Math.Clamp(Math.round(this.center.x + Phaser.Math.Between(-6, 6)), 2, MAP - 3);
    const ny = Phaser.Math.Clamp(Math.round(this.center.y + Phaser.Math.Between(-6, 6)), 2, MAP - 3);
    if (!this.sendWalker(w, nx, ny)) this.rest(w, 1 + Math.random() * 2);
  }

  /** Coloca lo que el diseñador marcó en Tiled (capa Logica). */
  private placeFromLogicLayer() {
    const map = this.make.tilemap({ key: 'isla-01' });
    const layer = map.getObjectLayer('Logica');
    if (!layer) return;
    for (const o of layer.objects) {
      const t = this.groundLayer.worldToTileXY(o.x ?? 0, o.y ?? 0);
      if (!t) continue;
      const edificio = o.properties?.find((p: { name: string }) => p.name === 'edificio')?.value as BuildingId | undefined;
      const oficio = o.properties?.find((p: { name: string }) => p.name === 'oficio')?.value as string | undefined;
      if (edificio && BUILDINGS[edificio]) this.tryPlace(edificio, t.x, t.y, true);
      else if (oficio && WL_WORKERS[oficio]) {
        const { x, y } = this.iso(t.x, t.y);
        const s = this.add.sprite(x, y - 15, `wl-${oficio}-e`, 0).setDepth(8000);
        s.setScale(wlWorkerScale(WL_WORKERS[oficio].dirs.e?.fh ?? 42));
        s.play(`wl-walk-${oficio}-e`);
        const shadow = this.add.image(x, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
        const w = this.makeWalker(s, shadow, oficio, 'settler');
        this.assignJob(w);
      }
    }
  }

  private placeExtraInitial() {
    this.tryPlace('cantera', this.center.x + 3, this.center.y - 2, true);
    this.tryPlace('residenciaS', this.center.x - 1, this.center.y + 3, true);
    this.tryPlace('residenciaM', this.center.x + 2, this.center.y + 4, true);
    this.tryPlace('granja', this.center.x + 5, this.center.y + 2, true);
    this.tryPlace('molino', this.center.x + 6, this.center.y - 1, true);
    this.tryPlace('pozo', this.center.x + 1, this.center.y + 1, true);
    this.tryPlace('torre', this.center.x - 5, this.center.y - 4, true);
    this.tryPlace('ornamento', this.center.x + 1, this.center.y - 3, true);
  }

  onTileClicked(tx: number, ty: number) {
    const ww = window as unknown as { __inspect?: object | null };
    if (!this.pendingBuild) {
      // selección: publica la ficha para el panel React
      const game = (window as unknown as { __game?: { inspect: (x: number, y: number) => object | null } }).__game;
      ww.__inspect = game?.inspect(tx, ty) ?? null;
      if (ww.__inspect) playSfx('select');
      return;
    }
    const t = terrainAt(tx, ty);
    if (t === 'water' || t === 'waterB' || t === 'waterC') {
      this.hintText.setText('⛔ No se puede construir en el agua').setY(44);
      this.time.delayedCall(1500, () => this.hintText.setText(''));
      return;
    }
    this.tryPlace(this.pendingBuild, tx, ty, false);
    this.pendingBuild = null;
    this.hintText.setText('');
  }

  tryPlace(id: BuildingId, tx: number, ty: number, free: boolean): boolean {
    const def = BUILDINGS[id];
    const art = WL_BUILDINGS[id];
    if (!art) return false;
    if (!free) {
      const ok = (Object.entries(def.coste) as [ResourceId, number][]).every(([k, v]) => this.stock[k] >= v);
      if (!ok) {
        this.hintText.setText(`⛔ Faltan recursos para ${def.nombre}`).setY(44);
        playSfx('error');
        this.time.delayedCall(1500, () => this.hintText.setText(''));
        return false;
      }
      for (const [k, v] of Object.entries(def.coste) as [ResourceId, number][]) this.stock[k] -= v;
      playSfx('confirm');
    }
    const scale = wlBuildingScale(art.w, art.h);
    const { x, y } = this.iso(tx, ty);
    if (id === 'puerto' || id === 'pesqueria') {
      const at = (ax: number, ay: number) => (ax < 0 || ay < 0 || ax >= MAP || ay >= MAP ? null : terrainAt(ax, ay));
      if (!touchesWater(tx, ty, at)) {
        this.hintText.setText(`⛔ ${def.nombre} necesita agua adyacente`).setY(44);
        playSfx('error');
        this.time.delayedCall(1500, () => this.hintText.setText(''));
        return false;
      }
    }
    const depth = 6000 + ty * 4;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(this.add.image(0, -2, 'shadow').setAlpha(0.75).setScale(3.0));
    this.surroundings(id, x, y, depth, parts);
    // ancla por hotspot oficial de Widelands
    const ox = art.hotspot[0] / art.w;
    const oy = art.hotspot[1] / art.h;
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (art.mode === 'sheet') {
      const sp = this.add.sprite(0, 0, `wl-sheet-${id}`, 0).setOrigin(ox, oy).setScale(scale);
      sp.play(`wl-b-${id}`);
      img = sp;
    } else {
      img = this.add.image(0, 0, WL_TEX[id]).setOrigin(ox, oy).setScale(scale);
    }
    parts.push(img);
    const name = this.add.text(0, 10, def.nombre, { fontSize: '9px', color: '#fff', backgroundColor: '#00000077', padding: { x: 4, y: 2 } }).setOrigin(0.5);
    parts.push(name);
    const c = this.add.container(x, y, parts).setDepth(depth);
    img.setAlpha(0); // se revela al terminar la obra
    // Etapa de obra: si hay sheet de construcción oficial se muestra creciendo;
    // si no, andamio procedural + edificio atenuado.
    let buildFx: Phaser.GameObjects.GameObject | null = null;
    if (art.build) {
      const b = art.build;
      const bs = this.add.sprite(0, 0, `wl-buildsheet-${id}`, 0)
        .setOrigin(b.hotspot[0] / b.fw, b.hotspot[1] / b.fh).setScale(scale);
      bs.play(`wl-build-${id}`);
      c.add(bs);
      buildFx = bs;
    } else {
      const scaffold = this.add.image(0, -44, 'scaffold').setOrigin(0.5, 1).setAlpha(0.95).setScale(1.3);
      c.add(scaffold);
      img.setAlpha(0.45);
      buildFx = scaffold;
    }
    const worker = this.add.image(30, -12, 'wl-carrier-e', 4).setScale(wlWorkerScale(42));
    c.add(worker);
    this.tweens.add({ targets: worker, y: -16, duration: 380, yoyo: true, repeat: 8 });
    this.drawPath(x, y, depth - 1);
    this.tweens.add({
      targets: buildFx ? [buildFx] : [], alpha: 0, duration: Math.min(def.tiempoConstruccionMs, 4000),
      onComplete: () => {
        buildFx?.destroy(); worker.destroy(); img.setAlpha(1); this.popIn(img, scale);
        playSfx('built');
        if (id === 'puerto') this.spawnShip(tx, ty);
      },
    });
    this.placed.push({ id, tx, ty, sprite: c, done: 0, total: def.tiempoConstruccionMs });
    this.buildingTiles.add(`${tx},${ty}`);
    if (WL_SMOKE.has(id)) this.addSmoke(x, y - art.h * scale * 0.85, depth + 1);
    if (id === 'granja') this.plantWheat(x, y, depth);
    // farol nocturno sobre la puerta
    const lamp = this.add.image(x, y - art.h * scale * 0.55, 'glow')
      .setDepth(depth + 2).setScale(0.9).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.lanterns.push(lamp);
    if (id === 'torre') this.territoryRadius += 1.5;
    if (id === 'cuartel') {
      if (!free) playSfx('sword');
      for (const t of ['soldier', 'archer']) {
        const s = this.add.sprite(x + 30, y - 15, `wl-${t}-e`, 0).setDepth(8000);
        s.setScale(wlWorkerScale(WL_WORKERS[t]?.dirs.e?.fh ?? 42));
        s.play(`wl-walk-${t}-e`);
        const shadow = this.add.image(x + 30, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
        const w = this.makeWalker(s, shadow, t, 'settler');
        this.assignJob(w);
      }
    }
    this.updateHud();
    return true;
  }

  private popIn(img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, base: number) {
    img.setScale(base * 0.85);
    this.tweens.add({ targets: img, scale: base, duration: 300, ease: 'Back.easeOut' });
  }

  private surroundings(id: BuildingId, x: number, y: number, depth: number, parts: Phaser.GameObjects.GameObject[]) {
    const add = (tex: string, dx: number, dy: number, s = 1.0, alpha = 1) => {
      const p = this.add.image(dx, dy, tex).setScale(s).setAlpha(alpha);
      parts.push(p);
    };
    switch (id) {
      case 'almacen': add('crates', -64, -6); add('fence', 58, -4); break;
      case 'cabanaLenador': add('logs', -62, -4); add('stump', 54, -2); break;
      case 'aserradero': add('logs', 62, -4); break;
      case 'cantera': add('stones', 58, -4); break;
      case 'residenciaS': case 'residenciaM': case 'residenciaL':
        add('fence', -62, -2); add('wl-bush-1', 52, 0); break;
      case 'granja':
        add('fence', -68, -2); add('fence', 68, -2); break;
      case 'pozo': add('wl-bush-1', -44, 0); break;
      case 'fundicion': case 'herreria': add('crates', 62, -4); break;
      case 'cuartel': case 'armeria': add('fence', -64, -2); add('fence', 64, -2); break;
      case 'torre': add('stones', 52, -2, 0.8); break;
      case 'ornamento': add('wl-bush-1', -58, 0); add('wl-bush-2', 58, 0); add('tuft', -38, 2); add('tuft', 38, 2); break;
      default: break;
    }
  }

  private drawPath(x: number, y: number, depth: number) {
    if (!this.placed.length) return;
    const a = this.iso(this.placed[0].tx, this.placed[0].ty);
    const steps = 7;
    for (let i = 1; i < steps; i++) {
      const px = a.x + ((x - a.x) * i) / steps + Phaser.Math.Between(-14, 14);
      const py = a.y + ((y - a.y) * i) / steps + Phaser.Math.Between(-8, 8);
      this.add.image(px, py + 8, 'pathdot').setDepth(depth).setAlpha(0.5).setScale(1.2);
    }
  }

  private addSmoke(x: number, y: number, depth: number) {
    const wind = 10; // deriva constante hacia el este
    const puff = () => {
      if (!this.scene.isActive()) return;
      const dx = Phaser.Math.Between(-4, 4);
      const halo = this.add.circle(x + dx, y, 6, 0x9aa0aa, 0.35).setDepth(depth);
      const core = this.add.circle(x + dx, y - 2, 3.4, 0xf5f0e8, 0.6).setDepth(depth + 0.1);
      for (const [p, rise, drift, grow] of [[halo, -34, wind + 8, 2.6], [core, -26, wind + 4, 2.0]] as const) {
        this.tweens.add({
          targets: p, y: y + rise, x: x + dx + drift, alpha: 0, scale: grow,
          duration: 2100, onComplete: () => p.destroy(),
        });
      }
    };
    this.time.addEvent({ delay: 850, loop: true, callback: puff });
  }

  private setupAmbient() {
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(-1400, 1400);
      const y = Phaser.Math.Between(-500, 500);
      const cloud = this.add.image(x, y, 'cloud').setDepth(9300).setAlpha(0.8).setScale(1.6 + Math.random() * 1.4);
      const shade = this.add.ellipse(x, y + 300, 200, 55, 0x000000, 0.1).setDepth(9390);
      const speed = Phaser.Math.Between(60000, 110000);
      this.tweens.add({
        targets: [cloud], x: x + 3200, duration: speed, repeat: -1,
        onUpdate: () => shade.setPosition(cloud.x, cloud.y + 300),
        onRepeat: () => { cloud.x = -1800; },
      });
    }
    const birdFly = () => {
      if (!this.scene.isActive()) return;
      const y = Phaser.Math.Between(-400, 600);
      const b = this.add.image(-1600, y, 'bird').setDepth(9350).setScale(2.4);
      this.tweens.add({ targets: b, x: 1800, duration: Phaser.Math.Between(9000, 14000), onComplete: () => b.destroy() });
      this.tweens.add({ targets: b, scaleY: 0.7, duration: 220, yoyo: true, repeat: 40 });
    };
    this.time.addEvent({ delay: 7000, loop: true, callback: birdFly });
    for (let i = 0; i < 4; i++) {
      const c = this.iso(this.center.x + Phaser.Math.Between(-4, 4), this.center.y + Phaser.Math.Between(-4, 4));
      const f = this.add.image(c.x, c.y - 20, 'butterfly').setDepth(8600).setScale(2);
      const flutter = () => {
        if (!f.active) return;
        this.tweens.add({
          targets: f, x: f.x + Phaser.Math.Between(-80, 80), y: f.y + Phaser.Math.Between(-40, 40),
          duration: Phaser.Math.Between(1400, 2600), ease: 'Sine.easeInOut', onComplete: flutter,
        });
      };
      flutter();
    }
  }

  private tickEconomy() {
    const auto: Partial<Record<BuildingId, { in: Partial<Record<ResourceId, number>>; out: Partial<Record<ResourceId, number>> }>> = {
      cabanaLenador: { in: {}, out: { madera: 2 } },
      cantera: { in: {}, out: { piedra: 2 } },
      granja: { in: {}, out: { grano: 2 } },
      pozo: { in: {}, out: { agua: 2 } },
      pesqueria: { in: {}, out: { pez: 2 } },
      minaCarbon: { in: { pan: 1 }, out: { carbon: 2 } },
      minaHierro: { in: { pan: 1 }, out: { hierro: 2 } },
      minaOro: { in: { pan: 1 }, out: { oro: 1 } },
    };
    for (const p of this.placed) {
      const rule = auto[p.id];
      if (rule) {
        const can = Object.entries(rule.in).every(([k, v]) => this.stock[k as ResourceId] >= (v ?? 0));
        if (can) {
          for (const [k, v] of Object.entries(rule.in)) this.stock[k as ResourceId] -= v ?? 0;
          for (const [k, v] of Object.entries(rule.out)) this.stock[k as ResourceId] += v ?? 0;
        }
      }
    }
    const recipeByBuilding: Partial<Record<BuildingId, string>> = RECIPE_BY_BUILDING;
    for (const p of this.placed) {
      const rid = recipeByBuilding[p.id];
      if (!rid) continue;
      let job = this.jobs.find((j) => j.edificio === p.id);
      if (!job) { job = { recipeId: rid, edificio: p.id, progresoMs: 0, duracionMs: 8000 }; this.jobs.push(job); }
      const r = tickJob(this.stock, job, 1000);
      this.stock = r.stock;
      Object.assign(job, r.job);
    }
    this.updateHud();
  }

  private updateHud() {
    const s = this.stock;
    this.hudText?.setText(`🪵${s.madera}  🧱${s.tablon}/${s.piedra}  🌾${s.grano} 🍞${s.pan} 💧${s.agua} 🐟${s.pez}  ⛏${s.carbon}/${s.hierro}/${s.oro} 👑${s.lingoteOro}  🛠${s.herramienta} ⚔${s.espada} 🏹${s.arco}  🏠${this.placed.length}`);
    (window as unknown as { __stock?: Stock }).__stock = { ...this.stock };
  }

  private exposeBridge() {
    const w = window as unknown as {
      __game?: {
        place: (id: BuildingId) => void;
        stock: () => Stock;
        counts: () => number;
        inspect: (tx: number, ty: number) => {
          id: BuildingId; nombre: string; descripcion: string; categoria: string;
          receta?: { in: [string, number][]; out: [string, number][] };
          produciendo: boolean;
        } | null;
      };
    };
    w.__game = {
      place: (id: BuildingId) => {
        this.pendingBuild = id;
        this.hintText?.setText(`🏗 ${BUILDINGS[id].nombre}: clic en una loseta (ESC cancela)`).setY(44);
      },
      stock: () => ({ ...this.stock }),
      counts: () => this.placed.length,
      inspect: (tx: number, ty: number) => {
        const p = this.placed.find((q) => q.tx === tx && q.ty === ty);
        if (!p) return null;
        const def = BUILDINGS[p.id];
        const rid = RECIPE_BY_BUILDING[p.id];
        const recipe = rid ? RECIPES.find((r) => r.id === rid) : undefined;
        return {
          id: p.id,
          nombre: def.nombre,
          descripcion: def.descripcion,
          categoria: def.categoria,
          receta: recipe ? {
            in: Object.entries(recipe.entradas) as [string, number][],
            out: Object.entries(recipe.salidas) as [string, number][],
          } : undefined,
          produciendo: !!recipe,
        };
      },
    };
  }

  override update(_time: number, delta: number) {
    const cam = this.cameras.main;
    const speed = 22 / cam.zoom;
    const keys = this.input.keyboard?.createCursorKeys();
    if (keys?.left.isDown || this.wasd?.A.isDown) cam.scrollX -= speed;
    if (keys?.right.isDown || this.wasd?.D.isDown) cam.scrollX += speed;
    if (keys?.up.isDown || this.wasd?.W.isDown) cam.scrollY -= speed;
    if (keys?.down.isDown || this.wasd?.S.isDown) cam.scrollY += speed;
    const dt = Math.min(delta, 100) / 1000;
    this.updateWalkers(dt * 1000);
    this.updateShips(dt);
  }
}