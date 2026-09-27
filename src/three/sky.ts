// Cielo procedural 3D (migración 3D, coste cero).
// El sol orbita con el mismo ciclo día/noche del 2D (daynight.skyAt).

import { skyAt } from '@/game/systems/daynight';

export interface SunAngle { elev: number; azim: number }

/** Elevación (rad, negativa de noche) y azimut del sol. */
export function sunAngle(elapsedMs: number, periodMs: number): SunAngle {
  const t = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  // Mediodía en t=0.25, medianoche en t=0.75 (igual que skyAt).
  const dayPhase = (t - 0.25) * Math.PI * 2;
  const elev = Math.cos(dayPhase) * 1.1 - 0.15;
  const azim = t * Math.PI * 2;
  return { elev, azim };
}

/** 0 = pleno día, 1 = medianoche (para luces y faroles). */
export function nightFactor(elapsedMs: number, periodMs = 240000): number {
  return skyAt(elapsedMs, periodMs).darkness;
}
