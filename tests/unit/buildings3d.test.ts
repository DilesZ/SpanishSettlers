import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingId } from '@/game/data/buildings';
import { buildHome3D, BUILDING_HEIGHT, BUILDING_SPACING } from '@/three/buildings3d';

const ALL = Object.keys(BUILDINGS) as BuildingId[];

describe('edificios 3D', () => {
  it('los 22 edificios tienen constructor con huella y altura sanas', () => {
    for (const id of ALL) {
      const g = buildHome3D(id, 'player');
      expect(g.userData.footprint, id).toBeGreaterThan(0.5);
      expect(g.userData.footprint, id).toBeLessThan(5);
      expect(g.userData.height, id).toBeGreaterThan(0.8);
      expect(g.userData.height, id).toBeLessThan(6);
      expect(g.children.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('el molino trae aspas animables y la torre brasero', () => {
    const molino = buildHome3D('molino', 'player');
    expect(molino.userData.sails).toBeTruthy();
    const torre = buildHome3D('torre', 'player');
    expect(torre.userData.brazier, 'torre').toBe(true);
  });

  it('el banderín rival es rojo y el propio ámbar', () => {
    const a = buildHome3D('almacen', 'player');
    const b = buildHome3D('almacen', 'rival');
    expect(a.userData.pennant).toBe(0xfbbf24);
    expect(b.userData.pennant).toBe(0xb3402e);
  });

  it('constantes de urbanismo sanas', () => {
    expect(BUILDING_SPACING).toBeGreaterThanOrEqual(2.4);
    expect(BUILDING_HEIGHT('torre')).toBeGreaterThan(BUILDING_HEIGHT('residenciaS'));
  });
});
