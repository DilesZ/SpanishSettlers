# 039 — Sin guía + pantalla completa

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).

## Cambio
- Fuera la Guía del colono y su aside: grid a 2 columnas en xl (`300px | mapa`); misiones siguen bajo el mapa a ancho completo.
- Botón ⛶ en el marco del mapa: Fullscreen API sobre la sección (Phaser `RESIZE` se adapta solo); ESC sale; estado `aria-pressed` sincronizado con `fullscreenchange`.

## Test / build
- 161 unit, tsc limpio, build OK, e2e 2/2, lint sin errores nuevos.

## Siguiente paso
- R2 del council.
