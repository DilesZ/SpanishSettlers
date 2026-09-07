// Ciclo día/noche (lógica pura, testeable). Periodo completo configurable.
// Fases: amanecer cálido -> día neutro -> atardecer naranja -> noche azul.
export interface SkyState {
  /** 0 = mediodía, 1 = medianoche */
  darkness: number;
  overlayColor: number;
  overlayAlpha: number;
  lanternAlpha: number;
  starsAlpha: number;
  isNight: boolean;
}

export const DAY_LENGTH_MS = 240000;

export function skyAt(elapsedMs: number, periodMs = DAY_LENGTH_MS): SkyState {
  const t = ((elapsedMs % periodMs) + periodMs) % periodMs / periodMs; // 0..1
  // curva de oscuridad: 0 en t=0.25 (mediodía), 1 en t=0.75 (medianoche)
  const darkness = Math.min(1, Math.max(0, 0.5 - 0.5 * Math.cos((t - 0.25) * Math.PI * 2)));
  const warm = Math.exp(-Math.pow((t - 0.0) / 0.06, 2)) + Math.exp(-Math.pow((t - 0.5) / 0.06, 2));
  const dawn = Math.min(1, warm);
  const overlayColor = darkness > 0.55 ? 0x0a1030 : dawn > 0.45 ? 0xd86a2e : 0x1a2450;
  return {
    darkness,
    overlayColor,
    overlayAlpha: darkness * 0.42 + dawn * 0.06,
    lanternAlpha: Math.min(1, Math.max(0, (darkness - 0.25) * 2)),
    starsAlpha: Math.min(1, Math.max(0, (darkness - 0.55) * 2.4)),
    isNight: darkness > 0.6,
  };
}
