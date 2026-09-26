// Lógica pura de economía (testeable sin Phaser) — skill TDD.
// Inventario + producción por recetas + prioridades de transporte.

import { INITIAL_STOCK, RECIPES, type BuildingId, type ResourceId } from '../data/buildings';

export type Stock = Record<ResourceId, number>;

export function createInitialStock(): Stock {
  return { ...INITIAL_STOCK };
}

export function canAfford(stock: Stock, cost: Partial<Record<ResourceId, number>>): boolean {
  return Object.entries(cost).every(([k, v]) => (stock[k as ResourceId] ?? 0) >= (v ?? 0));
}

/** Qué recursos faltan para pagar un coste (vacío = se puede pagar).
 *  Para el aviso "producción bloqueada" de la Fase 2 (caminos/logística). */
export function missingInputs(
  stock: Stock,
  cost: Partial<Record<ResourceId, number>>,
): ResourceId[] {
  const out: ResourceId[] = [];
  for (const [k, v] of Object.entries(cost)) {
    if ((stock[k as ResourceId] ?? 0) < (v ?? 0)) out.push(k as ResourceId);
  }
  return out;
}

/** Productores automáticos (sin receta): cabaña, cantera, granja, pozo,
 *  pesquería y minas (comen pan). Puro: devuelve el stock resultante.
 *  Lo usan el jugador y la IA rival con sus propios stocks (Fase 4). */
const AUTO_RULES: Partial<Record<BuildingId, { in: Partial<Record<ResourceId, number>>; out: Partial<Record<ResourceId, number>> }>> = {
  cabanaLenador: { in: {}, out: { madera: 2 } },
  cantera: { in: {}, out: { piedra: 2 } },
  granja: { in: {}, out: { grano: 2 } },
  pozo: { in: {}, out: { agua: 2 } },
  pesqueria: { in: {}, out: { pez: 2 } },
  minaCarbon: { in: { pan: 1 }, out: { carbon: 2 } },
  minaHierro: { in: { pan: 1 }, out: { hierro: 2 } },
  minaOro: { in: { pan: 1 }, out: { oro: 1 } },
};

export function tickAutoProducers(stock: Stock, buildingIds: BuildingId[], tickNo = 0): Stock {
  const next = { ...stock };
  for (const id of buildingIds) {
    const rule = AUTO_RULES[id];
    if (!rule) continue;
    // Las minas comen un pan cada 4 ticks (si no, ni jugador ni IA podrían
    // sostenerlas con la producción de una panadería: 1 pan/s es impagable).
    if ((id === 'minaCarbon' || id === 'minaHierro' || id === 'minaOro') && tickNo % 4 !== 0) continue;
    if (!canAfford(next, rule.in)) continue;
    for (const [k, v] of Object.entries(rule.in)) next[k as ResourceId] -= v ?? 0;
    for (const [k, v] of Object.entries(rule.out)) next[k as ResourceId] += v ?? 0;
  }
  return next;
}

/**
 * Council Fase 1: los productores vierten a su buffer local (bandera del
 * edificio) en vez de teletransportar al stock global. Devuelve overflow por
 * edificio (true = pila llena, goods-stuck). El rival sigue con stock global
 * por perf (misma regla económica, distinto transporte: deuda documentada).
 * `consumePan` descuenta el pan de mina del stock central al producir.
 */
export interface Placement {
  id: BuildingId;
  key: string;
  /** Reserva restante de la veta (solo minas). undefined = infinita. */
  reserve?: number;
}

export function produceToBuffers(
  buffers: Record<string, Partial<Record<ResourceId, number>>>,
  placements: Placement[],
  central: Stock,
  tickNo = 0,
  capacityPerResource = 12,
): { central: Stock; overflowKeys: string[]; depletedKeys: string[]; consumed: Record<string, number> } {
  const nextCentral = { ...central };
  const overflowKeys: string[] = [];
  const depletedKeys: string[] = [];
  const consumed: Record<string, number> = {};
  for (const p of placements) {
    const rule = AUTO_RULES[p.id];
    if (!rule) continue;
    const isMine = p.id === 'minaCarbon' || p.id === 'minaHierro' || p.id === 'minaOro';
    if (isMine && tickNo % 4 !== 0) continue;
    // R1: veta agotada = la mina para y avisa (escasez real con coste).
    if (isMine && (p.reserve ?? Infinity) <= 0) {
      depletedKeys.push(p.key);
      continue;
    }
    if (!canAfford(nextCentral, rule.in)) continue;
    for (const [k, v] of Object.entries(rule.in)) nextCentral[k as ResourceId] -= v ?? 0;
    const buf = (buffers[p.key] ??= {});
    for (const [k, v] of Object.entries(rule.out)) {
      const rk = k as ResourceId;
      const cur = buf[rk] ?? 0;
      const room = Math.max(0, capacityPerResource - cur);
      const add = Math.min(room, v ?? 0);
      buf[rk] = cur + add;
      if (add < (v ?? 0)) overflowKeys.push(p.key);
    }
    if (isMine && p.reserve !== undefined) consumed[p.key] = (consumed[p.key] ?? 0) + 1;
  }
  return { central: nextCentral, overflowKeys, depletedKeys, consumed };
}

export function payCost(stock: Stock, cost: Partial<Record<ResourceId, number>>): Stock {
  if (!canAfford(stock, cost)) throw new Error('Recursos insuficientes');
  const next = { ...stock };
  for (const [k, v] of Object.entries(cost)) {
    next[k as ResourceId] -= v ?? 0;
  }
  return next;
}

export interface ProductionJob {
  recipeId: string;
  edificio: BuildingId;
  progresoMs: number;
  duracionMs: number;
  /** Clave de instancia ("tx,ty"): cada edificio produce por separado. */
  key?: string;
}

export function createJob(edificio: BuildingId, recipeId: string, duracionMs: number): ProductionJob {
  return { recipeId, edificio, progresoMs: 0, duracionMs };
}

export function tickJob(stock: Stock, job: ProductionJob, deltaMs: number): { stock: Stock; job: ProductionJob; terminado: boolean } {
  const recipe = RECIPES.find((r) => r.id === job.recipeId);
  if (!recipe) throw new Error(`Receta desconocida: ${job.recipeId}`);
  const progresoMs = job.progresoMs + deltaMs;
  if (progresoMs < job.duracionMs) {
    return { stock, job: { ...job, progresoMs }, terminado: false };
  }
  // Al terminar: consumir entradas y producir salidas si hay stock suficiente.
  if (!canAfford(stock, recipe.entradas)) {
    return { stock, job: { ...job, progresoMs: job.duracionMs }, terminado: false };
  }
  let next = { ...stock };
  for (const [k, v] of Object.entries(recipe.entradas)) next[k as ResourceId] -= v ?? 0;
  for (const [k, v] of Object.entries(recipe.salidas)) next[k as ResourceId] += v ?? 0;
  return { stock: next, job: { ...job, progresoMs: 0 }, terminado: true };
}

/** Valor económico para bonus militar (estilo S4: a más economía, más fuerza fuera de territorio). */
export function settlementValue(stock: Stock, buildingCount: number, ornaments: number): number {
  const stockValue = Object.values(stock).reduce((a, b) => a + b, 0);
  return stockValue + buildingCount * 10 + ornaments * 20;
}

export function militaryStrengthFactor(settlementVal: number, enemyVal: number, fightingAtHome: boolean): number {
  if (fightingAtHome) return 1;
  const ratio = settlementVal / Math.max(1, enemyVal);
  return Math.min(1.5, Math.max(0.5, 0.7 + ratio * 0.3));
}
