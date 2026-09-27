// Harness de simulación para la vista 3D (puro y testeable).
// Reusa los MISMOS sistemas que el juego 2D (economía, transporte, recetas,
// A*): la vista 3D es otro render del mismo diseño, no otro juego.
// Alcance v1: economía + transporte + jobs + colocar. Sin rival/oleadas/
// niebla/especialistas (hoja de ruta en el devlog del motor 3D).

import { BUILDINGS, INITIAL_STOCK, RECIPES, type BuildingId, type ResourceId } from '@/game/data/buildings';
import { LOGIC_OBJECTS } from '@/game/maps/island';
import { createInitialStock, produceToBuffers, tickJob, type ProductionJob, type Stock } from '@/game/systems/economy';
import { createTransportState, requestShipments, tickQueue, type TransportState } from '@/game/systems/transport';

export interface Placed3D {
  id: BuildingId;
  tx: number;
  ty: number;
}

export interface Sim3D {
  stock: Stock;
  placed: Placed3D[];
  transport: TransportState;
  jobs: ProductionJob[];
  tickNo: number;
}

/** Primera receta de cada edificio productor (igual que el juego 2D). */
export const RECIPE_BY_BUILDING_3D: Partial<Record<BuildingId, string>> = {
  aserradero: 'tablon',
  molino: 'harina',
  panaderia: 'pan',
  fundicion: 'lingote-hierro',
  herreria: 'herramienta',
  armeria: 'espada',
};

export function createSim3D(): Sim3D {
  return {
    stock: { ...INITIAL_STOCK },
    placed: [],
    transport: createTransportState(),
    jobs: [],
    tickNo: 0,
  };
}

function isLand(t: string): boolean {
  return t !== 'water' && t !== 'waterB' && t !== 'waterC' && t !== 'mountain';
}

/** Primera loseta de tierra libre en espiral (para planta inicial y obra). */
export function findFreeLand(
  terrain: (tx: number, ty: number) => string,
  occupied: (tx: number, ty: number) => boolean,
  size: number,
  cx: number,
  cy: number,
  maxR = 8,
): { x: number; y: number } | null {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (const dx of [-r, r]) {
        const candidates = r === 0 ? [[cx, cy]] : [[cx + dx, cy + dy], [cx + dy, cy + dx]];
        for (const [tx, ty] of candidates) {
          if (tx < 1 || ty < 1 || tx >= size - 1 || ty >= size - 1) continue;
          if (!isLand(terrain(tx, ty))) continue;
          if (occupied(tx, ty)) continue;
          return { x: tx, y: ty };
        }
      }
    }
  }
  return null;
}

/** Misma planta inicial que el juego 2D (capa Lógica + extras). */
export function initialTown(
  sim: Sim3D,
  terrain: (tx: number, ty: number) => string,
  size: number,
  cx: number,
  cy: number,
): void {
  const taken = new Set<string>();
  const claim = (tx: number, ty: number): { x: number; y: number } => {
    if (tx >= 1 && ty >= 1 && tx < size - 1 && ty < size - 1 && isLand(terrain(tx, ty)) && !taken.has(`${tx},${ty}`)) {
      taken.add(`${tx},${ty}`);
      return { x: tx, y: ty };
    }
    const f = findFreeLand(terrain, (x, y) => taken.has(`${x},${y}`), size, tx, ty, 10);
    const p = f ?? { x: cx, y: cy };
    taken.add(`${p.x},${p.y}`);
    return p;
  };
  const extras: { id: BuildingId; dx: number; dy: number }[] = [
    { id: 'residenciaS', dx: -1, dy: 3 },
    { id: 'granja', dx: 5, dy: 2 },
    { id: 'molino', dx: 6, dy: -1 },
    { id: 'pozo', dx: 1, dy: 1 },
    { id: 'torre', dx: -5, dy: -4 },
  ];
  for (const o of LOGIC_OBJECTS) {
    if (!('edificio' in o.props)) continue;
    const id = o.props.edificio as BuildingId;
    if (!BUILDINGS[id]) continue;
    const p = claim(Math.round(cx + o.dx), Math.round(cy + o.dy));
    sim.placed.push({ id, tx: p.x, ty: p.y });
  }
  for (const e of extras) {
    const p = claim(cx + e.dx, cy + e.dy);
    sim.placed.push({ id: e.id, tx: p.x, ty: p.y });
  }
}

function canAfford(stock: Stock, cost: Partial<Record<ResourceId, number>>): boolean {
  return Object.entries(cost).every(([k, v]) => (stock[k as ResourceId] ?? 0) >= (v ?? 0));
}

/** Reglas de obra 3D: tierra libre + coste (mismas que el juego 2D). */
export function canPlace3D(
  sim: Sim3D,
  terrain: (tx: number, ty: number) => string,
  size: number,
  id: BuildingId,
  tx: number,
  ty: number,
): boolean {
  tx = Math.round(tx);
  ty = Math.round(ty);
  if (tx < 1 || ty < 1 || tx >= size - 1 || ty >= size - 1) return false;
  if (sim.placed.some((p) => p.tx === tx && p.ty === ty)) return false;
  if (!isLand(terrain(tx, ty))) return false;
  return canAfford(sim.stock, BUILDINGS[id].coste);
}

/** Coloca cobrando (false si no se puede). */
export function place3D(sim: Sim3D, terrain: (tx: number, ty: number) => string, size: number, id: BuildingId, tx: number, ty: number): boolean {
  if (!canPlace3D(sim, terrain, size, id, tx, ty)) return false;
  for (const [k, v] of Object.entries(BUILDINGS[id].coste) as [ResourceId, number][]) {
    sim.stock[k] -= v;
  }
  sim.placed.push({ id, tx: Math.round(tx), ty: Math.round(ty) });
  return true;
}

export interface Tick3DOpts {
  /** Porteadores activos (determinan el ancho de banda, como en 2D). */
  carriers: number;
  /** Distancia con retardo (v1: terreno libre, conexo por Manhattan). */
  distanceOf: (fromKey: string) => { connected: boolean; distance: number };
  centralKey: string;
}

/** Un tick de sim (1 s): productores → transporte → recetas. */
export function tickSim3D(sim: Sim3D, opts: Tick3DOpts): void {
  sim.tickNo++;
  const placements = sim.placed.map((p) => ({ id: p.id, key: `${p.tx},${p.ty}` }));
  const prod = produceToBuffers(sim.transport.buffers, placements, sim.stock, sim.tickNo);
  sim.stock = prod.central;
  requestShipments(sim.transport, {
    bandwidth: 4 + opts.carriers * 2,
    centralKey: opts.centralKey,
    distanceOf: opts.distanceOf,
  });
  const flow = tickQueue(sim.transport);
  for (const [k, v] of Object.entries(flow.deliveries)) {
    sim.stock[k as ResourceId] = (sim.stock[k as ResourceId] ?? 0) + (v ?? 0);
  }
  for (const p of sim.placed) {
    const rid = RECIPE_BY_BUILDING_3D[p.id];
    if (!rid) continue;
    const jkey = `${p.tx},${p.ty}`;
    let job = sim.jobs.find((j) => j.key === jkey);
    if (!job) {
      const ms = RECIPES.find((r) => r.id === rid)?.tiempoMs ?? 8000;
      job = { recipeId: rid, edificio: p.id, progresoMs: 0, duracionMs: ms, key: jkey };
      sim.jobs.push(job);
    }
    const r = tickJob(sim.stock, job, 1000);
    sim.stock = r.stock;
    Object.assign(job, r.job);
  }
}

export { createInitialStock };
