// Niebla de guerra (lógica pura, testeable sin Phaser) — council exploración.
// Tres estados por loseta: 0 oculta, 1 explorada (vista antes, tenue),
// 2 visible (a la vista ahora). La mecánica no cambia (los caminantes ven
// igual); solo la información: construir e inspeccionar exigen haber visto.

export const HIDDEN = 0;
export const EXPLORED = 1;
export const VISIBLE = 2;

export type FogGrid = Uint8Array;

export function createFog(size: number): FogGrid {
  return new Uint8Array(size * size);
}

export function fogIdx(x: number, y: number, size: number): number {
  return Math.round(y) * size + Math.round(x);
}

export function fogAt(fog: FogGrid, size: number, x: number, y: number): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= size || iy >= size) return HIDDEN;
  return fog[iy * size + ix];
}

/**
 * Revela un círculo (euclídeo) como visible. Devuelve losetas que se ven
 * por primera vez (para el "¡rival avistado!" y % de mapa).
 */
export function revealCircle(
  fog: FogGrid,
  size: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  let fresh = 0;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const dx = tx - cx;
      const dy = ty - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = ty * size + tx;
      if (fog[i] === HIDDEN) fresh++;
      fog[i] = VISIBLE;
    }
  }
  return fresh;
}

/** Fin de tick: lo visible pasa a explorado (las fuentes re-revelan). */
export function settleFog(fog: FogGrid): void {
  for (let i = 0; i < fog.length; i++) {
    if (fog[i] === VISIBLE) fog[i] = EXPLORED;
  }
}

/** ¿Se puede construir / inspeccionar? Solo lo ya visto. */
export function isExplored(fog: FogGrid, size: number, x: number, y: number): boolean {
  return fogAt(fog, size, x, y) >= EXPLORED;
}

/** % del mapa visto alguna vez (HUD 🗺). */
export function exploredPercent(fog: FogGrid): number {
  if (!fog.length) return 0;
  let seen = 0;
  for (let i = 0; i < fog.length; i++) {
    if (fog[i] >= EXPLORED) seen++;
  }
  return Math.round((seen / fog.length) * 100);
}

export function serializeFog(fog: FogGrid): number[] {
  return Array.from(fog);
}

export function deserializeFog(data: unknown, size: number): FogGrid {
  const fog = createFog(size);
  if (!Array.isArray(data)) return fog;
  const n = Math.min(data.length, fog.length);
  for (let i = 0; i < n; i++) {
    const v = data[i];
    fog[i] = v === VISIBLE || v === EXPLORED ? v : HIDDEN;
  }
  return fog;
}
