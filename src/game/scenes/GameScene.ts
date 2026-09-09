import Phaser from 'phaser';
import { playSfx } from '../audio';
import { BUILDINGS, INITIAL_STOCK, RECIPES, type BuildingId, type ResourceId } from '../data/buildings';
import { WL_BUILDINGS, WL_BUSHES, WL_CRITTERS, WL_GRASS, WL_RES_ICONS, WL_ROCKS, WL_SHIPS, WL_SHROOMS, WL_TREES, WL_WHEAT, WL_WHEAT_ORDER, WL_WORKERS, wlBuildingScale, wlWorkerScale } from '../data/wlArt';
import { DAY_LENGTH_MS, skyAt } from '../systems/daynight';
import { findPath, smoothPath, type GridPos } from '../systems/pathfinding';
import { applyDamage, attackReach, recruitCost, soldierDps, towerDps, VICTORY_WAVES, waveSpec } from '../systems/combat';
import { OBJECTIVES, isComplete } from '../systems/objectives';
import { goodsFor, isNavigable, pickFishingCircuit, touchesWater } from '../systems/ships';
import { ISLAND_SIZE, TILE_H, TILE_W, terrainAt } from '../maps/island';
import { missingInputs, payCost, tickAutoProducers, tickJob, type ProductionJob, type Stock } from '../systems/economy';
import { foodPerTick, growthPerTick, housingFor, moraleOf } from '../systems/population';
import { findRivalBase, lateRivalBuild, nextRivalBuild, rivalStartingStock, RIVAL_ORDER, type Owner } from '../systems/rival';
import { addRoad, createRoadNet, deserializeRoads, hasRoad, removeRoad, roadNeighbors, serializeRoads, tileCost, ROAD_SPEED_BONUS, type RoadNet } from '../systems/roads';
import { initWaterFX, updateWaterFX, LEGACY_WATER_BLINK_ENABLED, type WaterFX } from '../fx/water';
import { initAtmosphere, updateSky, registerCloud } from '../fx/atmosphere';

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

interface Placed { id: BuildingId; tx: number; ty: number; sprite: Phaser.GameObjects.Container; done: number; total: number; owner: Owner }

type WlDir6 = 'e' | 'se' | 'sw' | 'w' | 'nw' | 'ne';

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  role: string;
  kind: 'settler' | 'critter';
  /** Bando: los colonos del rival deambulan su base (Fase 4). */
  faction: Owner;
  path: GridPos[];
  targetPx: { x: number; y: number } | null;
  speed: number;
  state: 'idle' | 'walk' | 'work';
  stateT: number;
  onArrive: (() => void) | null;
  loaded: boolean;
  goods: ResourceId | null;
  goodsIcon: Phaser.GameObjects.Image | null;
  hp: number;
  maxHp: number;
  foe: Enemy | null;
}

interface Enemy {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  dmg: number;
  ranged: boolean;
  base: 'soldier' | 'archer';
  /** Incursores neutrales o tropas del rival (guarnición o incursión). */
  side: 'raider' | 'rival';
  mode: 'raid' | 'garrison';
  path: GridPos[];
  targetPx: { x: number; y: number } | null;
  speed: number;
  target: GridPos | null;
  attackT: number;
  bar: Phaser.GameObjects.Graphics;
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

const SAVE_KEY = 'spanish-settlers-b-save-v1';

export class GameScene extends Phaser.Scene {
  stock: Stock = { ...INITIAL_STOCK };
  placed: Placed[] = [];
  walkers: Walker[] = [];
  ships: Ship[] = [];
  buildingTiles = new Set<string>();
  pendingBuild: BuildingId | null = null;
  /** Modo herramienta camino: clic alterna, arrastrar pinta, ESC cancela. */
  pendingRoad = false;
  roads: RoadNet = createRoadNet();
  private roadDecals = new Map<string, Phaser.GameObjects.Container>();
  /** Avisos de producción bloqueada por edificio ("x,y" → recursos que faltan). */
  private stallInfo = new Map<string, ResourceId[]>();
  private stallMarks = new Map<string, Phaser.GameObjects.Text>();
  // ---------- Población (Fase 3): techo real, comida, moral y crecimiento ----------
  private popCount = 20;
  private popProgress = 0;
  private foodAcc = 0;
  private morale = 80;
  // ---------- Rival (Fase 4): colonia IA con sus propias reglas ----------
  private aiStock: Stock = rivalStartingStock();
  private aiCenter: GridPos | null = null;
  private aiRaidT = 0;
  private aiRaids = 0;
  territoryRadius = 7;
  center = { x: MAP / 2, y: MAP / 2 };
  jobs: ProductionJob[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private waterCells: { x: number; y: number; alt: boolean }[] = [];
  private waterFX: WaterFX | null = null;
  private forestTiles: { x: number; y: number }[] = [];
  private shoreTiles: { x: number; y: number }[] = [];
  private hillTiles: { x: number; y: number }[] = [];
  private hoverMarker!: Phaser.GameObjects.Graphics;
  private minimap?: Phaser.Cameras.Scene2D.Camera;
  private wheatPlots: { sprite: Phaser.GameObjects.Sprite; stageIdx: number }[] = [];
  private stars: Phaser.GameObjects.Arc[] = [];
  private lanterns: Phaser.GameObjects.Image[] = [];
  private enemies: Enemy[] = [];
  private buildingHp = new Map<string, { hp: number; maxHp: number; bar: Phaser.GameObjects.Graphics }>();
  private waveNo = 0;
  private kills = 0;
  private wavesRepelled = 0;
  private doneObjectives = new Set<string>();
  private gameStatus: 'playing' | 'victory' | 'defeat' = 'playing';
  private startTime = 0;
  /** Economía con reloj de pared (Fase 2): el tick de simulación no depende
   *  de los FPS (a pocos FPS el reloj de Phaser dilata el tiempo y la
   *  economía se paraba). Acumulador en update() con tope anti-espiral. */
  private econAcc = 0;
  private econLast = 0;
  private econTickNo = 0;

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
    for (const [name] of Object.entries(WL_GRASS)) {
      this.load.image(`wl-grass-${name}`, `/assets/wl/nature/grass-${name}.png`);
    }
    for (const [name] of Object.entries(WL_SHROOMS)) {
      this.load.image(`wl-shroom-${name}`, `/assets/wl/nature/shroom-${name}.png`);
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
    this.setupRival();
    this.spawnPopulation();
    this.spawnCritters();
    this.setupAmbient();
    this.setupNight();
    initAtmosphere(this);
    this.setupMapFrame();
    this.setupParticles();
    this.exposeBridge();
    this.econLast = performance.now();
    if (LEGACY_WATER_BLINK_ENABLED) {
      this.time.addEvent({ delay: 700, loop: true, callback: () => this.animateWater() });
    }
    this.waterFX = initWaterFX(this, this.waterCells, (tx, ty) => this.iso(tx, ty));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.waterFX?.stop());
    this.time.addEvent({ delay: 6000, loop: true, callback: () => this.wheatTick() });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.skyTick() });
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.combatTick() });
    this.time.addEvent({ delay: 60000, loop: true, callback: () => this.saveGame(true) });
    this.startTime = this.time.now;
    this.time.delayedCall(75000, () => this.spawnWave());
    this.time.addEvent({ delay: 100000, loop: true, callback: () => this.spawnWave() });
    this.scale.on('resize', () => this.layoutMinimap());
    // demo para fotos/tests: ?demo=puerto coloca un puerto junto al agua
    try {
      const q = new URLSearchParams(window.location.search).get('demo');
      if (q === 'puerto') {
        this.time.delayedCall(2500, () => this.demoPort());
      } else if (q === 'raid') {
        this.time.delayedCall(6000, () => this.spawnWave());
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
    // this.placeSparkles(); // sustituido por initWaterFX en create()
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
    const grassNames = Object.keys(WL_GRASS);
    const shroomNames = Object.keys(WL_SHROOMS);
    if (t === 'forest' && n > 0.2 && treeNames.length) {
      const name = treeNames[Math.floor(n * treeNames.length) % treeNames.length];
      const art = WL_TREES[name];
      const ox = art.hotspot[0] / art.w;
      const oy = art.hotspot[1] / art.h;
      const tscale = 1.1 + n * 0.5;
      if (art.sheet) {
        const tree = this.add.sprite(x + Phaser.Math.Between(-20, 20), y - 6, `wl-tree-${name}`, 0)
          .setOrigin(ox, oy).setDepth(depth).setScale(tscale);
        tree.play(`wl-tree-${name}`);
        if (n > 0.86) tree.setTint(0xddaa66); // ejemplar otoñal
      } else {
        const tree = this.add.image(x + Phaser.Math.Between(-20, 20), y - 6, `wl-tree-${name}`)
          .setOrigin(ox, oy).setDepth(depth).setScale(tscale);
        if (n > 0.86) tree.setTint(0xddaa66);
      }
      if (n > 0.7 && shroomNames.length) {
        const sn = shroomNames[Math.floor(n * shroomNames.length) % shroomNames.length];
        const sa = WL_SHROOMS[sn];
        this.add.image(x - 18, y + 6, `wl-shroom-${sn}`)
          .setOrigin(sa.hotspot[0] / sa.w, sa.hotspot[1] / sa.h)
          .setDepth(depth).setScale(1.2);
      }
    } else if (t === 'mountain' && n > 0.3 && rockNames.length) {
      const name = rockNames[Math.floor(n * rockNames.length) % rockNames.length];
      const art = WL_ROCKS[name];
      this.add.image(x, y - 4, `wl-rock-${name}`)
        .setOrigin(art.hotspot[0] / art.w, art.hotspot[1] / art.h)
        .setDepth(depth).setScale(1.2 + n * 0.6);
    } else if ((t === 'grass' || t === 'grassB' || t === 'grassC') && grassNames.length) {
      if (n > 0.82 && bushNames.length) {
        const name = bushNames[Math.floor(n * bushNames.length) % bushNames.length];
        const art = WL_BUSHES[name];
        this.add.image(x + 14, y + 2, `wl-bush-${name}`)
          .setOrigin(art.hotspot[0] / art.w, art.hotspot[1] / art.h)
          .setDepth(depth).setAlpha(0.95);
      } else if (n > 0.35) {
        const name = grassNames[Math.floor(n * grassNames.length) % grassNames.length];
        const art = WL_GRASS[name];
        this.add.image(x + Phaser.Math.Between(-22, 22), y + Phaser.Math.Between(-4, 6), `wl-grass-${name}`)
          .setOrigin(art.hotspot[0] / art.w, art.hotspot[1] / art.h)
          .setDepth(depth).setAlpha(0.9);
      }
    } else if (t === 'sand' && n > 0.55) {
      this.add.image(x, y - 24, 'palm').setDepth(depth).setScale(1.7 + n * 0.5);
    }
  }

  private animateWater() {
    if (!LEGACY_WATER_BLINK_ENABLED) return;
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
    this.zoomTarget = 0.7;
    const home = this.iso(this.center.x, this.center.y);
    cam.centerOn(home.x, home.y);
    cam.fadeIn(600);
    // Zoom suave hacia el cursor (rueda = objetivo, update() interpola).
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomTarget = Phaser.Math.Clamp(this.zoomTarget * (dy > 0 ? 0.9 : 1.1), 0.35, 2);
      // Anclar el zoom al cursor: compensar el scroll para que el punto bajo
      // el ratón permanezca estable durante la interpolación.
      try {
        const before = cam.getWorldPoint(p.x, p.y);
        this.zoomAnchor = { sx: p.x, sy: p.y, wx: before.x, wy: before.y };
      } catch { this.zoomAnchor = null; }
    });
    let dragging = false;
    let last = { x: 0, y: 0 };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) { dragging = true; last = { x: p.x, y: p.y }; }
      else if (p.leftButtonDown()) {
        if (this.minimap && this.inMinimap(p.x, p.y)) {
          const wp = this.minimap.getWorldPoint(p.x, p.y);
          this.panTarget = { x: wp.x, y: wp.y };
          return;
        }
        const wx = p.worldX;
        const wy = p.worldY;
        const t = this.groundLayer.worldToTileXY(wx, wy);
        if (t && t.x >= 0 && t.y >= 0 && t.x < MAP && t.y < MAP) this.onTileClicked(t.x, t.y);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.x >= 0 && p.y >= 0 && p.x <= this.scale.width && p.y <= this.scale.height) this.edgeArmed = true;
      if (dragging && p.isDown) { cam.scrollX -= (p.x - last.x) / cam.zoom; cam.scrollY -= (p.y - last.y) / cam.zoom; last = { x: p.x, y: p.y }; }
      // Pintar caminos arrastrando con el botón izquierdo.
      if (this.pendingRoad && p.leftButtonDown()) {
        const dt2 = this.groundLayer.worldToTileXY(p.worldX, p.worldY);
        if (dt2 && dt2.x >= 0 && dt2.y >= 0 && dt2.x < MAP && dt2.y < MAP) {
          this.tryAddRoad(Math.round(dt2.x), Math.round(dt2.y));
        }
      }
      if (!p.isDown) {
        const t = this.groundLayer.worldToTileXY(p.worldX, p.worldY);
        if (t && t.x >= 0 && t.y >= 0 && t.x < MAP && t.y < MAP) {
          const { x, y } = this.iso(t.x, t.y);
          this.hoverMarker.setPosition(x, y).setVisible(true);
          this.updateGhost(t.x, t.y, x, y);
        } else {
          this.hoverMarker.setVisible(false);
          this.clearGhost();
        }
      }
    });
    this.input.on('pointerup', () => { dragging = false; });
    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBounds(-2200, -600, 4400, 3200);

    // La barra de recursos vive en React (/play). En Phaser solo avisos.
    this.hintText = this.add.text(12, 12, '', { fontSize: '13px', color: '#fde68a', backgroundColor: '#000000aa', padding: { x: 10, y: 7 } })
      .setScrollFactor(0).setDepth(9950);

    const homeMm = this.iso(this.center.x, this.center.y);
    this.minimap = this.cameras.add(0, 0, 190, 140).setZoom(0.055).centerOn(homeMm.x, homeMm.y);
    this.minimap.setBackgroundColor('#0d1f16');
    this.layoutMinimap();
  }

  private layoutMinimap() {
    if (!this.minimap) return;
    const w = this.scale.width;
    const h = this.scale.height;
    this.minimap.setViewport(Math.max(8, w - 202), Math.max(8, h - 152), 190, 140);
  }

  private inMinimap(sx: number, sy: number): boolean {
    const w = this.scale.width;
    const h = this.scale.height;
    const vx = Math.max(8, w - 202);
    const vy = Math.max(8, h - 152);
    return sx >= vx && sx <= vx + 190 && sy >= vy && sy <= vy + 140;
  }

  private wasd?: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; Q: Phaser.Input.Keyboard.Key; E: Phaser.Input.Keyboard.Key };
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private camVel = { x: 0, y: 0 };
  private zoomTarget = 0.7;
  private zoomAnchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  /** Paneado suave manual (los efectos pan de cámara resultaron poco
   *  fiables junto al control por velocidad: se interpola en update). */
  private panTarget: { x: number; y: number } | null = null;
  /** Edge-scroll solo tras un movimiento real del puntero (el puntero
   *  sintético inicial en (0,0) no debe expulsar la cámara al arrancar). */
  private edgeArmed = false;
  private ghost?: Phaser.GameObjects.Image | null;
  private selectRing?: Phaser.GameObjects.Graphics | null;
  private mapFrame?: Phaser.GameObjects.Graphics | null;

  private setupInput() {
    this.input.keyboard?.on('keydown-ESC', () => {
      this.pendingBuild = null;
      this.pendingRoad = false;
      this.hintText?.setText('');
      this.clearGhost();
    });
    if (this.input.keyboard) {
      this.wasd = this.input.keyboard.addKeys('W,A,S,D,Q,E') as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; Q: Phaser.Input.Keyboard.Key; E: Phaser.Input.Keyboard.Key };
      this.cursors = this.input.keyboard.createCursorKeys();
    }
  }

  /** Previsualización fantasma del edificio pendiente sobre la loseta. */
  private updateGhost(tx: number, ty: number, x: number, y: number) {
    if (!this.pendingBuild) {
      this.clearGhost();
      return;
    }
    const id = this.pendingBuild;
    const art = WL_BUILDINGS[id];
    if (!art) return;
    if (!this.ghost || this.ghost.getData('bid') !== id) {
      this.clearGhost();
      const ox = art.hotspot[0] / art.w;
      const oy = art.hotspot[1] / art.h;
      this.ghost = this.add.image(x, y, WL_TEX[id])
        .setOrigin(ox, oy).setScale(wlBuildingScale(art.w, art.h))
        .setAlpha(0.55).setDepth(9500);
      this.ghost.setData('bid', id);
    } else {
      this.ghost.setPosition(x, y);
    }
    const ok = this.canPlace(id, tx, ty);
    this.ghost.setTint(ok ? 0x88ff88 : 0xff6666);
  }

  private clearGhost() {
    this.ghost?.destroy();
    this.ghost = null;
  }

  private canPlace(id: BuildingId, tx: number, ty: number): boolean {
    if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1) return false;
    if (this.buildingTiles.has(`${tx},${ty}`)) return false;
    const t = terrainAt(tx, ty);
    if (t === 'water' || t === 'waterB' || t === 'waterC' || t === 'mountain') return false;
    if ((id === 'puerto' || id === 'pesqueria') && !this.adjacentWater(tx, ty)) return false;
    const cost = BUILDINGS[id].coste;
    return Object.entries(cost).every(([k, v]) => (this.stock[k as ResourceId] ?? 0) >= (v ?? 0));
  }

  private adjacentWater(tx: number, ty: number): boolean {
    const at = (ax: number, ay: number) => (ax < 0 || ay < 0 || ax >= MAP || ay >= MAP ? null : terrainAt(ax, ay));
    return touchesWater(tx, ty, at);
  }

  // ---------- Caminos (Fase 2): red pintable que acelera y guía a los colonos ----------
  private canRoad(tx: number, ty: number): boolean {
    tx = Math.round(tx);
    ty = Math.round(ty);
    if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1) return false;
    if (this.buildingTiles.has(`${tx},${ty}`)) return false;
    const t = terrainAt(tx, ty);
    return t !== 'water' && t !== 'waterB' && t !== 'waterC' && t !== 'mountain';
  }

  /** Pinta un tramo si es válido (idempotente, para arrastrar). */
  private tryAddRoad(tx: number, ty: number): boolean {
    tx = Math.round(tx);
    ty = Math.round(ty);
    if (hasRoad(this.roads, tx, ty) || !this.canRoad(tx, ty)) return false;
    const net = this.roads;
    addRoad(net, tx, ty);
    this.renderRoadTile(tx, ty);
    for (const nb of roadNeighbors(net, tx, ty)) this.renderRoadTile(nb.x, nb.y);
    return true;
  }

  /** Clic con la herramienta: alterna (pone o quita). */
  private toggleRoad(tx: number, ty: number): void {
    tx = Math.round(tx);
    ty = Math.round(ty);
    if (hasRoad(this.roads, tx, ty)) {
      removeRoad(this.roads, tx, ty);
      this.roadDecals.get(`${tx},${ty}`)?.destroy();
      this.roadDecals.delete(`${tx},${ty}`);
      for (const nb of roadNeighbors(this.roads, tx, ty)) this.renderRoadTile(nb.x, nb.y);
      playSfx('click');
      return;
    }
    if (!this.tryAddRoad(tx, ty)) {
      this.hintText.setText('⛔ El camino no va en agua, montaña ni edificios').setY(44);
      playSfx('error');
      this.time.delayedCall(1500, () => this.hintText.setText(''));
      return;
    }
    playSfx('click');
  }

  /** Decal de tierra conectada a sus vecinos (base + salientes orientados). */
  private renderRoadTile(tx: number, ty: number): void {
    const k = `${tx},${ty}`;
    this.roadDecals.get(k)?.destroy();
    const { x, y } = this.iso(tx, ty);
    const parts: Phaser.GameObjects.Image[] = [];
    // Base oscura (borde visible en hierba Y en tierra) + núcleo claro.
    const rim = this.add.image(0, 8, 'pathdot').setScale(6.6, 4.2).setAlpha(0.8).setTint(0x7a5c38);
    const core = this.add.image(0, 8, 'pathdot').setScale(5.6, 3.5).setAlpha(0.9);
    parts.push(rim, core);
    for (const nb of roadNeighbors(this.roads, tx, ty)) {
      // Desplazamiento en pantalla hacia la loseta vecina (diamante 132x66).
      const dx = (nb.x - tx - (nb.y - ty)) * (TILE_W / 2);
      const dy = (nb.x - tx + (nb.y - ty)) * (TILE_H / 2);
      const ang = Math.atan2(dy, dx);
      const stubRim = this.add.image(dx / 2, 8 + dy / 2, 'pathdot')
        .setScale(3.2, 2.0).setAlpha(0.8).setTint(0x7a5c38)
        .setRotation(ang);
      const stub = this.add.image(dx / 2, 8 + dy / 2, 'pathdot')
        .setScale(2.6, 1.6).setAlpha(0.9)
        .setRotation(ang);
      parts.push(stubRim, stub);
    }
    const c = this.add.container(x, y, parts).setDepth(90);
    this.roadDecals.set(k, c);
  }

  /** Hojas, brasas y salpicaduras ambientales (vida sin coste de CPU). */
  private setupParticles() {
    // hojas que caen junto a un bosque aleatorio
    this.time.addEvent({
      delay: 1400, loop: true,
      callback: () => {
        if (!this.forestTiles.length) return;
        const t = this.forestTiles[Phaser.Math.Between(0, this.forestTiles.length - 1)];
        const { x, y } = this.iso(t.x, t.y);
        const leaf = this.add.ellipse(
          x + Phaser.Math.Between(-30, 30), y - 60,
          5, 3, [0x6cab5c, 0xd9a441, 0xdd8844][Phaser.Math.Between(0, 2)], 0.9,
        ).setDepth(8600);
        this.tweens.add({
          targets: leaf, y: y - 6, x: leaf.x + Phaser.Math.Between(-26, 26),
          duration: Phaser.Math.Between(1400, 2400), ease: 'Sine.easeInOut',
          onComplete: () => leaf.destroy(),
        });
      },
    });
    // brasas sobre fundición y herrería
    this.time.addEvent({
      delay: 900, loop: true,
      callback: () => {
        const forges = this.placed.filter((p) => p.id === 'fundicion' || p.id === 'herreria');
        if (!forges.length) return;
        const p = forges[Phaser.Math.Between(0, forges.length - 1)];
        const { x, y } = this.iso(p.tx, p.ty);
        const ember = this.add.circle(x + Phaser.Math.Between(-8, 8), y - 60, 2, 0xff9a2e, 0.9).setDepth(8600);
        this.tweens.add({
          targets: ember, y: y - 110, alpha: 0, duration: Phaser.Math.Between(900, 1500),
          onComplete: () => ember.destroy(),
        });
      },
    });
    // salpicaduras en la orilla
    this.time.addEvent({
      delay: 1100, loop: true,
      callback: () => {
        if (!this.shoreTiles.length) return;
        const t = this.shoreTiles[Phaser.Math.Between(0, this.shoreTiles.length - 1)];
        const { x, y } = this.iso(t.x, t.y);
        const sp = this.add.circle(x + Phaser.Math.Between(-24, 24), y, 2.5, 0xffffff, 0.55).setDepth(52);
        this.tweens.add({ targets: sp, alpha: 0, scale: 2, duration: 900, onComplete: () => sp.destroy() });
      },
    });
  }

  /** Anillo pulsante sobre el edificio inspeccionado + foco suave de cámara. */
  private showSelectRing(tx: number, ty: number) {
    this.selectRing?.destroy();
    const { x, y } = this.iso(tx, ty);
    const g = this.add.graphics().setDepth(9490);
    g.lineStyle(3, 0xfde68a, 1);
    g.strokeEllipse(x, y - 10, 110, 44);
    this.tweens.add({ targets: g, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    this.selectRing = g;
    this.panTarget = { x, y };
  }

  private hideSelectRing() {
    this.selectRing?.destroy();
    this.selectRing = null;
  }

  /** Marco del viewport principal dibujado SOLO en el minimapa. */
  private setupMapFrame() {
    const g = this.add.graphics().setDepth(9600);
    this.cameras.main.ignore(g);
    this.mapFrame = g;
  }

  private drawMapFrame() {
    if (!this.mapFrame || !this.minimap) return;
    const wv = this.cameras.main.worldView;
    const g = this.mapFrame;
    g.clear();
    g.lineStyle(6, 0xfde68a, 0.85);
    g.strokeRect(wv.x, wv.y, wv.width, wv.height);
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
      this.minimap.ignore([this.hintText, ...this.stars]);
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
    updateSky(this, s); // publica __sky + faroles + estrellas + luciérnagas
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

  private makeWalker(sprite: Phaser.GameObjects.Sprite, shadow: Phaser.GameObjects.Image, role: string, kind: 'settler' | 'critter', faction: Owner = 'player'): Walker {
    const w: Walker = {
      sprite, shadow, role, kind, faction, path: [], targetPx: null,
      speed: kind === 'critter' ? 55 : 68, state: 'idle', stateT: Math.random() * 1.5,
      onArrive: null, loaded: false, goods: null, goodsIcon: null,
      hp: 30, maxHp: 30, foe: null,
    };
    this.walkers.push(w);
    return w;
  }

  private sendWalker(w: Walker, tx: number, ty: number, onArrive: (() => void) | null = null): boolean {
    const from = this.walkerTile(w);
    const allowWater = w.kind === 'critter' && w.role === 'duck';
    const blocked = (x: number, y: number) => this.tileBlocked(x, y, tx, ty, allowWater);
    // Los colonos prefieren los caminos (A* ponderado); la fauna deambula libre.
    const costFn = w.kind === 'critter' ? undefined : (x: number, y: number) => tileCost(this.roads, x, y);
    const raw = findPath(from, { x: tx, y: ty }, MAP, MAP, blocked, 4000, costFn);
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
      // Bonus de velocidad sobre caminos (los colonos vuelan por la red vial).
      let step = w.speed * dt;
      if (w.kind === 'settler') {
        const t = this.groundLayer.worldToTileXY(s.x, s.y);
        if (t && hasRoad(this.roads, t.x, t.y)) step *= ROAD_SPEED_BONUS;
      }
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

  // ============ Combate defensivo: oleadas, torres y soldados ============
  private enemyTile(e: Enemy): GridPos {
    const t = this.groundLayer.worldToTileXY(e.sprite.x, e.sprite.y);
    return { x: Phaser.Math.Clamp(t?.x ?? 0, 0, MAP - 1), y: Phaser.Math.Clamp(t?.y ?? 0, 0, MAP - 1) };
  }

  private drawBar(bar: Phaser.GameObjects.Graphics, x: number, y: number, frac: number, color: number) {
    bar.clear();
    if (frac >= 1) return;
    bar.fillStyle(0x000000, 0.7);
    bar.fillRect(x - 16, y, 32, 5);
    bar.fillStyle(color, 1);
    bar.fillRect(x - 15, y + 1, 30 * Math.max(0, frac), 3);
  }

  /** Edificio más cercano de un bando (los incursores solo ven al jugador). */
  private nearestBuilding(tx: number, ty: number, owner: Owner = 'player'): Placed | null {
    let best: Placed | null = null;
    let bestD = Infinity;
    for (const p of this.placed) {
      if (p.owner !== owner) continue;
      const d = Math.hypot(p.tx - tx, p.ty - ty);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  private spawnWave() {
    if (this.gameStatus !== 'playing') return;
    this.waveNo++;
    const spec = waveSpec(this.waveNo);
    // borde del mapa: loseta de tierra aleatoria en el perímetro
    const edge: GridPos[] = [];
    for (let i = 2; i < MAP - 2; i++) {
      edge.push({ x: i, y: 2 }, { x: i, y: MAP - 3 }, { x: 2, y: i }, { x: MAP - 3, y: i });
    }
    const land = edge.filter((p) => {
      const t = terrainAt(p.x, p.y);
      return t !== 'water' && t !== 'waterB' && t !== 'waterC' && t !== 'mountain';
    });
    if (!land.length || !this.placed.length) return;
    const archers = this.waveNo % 3 === 0 ? 2 : 0;
    for (let i = 0; i < spec.count; i++) {
      const s = land[Phaser.Math.Between(0, land.length - 1)];
      const { x, y } = this.iso(s.x, s.y);
      const ranged = i >= spec.count - archers;
      const tex = ranged ? 'wl-archer-e' : 'wl-soldier-e';
      const anim = ranged ? 'wl-walk-archer-e' : 'wl-walk-soldier-e';
      const sprite = this.add.sprite(x, y - 15, tex, 0).setDepth(8000);
      sprite.setTint(ranged ? 0x773377 : 0x883333);
      sprite.setScale(wlWorkerScale(WL_WORKERS.soldier?.dirs.e?.fh ?? 42));
      sprite.play(anim);
      const shadow = this.add.image(x, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
      const bar = this.add.graphics().setDepth(8200);
      const e: Enemy = {
        sprite, shadow, hp: spec.enemyHp, maxHp: spec.enemyHp, dmg: spec.enemyDmg,
        ranged, base: ranged ? 'archer' : 'soldier', side: 'raider', mode: 'raid',
        path: [], targetPx: null, speed: 60, target: null, attackT: 0, bar,
      };
      this.enemies.push(e);
      this.sendEnemy(e);
    }
    this.hintText?.setText(`⚔ ¡Oleada ${this.waveNo}! ${spec.count} incursores se acercan`).setY(44);
    playSfx('sword');
    this.time.delayedCall(4000, () => this.hintText.setText(''));
  }

  private sendEnemy(e: Enemy) {
    const from = this.enemyTile(e);
    const target = this.nearestBuilding(from.x, from.y);
    if (!target) { e.target = null; e.targetPx = null; return; }
    e.target = { x: target.tx, y: target.ty };
    const raw = findPath(from, e.target, MAP, MAP, (x, y) => this.tileBlocked(x, y, e.target!.x, e.target!.y));
    if (!raw || raw.length < 2) { e.targetPx = null; return; }
    e.path = smoothPath(raw, (x, y) => this.tileBlocked(x, y, e.target!.x, e.target!.y)).slice(1);
    const next = e.path.shift()!;
    const p = this.iso(next.x, next.y);
    e.targetPx = { x: p.x, y: p.y - 15 };
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      const s = e.sprite;
      if (!s.active) continue;
      if (e.targetPx) {
        const dx = e.targetPx.x - s.x;
        const dy = e.targetPx.y - s.y;
        const dist = Math.hypot(dx, dy);
        const step = e.speed * dt;
        if (dist <= Math.max(5, step)) {
          s.x = e.targetPx.x;
          s.y = e.targetPx.y;
          const next = e.path.shift();
          if (!next) {
            e.targetPx = null;
          } else {
            const p = this.iso(next.x, next.y);
            e.targetPx = { x: p.x, y: p.y - 15 };
          }
        } else {
          s.x += (dx / dist) * step;
          s.y += (dy / dist) * step;
          const dir = this.dir6(dx, dy);
          const key = `wl-walk-${e.base}-${dir}`;
          if (this.anims.exists(key)) {
            s.setTexture(`wl-${e.base}-${dir}`);
            s.play(key, true);
          }
        }
        e.shadow.setPosition(s.x, s.y + 13);
        s.setDepth(7500 + Math.round(s.y / 4));
      }
      this.drawBar(e.bar, s.x, s.y - 52, e.hp / e.maxHp, 0xef4444);
    }
  }

  private combatTick() {
    // torres disparan al incursor más cercano (radio 5 losetas)
    for (const p of this.placed) {
      if (p.id !== 'torre') continue;
      let best: Enemy | null = null;
      let bestD = 5;
      for (const e of this.enemies) {
        if (!e.sprite.active) continue;
        const t = this.enemyTile(e);
        const d = Math.hypot(t.x - p.tx, t.y - p.ty);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        const { x: x1, y: y1 } = this.iso(p.tx, p.ty);
        const proj = this.add.circle(x1, y1 - 70, 3, 0xffe08a, 1).setDepth(8600);
        this.tweens.add({ targets: proj, x: best.sprite.x, y: best.sprite.y - 15, duration: 220 });
        const target = best;
        this.time.delayedCall(230, () => {
          proj.destroy();
          if (!target.sprite.active) return;
          if (applyDamage(target, towerDps())) this.killEnemy(target);
          playSfx('chop');
        });
      }
    }
    // soldados propios traban combate cuerpo a cuerpo (radio ~1.2 losetas)
    for (const w of this.walkers) {
      if (w.kind !== 'settler' || w.faction !== 'player' || (w.role !== 'soldier' && w.role !== 'archer')) continue;
      if (!w.sprite.active) continue;
      const wt = this.walkerTile(w);
      let best: Enemy | null = null;
      let bestD = 2.2;
      for (const e of this.enemies) {
        if (!e.sprite.active) continue;
        const t = this.enemyTile(e);
        const d = Math.hypot(t.x - wt.x, t.y - wt.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      w.foe = best;
      if (best) {
        if (applyDamage(best, soldierDps(1) * 0.5)) this.killEnemy(best);
        // represalia del incursor
        w.hp -= best.dmg * 0.5;
        if (w.hp <= 0) this.killWalker(w);
        continue;
      }
      // Sin enemigo cerca: asedian el edificio rival adyacente.
      let targetB: Placed | null = null;
      let targetD = 1.8;
      for (const p of this.placed) {
        if (p.owner !== 'rival') continue;
        const d = Math.hypot(p.tx - wt.x, p.ty - wt.y);
        if (d < targetD) { targetD = d; targetB = p; }
      }
      if (targetB) {
        const key = `${targetB.tx},${targetB.ty}`;
        const rec = this.buildingHp.get(key) ?? { hp: 120, maxHp: 120, bar: this.add.graphics().setDepth(8600) };
        this.buildingHp.set(key, rec);
        if (applyDamage(rec, soldierDps(1) * 0.5)) {
          this.destroyBuilding(targetB.tx, targetB.ty);
        } else {
          const { x, y } = this.iso(targetB.tx, targetB.ty);
          this.drawBar(rec.bar, x, y - 80, rec.hp / rec.maxHp, 0xfbbf24);
        }
      }
    }
    // incursores golpean edificios adyacentes (la guarnición rival espera)
    for (const e of this.enemies) {
      if (!e.sprite.active || e.targetPx || e.mode !== 'raid') continue;
      if (!e.target) {
        this.sendEnemy(e);
        continue;
      }
      const t = this.enemyTile(e);
      const dist = Math.hypot(t.x - e.target.x, t.y - e.target.y);
      if (dist > attackReach(e.ranged)) {
        this.sendEnemy(e);
        continue;
      }
      e.attackT += 0.5;
      if (e.attackT < 1.5) continue;
      e.attackT = 0;
      if (e.ranged) {
        // flecha visible hacia el edificio
        const p = this.placed.find((q) => q.tx === e.target!.x && q.ty === e.target!.y);
        if (p) {
          const { x: x1, y: y1 } = this.iso(e.target.x, e.target.y);
          const arrow = this.add.circle(e.sprite.x, e.sprite.y - 20, 2.5, 0xc084fc, 1).setDepth(8600);
          this.tweens.add({ targets: arrow, x: x1, y: y1 - 30, duration: 260, onComplete: () => arrow.destroy() });
        }
      }
      const key = `${e.target.x},${e.target.y}`;
      const rec = this.buildingHp.get(key) ?? { hp: 100, maxHp: 100, bar: this.add.graphics().setDepth(8600) };
      this.buildingHp.set(key, rec);
      if (applyDamage(rec, e.dmg)) {
        this.destroyBuilding(e.target.x, e.target.y);
      } else {
        const p = this.placed.find((q) => q.tx === e.target!.x && q.ty === e.target!.y);
        if (p) {
          const { x, y } = this.iso(p.tx, p.ty);
          this.drawBar(rec.bar, x, y - 80, rec.hp / rec.maxHp, 0xfbbf24);
          this.tweens.add({ targets: p.sprite, x: x + 3, duration: 60, yoyo: true, repeat: 3, onComplete: () => p.sprite.setPosition(x, y) });
        }
      }
    }
    // limpiar enemigos muertos ya se hace en killEnemy; reasignar objetivos huérfanos
    for (const w of this.walkers) {
      if (w.foe && !w.foe.sprite.active) {
        w.foe = null;
        if (w.state === 'idle') this.assignJob(w);
      }
    }
  }

  private killEnemy(e: Enemy) {
    this.tweens.add({ targets: e.sprite, alpha: 0, scale: 0.1, duration: 300, onComplete: () => e.sprite.destroy() });
    e.shadow.destroy();
    e.bar.destroy();
    this.enemies = this.enemies.filter((x) => x !== e);
    this.kills++;
    if (this.kills % 2 === 0) {
      this.stock.oro += 1;
      this.updateHud();
    }
    if (!this.enemies.length) {
      this.stock.oro += 2;
      this.wavesRepelled++;
      this.updateHud();
      if (this.wavesRepelled >= VICTORY_WAVES && this.gameStatus === 'playing') {
        this.gameStatus = 'victory';
        this.hintText?.setText(`🏆 ¡VICTORIA! Rechazaste ${VICTORY_WAVES} oleadas`).setY(44);
        playSfx('built');
      } else {
        this.hintText?.setText(`🛡 ¡Oleada ${this.waveNo} rechazada! +2 oro`).setY(44);
        playSfx('confirm');
      }
      this.time.delayedCall(6000, () => this.hintText.setText(''));
    }
  }

  private checkObjectives() {
    const army = this.walkers.filter((w) => w.kind === 'settler' && w.faction === 'player' && (w.role === 'soldier' || w.role === 'archer')).length;
    const state = {
      buildings: this.placed.filter((p) => p.owner === 'player').map((p) => p.id),
      army,
      wavesRepelled: this.wavesRepelled,
    };
    for (const o of OBJECTIVES) {
      if (this.doneObjectives.has(o.id)) continue;
      if (!isComplete(o.id, state)) continue;
      this.doneObjectives.add(o.id);
      for (const [k, v] of Object.entries(o.reward)) {
        this.stock[k as ResourceId] += v ?? 0;
      }
      this.updateHud();
      this.hintText?.setText(`🏆 Objetivo: ${o.text} ¡recompensa!`).setY(44);
      playSfx('built');
      this.time.delayedCall(4000, () => this.hintText.setText(''));
    }
  }

  private killWalker(w: Walker) {
    if (w.kind === 'settler' && w.faction === 'player') this.popCount = Math.max(0, this.popCount - 1);
    this.tweens.add({ targets: w.sprite, alpha: 0, duration: 300, onComplete: () => w.sprite.destroy() });
    w.shadow.destroy();
    w.goodsIcon?.destroy();
    this.walkers = this.walkers.filter((x) => x !== w);
  }

  private saveGame(silent = false): string | null {
    try {
      const data = {
        v: 4,
        savedAt: Date.now(),
        stock: this.stock,
        aiStock: this.aiStock,
        placed: this.placed.map((p) => ({ id: p.id, tx: p.tx, ty: p.ty, owner: p.owner })),
        roads: serializeRoads(this.roads),
        pop: { count: this.popCount, progress: this.popProgress, morale: this.morale },
        waveNo: this.waveNo,
        kills: this.kills,
        wavesRepelled: this.wavesRepelled,
        doneObjectives: [...this.doneObjectives],
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) playSfx('confirm');
      return new Date(data.savedAt).toLocaleString();
    } catch {
      return null;
    }
  }

  private loadGame(): boolean {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as {
        stock: Stock; placed: { id: BuildingId; tx: number; ty: number; owner?: Owner }[];
        roads?: string[];
        aiStock?: Stock;
        pop?: { count?: number; progress?: number; morale?: number };
        waveNo: number; kills: number; wavesRepelled?: number; doneObjectives?: string[];
      };
      if (!data || !Array.isArray(data.placed)) return false;
      // limpiar mundo
      for (const p of this.placed) p.sprite.destroy();
      for (const d of this.roadDecals.values()) d.destroy();
      for (const m of this.stallMarks.values()) m.destroy();
      for (const w of this.walkers) {
        w.sprite.destroy();
        w.shadow.destroy();
        w.goodsIcon?.destroy();
      }
      for (const s of this.ships) s.sprite.destroy();
      for (const e of this.enemies) {
        e.sprite.destroy();
        e.shadow.destroy();
        e.bar.destroy();
      }
      for (const plot of this.wheatPlots) plot.sprite.destroy();
      for (const l of this.lanterns) l.destroy();
      for (const rec of this.buildingHp.values()) rec.bar.destroy();
      this.placed = [];
      this.walkers = [];
      this.ships = [];
      this.enemies = [];
      this.wheatPlots = [];
      this.lanterns = [];
      this.buildingHp.clear();
      this.buildingTiles.clear();
      this.roadDecals.clear();
      this.stallMarks.clear();
      this.stallInfo.clear();
      this.jobs = [];
      this.territoryRadius = 7;
      // restaurar
      this.stock = { ...data.stock };
      this.aiStock = data.aiStock ? { ...data.aiStock } : rivalStartingStock();
      this.rivalTickStep = 0;
      this.aiRaidT = 0;
      this.popCount = Math.max(0, Math.floor(data.pop?.count ?? 20));
      this.popProgress = data.pop?.progress ?? 0;
      this.morale = data.pop?.morale ?? 80;
      this.foodAcc = 0;
      this.roads = deserializeRoads(data.roads);
      for (const k of this.roads) {
        if (this.buildingTiles.has(k)) {
          // Camino absorbido por un edificio: fuera de la red.
          this.roads.delete(k);
          continue;
        }
        const [rx, ry] = k.split(',').map(Number);
        this.renderRoadTile(rx, ry);
      }
      this.waveNo = data.waveNo ?? 0;
      this.kills = data.kills ?? 0;
      this.wavesRepelled = data.wavesRepelled ?? 0;
      this.doneObjectives = new Set(data.doneObjectives ?? []);
      this.gameStatus = 'playing';
      for (const p of data.placed) {
        if (BUILDINGS[p.id]) this.tryPlace(p.id, p.tx, p.ty, true, p.owner ?? 'player');
      }
      this.spawnPopulation();
      this.spawnCritters();
      // El censo manda: reponer caminantes visibles hasta el nivel guardado.
      let guard = 0;
      const settlerCount = () => this.walkers.filter((w) => w.kind === 'settler' && w.faction === 'player').length;
      while (settlerCount() < Math.min(this.popCount, 40) && guard++ < 30) {
        this.spawnPerson('settler');
      }
      // Cuadrilla rival: reponer si su base sobrevivió al guardado.
      if (this.rivalAlive()) {
        const crew: string[] = ['woodcutter', 'carrier', 'settler', 'miner', 'carrier'];
        let ri = 0;
        let rguard = 0;
        while (this.walkers.filter((w) => w.kind === 'settler' && w.faction === 'rival').length < 5 && rguard++ < 8) {
          this.spawnRivalWorker(crew[ri++ % crew.length]);
        }
      }
      for (const p of this.placed) {
        if (p.id === 'puerto') {
          this.spawnShip(p.tx, p.ty);
          this.spawnShip(p.tx, p.ty);
        }
      }
      this.updateHud();
      playSfx('confirm');
      this.hintText?.setText('💾 Partida cargada').setY(44);
      this.time.delayedCall(3000, () => this.hintText.setText(''));
      return true;
    } catch {
      return false;
    }
  }

  private destroyBuilding(tx: number, ty: number) {    const i = this.placed.findIndex((p) => p.tx === tx && p.ty === ty);
    if (i < 0) return;
    const [p] = this.placed.splice(i, 1);
    p.sprite.destroy();
    this.buildingTiles.delete(`${tx},${ty}`);
    const rec = this.buildingHp.get(`${tx},${ty}`);
    rec?.bar.destroy();
    this.buildingHp.delete(`${tx},${ty}`);
    this.stallMarks.get(`${tx},${ty}`)?.destroy();
    this.stallMarks.delete(`${tx},${ty}`);
    this.stallInfo.delete(`${tx},${ty}`);
    this.jobs = this.jobs.filter((j) => j.key !== `${tx},${ty}`);
    // trigales huérfanos de una granja caída
    if (p.id === 'granja') {
      const { x, y } = this.iso(tx, ty);
      this.wheatPlots = this.wheatPlots.filter((plot) => {
        const keep = Math.hypot(plot.sprite.x - x, plot.sprite.y - y) > 160;
        if (!keep) plot.sprite.destroy();
        return keep;
      });
    }
    // farol huérfano
    {
      const { x, y } = this.iso(tx, ty);
      this.lanterns = this.lanterns.filter((l) => {
        const keep = Math.hypot(l.x - x, l.y - y) > 160;
        if (!keep) l.destroy();
        return keep;
      });
    }
    // sus defensores buscan otro objetivo
    for (const e of this.enemies) {
      if (e.target && e.target.x === tx && e.target.y === ty) this.sendEnemy(e);
    }
    this.hintText?.setText(`🔥 ¡${BUILDINGS[p.id].nombre} destruido!`).setY(44);
    playSfx('error');
    this.time.delayedCall(4000, () => this.hintText.setText(''));
    if (p.id === 'almacen' && this.gameStatus === 'playing') {
      if (p.owner === 'rival') {
        this.gameStatus = 'victory';
        this.hintText?.setText('🏆 ¡Colonia rival arrasada! Tu asentamiento perdura').setY(44);
        playSfx('built');
      } else {
        this.gameStatus = 'defeat';
        this.hintText?.setText('💀 Sin almacén la colonia cae...').setY(44);
      }
    }
    this.updateHud();
  }

  private recruit(): boolean {
    const cuartel = this.placed.find((p) => p.id === 'cuartel');
    if (!cuartel) {
      this.hintText?.setText('⛔ Necesitas un cuartel').setY(44);
      return false;
    }
    const army = this.walkers.filter((w) => w.kind === 'settler' && w.faction === 'player' && (w.role === 'soldier' || w.role === 'archer')).length;
    if (army >= 12) {
      this.hintText?.setText('⛔ Ejército al completo (12)').setY(44);
      return false;
    }
    const cost = recruitCost(army);
    if ((this.stock.espada ?? 0) < cost.espada || (this.stock.pan ?? 0) < cost.pan) {
      this.hintText?.setText(`⛔ Reclutar cuesta ${cost.espada}⚔ + ${cost.pan}🍞`).setY(44);
      playSfx('error');
      return false;
    }
    this.stock.espada -= cost.espada;
    this.stock.pan -= cost.pan;
    const role = army % 2 === 0 ? 'soldier' : 'archer';
    // Reclutar viste a un colono (no aparece de la nada); si no hay
    // paisanos libres, llega uno nuevo (el censo lo refleja).
    const volunteer = this.walkers.find((x) => x.kind === 'settler' && x.faction === 'player' && x.role === 'settler' && x.sprite.active);
    if (volunteer) {
      volunteer.role = role;
      volunteer.loaded = false;
      volunteer.foe = null;
      this.setGoods(volunteer, null);
      volunteer.sprite.setScale(wlWorkerScale(WL_WORKERS[role]?.dirs.e?.fh ?? 42));
      volunteer.sprite.setTexture(`wl-${role}-e`);
      if (this.anims.exists(`wl-walk-${role}-e`)) volunteer.sprite.play(`wl-walk-${role}-e`);
      if (!this.sendWalker(volunteer, cuartel.tx, cuartel.ty, () => this.assignJob(volunteer))) {
        this.assignJob(volunteer);
      }
      playSfx('sword');
      this.updateHud();
      return true;
    }
    this.popCount++;
    const { x, y } = this.iso(cuartel.tx, cuartel.ty);
    const s = this.add.sprite(x + 30, y - 15, `wl-${role}-e`, 0).setDepth(8000);
    s.setScale(wlWorkerScale(WL_WORKERS[role]?.dirs.e?.fh ?? 42));
    s.play(`wl-walk-${role}-e`);
    const shadow = this.add.image(x + 30, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
    const w = this.makeWalker(s, shadow, role, 'settler');
    this.assignJob(w);
    playSfx('sword');
    this.updateHud();
    return true;
  }

  /** Cerebro por oficio: encadena ir → trabajar → volver. */
  private assignJob(w: Walker) {
    if (!w.sprite.active || w.state === 'walk' || w.state === 'work') return;
    if (w.faction === 'rival') {
      this.rivalStroll(w);
      return;
    }
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
    // (La cantera ya viene en la capa Lógica del mapa: no duplicarla.)
    this.tryPlace('residenciaS', this.center.x - 1, this.center.y + 3, true);
    this.tryPlace('residenciaM', this.center.x + 2, this.center.y + 4, true);
    this.tryPlace('granja', this.center.x + 5, this.center.y + 2, true);
    this.tryPlace('molino', this.center.x + 6, this.center.y - 1, true);
    this.tryPlace('pozo', this.center.x + 1, this.center.y + 1, true);
    this.tryPlace('torre', this.center.x - 5, this.center.y - 4, true);
    this.tryPlace('ornamento', this.center.x + 1, this.center.y - 3, true);
    // Sendero inicial de ejemplo: del almacén hacia el este (Fase 2).
    for (let dx = 1; dx <= 3; dx++) this.tryAddRoad(this.center.x + dx, this.center.y);
  }

  onTileClicked(tx: number, ty: number) {
    // worldToTileXY devuelve fracciones: se redondea a la loseta (los errores
    // de coma flotante tipo 13.9999 y los clics descentrados van a su loseta).
    tx = Math.round(tx);
    ty = Math.round(ty);
    const ww = window as unknown as { __inspect?: object | null };
    if (this.pendingRoad) {
      this.toggleRoad(tx, ty);
      return; // la herramienta sigue activa hasta ESC
    }
    if (!this.pendingBuild) {
      // selección: publica la ficha para el panel React
      const game = (window as unknown as { __game?: { inspect: (x: number, y: number) => object | null } }).__game;
      ww.__inspect = game?.inspect(tx, ty) ?? null;
      if (ww.__inspect) {
        playSfx('select');
        this.showSelectRing(tx, ty);
      } else {
        this.hideSelectRing();
      }
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
    this.clearGhost();
    this.hintText.setText('');
  }

  tryPlace(id: BuildingId, tx: number, ty: number, free: boolean, owner: Owner = 'player'): boolean {
    const def = BUILDINGS[id];
    const art = WL_BUILDINGS[id];
    if (!art) return false;
    tx = Math.round(tx);
    ty = Math.round(ty);
    if (!free) {
      const ok = (Object.entries(def.coste) as [ResourceId, number][]).every(([k, v]) => this.stock[k] >= v);
      if (!ok) {
        this.hintText.setText(`⛔ Faltan recursos para ${def.nombre}`).setY(44);
        playSfx('error');
        this.time.delayedCall(1500, () => this.hintText.setText(''));
        return false;
      }
      if (this.buildingTiles.has(`${tx},${ty}`)) {
        this.hintText.setText('⛔ Loseta ocupada por otro edificio').setY(44);
        playSfx('error');
        this.time.delayedCall(1500, () => this.hintText.setText(''));
        return false;
      }
      const terr = terrainAt(Math.floor(tx), Math.floor(ty));
      if (terr === 'water' || terr === 'waterB' || terr === 'waterC' || terr === 'mountain') {
        this.hintText.setText('⛔ Terreno no válido para construir').setY(44);
        playSfx('error');
        this.time.delayedCall(1500, () => this.hintText.setText(''));
        return false;
      }
      if (id === 'puerto' || id === 'pesqueria') {
        const at = (ax: number, ay: number) => (ax < 0 || ay < 0 || ax >= MAP || ay >= MAP ? null : terrainAt(ax, ay));
        if (!touchesWater(tx, ty, at)) {
          this.hintText.setText(`⛔ ${def.nombre} necesita agua adyacente`).setY(44);
          playSfx('error');
          this.time.delayedCall(1500, () => this.hintText.setText(''));
          return false;
        }
      }
      for (const [k, v] of Object.entries(def.coste) as [ResourceId, number][]) this.stock[k] -= v;
      playSfx('confirm');
    }
    const scale = wlBuildingScale(art.w, art.h);
    const { x, y } = this.iso(tx, ty);
    // Un edificio sobre un camino lo absorbe (la red queda limpia).
    if (hasRoad(this.roads, tx, ty)) {
      removeRoad(this.roads, tx, ty);
      this.roadDecals.get(`${tx},${ty}`)?.destroy();
      this.roadDecals.delete(`${tx},${ty}`);
      for (const nb of roadNeighbors(this.roads, tx, ty)) this.renderRoadTile(nb.x, nb.y);
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
    const name = this.add.text(0, 10, owner === 'rival' ? `⚔ ${def.nombre}` : def.nombre, { fontSize: '9px', color: '#fff', backgroundColor: '#00000077', padding: { x: 4, y: 2 } }).setOrigin(0.5);
    parts.push(name);
    if (owner === 'rival') {
      // Banderín rojo: identidad del rival legible en el mundo.
      const g = this.add.graphics();
      const topY = -art.h * scale - 4;
      g.lineStyle(2, 0x3a2415, 1);
      g.lineBetween(-2, topY, -2, topY - 16);
      g.fillStyle(0xb3402e, 1);
      g.fillTriangle(-2, topY - 16, -2, topY - 4, 13, topY - 10);
      parts.push(g);
    }
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
    if (owner === 'player') this.drawPath(x, y, depth - 1);
    this.tweens.add({
      targets: buildFx ? [buildFx] : [], alpha: 0, duration: Math.min(def.tiempoConstruccionMs, 4000),
      onComplete: () => {
        buildFx?.destroy(); worker.destroy(); img.setAlpha(1); this.popIn(img, scale);
        playSfx('built');
        if (id === 'puerto') this.spawnShip(tx, ty);
      },
    });
    this.placed.push({ id, tx, ty, sprite: c, done: 0, total: def.tiempoConstruccionMs, owner });
    this.buildingTiles.add(`${tx},${ty}`);
    if (WL_SMOKE.has(id)) this.addSmoke(x, y - art.h * scale * 0.85, depth + 1);
    if (id === 'granja' && owner === 'player') this.plantWheat(x, y, depth);
    // farol nocturno sobre la puerta
    const lamp = this.add.image(x, y - art.h * scale * 0.55, 'glow')
      .setDepth(depth + 2).setScale(0.9).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.lanterns.push(lamp);
    if (id === 'torre' && owner === 'player') this.territoryRadius += 1.5;
    if (id === 'cuartel' && owner === 'player') {
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
      registerCloud(this, cloud, shade, 0.1);
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
    this.econTickNo++;
    this.stock = tickAutoProducers(this.stock, this.placed.filter((p) => p.owner !== 'rival').map((p) => p.id), this.econTickNo);
    this.aiStock = tickAutoProducers(this.aiStock, this.placed.filter((p) => p.owner === 'rival').map((p) => p.id), this.econTickNo);
    const recipeByBuilding: Partial<Record<BuildingId, string>> = RECIPE_BY_BUILDING;
    for (const p of this.placed) {
      const rid = recipeByBuilding[p.id];
      if (!rid) continue;
      const jkey = `${p.tx},${p.ty}`;
      let job = this.jobs.find((j) => j.key === jkey);
      if (!job) { job = { recipeId: rid, edificio: p.id, progresoMs: 0, duracionMs: 8000, key: jkey }; this.jobs.push(job); }
      if (p.owner === 'rival') {
        const r = tickJob(this.aiStock, job, 1000);
        this.aiStock = r.stock;
        Object.assign(job, r.job);
        continue;
      }
      const r = tickJob(this.stock, job, 1000);
      this.stock = r.stock;
      Object.assign(job, r.job);
      this.refreshStall(p, rid, !r.terminado && r.job.progresoMs >= r.job.duracionMs);
    }
    this.tickPopulation();
    this.rivalTick();
    this.checkObjectives();
    this.updateHud();
  }

  /** Come (pan y luego pescado), calcula moral y mueve el censo. */
  private tickPopulation() {
    const cap = housingFor(this.placed.filter((p) => p.owner === 'player').map((p) => p.id));
    // Comer: pan primero, pescado después (con arrastre fraccional).
    let need = foodPerTick(this.popCount) + this.foodAcc;
    this.foodAcc = 0;
    for (const k of ['pan', 'pez'] as ResourceId[]) {
      const got = Math.min(this.stock[k], Math.floor(need));
      this.stock[k] -= got;
      need -= got;
    }
    this.foodAcc = Math.min(need, 2); // fracción pendiente (deuda topada)
    this.morale = moraleOf({
      population: this.popCount,
      housing: cap,
      food: this.stock.pan + this.stock.pez,
    });
    const g = growthPerTick({
      population: this.popCount,
      housing: cap,
      food: this.stock.pan + this.stock.pez,
      morale: this.morale,
    });
    this.popProgress += g;
    if (this.popProgress >= 1) {
      this.popProgress = 0;
      this.immigrateOne(cap);
    } else if (this.popProgress <= -1) {
      this.popProgress = 0;
      this.emigrateOne();
    }
  }

  /** Marca ⚠ sobre el edificio parado por falta de insumos (Fase 2). */
  private refreshStall(p: { id: BuildingId; tx: number; ty: number }, recipeId: string, stalled: boolean) {
    const k = `${p.tx},${p.ty}`;
    if (!stalled) {
      if (this.stallMarks.has(k)) {
        this.stallMarks.get(k)?.destroy();
        this.stallMarks.delete(k);
        this.stallInfo.delete(k);
      }
      return;
    }
    const recipe = RECIPES.find((r) => r.id === recipeId);
    const faltan = recipe ? missingInputs(this.stock, recipe.entradas) : [];
    this.stallInfo.set(k, faltan);
    if (this.stallMarks.has(k)) return;
    const { x, y } = this.iso(p.tx, p.ty);
    const mark = this.add.text(x + 34, y - 92, '⚠', { fontSize: '22px' })
      .setOrigin(0.5).setDepth(9600);
    this.tweens.add({ targets: mark, y: y - 100, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.stallMarks.set(k, mark);
  }

  /** Loseta de tierra en el borde para entrar/salir del mapa. */
  private edgeLandTile(): GridPos | null {
    const edge: GridPos[] = [];
    for (let i = 2; i < MAP - 2; i++) {
      edge.push({ x: i, y: 2 }, { x: i, y: MAP - 3 }, { x: 2, y: i }, { x: MAP - 3, y: i });
    }
    const land = edge.filter((p) => {
      const t = terrainAt(p.x, p.y);
      return t !== 'water' && t !== 'waterB' && t !== 'waterC' && t !== 'mountain';
    });
    if (!land.length) return null;
    return land[Phaser.Math.Between(0, land.length - 1)];
  }

  /** Un colono nuevo llega andando desde el borde hasta el almacén. */
  private immigrateOne(cap: number) {
    const settlers = this.walkers.filter((w) => w.kind === 'settler' && w.faction === 'player');
    if (this.popCount >= cap || settlers.length >= 44) return;
    const at = this.edgeLandTile();
    const home = this.placed[0];
    if (!at || !home) return;
    const { x, y } = this.iso(at.x, at.y);
    const s = this.add.sprite(x, y - 15, 'wl-settler-e', 0).setDepth(8000);
    s.setScale(wlWorkerScale(WL_WORKERS.settler?.dirs.e?.fh ?? 42));
    const shadow = this.add.image(x, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
    const w = this.makeWalker(s, shadow, 'settler', 'settler');
    this.popCount++;
    playSfx('confirm');
    const gx = Phaser.Math.Clamp(home.tx + Phaser.Math.Between(-2, 2), 2, MAP - 3);
    const gy = Phaser.Math.Clamp(home.ty + Phaser.Math.Between(-2, 2), 2, MAP - 3);
    if (!this.sendWalker(w, gx, gy, () => this.assignJob(w))) this.assignJob(w);
    this.hintText?.setText('🚶 ¡Un colono se une a tu colonia!').setY(44);
    this.time.delayedCall(2500, () => this.hintText.setText(''));
  }

  /** Un colono hace las maletas y abandona la colonia por el borde. */
  private emigrateOne() {
    const leaver = this.walkers.find((w) =>
      w.kind === 'settler' && w.faction === 'player' && w.sprite.active && w.role !== 'soldier' && w.role !== 'archer');
    this.popCount = Math.max(0, this.popCount - 1);
    if (!leaver) return;
    // Deja lo que lleve y se va (al llegar se disuelve sin recontar).
    leaver.loaded = false;
    this.setGoods(leaver, null);
    const at = this.edgeLandTile();
    if (!at) {
      this.killWalkerSilent(leaver);
      return;
    }
    if (!this.sendWalker(leaver, at.x, at.y, () => this.killWalkerSilent(leaver))) {
      this.killWalkerSilent(leaver);
    }
    this.hintText?.setText('🚶 Un colono abandona la colonia...').setY(44);
    this.time.delayedCall(2500, () => this.hintText.setText(''));
  }

  /** Elimina un caminante sin tocar el censo (ya descontado). */
  private killWalkerSilent(w: Walker) {
    w.sprite.destroy();
    w.shadow.destroy();
    w.goodsIcon?.destroy();
    this.walkers = this.walkers.filter((x) => x !== w);
  }

  // ============ Rival (Fase 4): director con las mismas reglas ============
  private rivalAlive(): boolean {
    return this.placed.some((p) => p.owner === 'rival' && p.id === 'almacen');
  }

  private rivalBuildings(): BuildingId[] {
    return this.placed.filter((p) => p.owner === 'rival').map((p) => p.id);
  }

  private rivalGarrison(): Enemy[] {
    return this.enemies.filter((e) => e.side === 'rival' && e.mode === 'garrison' && e.sprite.active);
  }

  private setupRival() {
    const at = (x: number, y: number) => terrainAt(x, y);
    this.aiCenter = findRivalBase(at, MAP, this.center.x, this.center.y);
    if (!this.aiCenter) return; // isla sin sitio: sin rival
    const c = this.aiCenter;
    this.tryPlace('almacen', c.x, c.y, true, 'rival');
    const hut = this.rivalSpot();
    if (hut) this.tryPlace('cabanaLenador', hut.x, hut.y, true, 'rival');
    const crew: string[] = ['woodcutter', 'carrier', 'settler', 'miner', 'carrier'];
    for (const role of crew) this.spawnRivalWorker(role);
    this.time.delayedCall(25000, () => {
      if (this.gameStatus !== 'playing' || !this.rivalAlive()) return;
      this.hintText?.setText('⚔ Exploradores avistan otra colonia al otro lado...').setY(44);
      this.time.delayedCall(5000, () => this.hintText.setText(''));
    });
  }

  /** Primera loseta libre en espiral alrededor de la base rival.
   *  Con un anillo de separación para que el pueblo respire (sin solapes). */
  private rivalSpot(): GridPos | null {
    if (!this.aiCenter) return null;
    const nearBuilding = (tx: number, ty: number): boolean => {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (this.buildingTiles.has(`${tx + ox},${ty + oy}`)) return true;
        }
      }
      return false;
    };
    for (let r = 1; r <= 7; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = Math.round(this.aiCenter.x + dx);
          const ty = Math.round(this.aiCenter.y + dy);
          if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1) continue;
          if (this.buildingTiles.has(`${tx},${ty}`)) continue;
          if (nearBuilding(tx, ty)) continue;
          const t = terrainAt(tx, ty);
          if (t === 'water' || t === 'waterB' || t === 'waterC' || t === 'mountain') continue;
          return { x: tx, y: ty };
        }
      }
    }
    return null;
  }

  private spawnRivalWorker(role: string) {
    if (!this.aiCenter) return;
    const tx = Phaser.Math.Clamp(Math.round(this.aiCenter.x + Phaser.Math.Between(-3, 3)), 2, MAP - 3);
    const ty = Phaser.Math.Clamp(Math.round(this.aiCenter.y + Phaser.Math.Between(-3, 3)), 2, MAP - 3);
    const { x, y } = this.iso(tx, ty);
    const s = this.add.sprite(x, y - 15, `wl-${role}-e`, 0).setDepth(8000);
    s.setScale(wlWorkerScale(WL_WORKERS[role]?.dirs.e?.fh ?? 42));
    s.setTint(0xffb3b3); // tez rival: mismo colono, otro bando
    if (this.anims.exists(`wl-walk-${role}-e`)) s.play(`wl-walk-${role}-e`);
    const shadow = this.add.image(x, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
    const w = this.makeWalker(s, shadow, role, 'settler', 'rival');
    this.rivalStroll(w);
  }

  private rivalStroll(w: Walker) {
    if (!this.aiCenter) {
      this.rest(w, 1 + Math.random() * 2);
      return;
    }
    const nx = Phaser.Math.Clamp(Math.round(this.aiCenter.x + Phaser.Math.Between(-5, 5)), 2, MAP - 3);
    const ny = Phaser.Math.Clamp(Math.round(this.aiCenter.y + Phaser.Math.Between(-5, 5)), 2, MAP - 3);
    if (!this.sendWalker(w, nx, ny)) this.rest(w, 1 + Math.random() * 2);
  }

  private spawnRivalTroop() {
    const base = this.placed.find((p) => p.owner === 'rival' && p.id === 'cuartel')
      ?? this.placed.find((p) => p.owner === 'rival' && p.id === 'almacen');
    if (!base) return;
    const n = this.rivalGarrison().length + this.enemies.filter((e) => e.side === 'rival' && e.sprite.active).length;
    const ranged = n % 3 === 2;
    const { x, y } = this.iso(base.tx, base.ty);
    const sprite = this.add.sprite(x + 24, y - 15, ranged ? 'wl-archer-e' : 'wl-soldier-e', 0).setDepth(8000);
    sprite.setTint(0x3b6ea5); // acero rival
    sprite.setScale(wlWorkerScale(WL_WORKERS.soldier?.dirs.e?.fh ?? 42));
    sprite.play(ranged ? 'wl-walk-archer-e' : 'wl-walk-soldier-e');
    const shadow = this.add.image(x + 24, y - 1, 'shadow').setDepth(7999).setAlpha(0.6).setScale(1.2);
    const bar = this.add.graphics().setDepth(8200);
    this.enemies.push({
      sprite, shadow, hp: 45, maxHp: 45, dmg: 3.5,
      ranged, base: ranged ? 'archer' : 'soldier', side: 'rival', mode: 'garrison',
      path: [], targetPx: null, speed: 60, target: null, attackT: 0, bar,
    });
  }

  /** Director rival: un paso cada ~12s de pared (lo llama tickEconomy). */
  private rivalTickStep = 0;

  private rivalTick() {
    if (!this.aiCenter || this.gameStatus !== 'playing' || !this.rivalAlive()) return;
    this.rivalTickStep++;
    const built = this.rivalBuildings();
    // Construir según el orden (o tardío por rotación).
    if (this.rivalTickStep % 12 === 0) {
      const next = nextRivalBuild(RIVAL_ORDER, built, this.aiStock)
        ?? lateRivalBuild(built.length, this.aiStock);
      if (next) {
        const spot = this.rivalSpot();
        if (spot) {
          this.aiStock = payCost(this.aiStock, BUILDINGS[next].coste);
          if (this.tryPlace(next, spot.x, spot.y, true, 'rival') && (next === 'cuartel' || next === 'torre')) {
            this.hintText?.setText(`⚔ El rival levanta ${BUILDINGS[next].nombre}`).setY(44);
            this.time.delayedCall(4000, () => this.hintText.setText(''));
          }
        }
      }
      // Mano de obra rival visible (tope 6).
      const crew = this.walkers.filter((w) => w.kind === 'settler' && w.faction === 'rival').length;
      if (crew < 6) {
        this.spawnRivalWorker(['carrier', 'woodcutter', 'settler', 'miner'][crew % 4]);
      }
    }
    // Reclutar guarnición con los mismos costes que el jugador.
    const garrison = this.rivalGarrison();
    if (built.includes('cuartel') && garrison.length < 5 && this.rivalTickStep % 6 === 0) {
      const cost = recruitCost(garrison.length);
      if ((this.aiStock.espada ?? 0) >= cost.espada && (this.aiStock.pan ?? 0) >= cost.pan) {
        this.aiStock.espada -= cost.espada;
        this.aiStock.pan -= cost.pan;
        this.spawnRivalTroop();
      }
    }
    // Incursión cada ~75s si hay guarnición.
    this.aiRaidT++;
    if (this.aiRaidT >= 75) {
      this.aiRaidT = 0;
      const raiders = this.rivalGarrison().slice(0, 3);
      if (raiders.length >= 2) {
        for (const e of raiders) {
          e.mode = 'raid';
          this.sendEnemy(e);
        }
        this.aiRaids++;
        this.hintText?.setText(`⚔ ¡Incursión rival! ${raiders.length} soldados se acercan`).setY(44);
        playSfx('sword');
        this.time.delayedCall(4000, () => this.hintText.setText(''));
      }
    }
  }

  private updateHud() {
    // El HUD visible vive en React (/play lee window.__stock cada segundo).
    (window as unknown as { __stock?: Stock }).__stock = { ...this.stock };
  }

  private exposeBridge() {
    const w = window as unknown as {
      __game?: {
        place: (id: BuildingId) => void;
        road: () => void;
        debugClick: (sx: number, sy: number) => { x: number; y: number } | null;
        focus: (tx: number, ty: number) => void;
        pop: () => { pop: number; cap: number; morale: number; eating: number };
        stalls: () => { id: BuildingId; nombre: string; tx: number; ty: number; faltan: string[] }[];
        stock: () => Stock;
        counts: () => number;
        recruit: () => boolean;
        save: () => string | null;
        load: () => boolean;
        hasSave: () => string | null;
        status: () => { status: string; wave: number; kills: number; buildings: number; timeSec: number; rival: number; aiBase: { x: number; y: number } | null; ai: { espada: number; pan: number; hierro: number; carbon: number; lingote: number; troops: number; raids: number } };
        objectives: () => { id: string; text: string; done: boolean }[];
        inspect: (tx: number, ty: number) => {
          id: BuildingId; nombre: string; descripcion: string; categoria: string;
          receta?: { in: [string, number][]; out: [string, number][] };
          produciendo: boolean;
          faltan?: string[];
          bando: 'tuya' | 'rival';
        } | null;
      };
    };
    w.__game = {
      place: (id: BuildingId) => {
        this.pendingBuild = id;
        this.pendingRoad = false;
        this.hideSelectRing();
        this.hintText?.setText(`🏗 ${BUILDINGS[id].nombre}: clic en una loseta (ESC cancela)`).setY(44);
      },
      road: () => {
        this.pendingRoad = true;
        this.pendingBuild = null;
        this.hideSelectRing();
        this.clearGhost();
        this.hintText?.setText('🛤 Camino: clic o arrastra para trazar (clic en camino = quitar, ESC termina)').setY(44);
      },
      debugClick: (lx: number, ly: number) => {
        const wp = this.cameras.main.getWorldPoint(lx, ly);
        const t = this.groundLayer.worldToTileXY(wp.x, wp.y);
        return t ? { x: t.x, y: t.y } : null;
      },
      pop: () => ({
        pop: this.popCount,
        cap: housingFor(this.placed.filter((p) => p.owner === 'player').map((p) => p.id)),
        morale: this.morale,
        eating: foodPerTick(this.popCount),
      }),
      stalls: () => {
        const out: { id: BuildingId; nombre: string; tx: number; ty: number; faltan: string[] }[] = [];
        for (const p of this.placed) {
          const faltan = this.stallInfo.get(`${p.tx},${p.ty}`);
          if (faltan) out.push({ id: p.id, nombre: BUILDINGS[p.id].nombre, tx: p.tx, ty: p.ty, faltan: [...faltan] });
        }
        return out;
      },
      stock: () => ({ ...this.stock }),
      counts: () => this.placed.length,
      recruit: () => this.recruit(),
      save: () => this.saveGame(),
      load: () => this.loadGame(),
      status: () => ({
        status: this.gameStatus,
        wave: this.waveNo,
        kills: this.kills,
        buildings: this.placed.length,
        timeSec: Math.floor((this.time.now - this.startTime) / 1000),
        rival: this.rivalBuildings().length,
        aiBase: this.aiCenter ? { ...this.aiCenter } : null,
        ai: {
          espada: this.aiStock.espada, pan: this.aiStock.pan,
          hierro: this.aiStock.hierro, carbon: this.aiStock.carbon,
          lingote: this.aiStock.lingoteHierro,
          troops: this.enemies.filter((e) => e.side === 'rival' && e.sprite.active).length,
          raids: this.aiRaids,
        },
      }),
      // Hook QA: centra la cámara en una loseta (sondas, no UI).
      focus: (tx: number, ty: number) => {
        const p = this.iso(Math.round(tx), Math.round(ty));
        this.panTarget = { x: p.x, y: p.y };
      },
      objectives: () => {
        const army = this.walkers.filter((x) => x.kind === 'settler' && x.faction === 'player' && (x.role === 'soldier' || x.role === 'archer')).length;
        const state = {
          buildings: this.placed.filter((p) => p.owner === 'player').map((p) => p.id),
          army,
          wavesRepelled: this.wavesRepelled,
        };
        return OBJECTIVES.map((o) => ({
          id: o.id,
          text: o.text,
          done: this.doneObjectives.has(o.id) || isComplete(o.id, state),
        }));
      },
      hasSave: () => {
        try {
          const raw = window.localStorage.getItem(SAVE_KEY);
          if (!raw) return null;
          const data = JSON.parse(raw) as { savedAt?: number };
          return data.savedAt ? new Date(data.savedAt).toLocaleString() : null;
        } catch {
          return null;
        }
      },
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
          produciendo: !!recipe && !this.stallInfo.has(`${tx},${ty}`),
          faltan: this.stallInfo.get(`${tx},${ty}`),
          bando: p.owner === 'rival' ? 'rival' : 'tuya',
        };
      },
    };
  }

  override update(_time: number, delta: number) {
    const cam = this.cameras.main;
    const dt = Math.min(delta, 100) / 1000;
    // --- Economía a 1 tick/s de pared, independiente de los FPS.
    const wallNow = performance.now();
    if (this.econLast > 0) {
      this.econAcc += Math.min(wallNow - this.econLast, 250);
      let n = 0;
      while (this.econAcc >= 1000 && n < 3) {
        this.tickEconomy();
        this.econAcc -= 1000;
        n++;
      }
      if (n === 3) this.econAcc = 0;
    }
    this.econLast = wallNow;
    // --- Cámara suave: velocidad con inercia + edge scrolling + zoom interpolado.
    const accel = 2600 / cam.zoom;
    let ix = 0;
    let iy = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) ix -= 1;
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) ix += 1;
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) iy -= 1;
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) iy += 1;
    // Edge scrolling (márgenes de 14px, solo si el puntero está dentro del canvas
    // y ya se ha movido alguna vez: evita que el puntero sintético (0,0)
    // arrastre la cámara a una esquina al cargar la partida).
    const p = this.input.activePointer;
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.edgeArmed && p && !p.isDown && p.x >= 0 && p.y >= 0 && p.x <= w && p.y <= h && !this.inMinimap(p.x, p.y)) {
      const m = 14;
      if (p.x < m) ix -= 1;
      else if (p.x > w - m) ix += 1;
      if (p.y < m) iy -= 1;
      else if (p.y > h - m) iy += 1;
    }
    if (this.wasd?.Q.isDown) this.zoomTarget = Phaser.Math.Clamp(this.zoomTarget * (1 - dt * 1.2), 0.35, 2);
    if (this.wasd?.E.isDown) this.zoomTarget = Phaser.Math.Clamp(this.zoomTarget * (1 + dt * 1.2), 0.35, 2);
    const n = Math.hypot(ix, iy) || 1;
    this.camVel.x = Phaser.Math.Linear(this.camVel.x, (ix / n) * accel * dt * 18, 1 - Math.exp(-dt * 8));
    this.camVel.y = Phaser.Math.Linear(this.camVel.y, (iy / n) * accel * dt * 18, 1 - Math.exp(-dt * 8));
    // Cualquier entrada manual cancela el paneado programado.
    if (ix !== 0 || iy !== 0 || (p && p.isDown)) this.panTarget = null;
    if (this.panTarget) {
      // Paneado suave hacia el objetivo (centra la vista en él).
      const wantX = this.panTarget.x - cam.width / (2 * cam.zoom);
      const wantY = this.panTarget.y - cam.height / (2 * cam.zoom);
      const k = 1 - Math.exp(-dt * 5);
      cam.scrollX = Phaser.Math.Linear(cam.scrollX, wantX, k);
      cam.scrollY = Phaser.Math.Linear(cam.scrollY, wantY, k);
      this.camVel.x = 0;
      this.camVel.y = 0;
      if (Math.hypot(wantX - cam.scrollX, wantY - cam.scrollY) < 3) this.panTarget = null;
    } else {
      cam.scrollX += this.camVel.x * dt;
      cam.scrollY += this.camVel.y * dt;
    }
    if (Math.abs(cam.zoom - this.zoomTarget) > 0.001) {
      const nz = Phaser.Math.Linear(cam.zoom, this.zoomTarget, 1 - Math.exp(-dt * 8));
      cam.setZoom(nz);
      if (this.zoomAnchor) {
        try {
          const after = cam.getWorldPoint(this.zoomAnchor.sx, this.zoomAnchor.sy);
          cam.scrollX += this.zoomAnchor.wx - after.x;
          cam.scrollY += this.zoomAnchor.wy - after.y;
        } catch { /* noop */ }
      }
    } else {
      this.zoomAnchor = null;
    }
    this.updateWalkers(dt * 1000);
    this.updateShips(dt);
    this.updateEnemies(dt);
    this.drawMapFrame();
    updateWaterFX(this.waterFX);
  }
}