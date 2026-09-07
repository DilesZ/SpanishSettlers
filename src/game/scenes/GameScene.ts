import Phaser from 'phaser';
import { BUILDINGS, INITIAL_STOCK, type BuildingId, type ResourceId } from '../data/buildings';
import { ISLAND_SIZE, TILE_H, TILE_W, terrainAt } from '../maps/island';
import { tickJob, type ProductionJob, type Stock } from '../systems/economy';

// Fase 1: el suelo viene de Tiled (public/assets/maps/isla-01.json) con el
// tileset Kenney CC0 (public/assets/terrain-sheet.png). Este archivo ya NO
// dibuja tiles: solo decora, coloca edificios y simula.
const MAP = ISLAND_SIZE;

const BUILD_TEX: Record<BuildingId, string> = {
  almacen: 'b-almacen', cabanaLenador: 'b-cabanaLenador', aserradero: 'b-aserradero',
  cantera: 'b-cantera', residenciaS: 'b-residenciaS', residenciaM: 'b-residenciaM',
  residenciaL: 'b-residenciaL', granja: 'b-granja', molino: 'b-molino',
  panaderia: 'b-panaderia', pozo: 'b-pozo', pesqueria: 'b-pesqueria',
  minaCarbon: 'b-minaCarbon', minaHierro: 'b-minaHierro', minaOro: 'b-minaOro',
  fundicion: 'b-fundicion', herreria: 'b-herreria', armeria: 'b-armeria',
  cuartel: 'b-cuartel', torre: 'b-torre', ornamento: 'b-ornamento',
};

const SMOKERS: Set<BuildingId> = new Set(['herreria', 'fundicion', 'panaderia', 'minaHierro', 'minaCarbon', 'cabanaLenador', 'residenciaM', 'residenciaL']);
const GLOWERS: Set<BuildingId> = new Set(['fundicion', 'herreria', 'minaCarbon', 'minaHierro', 'minaOro', 'panaderia']);

interface Placed { id: BuildingId; tx: number; ty: number; sprite: Phaser.GameObjects.Container; done: number; total: number }

export class GameScene extends Phaser.Scene {
  stock: Stock = { ...INITIAL_STOCK };
  placed: Placed[] = [];
  settlers: Phaser.GameObjects.Image[] = [];
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
    this.load.tilemapTiledJSON('isla-01', 'assets/maps/isla-01.json');
    this.load.image('terreno', 'assets/terrain-sheet.png');
  }

  create() {
    this.buildTilemap();
    this.setupCamera();
    this.setupInput();
    this.placeFromLogicLayer();
    this.placeExtraInitial();
    this.spawnPopulation();
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
  }

  private decorate(tx: number, ty: number, t: string, x: number, y: number) {
    const depth = 100 + ty * MAP + tx + 0.5;
    // hash local para variar (misma función que island.ts)
    let h = (tx * 374761393 + ty * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const n = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    if (t === 'forest' && n > 0.22) {
      const tree = this.add.image(x + Phaser.Math.Between(-20, 20), y - 28, n > 0.55 ? 'pine' : 'oak').setDepth(depth);
      tree.setScale(1.5 + n * 0.7);
      this.tweens.add({ targets: tree, angle: 1.1, duration: 2400 + n * 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (t === 'mountain' && n > 0.35) {
      this.add.image(x, y - 18, 'rock').setDepth(depth).setScale(1.6 + n);
    } else if ((t === 'grass' || t === 'grassB' || t === 'grassC') && n > 0.86) {
      this.add.image(x + 16, y + 4, 'flowers').setDepth(depth).setAlpha(0.95).setScale(1.6);
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
    cam.setZoom(0.75);
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
    const s = this.add.image(x, y - 15, tex).setDepth(8000);
    s.setData('role', tex);
    s.setScale(1.8);
    this.settlers.push(s);
    this.wanderRole(s);
  }

  private wanderRole(s: Phaser.GameObjects.Image) {
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
    s.setFlipX(x < s.x);
    s.setDepth(7500 + ty * 2);
    this.tweens.add({ targets: s, x, y: y - 15, duration: Phaser.Math.Between(2200, 5200), ease: 'Sine.easeInOut', onComplete: () => this.wanderRole(s) });
    this.tweens.add({ targets: s, scaleY: 1.7, duration: 260, yoyo: true, repeat: 7 });
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
      else if (oficio) {
        const { x, y } = this.iso(t.x, t.y);
        const s = this.add.image(x, y - 15, oficio).setDepth(8000);
        s.setData('role', oficio);
        s.setScale(1.8);
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
    if (!free) {
      const ok = (Object.entries(def.coste) as [ResourceId, number][]).every(([k, v]) => this.stock[k] >= v);
      if (!ok) {
        this.hintText.setText(`⛔ Faltan recursos para ${def.nombre}`).setY(44);
        this.time.delayedCall(1500, () => this.hintText.setText(''));
        return false;
      }
      for (const [k, v] of Object.entries(def.coste) as [ResourceId, number][]) this.stock[k] -= v;
    }
    const { x, y } = this.iso(tx, ty);
    const depth = 6000 + ty * 4;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(this.add.image(0, -2, 'shadow').setAlpha(0.75).setScale(1.8));
    this.surroundings(id, x, y, depth, parts);
    const img = this.add.image(0, -34, BUILD_TEX[id]).setOrigin(0.5, 1).setScale(1.7);
    parts.push(img);
    const name = this.add.text(0, 3, def.nombre, { fontSize: '9px', color: '#fff', backgroundColor: '#00000077', padding: { x: 4, y: 2 } }).setOrigin(0.5);
    parts.push(name);
    const c = this.add.container(x, y, parts).setDepth(depth);
    if (id === 'molino') {
      const blades = this.add.image(58, -150, 'mill-blades').setScale(1);
      c.add(blades);
      this.tweens.add({ targets: blades, angle: 360, duration: 5200, repeat: -1 });
    }
    if (GLOWERS.has(id)) {
      const glow = this.add.image(0, -52, 'glow').setAlpha(0.5).setScale(2.2);
      c.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const scaffold = this.add.image(0, -34, 'scaffold').setOrigin(0.5, 1).setAlpha(0.95).setScale(1.7);
    c.add(scaffold);
    img.setAlpha(0.45);
    const worker = this.add.image(44, -12, 'carrier').setScale(1.8);
    c.add(worker);
    this.tweens.add({ targets: worker, y: -16, duration: 380, yoyo: true, repeat: 8 });
    this.drawPath(x, y, depth - 1);
    this.tweens.add({
      targets: [scaffold], alpha: 0, duration: Math.min(def.tiempoConstruccionMs, 4000),
      onComplete: () => { scaffold.destroy(); worker.destroy(); img.setAlpha(1); this.popIn(img, 1.7); },
    });
    this.placed.push({ id, tx, ty, sprite: c, done: 0, total: def.tiempoConstruccionMs });
    if (SMOKERS.has(id)) this.addSmoke(x, y - 150, depth + 1);
    if (id === 'torre') this.territoryRadius += 1.5;
    if (id === 'cuartel') {
      for (const t of ['soldier', 'archer']) {
        const s = this.add.image(x + 44, y - 15, t).setDepth(8000);
        s.setData('role', t);
        s.setScale(1.8);
        this.settlers.push(s);
        this.wanderRole(s);
      }
    }
    this.updateHud();
    return true;
  }

  private popIn(img: Phaser.GameObjects.Image, base: number) {
    img.setScale(base * 0.85);
    this.tweens.add({ targets: img, scale: base, duration: 300, ease: 'Back.easeOut' });
  }

  private surroundings(id: BuildingId, x: number, y: number, depth: number, parts: Phaser.GameObjects.GameObject[]) {
    const add = (tex: string, dx: number, dy: number, s = 1.7, alpha = 1) => {
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
        add('fence', -68, -2); add('fence', 68, -2);
        add('field', 0, 44, 1.7, 0.95); break;
      case 'pozo': add('flowers', -44, 0); break;
      case 'fundicion': case 'herreria': add('crates', 62, -4); break;
      case 'cuartel': case 'armeria': add('fence', -64, -2); add('fence', 64, -2); break;
      case 'torre': add('stones', 52, -2, 1.4); break;
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
      this.add.image(px, py + 8, 'pathdot').setDepth(depth).setAlpha(0.5).setScale(1.8);
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
