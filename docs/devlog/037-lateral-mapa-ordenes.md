# 037 — Lateral, mapa grande y órdenes directas

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).

## Cambio
- Construcción al lateral: grid `300px | mapa | 340px` en xl (una sola instancia de `BuildMenu`, 1 columna por CSS en lateral); en el resto va bajo el mapa. Guía renumerada + tip de órdenes.
- Mapa 28→40 (1600 losetas): umbrales de terreno proporcionales (`island.ts` + `gen-map.mjs` + JSON regenerado), cámara, minimapa proporcional, A* 8000 iteraciones, base rival a distancia proporcional. Tests 3D (height/vegetation) sin números fijos.
- Colonos punto a punto: clic en colono + clic en destino = orden directa (anillo + hint + ESC); patrullas encadenadas (60% sigue andando); selección se limpia al morir/cargar/ESC.
- e2e `inspect`: clic al centro del canvas (el fijo 640,300 caía fuera con el lateral).

## Test / build
- 161 unit, tsc limpio, build OK, e2e 2/2, lint sin errores nuevos.

## Siguiente paso
- R2 del council (maná o recorte de recursos) o pulir órdenes (arrastrar para patrulla).
