import { describe, expect, it } from 'vitest';
import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';
import {
  canPlace3D,
  createSim3D,
  findFreeLand,
  initialTown,
  place3D,
  tickSim3D,
} from '@/three/sim3d';
import { BUILDINGS } from '@/game/data/buildings';

const taken = new Set<string>();
const occupied = (x: number, y: number) => taken.has(`${x},${y}`);

describe('sim 3D (mismas reglas que el 2D)', () => {
  it('la planta inicial cae en tierra y sin solapes', () => {
    const sim = createSim3D();
    const c = Math.floor(ISLAND_SIZE / 2);
    initialTown(sim, terrainAt, ISLAND_SIZE, c, c);
    expect(sim.placed.length).toBeGreaterThan(8);
    const keys = sim.placed.map((p) => `${p.tx},${p.ty}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of sim.placed) {
      expect(['water', 'waterB', 'waterC', 'mountain']).not.toContain(terrainAt(p.tx, p.ty));
    }
    expect(sim.placed.some((p) => p.id === 'almacen')).toBe(true);
  });

  it('findFreeLand evita agua y ocupados', () => {
    const f = findFreeLand(terrainAt, occupied, ISLAND_SIZE, 32, 32, 10);
    expect(f).not.toBeNull();
    expect(['water', 'waterB', 'waterC', 'mountain']).not.toContain(terrainAt(f!.x, f!.y));
    expect(findFreeLand(() => 'water', occupied, 28, 14, 14, 4)).toBeNull();
  });

  it('canPlace3D veta agua, bordes y sin recursos', () => {
    const sim = createSim3D();
    expect(canPlace3D(sim, () => 'water', 64, 'residenciaS', 30, 30)).toBe(false);
    expect(canPlace3D(sim, () => 'grass', 64, 'residenciaS', 0, 0)).toBe(false);
    expect(canPlace3D(sim, () => 'grass', 64, 'residenciaS', 30, 30)).toBe(true);
    const pobre = createSim3D();
    pobre.stock.madera = 0;
    expect(canPlace3D(pobre, () => 'grass', 64, 'residenciaS', 30, 30)).toBe(false);
    expect(BUILDINGS.residenciaS.coste.madera).toBe(2);
  });

  it('colocar cobra y respeta reglas', () => {
    const sim = createSim3D();
    const c = Math.floor(ISLAND_SIZE / 2);
    initialTown(sim, terrainAt, ISLAND_SIZE, c, c);
    const antes = sim.stock.madera;
    const spot = findFreeLand(terrainAt, (x, y) => sim.placed.some((p) => p.tx === x && p.ty === y), ISLAND_SIZE, c, c, 10)!;
    expect(place3D(sim, terrainAt, ISLAND_SIZE, 'residenciaS', spot.x, spot.y)).toBe(true);
    expect(sim.stock.madera).toBe(antes - 2);
    expect(place3D(sim, terrainAt, ISLAND_SIZE, 'residenciaS', spot.x, spot.y)).toBe(false);
    expect(place3D(sim, terrainAt, ISLAND_SIZE, 'puerto', 0, 0)).toBe(false);
  });

  it('el tick mueve materia: buffers → almacén y recetas', () => {
    const sim = createSim3D();
    const c = Math.floor(ISLAND_SIZE / 2);
    initialTown(sim, terrainAt, ISLAND_SIZE, c, c);
    const almacen = sim.placed.find((p) => p.id === 'almacen')!;
    const central = `${almacen.tx},${almacen.ty}`;
    const dist = (key: string) => {
      const [fx, fy] = key.split(',').map(Number);
      return { connected: true, distance: Math.abs(fx - almacen.tx) + Math.abs(fy - almacen.ty) };
    };
    const madera0 = sim.stock.madera;
    for (let i = 0; i < 30; i++) {
      tickSim3D(sim, { carriers: 4, distanceOf: dist, centralKey: central });
    }
    // La cabaña produjo y el transporte entregó (o está en ruta/pila).
    const enSistema = sim.stock.madera + sim.stock.tablon * 2;
    expect(enSistema).toBeGreaterThanOrEqual(madera0);
    expect(sim.tickNo).toBe(30);
  });
});
