# 035 — UI y mapa puros

- Fecha: 2026-09-27 · Rama: `proto-b-widelands`.
- Objetivo: pureza visual sin cambiar ni un texto ni una mecánica.

## Cambio
- `components/ui.tsx` (nuevo): `Card`, `SectionTitle`, `Chip`, `Warn` — una sola tarjeta/pastilla/título/aviso para todo el HUD.
- `HudPanels`: ColonyPanel, SpeedControl e InspectCard usan primitivas (adiós `CARD` duplicado, degradados y sombras bespoke; radios a `rounded-2xl`).
- `BuildMenu`, `/play` (marco de mapa, guía) y landing: mismo borde/sombra/radio; landing sin `shadow-lg` sueltos.
- `globals.css`: foco visible ámbar + selección a juego + `color-scheme: dark`.
- Mapa (solo constantes): niebla 0.62/0.28→0.55/0.22, bandas de borde −0.05, territorio 0.06→0.05, hover 0.9→0.75.

## Test / build
- 155 unit, tsc limpio, build OK, **e2e 2/2** (landing + ficha de edificio), lint sin errores nuevos.

## Decisión
- Puro = tokens, no gusto: si un panel necesita otro radio/sombra, se añade a `ui.tsx`, no inline.

## Siguiente paso
- Maná/sacerdote genérico o gating cantera↔rocas.
