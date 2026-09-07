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
