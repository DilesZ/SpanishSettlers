# Devlog 009 — Fase 2A: catálogo HD + marcha + audio (rama A, 2026-09-07)

## Cambios
- `scripts/make-buildings.mjs`: 21 edificios SVG→PNG 128px originales
  (gradientes, tejas individuales, entramado, puertas en arco, carteles,
  bocaminas con vagoneta, horno incandescente, torre almenada, fuente) +
  `mill-blades.png` + `icons/*.png` 30×30 + `buildings.json` y
  `src/game/data/buildingArt.ts` (manifest: humo, brillos, aspas).
- `scripts/make-people.mjs`: 8 oficios × 3 frames de marcha (26×28).
- `BootScene`: solo deco/props/FX; `GameScene` carga los PNG, crea
  animaciones `walk-<rol>`, colonos como Sprites, humo/brillos/aspas desde
  el manifest, iconos en el menú de `/play`.
- `src/game/audio.ts` + 6 SFX Kenney CC0: click/select/confirm/error/chop/sword.
- `src/game/data/roles.ts`: lista de oficios sin importar Phaser (testeable).
- `tests/unit/buildings-art.test.ts`: 21 PNG + iconos + manifest, 24 frames,
  6 ogg.

## Bug importante cazado
Las rutas de `preload` eran relativas (`assets/...`) y desde `/play` el
navegador pedía `/play/assets/...` → 404 silenciosos: **los PNG nunca
cargaban** (por eso se veían solo puntos). Todo a rutas absolutas `/assets/…`.

## Verificación
- `npm test`: 16/16. `npm run build`: OK.

## Checkpoint
- Tag: `proto-a-fase2a`. Queda Fase 2B (Widelands en B) y comparativa.
