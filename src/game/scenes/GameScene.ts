import Phaser from 'phaser';
import { BUILDINGS, INITIAL_STOCK, type BuildingId, type ResourceId } from '../data/buildings';
import { tickJob, type ProductionJob, type Stock } from '../systems/economy';

export const TILE_W = 64;
export const TILE_H = 32;
const MAP = 28;

type Terrain = 'grass' | 'water' | 'forest' | 'mountain';
interface Placed { id: BuildingId; tx: number; ty: number; sprite: Phaser.GameObjects.Container; done: number; total: number }

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

  constructor() {
    super('game');
  }

  create() {
    this.generateMap();
    this.setupCamera();
    this.setupInput();
    this.spawnSettlers(14);
    this.placeInitial();
    this.exposeBridge();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickEconomy() });
  }

  iso(tx: number, ty: number) {
    return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
  }

  private terrainAt(tx: number, ty: number): Terrain {
    const dCenter = Math.hypot(tx - MAP / 2, ty - MAP / 2);
    const n = hash(tx, ty);
    if (dCenter > 12.5) return 'water';
    if (n > 0.9) return 'mountain';
    if (n > 0.74) return 'forest';
    return 'grass';
  }

  private generateMap() {
    let depth = 0;
    for (let ty = 0; ty < MAP; ty++) {
      for (let tx = 0; tx < MAP; tx++) {
        const t = this.terrainAt(tx, ty);
        const { x, y } = this.iso(tx, ty);
        const key = t === 'grass' ? (hash(tx * 3, ty * 7) > 0.5 ? 'grass0' : 'grass1') : t;
        const img = this.add.image(x, y, key).setDepth(depth++);
        img.setData('tx', tx);
        img.setData('ty', ty);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerdown', () => this.onTileClicked(tx, ty));
      }
    }
    // Borde de territorio inicial
    const c = this.iso(this.center.x, this.center.y);
    this.add.circle(c.x, c.y - 8, this.territoryRadius * 34, 0xfbbf24, 0.08).setDepth(5000).setStrokeStyle(2, 0xfbbf24, 0.5);
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.centerOn(0, 200);
    // Drag con botón derecho o espacio + drag; rueda = zoom (skill cameras + input)
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

    this.hudText = this.add.text(12, 10, '', { fontSize: '13px', color: '#fff', backgroundColor: '#00000088', padding: { x: 8, y: 6 } })
      .setScrollFactor(0).setDepth(9000);
  }

  private wasd?: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  private setupInput() {
    this.input.keyboard?.on('keydown-ESC', () => { this.pendingBuild = null; });
    if (this.input.keyboard) {
      this.wasd = this.input.keyboard.addKeys('W,A,S,D') as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    }
  }

  private spawnSettlers(n: number) {
    for (let i = 0; i < n; i++) {
      const tx = this.center.x + Phaser.Math.Between(-4, 4);
      const ty = this.center.y + Phaser.Math.Between(-4, 4);
      const { x, y } = this.iso(tx, ty);
      const s = this.add.image(x, y - 10, i % 4 === 0 ? 'carrier' : 'settler').setDepth(4000 + ty);
      this.settlers.push(s);
      this.wander(s);
    }
  }

  private wander(s: Phaser.GameObjects.Image) {
    const tx = Phaser.Math.Between(4, MAP - 5);
    const ty = Phaser.Math.Between(4, MAP - 5);
    const { x, y } = this.iso(tx, ty);
    this.tweens.add({ targets: s, x, y: y - 10, duration: Phaser.Math.Between(2000, 5000), onComplete: () => { if (s.active) this.wander(s); } });
  }

  private placeInitial() {
    this.tryPlace('almacen', this.center.x, this.center.y, true);
    this.tryPlace('cabanaLenador', this.center.x - 3, this.center.y - 1, true);
    this.tryPlace('cantera', this.center.x + 3, this.center.y - 2, true);
  }

  onTileClicked(tx: number, ty: number) {
    if (!this.pendingBuild) return;
    this.tryPlace(this.pendingBuild, tx, ty, false);
    this.pendingBuild = null;
  }

  tryPlace(id: BuildingId, tx: number, ty: number, free: boolean): boolean {
    const def = BUILDINGS[id];
    if (!free) {
      const ok = (Object.entries(def.coste) as [ResourceId, number][]).every(([k, v]) => this.stock[k] >= v);
      if (!ok) return false;
      for (const [k, v] of Object.entries(def.coste) as [ResourceId, number][]) this.stock[k] -= v;
    }
    const { x, y } = this.iso(tx, ty);
    const box = this.add.rectangle(0, -22, 44, 30, this.colorFor(id), 1).setStrokeStyle(2, 0x000000, 0.7);
    const label = this.add.text(0, -30, def.nombre.slice(0, 10), { fontSize: '9px', color: '#fff' }).setOrigin(0.5);
    const c = this.add.container(x, y, [box, label]).setDepth(3000 + ty);
    this.placed.push({ id, tx, ty, sprite: c, done: 0, total: def.tiempoConstruccionMs });
    // Efecto territorio de torre
    if (id === 'torre') this.territoryRadius += 1.5;
    if (id === 'cuartel') this.spawnSoldier(x, y);
    this.updateHud();
    return true;
  }

  private colorFor(id: BuildingId): number {
    switch (BUILDINGS[id].categoria) {
      case 'madera': return 0x8b5a2b;
      case 'comida': return 0xd9a441;
      case 'mina': return 0x6b7280;
      case 'industria': return 0x7c3aed;
      case 'militar': return 0xdc2626;
      case 'decoracion': return 0xec4899;
      default: return 0x1d4ed8;
    }
  }

  private spawnSoldier(x: number, y: number) {
    const s = this.add.image(x + 20, y - 10, 'soldier').setDepth(4100);
    this.settlers.push(s);
    this.wander(s);
  }

  private tickEconomy() {
    // Producción automática simplificada: cada edificio productivo genera con su receta principal.
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
    // Recetas con temporizador (aserradero/molino/panadería/fundición/herrería/armería)
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
    this.hudText?.setText(`Madera:${s.madera} Tablón:${s.tablon} Piedra:${s.piedra} | Pan:${s.pan} Agua:${s.agua} | Carbón:${s.carbon} Hierro:${s.hierro} Lingote:${s.lingoteHierro} Oro:${s.oro} | Herr:${s.herramienta} Esp:${s.espada} Arco:${s.arco} | Edificios:${this.placed.length}`);
    (window as unknown as { __stock?: Stock }).__stock = { ...this.stock };
  }

  private exposeBridge() {
    const w = window as unknown as {
      __game?: { place: (id: BuildingId) => void; stock: () => Stock; counts: () => number };
    };
    w.__game = {
      place: (id: BuildingId) => { this.pendingBuild = id; },
      stock: () => ({ ...this.stock }),
      counts: () => this.placed.length,
    };
  }

  override update() {
    // Movimiento de cámara con bordes + WASD/flechas
    const cam = this.cameras.main;
    const speed = 12 / cam.zoom;
    const keys = this.input.keyboard?.createCursorKeys();
    if (keys?.left.isDown || this.wasd?.A.isDown) cam.scrollX -= speed;
    if (keys?.right.isDown || this.wasd?.D.isDown) cam.scrollX += speed;
    if (keys?.up.isDown || this.wasd?.W.isDown) cam.scrollY -= speed;
    if (keys?.down.isDown || this.wasd?.S.isDown) cam.scrollY += speed;
  }
}
