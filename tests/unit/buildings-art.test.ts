import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '@/game/data/buildings';
import { BUILDING_ART } from '@/game/data/buildingArt';
import { PEOPLE_ROLES } from '@/game/data/roles';

const PUB = join(__dirname, '..', '..', 'public', 'assets');

describe('arte del catalogo', () => {
  it('los 21 edificios tienen PNG, icono y entrada en el manifest', () => {
    for (const id of Object.keys(BUILDINGS)) {
      expect(existsSync(join(PUB, 'buildings', `b-${id}.png`)), `falta b-${id}.png`).toBe(true);
      expect(existsSync(join(PUB, 'buildings', 'icons', `${id}.png`)), `falta icono ${id}`).toBe(true);
      expect(BUILDING_ART[id], `falta manifest ${id}`).toBeDefined();
    }
    expect(existsSync(join(PUB, 'buildings', 'mill-blades.png'))).toBe(true);
  });

  it('cada oficio tiene 3 frames de marcha', () => {
    for (const role of PEOPLE_ROLES) {
      for (let f = 0; f < 3; f++) {
        expect(existsSync(join(PUB, 'people', `${role}-f${f}.png`)), `falta ${role}-f${f}`).toBe(true);
      }
    }
  });

  it('SFX CC0 presentes', () => {
    for (const sfx of ['click', 'select', 'confirm', 'error', 'chop', 'sword']) {
      expect(existsSync(join(PUB, 'audio', `${sfx}.ogg`)), `falta ${sfx}.ogg`).toBe(true);
    }
  });
});
