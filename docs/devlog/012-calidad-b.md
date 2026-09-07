# Devlog 012 — B sube de nivel: naturaleza, fauna, obras e iconos (2026-09-07)

## Cambios (rama B, todo GPL según ATRIBUCION.md)
- `import-widelands.mjs` ampliado: 3 árboles (alder/birch/beech, sheet 2×2 con
  balanceo), 6 rocas greenland, 5 arbustos, 4 critters (bunny/deer/sheep/duck
  direccionales), 16 iconos de recursos (`menu.png` de cada ware), etapas de
  construcción `build_1.png` (16/21 edificios) y cargas de portador
  (`walkload_e/w`).
- `GameScene`: `decorate()` con WL (árboles animados, rocas, arbustos),
  `spawnCritters()` + `wanderCritter()` (patos junto al agua), portadores que
  alternan vacío/cargado, obra que muestra el sheet de construcción oficial y
  revela el edificio al terminar, HUD con iconos `res-*`.
- `BootScene`: retirados pine/oak/rock/flowers procedurales sin uso.
- `tests/unit/wl-art.test.ts` (8 casos): nature, fauna, iconos, builds.

## Verificación
- `npm test`: 21/21. `npm run build`: OK.
- Capturas local + producción: obras, fauna, iconos y rocas confirmados.
- Desplegado a https://spanish-settlers-b-dileszs-projects.vercel.app
