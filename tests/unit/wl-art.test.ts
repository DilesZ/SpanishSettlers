import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '@/game/data/buildings';
import { WL_BUILDINGS, WL_WORKERS, wlBuildingScale, wlWorkerScale } from '@/game/data/wlArt';

const PUB = join(__dirname, '..', '..', 'public', 'assets');
const PEOPLE_ROLES = Object.keys(WL_WORKERS);

describe('arte Widelands (GPL)', () => {
  it('los 21 edificios tienen PNG, icono y manifest con hotspot', () => {
    for (const id of Object.keys(BUILDINGS)) {
      expect(WL_BUILDINGS[id], `falta manifest ${id}`).toBeDefined();
      expect(existsSync(join(PUB, 'wl', `b-${id}.png`)), `falta wl/b-${id}.png`).toBe(true);
      expect(existsSync(join(PUB, 'wl', 'icons', `${id}.png`)), `falta icono ${id}`).toBe(true);
      const art = WL_BUILDINGS[id];
      expect(art.hotspot[0]).toBeGreaterThanOrEqual(0);
      expect(art.hotspot[1]).toBeGreaterThanOrEqual(0);
      if (art.mode === 'sheet' && art.sheet) {
        expect(existsSync(join(PUB, 'wl', 'sheets', art.sheet.file)), `falta sheet ${id}`).toBe(true);
      }
    }
  });

  it('cada oficio tiene sheets e/w con rejilla válida', () => {
    for (const role of PEOPLE_ROLES) {
      const w = WL_WORKERS[role];
      expect(w, `falta worker ${role}`).toBeDefined();
      for (const d of ['e', 'w'] as const) {
        const dd = w.dirs[d];
        expect(dd, `falta dir ${d} en ${role}`).toBeDefined();
        expect(existsSync(join(PUB, 'wl', 'people', dd!.file)), `falta ${dd!.file}`).toBe(true);
        expect(dd!.fw).toBeGreaterThan(0);
        expect(dd!.fh).toBeGreaterThan(0);
      }
    }
  });

  it('escalas acotadas (edificios ~1 loseta, colonos visibles)', () => {
    for (const art of Object.values(WL_BUILDINGS)) {
      const s = wlBuildingScale(art.w, art.h);
      expect(s).toBeGreaterThanOrEqual(0.85);
      expect(s).toBeLessThanOrEqual(2.4);
    }
    for (const w of Object.values(WL_WORKERS)) {
      const s = wlWorkerScale(w.dirs.e?.fh ?? 42);
      expect(s).toBeGreaterThanOrEqual(0.8);
      expect(s).toBeLessThanOrEqual(1.5);
    }
  });

  it('SFX presentes', () => {
    for (const sfx of ['click', 'select', 'confirm', 'error', 'chop', 'sword']) {
      expect(existsSync(join(PUB, 'audio', `${sfx}.ogg`)), `falta ${sfx}.ogg`).toBe(true);
    }
  });
});
