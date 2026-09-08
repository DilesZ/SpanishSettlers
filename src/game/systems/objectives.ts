// Objetivos con recompensa (lógica pura, testeable).
import type { BuildingId, ResourceId } from '../data/buildings';

export interface ObjectiveDef {
  id: string;
  text: string;
  reward: Partial<Record<ResourceId, number>>;
}

export interface ObjectiveState {
  buildings: BuildingId[];
  army: number;
  wavesRepelled: number;
}

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'sawmill', text: 'Construye un aserradero', reward: { tablon: 4 } },
  { id: 'harbor', text: 'Construye un puerto', reward: { pez: 4 } },
  { id: 'army3', text: 'Recluta 3 soldados', reward: { espada: 2 } },
  { id: 'repel2', text: 'Rechaza 2 oleadas', reward: { oro: 5 } },
  { id: 'town10', text: 'Levanta 10 edificios', reward: { herramienta: 4 } },
];

export function isComplete(id: string, s: ObjectiveState): boolean {
  switch (id) {
    case 'sawmill': return s.buildings.includes('aserradero');
    case 'harbor': return s.buildings.includes('puerto');
    case 'army3': return s.army >= 3;
    case 'repel2': return s.wavesRepelled >= 2;
    case 'town10': return s.buildings.length >= 10;
    default: return false;
  }
}
