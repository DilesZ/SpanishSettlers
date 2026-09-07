import Phaser from 'phaser';

// Arte 100% ORIGINAL generado por código (sin copiar assets de ningún juego).
// Estilo propio "terracota ibérica": tejados rojizos, muros encalados, madera cálida.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    this.makeTiles();
    this.makeDeco();
    this.makePeople();
    this.makeBuildings();
    this.scene.start('game');
  }

  // ---------- Terreno isométrico 64x32 con moteado ----------
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
    // moteado para romper el plano
    for (const [sx, sy, c] of speckles) {
      g.fillStyle(c, 0.9);
      g.fillCircle(sx, sy, 1.4);
    }
    // brillo superior-izquierdo
    g.lineStyle(1, 0xffffff, 0.12);
    g.beginPath();
    g.moveTo(w / 2, 2);
    g.lineTo(w - 2, h / 2);
    g.strokePath();
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeTiles() {
    this.tile('grass0', 0x4a8f3c, 0x63a854, [[20, 14, 0x3c7a30], [40, 18, 0x5da24c], [32, 22, 0x3c7a30], [46, 12, 0x77b565]]);
    this.tile('grass1', 0x448637, 0x5d9c4e, [[16, 18, 0x38702c], [38, 12, 0x57a047], [28, 22, 0x38702c]]);
    this.tile('grass2', 0x529647, 0x6cab5c, [[22, 16, 0x7cc46a], [42, 20, 0x3f7d33], [30, 12, 0x8fd47e]]);
    this.tile('sand', 0xd9b36a, 0xe8c988, [[20, 16, 0xc49a52], [42, 14, 0xe8c988]]);
    this.tile('water', 0x2f6fb4, 0x5aa3e0, [[22, 16, 0x7cc0f0], [40, 20, 0x2a5f96]]);
    this.tile('water2', 0x2a68ac, 0x55a0dc, [[30, 14, 0x7cc0f0], [20, 20, 0x2a5f96]]);
    this.tile('forest', 0x3c7a30, 0x529647, [[18, 14, 0x2c5c24], [44, 20, 0x529647]]);
    this.tile('mountain', 0x8a8f98, 0xb9bec7, [[20, 18, 0x6b7280], [42, 14, 0xd1d5db], [32, 22, 0x6b7280]]);
  }

  // ---------- Decoración ----------
  private makeDeco() {
    // Pino
    let g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(14, 26, 4, 8);
    g.fillStyle(0x2c5c24, 1);
    g.fillTriangle(4, 28, 28, 28, 16, 6);
    g.fillStyle(0x3f7d33, 1);
    g.fillTriangle(8, 22, 24, 22, 16, 8);
    g.generateTexture('pine', 32, 36);
    g.destroy();
    // Roble
    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(14, 24, 4, 10);
    g.fillStyle(0x3f7d33, 1);
    g.fillCircle(16, 16, 11);
    g.fillStyle(0x529647, 1);
    g.fillCircle(12, 12, 6);
    g.fillCircle(20, 13, 5);
    g.generateTexture('oak', 32, 36);
    g.destroy();
    // Roca
    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x111111, 0.25);
    g.fillEllipse(16, 28, 24, 7);
    g.fillStyle(0x6b7280, 1);
    g.fillTriangle(6, 28, 26, 28, 16, 10);
    g.fillStyle(0x9ca3af, 1);
    g.fillTriangle(16, 10, 26, 28, 18, 28);
    g.fillStyle(0xe5e7eb, 1);
    g.fillTriangle(16, 10, 21, 19, 16, 19);
    g.generateTexture('rock', 32, 32);
    g.destroy();
    // Flores / hierba alta
    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x3c7a30, 1);
    g.fillTriangle(6, 14, 8, 14, 7, 4);
    g.fillTriangle(11, 14, 13, 14, 12, 6);
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(16, 8, 2);
    g.fillStyle(0xfde68a, 1);
    g.fillCircle(16, 8, 0.9);
    g.generateTexture('flowers', 20, 16);
    g.destroy();
    // Sombra suave para personajes/edificios
    g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(16, 6, 26, 8);
    g.generateTexture('shadow', 32, 12);
    g.destroy();
  }

  // ---------- Personajes 16x26 (cuerpo + cabeza + herramienta) ----------
  private person(key: string, tunic: number, skin = 0xf2c89b, hat: number | null = null, tool: 'axe' | 'sack' | 'sword' | 'spear' | null = null) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // piernas
    g.fillStyle(0x4a3220, 1);
    g.fillRect(5, 18, 2.6, 5);
    g.fillRect(8.4, 18, 2.6, 5);
    // túnica
    g.fillStyle(tunic, 1);
    g.fillRoundedRect(3.4, 10, 9.2, 9, 2);
    g.fillStyle(0x000000, 0.18);
    g.fillRect(3.4, 16, 9.2, 3);
    // brazos
    g.fillStyle(tunic, 1);
    g.fillRect(1.4, 11, 2.2, 6);
    g.fillRect(12.4, 11, 2.2, 6);
    g.fillStyle(skin, 1);
    g.fillRect(1.4, 16, 2.2, 2);
    g.fillRect(12.4, 16, 2.2, 2);
    // cabeza
    g.fillStyle(skin, 1);
    g.fillCircle(8, 6.4, 4);
    g.fillStyle(0x3a2415, 1);
    g.fillCircle(6.6, 6, 0.7);
    g.fillCircle(9.4, 6, 0.7);
    if (hat !== null) {
      g.fillStyle(hat, 1);
      g.fillTriangle(3.4, 4.6, 12.6, 4.6, 8, -1.4);
    }
    // herramienta
    if (tool === 'axe') {
      g.lineStyle(1.6, 0x6b4a2a, 1);
      g.beginPath(); g.moveTo(13.4, 12); g.lineTo(16.4, 6); g.strokePath();
      g.fillStyle(0x9ca3af, 1);
      g.fillTriangle(14.6, 4, 18.4, 5.4, 15.2, 8.4);
    } else if (tool === 'sack') {
      g.fillStyle(0xd9b36a, 1);
      g.fillEllipse(12.6, 11, 6, 8);
      g.lineStyle(1, 0x8b5a2b, 1);
      g.strokeEllipse(12.6, 11, 6, 8);
    } else if (tool === 'sword') {
      g.lineStyle(1.8, 0x9ca3af, 1);
      g.beginPath(); g.moveTo(13.6, 15); g.lineTo(17, 7); g.strokePath();
      g.lineStyle(1.8, 0x8b5a2b, 1);
      g.beginPath(); g.moveTo(12.4, 13.4); g.lineTo(14.8, 14.4); g.strokePath();
    } else if (tool === 'spear') {
      g.lineStyle(1.4, 0x6b4a2a, 1);
      g.beginPath(); g.moveTo(13.4, 20); g.lineTo(15.4, 2); g.strokePath();
      g.fillStyle(0xd1d5db, 1);
      g.fillTriangle(13.8, -1, 17, -1, 15.4, 2.6);
    }
    g.generateTexture(key, 20, 26);
    g.destroy();
  }

  private makePeople() {
    this.person('settler', 0x2f6fb4, 0xf2c89b, null, null);
    this.person('woodcutter', 0x8b5a2b, 0xf2c89b, 0x5b3a1e, 'axe');
    this.person('carrier', 0x3f7d33, 0xf2c89b, null, 'sack');
    this.person('soldier', 0xdc2626, 0xf2c89b, 0x9ca3af, 'sword');
    this.person('archer', 0x7c3aed, 0xf2c89b, 0x4c1d95, 'spear');
    this.person('miner', 0x4b5563, 0xf2c89b, 0xfde68a, null);
    this.person('fisher', 0x0ea5e9, 0xf2c89b, 0x134e4a, null);
  }

  // ---------- Edificios isométricos originales ----------
  private building(key: string, wall: number, roof: number, opts: { tower?: boolean; big?: boolean; mill?: boolean; flag?: number; chimney?: boolean; gold?: boolean } = {}) {
    const W = opts.big ? 96 : 72;
    const H = opts.tower ? 104 : opts.big ? 88 : 76;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const cx = W / 2;
    const baseY = H - 8;
    // sombra
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx, baseY + 3, opts.big ? 70 : 54, 14);
    if (opts.tower) {
      // torre de piedra alta con almenas
      const tw = 30;
      const tx = cx - tw / 2;
      const top = 14;
      g.fillStyle(0x9aa0aa, 1);
      g.fillRect(tx, top + 8, tw, baseY - top - 8);
      g.fillStyle(0x7c828c, 1);
      g.fillRect(tx + tw / 2, top + 8, tw / 2, baseY - top - 8);
      // hileras de piedra
      g.lineStyle(1, 0x6b7280, 0.7);
      for (let y = top + 16; y < baseY - 4; y += 9) {
        g.beginPath(); g.moveTo(tx + 2, y); g.lineTo(tx + tw - 2, y); g.strokePath();
      }
      // almenas
      g.fillStyle(0x9aa0aa, 1);
      for (let i = 0; i < 4; i++) g.fillRect(tx + i * 8, top, 5, 10);
      // puerta + ventana
      g.fillStyle(0x3a2415, 1);
      g.fillRoundedRect(cx - 5, baseY - 18, 10, 18, 3);
      g.fillStyle(0xfde68a, 1);
      g.fillRect(cx - 3, top + 22, 6, 8);
      // tejadillo + bandera
      g.fillStyle(roof, 1);
      g.fillTriangle(tx - 3, top + 8, tx + tw + 3, top + 8, cx, top - 6);
      if (opts.flag !== undefined) {
        g.lineStyle(2, 0x4a3220, 1);
        g.beginPath(); g.moveTo(cx, top - 6); g.lineTo(cx, top - 22); g.strokePath();
        g.fillStyle(opts.flag, 1);
        g.fillTriangle(cx, top - 22, cx + 16, top - 18, cx, top - 14);
      }
    } else {
      // casa: muros encalados con entramado + tejado a dos aguas
      const bw = opts.big ? 62 : 48;
      const bh = opts.big ? 30 : 24;
      const bx = cx - bw / 2;
      const by = baseY - bh;
      g.fillStyle(wall, 1);
      g.fillRect(bx, by, bw, bh);
      // lado sombreado derecho
      g.fillStyle(0x000000, 0.14);
      g.fillRect(cx, by, bw / 2, bh);
      // entramado de madera
      g.lineStyle(1.4, 0x6b4a2a, 1);
      g.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
      g.beginPath(); g.moveTo(cx, by + 2); g.lineTo(cx, by + bh - 2); g.strokePath();
      // puerta
      g.fillStyle(0x3a2415, 1);
      g.fillRoundedRect(cx - 6, baseY - 16, 12, 16, 2);
      g.fillStyle(0xfbbf24, 1);
      g.fillCircle(cx + 3.4, baseY - 8, 1);
      // ventanas
      g.fillStyle(0xbfe3ff, 1);
      g.fillRect(bx + 6, by + 7, 8, 7);
      g.fillRect(bx + bw - 14, by + 7, 8, 7);
      g.lineStyle(1, 0x6b4a2a, 1);
      g.strokeRect(bx + 6, by + 7, 8, 7);
      g.strokeRect(bx + bw - 14, by + 7, 8, 7);
      // tejado
      const rh = opts.big ? 26 : 22;
      g.fillStyle(roof, 1);
      g.fillTriangle(bx - 5, by + 2, cx, by - rh, cx, by + 2);
      g.fillStyle(Phaser.Display.Color.IntegerToColor(roof).darken(18).color, 1);
      g.fillTriangle(cx, by - rh, bx + bw + 5, by + 2, cx, by + 2);
      // cumbrera + tejas
      g.lineStyle(1, 0x000000, 0.25);
      for (let i = 1; i < 5; i++) {
        const y = by - rh + (rh / 5) * i;
        const spread = ((bw / 2 + 5) / 5) * i;
        g.beginPath(); g.moveTo(cx - spread, y); g.lineTo(cx + spread, y); g.strokePath();
      }
      if (opts.chimney) {
        g.fillStyle(0x78716c, 1);
        g.fillRect(cx + 12, by - rh - 2, 8, 16);
        g.fillStyle(0x57534e, 1);
        g.fillRect(cx + 12, by - rh - 2, 8, 3);
      }
      if (opts.mill) {
        // aspa de molino
        const hubX = bx + bw + 2;
        const hubY = by - 4;
        g.lineStyle(2.4, 0x4a3220, 1);
        g.beginPath(); g.moveTo(hubX - 12, hubY - 12); g.lineTo(hubX + 12, hubY + 12); g.strokePath();
        g.beginPath(); g.moveTo(hubX + 12, hubY - 12); g.lineTo(hubX - 12, hubY + 12); g.strokePath();
        g.fillStyle(0xf8fafc, 0.9);
        g.fillTriangle(hubX, hubY, hubX + 12, hubY - 12, hubX + 6, hubY - 13);
        g.fillStyle(0x8b5a2b, 1);
        g.fillCircle(hubX, hubY, 2.6);
      }
      if (opts.gold) {
        g.fillStyle(0xfde68a, 1);
        g.fillCircle(bx + 8, by - 4, 2);
        g.fillCircle(bx + bw - 8, by - 4, 2);
      }
    }
    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeBuildings() {
    this.building('b-almacen', 0xf5ead2, 0xb3402e, { big: true, chimney: true, gold: true });
    this.building('b-cabanaLenador', 0xe8d5ae, 0x7c4a21, { chimney: true });
    this.building('b-aserradero', 0xd9b36a, 0x8b5a2b, {});
    this.building('b-cantera', 0xd6d3d1, 0x78716c, {});
    this.building('b-residenciaS', 0xf5ead2, 0xb3402e, {});
    this.building('b-residenciaM', 0xf5ead2, 0x9c2f22, { big: false, chimney: true });
    this.building('b-residenciaL', 0xf5ead2, 0x7f1d1d, { big: true, chimney: true });
    this.building('b-granja', 0xefe3c2, 0xc47b2b, {});
    this.building('b-molino', 0xf5ead2, 0xb3402e, { big: true, mill: true });
    this.building('b-panaderia', 0xf5ead2, 0xd9a441, { chimney: true });
    this.building('b-pozo', 0xd6d3d1, 0x57534e, {});
    this.building('b-pesqueria', 0xcfe8f5, 0x0ea5e9, {});
    this.building('b-minaCarbon', 0x57534e, 0x292524, { chimney: true });
    this.building('b-minaHierro', 0x78716c, 0x44403c, { chimney: true });
    this.building('b-minaOro', 0xa8a29e, 0xb8860b, { chimney: true, gold: true });
    this.building('b-fundicion', 0x8a6a45, 0x44403c, { big: true, chimney: true });
    this.building('b-herreria', 0xe8d5ae, 0x57534e, { chimney: true });
    this.building('b-armeria', 0xe8d5ae, 0x7f1d1d, { big: true, flag: 0x7f1d1d });
    this.building('b-cuartel', 0xf5ead2, 0x9c2f22, { big: true, flag: 0xdc2626 });
    this.building('b-torre', 0x9aa0aa, 0xb3402e, { tower: true, flag: 0xfbbf24 });
    this.building('b-ornamento', 0xf5ead2, 0xec4899, {});
    // andamio de construcción
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(2, 0x8b5a2b, 1);
    g.strokeRect(4, 20, 64, 48);
    g.beginPath(); g.moveTo(4, 20); g.lineTo(68, 68); g.moveTo(68, 20); g.lineTo(4, 68); g.strokePath();
    g.fillStyle(0xb3402e, 1);
    g.fillTriangle(4, 20, 68, 20, 36, 2);
    g.generateTexture('scaffold', 72, 76);
    g.destroy();
  }
}
