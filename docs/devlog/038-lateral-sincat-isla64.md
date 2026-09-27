# 038 — Misiones abajo, sin categorías, isla 64

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).

## Cambio
- Misiones bajo el mapa: `ColonyPanel` a ancho completo tras el grid; el lateral queda solo con la guía.
- BuildMenu sin pestañas: lista única en `ORDER` (una columna en el lateral xl por CSS, una sola instancia montada).
- Isla 28/40→64 (4096 losetas): umbrales proporcionales ya existían; regenerado `isla-01.json`; cámara, minimapa proporcional, A* 12000 iters, base rival proporcional. `deserializeFog` descarta rejillas de otro tamaño (niebla nueva, no calco movido). Tests 3D sin números fijos (venía de 037, se mantiene).

## Test / build
- 161 unit, tsc limpio, build OK, e2e 2/2, lint sin errores nuevos.

## Siguiente paso
- R2 del council o rendimiento en isla 64 (niebla 4096 elipses/tick, espuma) si se nota pesado.
