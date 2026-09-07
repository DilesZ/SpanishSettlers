import Phaser from 'phaser';
import { playSfx } from '../audio';
import { BUILDINGS, INITIAL_STOCK, type BuildingId, type ResourceId } from '../data/buildings';
import { WL_BUILDINGS, WL_BUSHES, WL_CRITTERS, WL_ROCKS, WL_TREES, WL_WORKERS, wlBuildingScale, wlWorkerScale } from '../data/wlArt';
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
};

const WL_SMOKE: Set<BuildingId> = new Set(['fundicion', 'herreria', 'panaderia', 'minaCarbon', 'minaHierro', 'minaOro', 'cabanaLenador']);
const MAP = ISLAND_SIZE;

interface Placed { id: BuildingId; tx: number; ty: number; sprite: Phaser.GameObjects.Container; done: number; total: number }

export class GameScene extends Phaser.Scene {
  stock: Stock = { ...INITIAL_STOCK };
  placed: Placed[] = [];
  settlers: Phaser.GameObjects.Sprite[] = [];
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
        this.load.spritesheet(`wl-${role}-${dir}`, `/assets/wl/people/${d.file}`, {
          frameWidth: d.fw, frameHeight: d.fh,
        });
      }
      for (const [dir, d] of Object.entries(w.loads ?? {})) {
        this.load.spritesheet(`wl-${role}-load-${dir}`, `/assets/wl/people/${d.file}`, {
          frameWidth: d.fw, frameHeight: d.fh,
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
      if (art.build && !this.anims.exists(`wl-build-${id}`)) {
        this.anims.create({
          key: `wl-build-${id}`,
          frames: this.anims.generateFrameNumbers(`wl-buildsheet-${id}`, { start: 0, end: art.build.frames - 1 }),
          frameRate: art.build.fps,
          repeat: -1,
        });
      }
    }
    for (const [role, w] of Object.entries(WL_WORKERS)) {
      for (const dir of Object.keys(w.dirs)) {
        const key = `wl-walk-${role}-${dir}`;
        if (this.anims.exists(key)) continue;
        const total = w.grid.columns * w.grid.rows;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-${role}-${dir}`, { start: 0, end: Math.min(w.grid.frames, total) - 1 }),
          frameRate: w.grid.fps,
          repeat: -1,
        });
      }
      for (const dir of Object.keys(w.loads ?? {})) {
        const key = `wl-walkload-${role}-${dir}`;
        if (this.anims.exists(key)) continue;
        const total = w.grid.columns * w.grid.rows;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-${role}-load-${dir}`, { start: 0, end: Math.min(w.grid.frames, total) - 1 }),
          frameRate: w.grid.fps,
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
      for (const dir of Object.keys(c.dirs)) {
        if (dir === 'idle') continue;
        const key = `wl-crit-${name}-${dir}`;
        if (this.anims.exists(key)) continue;
        const total = c.grid.columns * c.grid.rows;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(`wl-crit-${name}-${dir}`, { start: 0, end: Math.min(c.grid.frames, total) - 1 }),
          frameRate: Math.min(c.grid.fps, 12),
          repeat: -1,
        });
      }
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
    this.exposeBridge();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickEconomy() });
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.animateWater() });
    this.scale.on('resize', () => this.layoutMinimap());
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
          const w = this.waterCells[Phaser.Math.Between(0, this.waterCells.length - 1)];
          tx = Phaser.Math.Clamp(w.x + Phaser.Math.Between(-2, 2), 2, MAP - 3);
          ty = Phaser.Math.Clamp(w.y + Phaser.Math.Between(-2, 2), 2, MAP - 3);
        } else {
          tx = Phaser.Math.Clamp(Math.round(this.center.x + Phaser.Math.Between(-7, 7)), 2, MAP - 3);
          ty = Phaser.Math.Clamp(Math.round(this.center.y + Phaser.Math.Between(-7, 7)), 2, MAP - 3);
        }
        const { x, y } = this.iso(tx, ty);
        const s = this.add.sprite(x, y - 8, `wl-crit-${name}-e`, 0).setDepth(7400);
        s.setData('critter', name);
        s.setScale(1.1);
        s.play(`wl-crit-${name}-e`);
        this.wanderCritter(s);
      }
    }
  }

  private wanderCritter(s: Phaser.GameObjects.Sprite) {
    if (!s.active) return;
    const name = s.getData('critter') as string;
    // destino cercano aleatorio (los bichos no se alejan)
    const cur = this.groundLayer.worldToTileXY(s.x, s.y) ?? { x: this.center.x, y: this.center.y };
    const nx = Phaser.Math.Clamp(cur.x + Phaser.Math.Between(-3, 3), 2, MAP - 3);
    const ny = Phaser.Math.Clamp(cur.y + Phaser.Math.Between(-3, 3), 2, MAP - 3);
    const { x, y } = this.iso(nx, ny);
    const dir = x >= s.x ? 'e' : 'w';
    const key = `wl-crit-${name}-${dir}`;
    if (WL_CRITTERS[name]?.dirs[dir as 'e' | 'w'] && this.anims.exists(key)) {
      s.setTexture(key);
      s.play(key);
    }
    s.setDepth(7400 + ny);
    this.tweens.add({
      targets: s, x, y: y - 8,
      duration: name === 'bunny' ? Phaser.Math.Between(900, 1600) : Phaser.Math.Between(2500, 5000),
      ease: 'Sine.easeInOut', onComplete: () => this.wanderCritter(s),
    });
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
    s.setData('role', tex);
    s.setData('dir', 'e');
    const fh = WL_WORKERS[tex]?.dirs.e?.fh ?? 42;
    s.setScale(wlWorkerScale(fh));
    s.play(`wl-walk-${tex}-e`);
    this.settlers.push(s);
    this.wanderRole(s);
  }

  private wanderRole(s: Phaser.GameObjects.Sprite) {
    if (!s.active) return;
    const role = s.getData('role') as string;
    let tx = Phaser.Math.Between(3, MAP - 4);
    let ty = Phaser.Math.Between(3, MAP - 4);
    if (role === 'woodcutter' && this.forestTiles.length) {
      const c = this.pickTile(this.forestTiles, this.center.x, this.center.y, 11);
      tx = c.x; ty = c.y;
    } else if (role === 'miner' && this.hillTiles.length) {
      const c = this.pickTile(this.hillTiles, this.center.x, this.center.y, 11);
      tx = c.x; ty = c.y;
    } else if (role === 'fisher' && this.shoreTiles.length) {
      const c = this.pickTile(this.shoreTiles, this.center.x, this.center.y, 13);
      tx = c.x; ty = c.y;
    } else if (role === 'carrier' && this.placed.length > 1) {
      const a = this.placed[0];
      const b = this.placed[Phaser.Math.Between(1, this.placed.length - 1)];
      const t = Math.random() > 0.5 ? a : b;
      tx = Phaser.Math.Clamp(t.tx + Phaser.Math.Between(-1, 1), 2, MAP - 3);
      ty = Phaser.Math.Clamp(t.ty + Phaser.Math.Between(0, 2), 2, MAP - 3);
    } else if ((role === 'soldier' || role === 'archer') && this.placed.length) {
      const towers = this.placed.filter((p) => p.id === 'torre' || p.id === 'cuartel');
      const t = towers.length ? towers[Phaser.Math.Between(0, towers.length - 1)] : this.placed[0];
      tx = Phaser.Math.Clamp(t.tx + Phaser.Math.Between(-4, 4), 2, MAP - 3);
      ty = Phaser.Math.Clamp(t.ty + Phaser.Math.Between(-4, 4), 2, MAP - 3);
    } else {
      tx = Phaser.Math.Clamp(Math.round(this.center.x + Phaser.Math.Between(-6, 6)), 2, MAP - 3);
      ty = Phaser.Math.Clamp(Math.round(this.center.y + Phaser.Math.Between(-6, 6)), 2, MAP - 3);
    }
    const { x, y } = this.iso(tx, ty);
    // dirección este/oeste según el destino (los sheets son direccionales);
    // los portadores alternan vacío/cargado para que se vea el acarreo
    const dir = x >= s.x ? 'e' : 'w';
    const loaded = role === 'carrier' && WL_WORKERS[role]?.loads?.[dir as 'e' | 'w'] && Math.random() > 0.5;
    const key = loaded ? `wl-walkload-${role}-${dir}` : `wl-walk-${role}-${dir}`;
    if ((loaded || WL_WORKERS[role]?.dirs[dir as 'e' | 'w']) && this.anims.exists(key)) {
      s.setTexture(loaded ? `wl-${role}-load-${dir}` : `wl-${role}-${dir}`);
      s.play(key);
    }
    s.setDepth(7500 + ty * 2);
    this.tweens.add({ targets: s, x, y: y - 15, duration: Phaser.Math.Between(2200, 5200), ease: 'Sine.easeInOut', onComplete: () => this.wanderRole(s) });
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
        s.setData('role', oficio);
        s.setScale(wlWorkerScale(WL_WORKERS[oficio].dirs.e?.fh ?? 42));
        s.play(`wl-walk-${oficio}-e`);
        this.settlers.push(s);
        this.wanderRole(s);
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
    if (!this.pendingBuild) return;
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
      onComplete: () => { buildFx?.destroy(); worker.destroy(); img.setAlpha(1); this.popIn(img, scale); },
    });
    this.placed.push({ id, tx, ty, sprite: c, done: 0, total: def.tiempoConstruccionMs });
    if (WL_SMOKE.has(id)) this.addSmoke(x, y - art.h * scale * 0.85, depth + 1);
    if (id === 'torre') this.territoryRadius += 1.5;
    if (id === 'cuartel') {
      if (!free) playSfx('sword');
      for (const t of ['soldier', 'archer']) {
        const s = this.add.sprite(x + 30, y - 15, `wl-${t}-e`, 0).setDepth(8000);
        s.setData('role', t);
        s.setScale(wlWorkerScale(WL_WORKERS[t]?.dirs.e?.fh ?? 42));
        s.play(`wl-walk-${t}-e`);
        this.settlers.push(s);
        this.wanderRole(s);
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
        add('fence', -62, -2); add('flowers', 52, 0); break;
      case 'granja':
        add('fence', -68, -2); add('fence', 68, -2); break;
      case 'pozo': add('flowers', -44, 0); break;
      case 'fundicion': case 'herreria': add('crates', 62, -4); break;
      case 'cuartel': case 'armeria': add('fence', -64, -2); add('fence', 64, -2); break;
      case 'torre': add('stones', 52, -2, 0.8); break;
      case 'ornamento': add('flowers', -58, 0); add('flowers', 58, 0); add('tuft', -38, 2); add('tuft', 38, 2); break;
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
    const puff = () => {
      if (!this.scene.isActive()) return;
      const p = this.add.circle(x + Phaser.Math.Between(-5, 5), y, 5, 0xf5f0e8, 0.5).setDepth(depth);
      this.tweens.add({
        targets: p, y: y - 50, x: x + Phaser.Math.Between(8, 22), alpha: 0, scale: 2.2,
        duration: 1900, onComplete: () => p.destroy(),
      });
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
    const recipeByBuilding: Partial<Record<BuildingId, string>> = {
      aserradero: 'tablon', molino: 'harina', panaderia: 'pan', fundicion: 'lingote-hierro', herreria: 'herramienta', armeria: 'espada',
    };
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
      __game?: { place: (id: BuildingId) => void; stock: () => Stock; counts: () => number };
    };
    w.__game = {
      place: (id: BuildingId) => {
        this.pendingBuild = id;
        this.hintText?.setText(`🏗 ${BUILDINGS[id].nombre}: clic en una loseta (ESC cancela)`).setY(44);
      },
      stock: () => ({ ...this.stock }),
      counts: () => this.placed.length,
    };
  }

  override update() {
    const cam = this.cameras.main;
    const speed = 22 / cam.zoom;
    const keys = this.input.keyboard?.createCursorKeys();
    if (keys?.left.isDown || this.wasd?.A.isDown) cam.scrollX -= speed;
    if (keys?.right.isDown || this.wasd?.D.isDown) cam.scrollX += speed;
    if (keys?.up.isDown || this.wasd?.W.isDown) cam.scrollY -= speed;
    if (keys?.down.isDown || this.wasd?.S.isDown) cam.scrollY += speed;
  }
}
