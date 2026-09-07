import Phaser from 'phaser';

// BootScene (Fase 2A): solo decoración procedural + FX genéricos.
// Edificios, colonos y terreno vienen de PNG (scripts/make-*.mjs + Tiled).
// Todo original, sin assets de terceros.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    this.makeNature();
    this.makeProps();
    this.makeFx();
    this.scene.start('game');
  }

  private makeNature() {
    let g = this.make.graphics({ x: 0, y: 0 }, false);
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
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(15, 26, 5, 12);
    g.fillStyle(0x3a7a33, 1);
    g.fillCircle(17, 15, 13);
    g.fillStyle(0x4c9a45, 1);
    g.fillCircle(12, 11, 7);
    g.fillCircle(22, 12, 6);
    g.fillStyle(0xd94f3d, 1);
    g.fillCircle(10, 14, 1.6);
    g.fillCircle(23, 17, 1.6);
    g.generateTexture('oak', 36, 40);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x8a6538, 1);
    g.fillTriangle(15, 36, 19, 36, 16, 12);
    g.fillStyle(0x3f8f3f, 1);
    for (const [x2, y2] of [[2, 8], [30, 8], [6, 2], [26, 2], [16, 0]] as [number, number][]) {
      g.lineStyle(3.4, 0x3f8f3f, 1);
      g.beginPath(); g.moveTo(16, 12); g.lineTo(x2, y2); g.strokePath();
    }
    g.fillStyle(0x6b4a2a, 1);
    g.fillCircle(14, 13, 2.2);
    g.fillCircle(18, 13, 2.2);
    g.generateTexture('palm', 34, 38);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(17, 30, 27, 8);
    g.fillStyle(0x6e737c, 1);
    g.fillTriangle(5, 30, 29, 30, 17, 9);
    g.fillStyle(0x9aa0aa, 1);
    g.fillTriangle(17, 9, 29, 30, 19, 30);
    g.fillStyle(0xeef1f4, 1);
    g.fillTriangle(17, 9, 23, 19, 17, 19);
    g.generateTexture('rock', 34, 34);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x3a7a33, 1);
    g.fillTriangle(3, 15, 5, 15, 4, 5);
    g.fillTriangle(13, 15, 15, 15, 14, 4);
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(17, 7, 2.2);
    g.fillStyle(0xfde68a, 1);
    g.fillCircle(17, 7, 1);
    g.generateTexture('flowers', 24, 17);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x6b4a2a, 1);
    g.fillEllipse(12, 14, 20, 8);
    g.fillStyle(0xa9804f, 1);
    g.fillEllipse(12, 12, 18, 7);
    g.lineStyle(2, 0x6b4a2a, 1);
    g.beginPath(); g.moveTo(16, 12); g.lineTo(21, 2); g.strokePath();
    g.fillStyle(0x9aa0aa, 1);
    g.fillTriangle(19, 0, 24, 2, 20, 5);
    g.generateTexture('stump', 26, 17);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.26);
    g.fillEllipse(17, 6, 28, 9);
    g.generateTexture('shadow', 34, 13);
    g.destroy();
  }

  private makeProps() {
    let g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(26, 22, 44, 8);
    const log = (x: number, y: number) => {
      g.fillStyle(0x7c4a21, 1);
      g.fillRoundedRect(x, y, 22, 7, 3);
      g.fillStyle(0xd9b36a, 1);
      g.fillCircle(x + 22, y + 3.5, 3.5);
    };
    log(6, 14); log(10, 7); log(28, 12); log(14, 0);
    g.generateTexture('logs', 54, 25);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(22, 24, 38, 8);
    g.fillStyle(0x9aa0aa, 1);
    g.fillRoundedRect(4, 14, 16, 9, 2);
    g.fillRoundedRect(22, 14, 16, 9, 2);
    g.fillRoundedRect(13, 5, 16, 9, 2);
    g.fillStyle(0xc4c9d1, 1);
    g.fillRect(6, 14, 12, 2.4);
    g.fillRect(15, 5, 12, 2.4);
    g.generateTexture('stones', 44, 27);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xa9804f, 1);
    g.fillRect(4, 14, 15, 15);
    g.fillStyle(0x8a6538, 1);
    g.fillRect(21, 10, 17, 19);
    g.lineStyle(1.4, 0x5e4426, 1);
    g.strokeRect(4, 14, 15, 15);
    g.strokeRect(21, 10, 17, 19);
    g.fillStyle(0x7c4a21, 1);
    g.fillEllipse(44, 20, 12, 16);
    g.lineStyle(1.2, 0x3a2415, 1);
    g.strokeEllipse(44, 20, 12, 16);
    g.generateTexture('crates', 52, 33);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(2, 2, 4, 16);
    g.fillRect(28, 2, 4, 16);
    g.fillStyle(0x8a6538, 1);
    g.fillRect(0, 5, 34, 3.4);
    g.fillRect(0, 11, 34, 3.4);
    g.generateTexture('fence', 34, 19);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(30, 26, 14);
    g.fillCircle(48, 22, 17);
    g.fillCircle(66, 26, 13);
    g.fillEllipse(48, 32, 72, 16);
    g.generateTexture('cloud', 96, 44);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(2.2, 0x1f2937, 1);
    g.beginPath();
    g.moveTo(1, 7); g.lineTo(6, 2); g.lineTo(11, 6); g.lineTo(16, 2); g.lineTo(21, 7);
    g.strokePath();
    g.generateTexture('bird', 22, 9);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xf9a8d4, 1);
    g.fillEllipse(4, 5, 6, 8);
    g.fillEllipse(12, 5, 6, 8);
    g.fillStyle(0x7c3aed, 1);
    g.fillRect(7.4, 1, 1.6, 9);
    g.generateTexture('butterfly', 16, 11);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xa9804f, 0.85);
    g.fillEllipse(8, 5, 14, 7);
    g.generateTexture('pathdot', 16, 10);
    g.destroy();

    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(1.6, 0x3e7d33, 1);
    for (const [x1, y1, x2, y2] of [[4, 12, 3, 3], [7, 12, 7, 1], [10, 12, 12, 4]] as [number, number, number, number][]) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
    g.generateTexture('tuft', 15, 13);
    g.destroy();
  }

  private makeFx() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 6; i > 0; i--) {
      g.fillStyle(0xffc861, 0.07);
      g.fillCircle(24, 24, i * 4);
    }
    g.fillStyle(0xffe9b0, 0.9);
    g.fillCircle(24, 24, 4);
    g.generateTexture('glow', 48, 48);
    g.destroy();

    const s = this.make.graphics({ x: 0, y: 0 }, false);
    s.lineStyle(2.4, 0x8b5a2b, 1);
    s.strokeRect(6, 26, 84, 60);
    s.beginPath();
    s.moveTo(6, 26); s.lineTo(90, 86); s.moveTo(90, 26); s.lineTo(6, 86);
    s.moveTo(6, 56); s.lineTo(90, 56);
    s.strokePath();
    s.fillStyle(0xb3402e, 0.95);
    s.fillTriangle(6, 26, 90, 26, 48, 4);
    s.generateTexture('scaffold', 96, 92);
    s.destroy();
  }
}
