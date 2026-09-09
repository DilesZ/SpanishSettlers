# Devlog 028 — Salto visual con 3 subagentes (terreno, luz, UI)

## Motivación
Las fases 1-4 mejoraron sistemas, pero la primera impresión seguía siendo
"juego 2D de los 2000". Tres subagentes en paralelo con ámbitos exclusivos
(terreno/agua, luz/atmósfera, UI) + integración del motor por el agente
principal, con comparativa de capturas antes/después.

## Cambios
- **Terreno y agua** (`scripts/make-terrain.mjs`, `src/game/fx/water.ts`):
  relieve pictórico por tile (luz/sombra, veta, guijarros, briznas,
  facetas en montaña, arena húmeda), agua con moteado de profundidad y
  destellos intra-tile, espuma de orilla por segmentos; se apaga el
  parpadeo legacy de tiles (`LEGACY_WATER_BLINK_ENABLED=false`).
- **Luz y atmósfera** (`src/game/fx/atmosphere.ts`, `GameCanvas.tsx`,
  `BootScene.makeAtmosphere`): faroles con halo+charco y parpadeo,
  luciérnagas, estrellas con titileo, nubes registradas con tinte
  día/noche, viñeta permanente, resplandor de horizonte al alba.
- **UI** (`play/page.tsx`, `HudPanels.tsx`, `BuildMenu.tsx`,
  `hud-icons.ts`, landing): cabecera con sigilo, barra de recursos con
  iconos, mapa enmarcado, objetivos con progreso, panel de población,
  guía del colono, muelle por categorías con tooltips, ficha de
  inspección, `alertdialog` de final. Mismos flujos y puente intactos.
- **Integración** (`GameScene`): `initWaterFX` + `initAtmosphere` +
  `updateSky` (sustituye el tinte manual) + `registerCloud` +
  `updateWaterFX`; paneado manual `panTarget` (los `cam.pan()` no se
  movían junto al control por velocidad: verificado por sonda).

## Verificación
- `npm test`: 77/77 (9 nuevos de atmósfera). `tsc` limpio, `build` OK,
  `playwright` 2/2.
- Capturas: día (`?dia=1`), noche (`?noche=1`, faroles preciosos), costa
  con zoom (espuma+destellos) y pueblo con zoom (edificios legibles).
  Falsa alarma documentada: la noche "no funcionaba" pero el overlay
  estaba a 0.42 (verificado por DOM); era error de apreciación.
- Capturas de la landing regeneradas con la nueva UI.

## Límites honestos
No es AAA 3D: el techo lo pone el sprite 2D (Widelands) y el truco de luz
(overlay+aditivos, sin GI). El salto es real pero dentro del 2D isométrico.
