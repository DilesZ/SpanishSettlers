// SpanishSettlers — helpers visuales del HUD (solo presentación).
// La lógica de PACK/iconos/fallback es la misma que usaba src/app/play/page.tsx:
// pack 'b' (arte wl commiteado) por defecto en local para evitar 404s.

import type { SyntheticEvent } from 'react';
import type { BuildingId, ResourceId } from '@/game/data/buildings';

export const PACK = process.env.NEXT_PUBLIC_PACK === 'a' ? 'a' : 'b';

export const ORDER: BuildingId[] = [
  'cabanaLenador', 'aserradero', 'cantera', 'residenciaS', 'residenciaM', 'residenciaL',
  'granja', 'molino', 'panaderia', 'pozo', 'pesqueria',
  'minaCarbon', 'minaHierro', 'minaOro', 'fundicion', 'herreria', 'armeria',
  'cuartel', 'torre', 'ornamento',
  ...(PACK === 'b' ? ['puerto' as BuildingId] : []),
];

export const iconFor = (id: BuildingId) =>
  PACK === 'b' ? `/assets/wl/icons/${id}.png` : `/assets/buildings/icons/${id}.png`;

export const iconFallback = (id: BuildingId) =>
  PACK === 'b' ? `/assets/buildings/icons/${id}.png` : `/assets/wl/icons/${id}.png`;

export const resIconFor = (k: ResourceId) =>
  PACK === 'b' ? `/assets/wl/icons/res-${k}.png` : null;

// Mismo comportamiento que el onError-fallback original: un solo reintento
// con la ruta alternativa; con fb='' no hace nada (guardia `&& fb`).
export const onImgFallback = (fb: string) => (e: SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  if (!t.dataset.fb && fb) {
    t.dataset.fb = '1';
    t.src = fb;
  }
};

export type CategoryId =
  | 'todos'
  | 'base'
  | 'madera'
  | 'piedra'
  | 'comida'
  | 'mina'
  | 'industria'
  | 'militar'
  | 'mar'
  | 'decoracion';

export const CATEGORIES: { id: CategoryId; label: string; glyph: string }[] = [
  { id: 'todos', label: 'Todo', glyph: '✦' },
  { id: 'base', label: 'Base', glyph: '🏠' },
  { id: 'madera', label: 'Madera', glyph: '🪓' },
  { id: 'piedra', label: 'Piedra', glyph: '⛰' },
  { id: 'comida', label: 'Comida', glyph: '🌾' },
  { id: 'mina', label: 'Minas', glyph: '⛏' },
  { id: 'industria', label: 'Industria', glyph: '⚙' },
  { id: 'militar', label: 'Militar', glyph: '⚔' },
  { id: 'mar', label: 'Mar', glyph: '⚓' },
  { id: 'decoracion', label: 'Ornato', glyph: '🌳' },
];
