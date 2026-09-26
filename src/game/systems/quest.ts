// Quest de onboarding en 3 pasos (lógica pura, testeable) — R1.
// Enseña la primera cadena jugando: cabaña → tablón → oleada 1.
// Sin estado propio: se deriva de la partida (idempotente, migra sola).

import type { BuildingId } from '../data/buildings';

export interface QuestStep {
  id: string;
  text: string;
  done: boolean;
  target: BuildingId | null;
}

export interface QuestState {
  /** Primer paso pendiente (0-2) o 3 = completada. */
  step: number;
  complete: boolean;
  /** Edificio a resaltar en el BuildMenu (null al completar). */
  target: BuildingId | null;
  steps: QuestStep[];
}

export function questState(
  placedIds: BuildingId[],
  tablon: number,
  wavesRepelled: number,
): QuestState {
  const has = (id: BuildingId) => placedIds.includes(id);
  const steps: QuestStep[] = [
    {
      id: 'cabana',
      text: 'Construye una cabaña de leñador',
      done: has('cabanaLenador'),
      target: 'cabanaLenador',
    },
    {
      id: 'tablon',
      text: 'Produce 1 tablón en el aserradero',
      done: has('aserradero') && tablon >= 1,
      target: 'aserradero',
    },
    {
      id: 'oleada',
      text: 'Repele la oleada 1',
      done: wavesRepelled >= 1,
      target: null,
    },
  ];
  const step = steps.findIndex((s) => !s.done);
  const complete = step === -1;
  return {
    step: complete ? 3 : step,
    complete,
    target: complete ? null : steps[step].target,
    steps,
  };
}
