import Phaser from 'phaser';
import { BUILDINGS, INITIAL_STOCK, type BuildingId, type ResourceId } from '../data/buildings';
import { tickJob, type ProductionJob, type Stock } from '../systems/economy';

export const TILE_W = 64;
export const TILE_H = 32;
const MAP = 28;

type Terrain = 'grass' | 'sand' | 'water' | 'forest' | 'mountain';
interface Placed { id: BuildingId; tx: number; ty: number; sprite: Phaser.GameObjects.Container; done: number; total: number }

const BUILD_TEX: Record<BuildingId, string> = {
  almacen: 'b-almacen', cabanaLenador: 'b-cabanaLenador', aserradero: 'b-aserradero',
  cantera: 'b-cantera', residenciaS: 'b-residenciaS', residenciaM: 'b-residenciaM',
  residenciaL: 'b-residenciaL', granja: 'b-granja', molino: 'b-molino',
  panaderia: 'b-panaderia', pozo: 'b-pozo', pesqueria: 'b-pesqueria',
  minaCarbon: 'b-minaCarbon', minaHierro: 'b-minaHierro', minaOro: 'b-minaOro',
  fundicion: 'b-fundicion', herreria: 'b-herreria', armeria: 'b-armeria',
  cuartel: 'b-cuartel', torre: 'b-torre', ornamento: 'b-ornamento',
};

const SMOKERS: Set<BuildingId> = new Set(['herreria', 'fundicion', 'panaderia', 'minaHierro', 'minaCarbon', 'cabanaLenador']);

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

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
  private waterTiles: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('game');
  }

  create() {
    this.generateMap();
    this.setupCamera();
    this.setupInput();
    this.spawnPopulation();
    this.placeInitial();
    this.exposeBridge();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickEconomy() });
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.animateWater() });
  }

  iso(tx: number, ty: number) {
    return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
  }

  private terrainAt(tx: number, ty: number): Terrain {
    const d = Math.hypot(tx - MAP / 2, ty - MAP / 2);
    const n = hash(tx, ty);
    if (d > 12.5) return 'water';
    if (d > 11.2) return 'sand';
    if (n > 0.9) return 'mountain';
    if (n > 0.72) return 'forest';
    return 'grass';
  }

  private grassKey(tx: number, ty: number): string {
    const n = hash(tx * 3 + 11, ty * 7 + 5);
    return n > 0.66 ? 'grass0' : n > 0.33 ? 'grass1' : 'grass2';
  }

  private generateMap() {
    for (let ty = 0; ty < MAP; ty++) {
      for (let tx = 0; tx < MAP; tx++) {
        const t = this.terrainAt(tx, ty);
        const { x, y } = this.iso(tx, ty);
        let key = this.grassKey(tx, ty);
        if (t === 'water') key = hash(tx, ty * 2) > 0.5 ? 'water' : 'water2';
        else if (t === 'sand') key = 'sand';
        else if (t === 'forest') key = 'forest';
        else if (t === 'mountain') key = 'mountain';
        const img = this.add.image(x, y, key).setDepth(ty * MAP + tx);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerdown', () => this.onTileClicked(tx, ty));
        img.on('pointerover', () => img.setTint(0xfff2cc));
        img.on('pointerout', () => img.clearTint());
        if (t === 'water') this.waterTiles.push(img);
        this.decorate(tx, ty, t, x, y);
      }
    }
    const c = this.iso(this.center.x, this.center.y);
    this.add.circle(c.x, c.y - 8, this.territoryRadius * 34, 0xfbbf24, 0.07).setDepth(9500).setStrokeStyle(2, 0xfbbf24, 0.45);
  }

  private decorate(tx: number, ty: number, t: Terrain, x: number, y: number) {
    const depth = ty * MAP + tx + 0.5;
    const n = hash(tx * 13 + 7, ty * 29 + 3);
    if (t === 'forest' && n > 0.25) {
      const tree = this.add.image(x + Phaser.Math.Between(-10, 10), y - 12, n > 0.6 ? 'pine' : 'oak').setDepth(depth);
      tree.setScale(0.9 + n * 0.4);
      this.tweens.add({ targets: tree, angle: 1.2, duration: 2200 + n * 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (t === 'mountain' && n > 0.4) {
      this.add.image(x, y - 8, 'rock').setDepth(depth).setScale(0.9 + n * 0.5);
    } else if (t === 'grass' && n > 0.86) {
      this.add.image(x + 8, y + 2, 'flowers').setDepth(depth).setAlpha(0.95);
    } else if (t === 'sand' && n > 0.9) {
      this.add.image(x - 6, y, 'rock').setDepth(depth).setScale(0.5).setAlpha(0.8);
    }
  }

  private animateWater() {
    for (const w of this.waterTiles) {
      if (!w.active) continue;
      w.setTexture(w.texture.key === 'water' ? 'water2' : 'water');
    }
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.centerOn(0, 200);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.4, 2.5));
    });
    let dragging = false;
    let last = { x: 0, y: 0 };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) { dragging = true; last = { x: p.x, y: p.y }; }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragging && p.isDown) { cam.scrollX -= (p.x - last.x) / cam.zoom; cam.scrollY -= (p.y - last.y) / cam.zoom; last = { x: p.x, y: p.y }; }
    });
    this.input.on('pointerup', () => { dragging = false; });
    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBounds(-1200, -400, 2400, 1600);

    this.hudText = this.add.text(12, 10, '', { fontSize: '12px', color: '#fff', backgroundColor: '#00000099', padding: { x: 8, y: 6 } })
      .setScrollFactor(0).setDepth(9900);
    this.hintText = this.add.text(12, 0, '', { fontSize: '12px', color: '#fde68a', backgroundColor: '#00000099', padding: { x: 8, y: 6 } })
      .setScrollFactor(0).setDepth(9900);
  }

  private wasd?: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  private setupInput() {
    this.input.keyboard?.on('keydown-ESC', () => { this.pendingBuild = null; this.hintText?.setText(''); });
    if (this.input.keyboard) {
      this.wasd = this.input.keyboard.addKeys('W,A,S,D') as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    }
  }

  // ---------- Población con oficios ----------
  private spawnPopulation() {
    const jobs: [string, number][] = [
      ['woodcutter', 3], ['carrier', 5], ['settler', 4],
      ['miner', 2], ['fisher', 1], ['soldier', 2],
    ];
    for (const [tex, n] of jobs) {
      for (let i = 0; i < n; i++) this.spawnPerson(tex);
    }
  }

  private spawnPerson(tex: string) {
    const tx = this.center.x + Phaser.Math.Between(-5, 5);
    const ty = this.center.y + Phaser.Math.Between(-5, 5);
    const { x, y } = this.iso(Phaser.Math.Clamp(Math.round(tx), 3, MAP - 4), Phaser.Math.Clamp(Math.round(ty), 3, MAP - 4));
    const s = this.add.image(x, y - 14, tex).setDepth(8000);
    this.settlers.push(s);
    this.wander(s);
  }

  private wander(s: Phaser.GameObjects.Image) {
    if (!s.active) return;
    const tx = Phaser.Math.Between(3, MAP - 4);
    const ty = Phaser.Math.Between(3, MAP - 4);
    const { x, y } = this.iso(tx, ty);
    s.setFlipX(x < s.x);
    s.setDepth(7500 + ty * 2);
    // pasitos: balanceo + bote
    this.tweens.add({ targets: s, x, y: y - 14, duration: Phaser.Math.Between(2200, 5200), ease: 'Sine.easeInOut', onComplete: () => this.wander(s) });
    this.tweens.add({ targets: s, scaleY: 0.94, duration: 280, yoyo: true, repeat: 6 });
  }

  private placeInitial() {
    this.tryPlace('almacen', this.center.x, this.center.y, true);
    this.tryPlace('cabanaLenador', this.center.x - 3, this.center.y - 1, true);
    this.tryPlace('cantera', this.center.x + 3, this.center.y - 2, true);
    this.tryPlace('residenciaS', this.center.x - 1, this.center.y + 3, true);
    this.tryPlace('granja', this.center.x + 4, this.center.y + 2, true);
    this.tryPlace('torre', this.center.x - 5, this.center.y - 4, true);
  }

  onTileClicked(tx: number, ty: number) {
    if (!this.pendingBuild) return;
    if (this.terrainAt(tx, ty) === 'water') {
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
    const shadow = this.add.image(0, -2, 'shadow').setAlpha(0.7);
    const img = this.add.image(0, -34, BUILD_TEX[id]).setOrigin(0.5, 1);
    const name = this.add.text(0, 2, def.nombre, { fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5);
    const c = this.add.container(x, y, [shadow, img, name]).setDepth(depth);
    // andamio que se desvanece al "terminar" la obra
    const scaffold = this.add.image(0, -34, 'scaffold').setOrigin(0.5, 1).setAlpha(0.95);
    c.add(scaffold);
    img.setAlpha(0.45);
    this.tweens.add({
      targets: [scaffold], alpha: 0, duration: Math.min(def.tiempoConstruccionMs, 4000),
      onComplete: () => { scaffold.destroy(); img.setAlpha(1); this.popIn(img); },
    });
    this.placed.push({ id, tx, ty, sprite: c, done: 0, total: def.tiempoConstruccionMs });
    if (SMOKERS.has(id)) this.addSmoke(x, y - 78, depth + 1);
    if (id === 'torre') this.territoryRadius += 1.5;
    if (id === 'cuartel') {
      const sx = x + 26;
      const s = this.add.image(sx, y - 14, 'soldier').setDepth(8000);
      this.settlers.push(s);
      this.wander(s);
    }
    this.updateHud();
    return true;
  }

  private popIn(img: Phaser.GameObjects.Image) {
    img.setScale(0.85);
    this.tweens.add({ targets: img, scale: 1, duration: 280, ease: 'Back.easeOut' });
  }

  private addSmoke(x: number, y: number, depth: number) {
    const puff = () => {
      if (!this.scene.isActive()) return;
      const p = this.add.circle(x + Phaser.Math.Between(-3, 3), y, 3, 0xffffff, 0.55).setDepth(depth);
      this.tweens.add({
        targets: p, y: y - 26, x: x + Phaser.Math.Between(4, 12), alpha: 0, scale: 2.1,
        duration: 1800, onComplete: () => p.destroy(),
      });
    };
    this.time.addEvent({ delay: 900, loop: true, callback: puff });
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
    this.hudText?.setText(`🪵${s.madera}  🧱${s.tablon}/${s.piedra}  🍞${s.pan} 💧${s.agua}  ⛏${s.carbon}/${s.hierro}/${s.oro}  🛠${s.herramienta} ⚔${s.espada} 🏹${s.arco}  🏠${this.placed.length}`);
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
    const speed = 12 / cam.zoom;
    const keys = this.input.keyboard?.createCursorKeys();
    if (keys?.left.isDown || this.wasd?.A.isDown) cam.scrollX -= speed;
    if (keys?.right.isDown || this.wasd?.D.isDown) cam.scrollX += speed;
    if (keys?.up.isDown || this.wasd?.W.isDown) cam.scrollY -= speed;
    if (keys?.down.isDown || this.wasd?.S.isDown) cam.scrollY += speed;
  }
}
