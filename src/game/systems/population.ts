// Población (lógica pura, testeable sin Phaser) — Fase 3.
// Vivienda = techo real (las casas dejan de ser decorado), la comida
// (pan + pescado) alimenta cada tick y la moral resultante mueve el
// crecimiento: con techo y comida llegan inmigrantes; con hambre o
// hacinamiento hay emigración. Ritmos calibrados al tick de 1s.

import type { BuildingId } from '../data/buildings';

export interface PopInput {
  population: number;
  housing: number;
  food: number;
}

export interface GrowthInput extends PopInput {
  morale: number;
}

/** Techo por edificio (el almacén también cobija al inicio). */
const HOUSING_BY_BUILDING: Partial<Record<BuildingId, number>> = {
  almacen: 10,
  residenciaS: 10,
  residenciaM: 20,
  residenciaL: 50,
};

export function housingFor(buildings: BuildingId[]): number {
  return buildings.reduce((acc, b) => acc + (HOUSING_BY_BUILDING[b] ?? 0), 0);
}

/** Moral 30..100: 30 base + 40 por techo + 30 por despensa. */
export function moraleOf(s: PopInput): number {
  const pop = Math.max(1, s.population);
  const housed = Math.min(1, s.housing / pop);
  const fed = Math.min(1, s.food / Math.max(1, pop * 0.2));
  return Math.round(30 + 40 * housed + 30 * fed);
}

/** Crecimiento en colonos por tick (1s). Positivo = inmigración. */
export function growthPerTick(s: GrowthInput, maxPop = 60): number {
  if (s.population >= maxPop) return 0;
  if (s.population > s.housing) return -0.02; // hacinamiento: se van
  if (s.population >= s.housing) return 0; // sin techo libre: estancado
  if (s.food <= 0) return -0.02; // hambre: se van
  return 0.02 * (0.5 + s.morale / 100);
}

/** Comida (pan/pescado) que la colonia consume por tick. */
export function foodPerTick(population: number): number {
  if (population <= 0) return 0;
  return population / 200;
}
