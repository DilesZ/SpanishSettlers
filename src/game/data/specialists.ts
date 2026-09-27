// Especialistas (idea del género, expresión propia): colonos entrenados con
// oficio. Reusan sprites de colonos teñidos; la tarea vive en Walker.task.
// Nada de razas ni nombres del original: geólogo, pionero y ladrón genéricos.

import type { ResourceId } from './buildings';

export type SpecialistTask = 'geologo' | 'pionero' | 'ladron';

/** Tareas especiales de caminante (incluye explorador). */
export type WalkerTask = SpecialistTask | 'scout';

export interface SpecialistDef {
  task: SpecialistTask;
  label: string;
  glyph: string;
  descripcion: string;
  coste: Partial<Record<ResourceId, number>>;
  tope: number;
  /** Sprite base (rol con animaciones existentes). */
  base: string;
  tint: number;
  speed: number;
}

export const SPECIALISTS: Record<SpecialistTask, SpecialistDef> = {
  geologo: {
    task: 'geologo', label: 'Geólogo', glyph: '🔨',
    descripcion: 'Busca vetas pobres y las recarga (+12, tope 30).',
    coste: { herramienta: 1, pan: 1 }, tope: 3,
    base: 'miner', tint: 0xffe08a, speed: 70,
  },
  pionero: {
    task: 'pionero', label: 'Pionero', glyph: '⛏',
    descripcion: 'Cava en la frontera y expande el territorio.',
    coste: { herramienta: 1, pan: 2 }, tope: 4,
    base: 'settler', tint: 0x9fca8f, speed: 75,
  },
  ladron: {
    task: 'ladron', label: 'Ladrón', glyph: '🕶',
    descripcion: 'Roba al rival y revela su zona. Rápido y sigiloso.',
    coste: { pan: 2 }, tope: 3,
    base: 'settler', tint: 0x8a8aa0, speed: 95,
  },
};

export const SPEC_TASKS = Object.keys(SPECIALISTS) as SpecialistTask[];
