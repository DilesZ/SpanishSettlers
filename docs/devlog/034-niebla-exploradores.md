# 034 — Niebla de guerra + exploradores (council exploración)

- Fecha: 2026-09-27 · Rama: `proto-b-widelands`.
- Objetivo: explorar para expandirse (S4: geólogo/pionero/niebla antes que más edificios).

## Cambio
- `systems/fog.ts` (nuevo): oculta/explorada/visible, `revealCircle`, `settleFog`, `isExplored`, `% explorado`, serialización.
- `GameScene`: la base empieza vista (r8); edificios (r5, almacén r7) y caminantes (r3, scouts r6) re-revelan cada tick; construir/caminos/inspeccionar exigen loseta vista (🌫 hint).
- Exploradores: 2 iniciales + 1 por torre (tope 6), rápidos, teñidos, buscan lo oculto; excluidos de recluta/emigración; persisten en guardado.
- Rival: el aviso "otra colonia" ahora salta al avistar un edificio rival de verdad (adiós temporizador 25 s).
- Guardado v6 (niebla + scouts + avistado; v5 migra re-explorando la base). HUD 🗺 % + guía paso 6.

## Test / build
- 155 unit (fog 4), tsc limpio, build OK. Lint: 0 errores nuevos.

## Decisión
- Niebla solo-información (la sim no cambia: pathfinding y combate intactos). Sin arte nuevo (scout = settler teñido).

## Siguiente paso
- Maná/sacerdote genérico o gating cantera↔rocas.
