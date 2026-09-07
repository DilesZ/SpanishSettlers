import Phaser from 'phaser';

// Genera texturas procedurales originales (sin copiar assets de S4).
// Estilo propio: isométrico esmeralda/terracota español.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    this.makeTile('grass0', '#3f7d3a', '#4c9150');
    this.makeTile('grass1', '#3a7536', '#47904b');
    this.makeTile('water', '#2b6cb0', '#3b82c4');
    this.makeTile('forest', '#2f6b2f', '#3f7d3a', true);
    this.makeTile('mountain', '#6b7280', '#9ca3af', false, true);
    this.makeDot('settler', '#fbbf24');
    this.makeDot('soldier', '#ef4444');
    this.makeDot('carrier', '#f8fafc');
    this.scene.start('game');
  }

  private makeTile(key: string, base: string, light: string, tree = false, rock = false) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const w = 64;
    const h = 32;
    g.fillStyle(Phaser.Display.Color.HexStringToColor(base).color, 1);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w, h / 2);
    g.lineTo(w / 2, h);
    g.lineTo(0, h / 2);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, Phaser.Display.Color.HexStringToColor(light).color, 1);
    g.strokePath();
    if (tree) {
      g.fillStyle(0x1f4d2e, 1);
      g.fillTriangle(w / 2 - 8, h / 2 + 4, w / 2 + 8, h / 2 + 4, w / 2, h / 2 - 12);
      g.fillStyle(0x5b3a1e, 1);
      g.fillRect(w / 2 - 1, h / 2 + 4, 2, 5);
    }
    if (rock) {
      g.fillStyle(0x4b5563, 1);
      g.fillTriangle(w / 2 - 10, h / 2 + 6, w / 2 + 10, h / 2 + 6, w / 2, h / 2 - 8);
      g.fillStyle(0xe5e7eb, 1);
      g.fillTriangle(w / 2 - 4, h / 2 - 2, w / 2 + 4, h / 2 - 2, w / 2, h / 2 - 8);
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeDot(key: string, color: string) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
    g.fillCircle(6, 6, 5);
    g.lineStyle(1, 0x000000, 0.8);
    g.strokeCircle(6, 6, 5);
    g.generateTexture(key, 12, 12);
    g.destroy();
  }
}
