# Devlog 010 — Fase 2B: Widelands en rama B (2026-09-07)

## Cambios
- `scripts/import-widelands.mjs`: importa 21 edificios + 8 workers de la
  tribu bárbara (`Temp/opencode/widelands`, fuera del repo) a
  `public/assets/wl/` + `src/game/data/wlArt.ts`. Descifrados los formatos:
  `idle_1.png` = spritesheet (frames/columns/rows/fps en init.lua),
  `idle_00.png` = frame único (ej. barracks 87×76), workers con tiras
  `walk_<dir>_<escala>.png` en rejilla columns×rows del init.lua.
- `GameScene` (B): carga sheets e imágenes wl, animaciones `wl-b-*` (edificios
  con idle animado: almacén, aserradero, granja, torre) y `wl-walk-*-e/w`
  (colonos direccionales este/oeste), ancla por hotspot oficial, escala por
  tamaño, iconos `menu.png` en el HUD, scaffold+humo+sonidos.
- `tests/unit/wl-art.test.ts` (4 casos): cobertura 21+8, hotspots, sheets,
  escalas acotadas, SFX.
- `docs/ATRIBUCION.md`: tabla completa de equivalencias.

## Verificación
- `npm test`: 17/17. `npm run build`: OK.

## Checkpoint
- Tag: `proto-b-fase2b`. Siguiente: Fase 3 (capturas + comparativa).
