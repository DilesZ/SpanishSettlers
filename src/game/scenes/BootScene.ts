import Phaser from 'phaser';

// SpanishSettlers — arte HD 100% ORIGINAL generado por código.
// Estilo "terracota ibérica": encalado, entramado de roble, teja árabe,
// piedra arenisca, madera cálida. Nada copiado de ningún juego.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    this.makeTiles();
    this.makeNature();
    this.makeProps();
    this.makePeople();
    this.makeBuildings();
    this.makeFx();
    this.scene.start('game');
  }

  // ============ TILES 64x32 ============
  private tile(key: string, base: number, edge: number, speckles: [number, number, number][] = []) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const w = 64;
    const h = 32;
    g.fillStyle(base, 1);
    g.beginPath();
    g.moveTo(w / 2, 1);
    g.lineTo(w - 1, h / 2);
    g.lineTo(w / 2, h - 1);
    g.lineTo(1, h / 2);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, edge, 1);
    g.strokePath();
    for (const [sx, sy, c] of speckles) {
      g.fillStyle(c, 0.9);
      g.fillCircle(sx, sy, 1.4);
    }
    g.lineStyle(1, 0xffffff, 0.1);
    g.beginPath();
    g.moveTo(w / 2, 2);
    g.lineTo(w - 2, h / 2);
    g.strokePath();
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeTiles() {
    this.tile('grass0', 0x4d9240, 0x67ac58, [[20, 14, 0x3e7832], [40, 18, 0x62a854], [32, 22, 0x3e7832], [46, 12, 0x7cba68]]);
    this.tile('grass1', 0x478a3a, 0x609e51, [[16, 18, 0x3a7330], [38, 12, 0x5aa34b], [28, 22, 0x3a7330], [50, 20, 0x74b364]]);
    this.tile('grass2', 0x559a4b, 0x70af60, [[22, 16, 0x82c96f], [42, 20, 0x427f36], [30, 12, 0x93d581]]);
    this.tile('sand', 0xdcb76f, 0xebcd8f, [[20, 16, 0xc79e55], [42, 14, 0xebcd8f], [32, 22, 0xc79e55]]);
    this.tile('dirt', 0xa9804f, 0xc49a63, [[18, 14, 0x8a6538], [40, 18, 0xbd9260], [30, 22, 0x8a6538]]);
    this.tile('water', 0x2f6fb4, 0x5aa3e0, [[22, 16, 0x82c6f2], [40, 20, 0x2a5f96], [30, 12, 0xa8d8f8]]);
    this.tile('water2', 0x2b6aae, 0x55a0dc, [[30, 14, 0x82c6f2], [20, 20, 0x2a5f96], [44, 14, 0xa8d8f8]]);
    this.tile('forest', 0x3e7d33, 0x559a4b, [[18, 14, 0x2e6026], [44, 20, 0x559a4b], [30, 12, 0x6cab5c]]);
    this.tile('mountain', 0x8d929b, 0xbdc2ca, [[20, 18, 0x6e737c], [42, 14, 0xd6d9de], [32, 22, 0x6e737c]]);
    this.tile('field', 0x7a5a34, 0x9a7a4a, [[14, 12, 0x5e4426], [30, 16, 0x8f6c3e], [46, 14, 0x5e4426]]);
  }

  // ============ NATURALEZA ============
  private makeNature() {
    let g = this.make.graphics({ x: 0, y: 0 }, false);
    // pino frondoso con 3 pisos
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(14, 30, 5, 9);
    const greens = [0x24511f, 0x2e6428, 0x3a7a33];
    const tiers: [number, number, number][] = [[4, 32, 28], [7, 24, 22], [10, 15, 15]];
    tiers.forEach(([x, y, w], i) => {
      g.fillStyle(greens[i], 1);
      g.fillTriangle(x, y, x + w, y, x + w / 2, y - 13);
    });
    g.fillStyle(0x4c9a45, 1);
    g.fillTriangle(13, 20, 19, 20, 16, 12);
    g.generateTexture('pine', 34, 42);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // roble con copa moteada + manzanas
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(15, 26, 5, 12);
    g.fillStyle(0x4a3220, 1);
    g.fillTriangle(15, 26, 8, 18, 11, 19);
    g.fillTriangle(20, 26, 27, 18, 24, 19);
    g.fillStyle(0x3a7a33, 1);
    g.fillCircle(17, 15, 13);
    g.fillStyle(0x4c9a45, 1);
    g.fillCircle(12, 11, 7);
    g.fillCircle(22, 12, 6);
    g.fillStyle(0x6cab5c, 1);
    g.fillCircle(14, 8, 3.4);
    g.fillStyle(0xd94f3d, 1);
    g.fillCircle(10, 14, 1.6);
    g.fillCircle(23, 17, 1.6);
    g.fillCircle(17, 20, 1.6);
    g.generateTexture('oak', 36, 40);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // palmera playera
    g.fillStyle(0x8a6538, 1);
    g.fillTriangle(15, 36, 19, 36, 16, 12);
    g.lineStyle(1, 0x6b4a2a, 0.8);
    for (let y = 16; y < 34; y += 4) {
      g.beginPath(); g.moveTo(15, y); g.lineTo(19, y + 1); g.strokePath();
    }
    g.fillStyle(0x3f8f3f, 1);
    const fronds: [number, number, number, number][] = [[16, 12, 2, 8], [16, 12, 30, 8], [16, 12, 6, 2], [16, 12, 26, 2], [16, 12, 16, 0]];
    for (const [x1, y1, x2, y2] of fronds) {
      g.lineStyle(3.4, 0x3f8f3f, 1);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
    g.fillStyle(0x6b4a2a, 1);
    g.fillCircle(14, 13, 2.2);
    g.fillCircle(18, 13, 2.2);
    g.generateTexture('palm', 34, 38);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // roca con nieve parcial y musgo
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(17, 30, 27, 8);
    g.fillStyle(0x6e737c, 1);
    g.fillTriangle(5, 30, 29, 30, 17, 9);
    g.fillStyle(0x9aa0aa, 1);
    g.fillTriangle(17, 9, 29, 30, 19, 30);
    g.fillStyle(0xeef1f4, 1);
    g.fillTriangle(17, 9, 23, 19, 17, 19);
    g.fillTriangle(17, 9, 14, 16, 17, 16);
    g.fillStyle(0x4c9a45, 1);
    g.fillCircle(9, 27, 2);
    g.fillCircle(25, 28, 1.6);
    g.generateTexture('rock', 34, 34);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // flores + hierba alta
    g.fillStyle(0x3a7a33, 1);
    g.fillTriangle(3, 15, 5, 15, 4, 5);
    g.fillTriangle(8, 15, 10, 15, 9, 7);
    g.fillTriangle(13, 15, 15, 15, 14, 4);
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(17, 7, 2.2);
    g.fillStyle(0xfde68a, 1);
    g.fillCircle(17, 7, 1);
    g.fillStyle(0xf8fafc, 1);
    g.fillCircle(21, 11, 1.6);
    g.fillStyle(0xfbbf24, 1);
    g.fillCircle(21, 11, 0.7);
    g.generateTexture('flowers', 24, 17);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // mata de hierba
    g.lineStyle(1.6, 0x3e7d33, 1);
    for (const [x1, y1, x2, y2] of [[4, 12, 3, 3], [7, 12, 7, 1], [10, 12, 12, 4]] as [number, number, number, number][]) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
    g.generateTexture('tuft', 15, 13);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // tocón con hacha clavada
    g.fillStyle(0x6b4a2a, 1);
    g.fillEllipse(12, 14, 20, 8);
    g.fillStyle(0xa9804f, 1);
    g.fillEllipse(12, 12, 18, 7);
    g.lineStyle(1, 0x6b4a2a, 1);
    g.strokeEllipse(12, 12, 14, 5);
    g.lineStyle(2, 0x6b4a2a, 1);
    g.beginPath(); g.moveTo(16, 12); g.lineTo(21, 2); g.strokePath();
    g.fillStyle(0x9aa0aa, 1);
    g.fillTriangle(19, 0, 24, 2, 20, 5);
    g.generateTexture('stump', 26, 17);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // sombra suave
    g.fillStyle(0x000000, 0.26);
    g.fillEllipse(17, 6, 28, 9);
    g.generateTexture('shadow', 34, 13);
    g.destroy();
  }

  // ============ PROPS (pilas, cajas, vallas, nube, ave) ============
  private makeProps() {
    let g = this.make.graphics({ x: 0, y: 0 }, false);
    // pila de troncos
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(26, 22, 44, 8);
    const log = (x: number, y: number) => {
      g.fillStyle(0x7c4a21, 1);
      g.fillRoundedRect(x, y, 22, 7, 3);
      g.fillStyle(0xd9b36a, 1);
      g.fillCircle(x + 22, y + 3.5, 3.5);
      g.lineStyle(1, 0x8b5a2b, 1);
      g.strokeCircle(x + 22, y + 3.5, 2.2);
    };
    log(6, 14); log(10, 7); log(28, 12); log(14, 0);
    g.generateTexture('logs', 54, 25);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // pila de piedra labrada
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(22, 24, 38, 8);
    g.fillStyle(0x9aa0aa, 1);
    g.fillRoundedRect(4, 14, 16, 9, 2);
    g.fillRoundedRect(22, 14, 16, 9, 2);
    g.fillRoundedRect(13, 5, 16, 9, 2);
    g.fillStyle(0xc4c9d1, 1);
    g.fillRect(6, 14, 12, 2.4);
    g.fillRect(15, 5, 12, 2.4);
    g.lineStyle(1, 0x6e737c, 1);
    g.strokeRoundedRect(4, 14, 16, 9, 2);
    g.strokeRoundedRect(22, 14, 16, 9, 2);
    g.strokeRoundedRect(13, 5, 16, 9, 2);
    g.generateTexture('stones', 44, 27);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // cajas + barril
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(24, 30, 42, 8);
    g.fillStyle(0xa9804f, 1);
    g.fillRect(4, 14, 15, 15);
    g.fillStyle(0x8a6538, 1);
    g.fillRect(21, 10, 17, 19);
    g.lineStyle(1.4, 0x5e4426, 1);
    g.strokeRect(4, 14, 15, 15);
    g.strokeRect(21, 10, 17, 19);
    g.beginPath(); g.moveTo(4, 14); g.lineTo(19, 29); g.moveTo(19, 14); g.lineTo(4, 29); g.strokePath();
    g.beginPath(); g.moveTo(21, 10); g.lineTo(38, 29); g.moveTo(38, 10); g.lineTo(21, 29); g.strokePath();
    g.fillStyle(0x7c4a21, 1);
    g.fillEllipse(44, 20, 12, 16);
    g.fillStyle(0x9a6530, 1);
    g.fillEllipse(44, 16, 10, 5);
    g.lineStyle(1.2, 0x3a2415, 1);
    g.strokeEllipse(44, 20, 12, 16);
    g.beginPath(); g.moveTo(38.5, 17); g.lineTo(49.5, 17); g.moveTo(38.5, 23); g.lineTo(49.5, 23); g.strokePath();
    g.generateTexture('crates', 52, 33);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // valla de madera (tramo)
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(2, 2, 4, 16);
    g.fillRect(28, 2, 4, 16);
    g.fillStyle(0x8a6538, 1);
    g.fillRect(0, 5, 34, 3.4);
    g.fillRect(0, 11, 34, 3.4);
    g.generateTexture('fence', 34, 19);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // nube esponjosa
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(30, 26, 14);
    g.fillCircle(48, 22, 17);
    g.fillCircle(66, 26, 13);
    g.fillEllipse(48, 32, 72, 16);
    g.fillStyle(0xdbe7f5, 0.9);
    g.fillEllipse(48, 34, 66, 10);
    g.generateTexture('cloud', 96, 44);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // ave en vuelo (dos alas en V suave)
    g.lineStyle(2.2, 0x1f2937, 1);
    g.beginPath();
    g.moveTo(1, 7);
    g.lineTo(6, 2);
    g.lineTo(11, 6);
    g.lineTo(16, 2);
    g.lineTo(21, 7);
    g.strokePath();
    g.generateTexture('bird', 22, 9);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // mariposa
    g.fillStyle(0xf9a8d4, 1);
    g.fillEllipse(4, 5, 6, 8);
    g.fillEllipse(12, 5, 6, 8);
    g.fillStyle(0x7c3aed, 1);
    g.fillRect(7.4, 1, 1.6, 9);
    g.generateTexture('butterfly', 16, 11);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    // punto de camino (para senderos)
    g.fillStyle(0xa9804f, 0.85);
    g.fillEllipse(8, 5, 14, 7);
    g.fillStyle(0x8a6538, 0.8);
    g.fillCircle(5, 4, 1.2);
    g.fillCircle(11, 6, 1.2);
    g.generateTexture('pathdot', 16, 10);
    g.destroy();
  }

  // ============ PERSONAJES 22x28 con más detalle ============
  private person(key: string, tunic: number, pants = 0x4a3220, skin = 0xf2c89b, hat: number | null = null, tool: 'axe' | 'sack' | 'sword' | 'spear' | 'hammer' | null = null, belt = 0x3a2415) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // botas + piernas
    g.fillStyle(0x2e1d10, 1);
    g.fillRect(6, 23, 3.4, 2.6);
    g.fillRect(11.6, 23, 3.4, 2.6);
    g.fillStyle(pants, 1);
    g.fillRect(6, 18, 3.4, 5.4);
    g.fillRect(11.6, 18, 3.4, 5.4);
    // túnica con pliegues
    g.fillStyle(tunic, 1);
    g.fillRoundedRect(4, 10, 13, 9.4, 3);
    g.fillStyle(0x000000, 0.16);
    g.fillTriangle(8, 11, 10.4, 11, 9.2, 18.6);
    g.fillTriangle(12, 11, 14, 11, 13.4, 18.6);
    // cinturón + hebilla
    g.fillStyle(belt, 1);
    g.fillRect(4, 16, 13, 2);
    g.fillStyle(0xd9a441, 1);
    g.fillRect(9.6, 16, 2.4, 2);
    // brazos + manos
    g.fillStyle(tunic, 1);
    g.fillRoundedRect(1.6, 11, 2.8, 6.4, 1);
    g.fillRoundedRect(16.6, 11, 2.8, 6.4, 1);
    g.fillStyle(skin, 1);
    g.fillCircle(3, 18, 1.5);
    g.fillCircle(18, 18, 1.5);
    // cabeza + cara
    g.fillStyle(skin, 1);
    g.fillCircle(10.5, 6, 4.4);
    g.fillStyle(0x3a2415, 1);
    g.fillCircle(8.9, 5.6, 0.8);
    g.fillCircle(12.1, 5.6, 0.8);
    g.lineStyle(0.9, 0x8a5a3b, 1);
    g.beginPath(); g.moveTo(9.2, 8.2); g.lineTo(11.8, 8.2); g.strokePath();
    // pelo lateral
    g.fillStyle(0x5b3a1e, 1);
    g.fillCircle(6.6, 5, 1.8);
    g.fillCircle(14.4, 5, 1.8);
    if (hat !== null) {
      g.fillStyle(hat, 1);
      g.fillTriangle(5.4, 4.4, 15.6, 4.4, 10.5, -2.4);
      g.fillStyle(0x000000, 0.15);
      g.fillTriangle(10.5, -2.4, 15.6, 4.4, 10.5, 4.4);
    }
    if (tool === 'axe') {
      g.lineStyle(1.8, 0x6b4a2a, 1);
      g.beginPath(); g.moveTo(18.4, 14); g.lineTo(22, 5); g.strokePath();
      g.fillStyle(0xb9bec7, 1);
      g.fillTriangle(19.8, 2.6, 24.4, 4.4, 20.6, 8);
      g.lineStyle(1, 0x6e737c, 1);
      g.strokeTriangle(19.8, 2.6, 24.4, 4.4, 20.6, 8);
    } else if (tool === 'sack') {
      g.fillStyle(0xd9b36a, 1);
      g.fillEllipse(18.4, 12, 7, 9.4);
      g.lineStyle(1, 0x8b5a2b, 1);
      g.strokeEllipse(18.4, 12, 7, 9.4);
      g.fillStyle(0x8b5a2b, 1);
      g.fillRect(16.4, 6.4, 4, 1.8);
    } else if (tool === 'sword') {
      g.lineStyle(2, 0xc4c9d1, 1);
      g.beginPath(); g.moveTo(18.6, 16); g.lineTo(22.6, 6); g.strokePath();
      g.lineStyle(2, 0x8b5a2b, 1);
      g.beginPath(); g.moveTo(17, 14); g.lineTo(20, 15.2); g.strokePath();
      g.fillStyle(0x8b5a2b, 1);
      g.fillCircle(18.4, 16.4, 1.4);
    } else if (tool === 'spear') {
      g.lineStyle(1.6, 0x6b4a2a, 1);
      g.beginPath(); g.moveTo(18.6, 24); g.lineTo(20.6, 0); g.strokePath();
      g.fillStyle(0xd6d9de, 1);
      g.fillTriangle(18.8, -3, 22.4, -3, 20.6, 1.4);
    } else if (tool === 'hammer') {
      g.lineStyle(1.8, 0x6b4a2a, 1);
      g.beginPath(); g.moveTo(18.4, 15); g.lineTo(21.4, 7); g.strokePath();
      g.fillStyle(0x6e737c, 1);
      g.fillRoundedRect(18.4, 3.4, 7, 4, 1);
    }
    g.generateTexture(key, 26, 28);
    g.destroy();
  }

  private makePeople() {
    this.person('settler', 0x2f6fb4);
    this.person('woodcutter', 0x8b5a2b, 0x4a3220, 0xf2c89b, 0x5b3a1e, 'axe');
    this.person('carrier', 0x3f7d33, 0x4a3220, 0xf2c89b, null, 'sack');
    this.person('soldier', 0xb91c1c, 0x3a3a3a, 0xf2c89b, 0x9aa0aa, 'sword', 0x1f2937);
    this.person('archer', 0x6d28d9, 0x3a2a1a, 0xf2c89b, 0x4c1d95, 'spear');
    this.person('miner', 0x4b5563, 0x33291f, 0xf2c89b, 0xfde68a, 'hammer');
    this.person('fisher', 0x0284c7, 0x4a3220, 0xf2c89b, 0x134e4a, null);
    this.person('baker', 0xf5ead2, 0x4a3220, 0xf2c89b, 0xf8fafc, null);
  }

  // ============ EDIFICIOS HD ============
  private ctx(W: number, H: number) {
    return { g: this.make.graphics({ x: 0, y: 0 }, false), W, H, cx: W / 2, baseY: H - 8 };
  }

  private foundation(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, w: number) {
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx, baseY + 4, w + 18, 15);
    g.fillStyle(0x8d929b, 1);
    const n = Math.floor(w / 13);
    for (let i = 0; i < n; i++) {
      const x = cx - w / 2 + i * 13;
      g.fillRoundedRect(x, baseY - 8, 12, 8, 1.4);
      g.fillStyle(0xa8adb5, 1);
      g.fillRect(x + 1, baseY - 8, 10, 2);
      g.fillStyle(0x8d929b, 1);
    }
    g.lineStyle(1, 0x5b6068, 0.9);
    for (let i = 0; i < n; i++) {
      g.strokeRoundedRect(cx - w / 2 + i * 13, baseY - 8, 12, 8, 1.4);
    }
  }

  private walls(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, timber = true) {
    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0xffffff, 0.1);
    g.fillRect(x, y, w, 3);
    g.fillStyle(0x000000, 0.13);
    g.fillRect(x + w / 2, y, w / 2, h);
    if (timber) {
      g.lineStyle(1.6, 0x6b4a2a, 1);
      g.strokeRect(x + 2, y + 2, w - 4, h - 4);
      g.beginPath();
      g.moveTo(x + w / 2, y + 2);
      g.lineTo(x + w / 2, y + h - 2);
      g.moveTo(x + 2, y + h / 2);
      g.lineTo(x + w - 2, y + h / 2);
      g.strokePath();
    }
  }

  private roof(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, rh: number, color: number) {
    const cx = x + w / 2;
    g.fillStyle(color, 1);
    g.fillTriangle(x - 6, y + 2, cx, y - rh, cx, y + 2);
    const dark = Phaser.Display.Color.IntegerToColor(color).darken(22).color;
    g.fillStyle(dark, 1);
    g.fillTriangle(cx, y - rh, x + w + 6, y + 2, cx, y + 2);
    // tejas: hileras
    g.lineStyle(1, 0x000000, 0.28);
    for (let i = 1; i <= 4; i++) {
      const yy = y - rh + (rh / 5) * i + 1;
      const spread = ((w / 2 + 6) / 5) * i;
      g.beginPath(); g.moveTo(cx - spread, yy); g.lineTo(cx + spread, yy); g.strokePath();
    }
    // cumbrera
    g.lineStyle(2, Phaser.Display.Color.IntegerToColor(color).darken(35).color, 1);
    g.beginPath(); g.moveTo(cx - 3, y - rh); g.lineTo(cx + 3, y - rh); g.strokePath();
    // alero sombreado
    g.fillStyle(0x000000, 0.18);
    g.fillRect(x - 6, y, w + 12, 3);
  }

  private door(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, w = 13, h = 19) {
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(cx - w / 2 - 1.4, baseY - h - 1, w + 2.8, h + 1, 5);
    g.fillStyle(0x4a3220, 1);
    g.fillRoundedRect(cx - w / 2, baseY - h, w, h, 5);
    g.lineStyle(1.2, 0x2e1d10, 1);
    for (let i = 1; i < 4; i++) {
      g.beginPath(); g.moveTo(cx - w / 2 + 1, baseY - h + (h / 4) * i); g.lineTo(cx + w / 2 - 1, baseY - h + (h / 4) * i); g.strokePath();
    }
    g.beginPath(); g.moveTo(cx, baseY - h); g.lineTo(cx, baseY); g.strokePath();
    g.fillStyle(0x1f2937, 1);
    g.fillRect(cx - w / 2, baseY - h + 4, w, 2);
    g.fillStyle(0xfbbf24, 1);
    g.fillCircle(cx + w / 2 - 3, baseY - 8, 1.2);
    // escalón
    g.fillStyle(0x9aa0aa, 1);
    g.fillRoundedRect(cx - w / 2 - 3, baseY - 1.4, w + 6, 3.4, 1.4);
  }

  private window(g: Phaser.GameObjects.Graphics, x: number, y: number, lit = false, shutters = true) {
    if (shutters) {
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(x - 5, y, 5, 10);
      g.fillRect(x + 10, y, 5, 10);
      g.lineStyle(0.8, 0x3a2415, 1);
      g.strokeRect(x - 5, y, 5, 10);
      g.strokeRect(x + 10, y, 5, 10);
    }
    g.fillStyle(lit ? 0xffc861 : 0xbfe3ff, 1);
    g.fillRect(x, y, 10, 10);
    g.fillStyle(0xffffff, lit ? 0.5 : 0.7);
    g.fillTriangle(x, y + 10, x, y + 4, x + 4, y + 10);
    g.lineStyle(1.2, 0x3a2415, 1);
    g.strokeRect(x, y, 10, 10);
    g.beginPath(); g.moveTo(x + 5, y); g.lineTo(x + 5, y + 10); g.moveTo(x, y + 5); g.lineTo(x + 10, y + 5); g.strokePath();
  }

  private chimney(g: Phaser.GameObjects.Graphics, x: number, y: number, h = 18) {
    g.fillStyle(0x7c6a5e, 1);
    g.fillRect(x, y - h, 9, h);
    g.fillStyle(0x8d7a6a, 1);
    g.fillRect(x, y - h, 3.4, h);
    g.lineStyle(1, 0x4a3f35, 1);
    for (let yy = y - h + 4; yy < y - 2; yy += 5) {
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 9, yy); g.strokePath();
    }
    g.fillStyle(0x4a3f35, 1);
    g.fillRect(x - 1.4, y - h - 2.4, 11.8, 3.4);
  }

  private house(key: string, wall: number, roofC: number, W: number, H: number, extra: (g: Phaser.GameObjects.Graphics, cx: number, baseY: number) => void = () => undefined) {
    const { g, cx, baseY } = this.ctx(W, H);
    const bw = W - 44;
    const bh = 30;
    const bx = cx - bw / 2;
    const by = baseY - 8 - bh;
    this.foundation(g, cx, baseY, bw + 6);
    this.walls(g, bx, by, bw, bh, wall);
    this.door(g, cx, baseY - 8);
    this.window(g, bx + 8, by + 8);
    this.window(g, bx + bw - 18, by + 8);
    this.roof(g, bx, by, bw, 24, roofC);
    extra(g, cx, baseY);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  private towerTex(key: string, stone: number, roofC: number, flag: number, W = 76, H = 128) {
    const { g, cx, baseY } = this.ctx(W, H);
    this.foundation(g, cx, baseY, 40);
    const tw = 32;
    const tx = cx - tw / 2;
    const top = 26;
    g.fillStyle(stone, 1);
    g.fillRect(tx, top + 8, tw, baseY - 8 - top - 8);
    g.fillStyle(0x000000, 0.14);
    g.fillRect(cx, top + 8, tw / 2, baseY - 8 - top - 8);
    g.lineStyle(1, 0x5b6068, 0.7);
    for (let y = top + 18; y < baseY - 12; y += 10) {
      g.beginPath(); g.moveTo(tx + 2, y); g.lineTo(tx + tw - 2, y); g.strokePath();
      g.beginPath(); g.moveTo(tx + 8 + ((y / 10) % 2) * 8, y); g.lineTo(tx + 8 + ((y / 10) % 2) * 8, y + 10); g.strokePath();
    }
    // galería de madera superior
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(tx - 5, top - 2, tw + 10, 12);
    g.lineStyle(1.4, 0x3a2415, 1);
    for (let i = 0; i <= 5; i++) {
      g.beginPath(); g.moveTo(tx - 5 + i * ((tw + 10) / 5), top - 2); g.lineTo(tx - 5 + i * ((tw + 10) / 5), top + 10); g.strokePath();
    }
    // almenas
    g.fillStyle(stone, 1);
    for (let i = 0; i < 4; i++) g.fillRect(tx - 5 + i * 10.6, top - 10, 6.4, 9);
    // saeteras con luz
    g.fillStyle(0x1f2937, 1);
    g.fillRect(cx - 2.4, top + 26, 4.8, 12);
    g.fillStyle(0xffc861, 1);
    g.fillRect(cx - 2.4, top + 26, 4.8, 3);
    g.fillStyle(0x1f2937, 1);
    g.fillRect(cx - 2.4, top + 46, 4.8, 12);
    // puerta elevada + escalera
    this.door(g, cx, baseY - 8, 11, 16);
    // tejadillo + mástil + gallardete
    g.fillStyle(roofC, 1);
    g.fillTriangle(tx - 6, top - 8, tx + tw + 6, top - 8, cx, top - 22);
    g.lineStyle(2.2, 0x4a3220, 1);
    g.beginPath(); g.moveTo(cx, top - 22); g.lineTo(cx, top - 40); g.strokePath();
    g.fillStyle(flag, 1);
    g.fillTriangle(cx, top - 40, cx + 19, top - 35.4, cx, top - 31);
    g.fillStyle(0xffffff, 0.35);
    g.fillTriangle(cx, top - 40, cx + 7, top - 38.4, cx, top - 36.8);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeBuildings() {
    // Almacén principal: grande, anexo lateral, cajas y barril
    {
      const W = 128;
      const H = 100;
      const { g, cx, baseY } = this.ctx(W, H);
      const bw = 74;
      const bh = 34;
      const bx = cx - bw / 2 - 8;
      const by = baseY - 8 - bh;
      this.foundation(g, cx - 4, baseY, bw + 22);
      // anexo
      this.walls(g, bx + bw - 6, by + 12, 26, 22, 0xd9c49a);
      g.fillStyle(0x7c4a21, 1);
      g.fillTriangle(bx + bw - 8, by + 12, bx + bw + 22, by + 12, bx + bw + 7, by - 1);
      this.walls(g, bx, by, bw, bh, 0xf5ead2);
      this.door(g, cx - 8, baseY - 8, 15, 22);
      this.window(g, bx + 8, by + 9, true);
      this.window(g, bx + bw - 20, by + 9);
      this.roof(g, bx, by, bw, 28, 0xb3402e);
      this.chimney(g, cx + 20, by - 16, 22);
      // cartel colgante
      g.lineStyle(1.6, 0x3a2415, 1);
      g.beginPath(); g.moveTo(cx - 30, by + 6); g.lineTo(cx - 30, by + 16); g.moveTo(cx - 16, by + 6); g.lineTo(cx - 16, by + 16); g.strokePath();
      g.fillStyle(0x8b5a2b, 1);
      g.fillRoundedRect(cx - 34, by + 16, 22, 12, 2);
      g.fillStyle(0xfde68a, 1);
      g.fillCircle(cx - 27, by + 22, 2.6);
      g.fillRect(cx - 24, by + 20, 9, 2);
      g.fillRect(cx - 24, by + 23, 7, 2);
      g.generateTexture('b-almacen', W, H);
      g.destroy();
    }

    this.house('b-cabanaLenador', 0xe8d5ae, 0x7c4a21, 96, 88, (g, cx, baseY) => {
      this.chimney(g, cx + 22, baseY - 58, 20);
      // leña apilada + tocón
      g.fillStyle(0x6b4a2a, 1);
      for (let i = 0; i < 3; i++) {
        g.fillRoundedRect(cx - 40, baseY - 12 - i * 6, 18, 5, 2);
        g.fillStyle(0xd9b36a, 1);
        g.fillCircle(cx - 22, baseY - 9.5 - i * 6, 2.5);
        g.fillStyle(0x6b4a2a, 1);
      }
      g.fillStyle(0xa9804f, 1);
      g.fillEllipse(cx + 34, baseY - 4, 14, 6);
    });

    // Aserradero: cobertizo abierto + sierra + tronco en caballetes
    {
      const W = 116;
      const H = 92;
      const { g, cx, baseY } = this.ctx(W, H);
      this.foundation(g, cx, baseY, 80);
      // cobertizo
      g.fillStyle(0x8a6538, 1);
      g.fillRect(cx - 40, baseY - 52, 5, 44);
      g.fillRect(cx + 35, baseY - 52, 5, 44);
      g.fillStyle(0x6b4a2a, 1);
      g.fillTriangle(cx - 46, baseY - 52, cx + 46, baseY - 52, cx, baseY - 74);
      g.fillStyle(0x8b5a2b, 0.55);
      g.fillTriangle(cx, baseY - 74, cx + 46, baseY - 52, cx, baseY - 52);
      // sierra circular
      g.fillStyle(0xc4c9d1, 1);
      g.fillCircle(cx - 8, baseY - 26, 11);
      g.fillStyle(0x8a8f98, 1);
      g.fillCircle(cx - 8, baseY - 26, 7);
      g.fillStyle(0x4b5563, 1);
      g.fillCircle(cx - 8, baseY - 26, 2);
      // tronco sobre caballetes
      g.fillStyle(0x5b3a1e, 1);
      g.fillTriangle(cx + 4, baseY - 8, cx + 10, baseY - 8, cx + 7, baseY - 20);
      g.fillTriangle(cx + 26, baseY - 8, cx + 32, baseY - 8, cx + 29, baseY - 20);
      g.fillStyle(0x7c4a21, 1);
      g.fillRoundedRect(cx - 2, baseY - 26, 40, 7, 3);
      g.fillStyle(0xd9b36a, 1);
      g.fillCircle(cx + 38, baseY - 22.5, 3.5);
      // serrín
      g.fillStyle(0xe8c988, 1);
      g.fillEllipse(cx - 8, baseY - 6, 22, 5);
      g.generateTexture('b-aserradero', W, H);
      g.destroy();
    }

    // Cantera: frente de roca + grúa + bloques
    {
      const W = 112;
      const H = 96;
      const { g, cx, baseY } = this.ctx(W, H);
      this.foundation(g, cx, baseY, 70);
      g.fillStyle(0x8d929b, 1);
      g.fillRoundedRect(cx - 36, baseY - 52, 46, 44, 4);
      g.fillStyle(0x9aa0aa, 1);
      g.fillTriangle(cx - 36, baseY - 52, cx + 10, baseY - 52, cx - 13, baseY - 66);
      g.lineStyle(1, 0x5b6068, 0.9);
      for (let y = baseY - 44; y < baseY - 10; y += 8) {
        g.beginPath(); g.moveTo(cx - 34, y); g.lineTo(cx + 8, y); g.strokePath();
      }
      // grúa
      g.lineStyle(3, 0x6b4a2a, 1);
      g.beginPath(); g.moveTo(cx + 22, baseY - 8); g.lineTo(cx + 22, baseY - 62); g.lineTo(cx - 8, baseY - 62); g.strokePath();
      g.lineStyle(1.2, 0x3a2415, 1);
      g.beginPath(); g.moveTo(cx - 8, baseY - 62); g.lineTo(cx - 8, baseY - 44); g.strokePath();
      g.fillStyle(0x9aa0aa, 1);
      g.fillRoundedRect(cx - 14, baseY - 44, 12, 9, 2);
      // bloques labrados
      g.fillStyle(0xb9bec7, 1);
      g.fillRoundedRect(cx + 12, baseY - 18, 15, 10, 2);
      g.fillRoundedRect(cx + 28, baseY - 16, 13, 8, 2);
      g.generateTexture('b-cantera', W, H);
      g.destroy();
    }

    this.house('b-residenciaS', 0xf5ead2, 0xb3402e, 88, 84);
    this.house('b-residenciaM', 0xf5ead2, 0x9c2f22, 100, 90, (g, cx, baseY) => {
      this.chimney(g, cx + 24, baseY - 60, 20);
      // jardinera con flores
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(cx - 30, baseY - 30, 18, 5);
      g.fillStyle(0xf472b6, 1);
      g.fillCircle(cx - 27, baseY - 32, 1.8);
      g.fillCircle(cx - 22, baseY - 33, 1.8);
      g.fillCircle(cx - 17, baseY - 32, 1.8);
    });
    this.house('b-residenciaL', 0xf7efdc, 0x7f1d1d, 122, 100, (g, cx, baseY) => {
      this.chimney(g, cx - 30, baseY - 66, 22);
      this.chimney(g, cx + 30, baseY - 66, 22);
      // balcón
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(cx - 16, baseY - 44, 32, 4);
      for (let i = 0; i < 6; i++) g.fillRect(cx - 16 + i * 6, baseY - 52, 2.4, 8);
      this.window(g, cx - 14, baseY - 66, true);
      this.window(g, cx + 4, baseY - 66, true);
    });

    // Granja: casa + campo arado + espantapájaros
    {
      const W = 124;
      const H = 96;
      const { g, cx, baseY } = this.ctx(W, H);
      this.foundation(g, cx - 16, baseY, 52);
      this.walls(g, cx - 42, baseY - 34, 52, 26, 0xefe3c2);
      this.roof(g, cx - 42, baseY - 34, 52, 22, 0xc47b2b);
      this.door(g, cx - 16, baseY - 8, 11, 16);
      // campo arado con brotes
      g.fillStyle(0x6b4a2a, 1);
      g.fillEllipse(cx + 30, baseY - 4, 56, 16);
      g.fillStyle(0x7a5a34, 1);
      g.fillEllipse(cx + 30, baseY - 6, 52, 13);
      g.lineStyle(1.2, 0x4e3822, 1);
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(cx + 8, baseY - 6 + i * 2.6);
        g.lineTo(cx + 52, baseY - 6 + i * 2.6);
        g.strokePath();
      }
      g.fillStyle(0x65b34e, 1);
      for (let i = 0; i < 9; i++) {
        g.fillTriangle(cx + 12 + i * 5, baseY - 8, cx + 14 + i * 5, baseY - 8, cx + 13 + i * 5, baseY - 13);
      }
      // espantapájaros
      g.lineStyle(2, 0x5b3a1e, 1);
      g.beginPath(); g.moveTo(cx + 30, baseY - 6); g.lineTo(cx + 30, baseY - 26); g.moveTo(cx + 22, baseY - 20); g.lineTo(cx + 38, baseY - 20); g.strokePath();
      g.fillStyle(0xb3402e, 1);
      g.fillTriangle(cx + 22, baseY - 20, cx + 38, baseY - 20, cx + 30, baseY - 12);
      g.fillStyle(0xf2c89b, 1);
      g.fillCircle(cx + 30, baseY - 29, 3.4);
      g.fillStyle(0xd9a441, 1);
      g.fillTriangle(cx + 25, baseY - 32, cx + 35, baseY - 32, cx + 30, baseY - 36);
      g.generateTexture('b-granja', W, H);
      g.destroy();
    }

    // Molino de torre con aspas separadas
    {
      const W = 110;
      const H = 124;
      const { g, cx, baseY } = this.ctx(W, H);
      this.foundation(g, cx, baseY, 52);
      // torre troncocónica de piedra
      g.fillStyle(0xe8e0cd, 1);
      g.fillTriangle(cx - 22, baseY - 8, cx + 22, baseY - 8, cx + 14, baseY - 78);
      g.beginPath();
      g.moveTo(cx - 22, baseY - 8);
      g.lineTo(cx + 22, baseY - 8);
      g.lineTo(cx + 14, baseY - 78);
      g.lineTo(cx - 14, baseY - 78);
      g.closePath();
      g.fillPath();
      g.fillStyle(0x000000, 0.1);
      g.fillTriangle(cx, baseY - 8, cx + 22, baseY - 8, cx + 14, baseY - 78);
      g.lineStyle(1, 0xb9ac8f, 1);
      for (let y = baseY - 20; y > baseY - 70; y -= 10) {
        g.beginPath(); g.moveTo(cx - 20, y); g.lineTo(cx + 20, y); g.strokePath();
      }
      // capirote
      g.fillStyle(0x7c4a21, 1);
      g.fillTriangle(cx - 17, baseY - 78, cx + 17, baseY - 78, cx, baseY - 98);
      this.door(g, cx, baseY - 8, 12, 18);
      this.window(g, cx - 8, baseY - 52, true, false);
      g.generateTexture('b-molino', W, H);
      g.destroy();
      // aspas (sprite aparte que girará)
      const b = this.make.graphics({ x: 0, y: 0 }, false);
      b.lineStyle(3, 0x4a3220, 1);
      const R = 34;
      for (const [dx, dy] of [[0, -R], [R, 0], [0, R], [-R, 0]] as [number, number][]) {
        b.beginPath(); b.moveTo(40, 40); b.lineTo(40 + dx, 40 + dy); b.strokePath();
      }
      b.fillStyle(0xf5ead2, 0.95);
      b.fillTriangle(40, 40, 40 + 8, 40 - R, 40 - 2, 40 - R + 4);
      b.fillTriangle(40, 40, 40 + R, 40 + 8, 40 + R - 4, 40 - 2);
      b.fillTriangle(40, 40, 40 - 8, 40 + R, 40 + 2, 40 + R - 4);
      b.fillTriangle(40, 40, 40 - R, 40 - 8, 40 - R + 4, 40 + 2);
      b.fillStyle(0x6b4a2a, 1);
      b.fillCircle(40, 40, 4);
      b.generateTexture('mill-blades', 80, 80);
      b.destroy();
    }

    this.house('b-panaderia', 0xf5ead2, 0xd9a441, 104, 92, (g, cx, baseY) => {
      this.chimney(g, cx + 24, baseY - 60, 24);
      this.window(g, cx - 30, baseY - 40, true);
      // cartel de pan
      g.fillStyle(0x6b4a2a, 1);
      g.fillRoundedRect(cx + 2, baseY - 42, 24, 14, 2);
      g.fillStyle(0xe8b45a, 1);
      g.fillEllipse(cx + 9, baseY - 35, 8, 5);
      g.fillEllipse(cx + 19, baseY - 35, 8, 5);
      g.lineStyle(0.8, 0x8a6538, 1);
      g.beginPath(); g.moveTo(cx + 6, baseY - 35); g.lineTo(cx + 12, baseY - 35); g.moveTo(cx + 16, baseY - 35); g.lineTo(cx + 22, baseY - 35); g.strokePath();
    });

    // Pozo: anillo de piedra + techumbre + cubo
    {
      const W = 76;
      const H = 88;
      const { g, cx, baseY } = this.ctx(W, H);
      g.fillStyle(0x000000, 0.22);
      g.fillEllipse(cx, baseY + 4, 52, 13);
      g.fillStyle(0x8d929b, 1);
      g.fillEllipse(cx, baseY - 8, 40, 20);
      g.fillStyle(0x2b3a4a, 1);
      g.fillEllipse(cx, baseY - 9, 26, 12);
      g.fillStyle(0xb9bec7, 1);
      g.fillEllipse(cx, baseY - 7, 26, 5);
      g.lineStyle(1, 0x5b6068, 1);
      g.strokeEllipse(cx, baseY - 8, 40, 20);
      // postes + tejadillo
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(cx - 20, baseY - 52, 4.4, 36);
      g.fillRect(cx + 15.6, baseY - 52, 4.4, 36);
      g.fillStyle(0xb3402e, 1);
      g.fillTriangle(cx - 25, baseY - 50, cx + 25, baseY - 50, cx, baseY - 68);
      // cuerda + cubo
      g.lineStyle(1.2, 0x3a2415, 1);
      g.beginPath(); g.moveTo(cx, baseY - 52); g.lineTo(cx, baseY - 30); g.strokePath();
      g.fillStyle(0x8b5a2b, 1);
      g.fillRect(cx - 5, baseY - 30, 10, 9);
      g.lineStyle(1, 0x3a2415, 1);
      g.strokeRect(cx - 5, baseY - 30, 10, 9);
      g.generateTexture('b-pozo', W, H);
      g.destroy();
    }

    // Pesquería: palafito + muelle + redes
    {
      const W = 118;
      const H = 92;
      const { g, cx, baseY } = this.ctx(W, H);
      g.fillStyle(0x2f6fb4, 0.5);
      g.fillEllipse(cx + 6, baseY + 2, 96, 20);
      // muelle
      g.fillStyle(0x6b4a2a, 1);
      for (let i = 0; i < 4; i++) g.fillRect(cx - 40 + i * 22, baseY - 16, 5, 16);
      g.fillStyle(0x8a6538, 1);
      g.fillRect(cx - 46, baseY - 20, 92, 6);
      g.lineStyle(1, 0x4a3220, 1);
      for (let x = cx - 46; x < cx + 46; x += 9) {
        g.beginPath(); g.moveTo(x, baseY - 20); g.lineTo(x, baseY - 14); g.strokePath();
      }
      // cabaña
      this.walls(g, cx - 26, baseY - 52, 44, 30, 0xcfe0ea);
      this.roof(g, cx - 26, baseY - 52, 44, 20, 0x0284c7);
      this.door(g, cx - 4, baseY - 22, 11, 15);
      // red colgada + peces
      g.lineStyle(0.8, 0xe8e0cd, 0.95);
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.moveTo(cx + 22, baseY - 44); g.lineTo(cx + 18 + i * 4, baseY - 24); g.strokePath();
      }
      g.beginPath(); g.moveTo(cx + 16, baseY - 32); g.lineTo(cx + 44, baseY - 32); g.strokePath();
      g.fillStyle(0x94c7e8, 1);
      g.fillEllipse(cx + 28, baseY - 27, 8, 4);
      g.fillEllipse(cx + 36, baseY - 27, 8, 4);
      g.generateTexture('b-pesqueria', W, H);
      g.destroy();
    }

    // Minas: bocamina en roca + vagoneta + farol
    const mine = (key: string, rockC: number, vein: number | null) => {
      const W = 116;
      const H = 100;
      const { g, cx, baseY } = this.ctx(W, H);
      this.foundation(g, cx, baseY, 76);
      // macizo rocoso
      g.fillStyle(rockC, 1);
      g.fillRoundedRect(cx - 40, baseY - 66, 80, 58, 6);
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(cx - 40, baseY - 30, 80, 22, 6);
      g.fillStyle(0xffffff, 0.16);
      g.fillTriangle(cx - 30, baseY - 66, cx - 6, baseY - 66, cx - 18, baseY - 82);
      // vetas
      if (vein !== null) {
        g.fillStyle(vein, 1);
        const spots: [number, number][] = [[-30, -56], [-12, -60], [6, -52], [24, -58], [-22, -36], [16, -30]];
        for (const [dx, dy] of spots) {
          g.fillCircle(cx + dx, baseY + dy, 2.2);
          g.fillStyle(0xffffff, 0.8);
          g.fillCircle(cx + dx - 0.7, baseY + dy - 0.7, 0.8);
          g.fillStyle(vein, 1);
        }
      }
      // bocamina con entibado
      g.fillStyle(0x140f08, 1);
      g.fillRoundedRect(cx - 14, baseY - 36, 28, 28, 6);
      g.lineStyle(3, 0x6b4a2a, 1);
      g.strokeRoundedRect(cx - 14, baseY - 36, 28, 28, 6);
      g.beginPath(); g.moveTo(cx - 14, baseY - 26); g.lineTo(cx + 14, baseY - 26); g.moveTo(cx - 14, baseY - 18); g.lineTo(cx + 14, baseY - 18); g.strokePath();
      // farol encendido
      g.fillStyle(0x3a2415, 1);
      g.fillRect(cx + 18, baseY - 34, 2.4, 8);
      g.fillStyle(0xffc861, 1);
      g.fillCircle(cx + 19.2, baseY - 26, 3.4);
      g.fillStyle(0xfff3c4, 1);
      g.fillCircle(cx + 19.2, baseY - 26, 1.4);
      // raíles + vagoneta
      g.lineStyle(2, 0x4b5563, 1);
      g.beginPath(); g.moveTo(cx - 34, baseY - 4); g.lineTo(cx + 34, baseY - 4); g.strokePath();
      g.lineStyle(1, 0x6e737c, 1);
      for (let x = cx - 32; x < cx + 34; x += 8) {
        g.beginPath(); g.moveTo(x, baseY - 6.4); g.lineTo(x, baseY - 1.6); g.strokePath();
      }
      g.fillStyle(0x5b6068, 1);
      g.fillRoundedRect(cx - 34, baseY - 18, 20, 12, 2);
      g.fillStyle(0x2e3338, 1);
      g.fillRoundedRect(cx - 34, baseY - 18, 20, 4, 2);
      g.fillStyle(0x1f2937, 1);
      g.fillCircle(cx - 29, baseY - 5, 2.6);
      g.fillCircle(cx - 19, baseY - 5, 2.6);
      g.generateTexture(key, W, H);
      g.destroy();
    };
    mine('b-minaCarbon', 0x57534e, 0x1c1917);
    mine('b-minaHierro', 0x78716c, 0xd97742);
    mine('b-minaOro', 0x8a7a5c, 0xfde047);

    // Fundición: nave grande + ventanas al rojo + chimenea alta
    {
      const W = 128;
      const H = 112;
      const { g, cx, baseY } = this.ctx(W, H);
      this.foundation(g, cx, baseY, 88);
      this.walls(g, cx - 44, baseY - 46, 88, 38, 0x8a6a45);
      // ventanas incandescentes
      for (const dx of [-28, -6, 16]) {
        g.fillStyle(0x1f2937, 1);
        g.fillRoundedRect(cx + dx, baseY - 40, 16, 16, 3);
        g.fillStyle(0xff7a1a, 1);
        g.fillRoundedRect(cx + dx + 2, baseY - 38, 12, 12, 2);
        g.fillStyle(0xffd23e, 1);
        g.fillRoundedRect(cx + dx + 5, baseY - 35, 6, 6, 1);
      }
      this.roof(g, cx - 44, baseY - 46, 88, 26, 0x44403c);
      this.chimney(g, cx + 24, baseY - 66, 40);
      // boca del horno
      g.fillStyle(0x140f08, 1);
      g.fillRoundedRect(cx - 40, baseY - 26, 22, 18, 4);
      g.fillStyle(0xff7a1a, 1);
      g.fillRoundedRect(cx - 38, baseY - 24, 18, 14, 3);
      g.fillStyle(0xffd23e, 1);
      g.fillRoundedRect(cx - 34, baseY - 21, 10, 8, 2);
      this.door(g, cx + 22, baseY - 8, 12, 17);
      g.generateTexture('b-fundicion', W, H);
      g.destroy();
    }

    this.house('b-herreria', 0xe8d5ae, 0x57534e, 108, 92, (g, cx, baseY) => {
      this.chimney(g, cx + 26, baseY - 60, 22);
      this.window(g, cx - 32, baseY - 40, true);
      // yunque + herradura
      g.fillStyle(0x6e737c, 1);
      g.fillRect(cx + 12, baseY - 22, 18, 6);
      g.fillTriangle(cx + 12, baseY - 22, cx + 6, baseY - 18, cx + 12, baseY - 16);
      g.fillRect(cx + 18, baseY - 16, 6, 8);
      g.lineStyle(2.4, 0x3a3f45, 1);
      g.beginPath(); g.arc(cx - 28, baseY - 48, 5, Math.PI * 0.1, Math.PI * 0.9, false); g.strokePath();
    });

    // Armería y cuartel: enseñas, escudos, rastrillo
    const martial = (key: string, big: boolean, flagC: number, shieldC: number) => {
      const W = big ? 128 : 112;
      const H = big ? 104 : 96;
      const { g, cx, baseY } = this.ctx(W, H);
      const bw = big ? 78 : 64;
      const bh = 34;
      const bx = cx - bw / 2;
      const by = baseY - 8 - bh;
      this.foundation(g, cx, baseY, bw + 10);
      this.walls(g, bx, by, bw, bh, 0xe9dcc0);
      this.door(g, cx, baseY - 8, 14, 21);
      this.window(g, bx + 7, by + 9);
      this.window(g, bx + bw - 17, by + 9);
      // escudos cruzados
      for (const dx of [-20, 20]) {
        g.fillStyle(shieldC, 1);
        g.fillCircle(cx + dx, by - 2, 7);
        g.lineStyle(1.4, 0xf5ead2, 1);
        g.strokeCircle(cx + dx, by - 2, 7);
        g.beginPath(); g.moveTo(cx + dx - 4, by - 2); g.lineTo(cx + dx + 4, by - 2); g.moveTo(cx + dx, by - 6); g.lineTo(cx + dx, by + 2); g.strokePath();
      }
      this.roof(g, bx, by, bw, 26, 0x7f1d1d);
      // mástil con gallardete
      g.lineStyle(2.4, 0x4a3220, 1);
      g.beginPath(); g.moveTo(cx, by - 26); g.lineTo(cx, by - 48); g.strokePath();
      g.fillStyle(flagC, 1);
      g.fillTriangle(cx, by - 48, cx + 22, by - 43, cx, by - 38);
      g.generateTexture(key, W, H);
      g.destroy();
    };
    martial('b-armeria', false, 0xb91c1c, 0x1f2937);
    martial('b-cuartel', true, 0xdc2626, 0x7f1d1d);

    this.towerTex('b-torre', 0x9aa0aa, 0xb3402e, 0xfbbf24);

    // Ornamento: fuente de piedra con parterres
    {
      const W = 110;
      const H = 88;
      const { g, cx, baseY } = this.ctx(W, H);
      g.fillStyle(0x000000, 0.2);
      g.fillEllipse(cx, baseY + 4, 84, 16);
      // parterres
      g.fillStyle(0x3a7a33, 1);
      g.fillEllipse(cx - 32, baseY - 2, 26, 12);
      g.fillEllipse(cx + 32, baseY - 2, 26, 12);
      for (const [dx, c] of [[-38, 0xf472b6], [-32, 0xfde68a], [-26, 0xf8fafc], [26, 0xf8fafc], [32, 0xf472b6], [38, 0xfde68a]] as [number, number][]) {
        g.fillStyle(c, 1);
        g.fillCircle(cx + dx, baseY - 6, 2);
      }
      // taza de fuente
      g.fillStyle(0xb9bec7, 1);
      g.fillEllipse(cx, baseY - 8, 52, 20);
      g.fillStyle(0x7cc4f2, 1);
      g.fillEllipse(cx, baseY - 9, 44, 15);
      g.fillStyle(0xd8edfd, 1);
      g.fillEllipse(cx - 8, baseY - 11, 18, 6);
      // columna + taza superior
      g.fillStyle(0x9aa0aa, 1);
      g.fillRect(cx - 4, baseY - 40, 8, 26);
      g.fillStyle(0xb9bec7, 1);
      g.fillEllipse(cx, baseY - 40, 30, 11);
      g.fillStyle(0x7cc4f2, 1);
      g.fillEllipse(cx, baseY - 41, 24, 8);
      // surtidor
      g.fillStyle(0xd8edfd, 1);
      g.fillTriangle(cx - 3, baseY - 56, cx + 3, baseY - 56, cx, baseY - 42);
      g.fillCircle(cx, baseY - 57, 2.4);
      g.generateTexture('b-ornamento', W, H);
      g.destroy();
    }

    // andamio de obra mejorado
    const s = this.make.graphics({ x: 0, y: 0 }, false);
    s.lineStyle(2.4, 0x8b5a2b, 1);
    s.strokeRect(6, 26, 84, 60);
    s.beginPath();
    s.moveTo(6, 26); s.lineTo(90, 86); s.moveTo(90, 26); s.lineTo(6, 86);
    s.moveTo(6, 56); s.lineTo(90, 56);
    s.strokePath();
    s.fillStyle(0xb3402e, 0.95);
    s.fillTriangle(6, 26, 90, 26, 48, 4);
    s.lineStyle(1.4, 0x7f1d1d, 1);
    s.beginPath(); s.moveTo(20, 26); s.lineTo(48, 4); s.moveTo(76, 26); s.lineTo(48, 4); s.strokePath();
    // lonas
    s.fillStyle(0xf5ead2, 0.85);
    s.fillRect(14, 60, 20, 14);
    s.generateTexture('scaffold', 96, 92);
    s.destroy();
  }

  // ============ FX ============
  private makeFx() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // halo de luz radial para faroles / horno
    for (let i = 6; i > 0; i--) {
      g.fillStyle(0xffc861, 0.07);
      g.fillCircle(24, 24, i * 4);
    }
    g.fillStyle(0xffe9b0, 0.9);
    g.fillCircle(24, 24, 4);
    g.generateTexture('glow', 48, 48);
    g.destroy();
  }
}
