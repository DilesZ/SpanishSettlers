# Devlog 030 — Clima y VFX de juego (2026-09-09)

## Objetivo
Mundo vivo: chubascos periódicos con cortina de lluvia y salpicaduras, más
VFX de construcción, impactos, cosecha y reclutamiento. Sin tocar GameScene
(lo integra otra persona) ni BootScene (no hizo falta).

## Cambios
- NUEVO `src/game/fx/weather.ts` (solo `import type` de Phaser):
  - `initWeather(scene, iso, { waterCells })`: programa chubascos cada 3-6
    min (primero a los ~90 s). Con lluvia: nubes registradas teñidas gris
    (`0x8f9bb0`), cortina de Rectangles finos en diagonal (máx. 40 vivos),
    anillos de salpicadura en el suelo (máx. 24) y ondas extra sobre el agua
    (máx. 12). Al escampar TODO se destruye y las nubes recuperan su tinte.
  - `?lluvia=1` en la URL (mismo patrón que `?dia=1`/`?noche=1`/`?demo=`):
    llueve desde el inicio (~1.5 s). Publica `window.__weather` para QA.
  - `registerWeatherCloud(scene, cloud)` por nube + auto-descubrimiento por
    textura `'cloud'` como fallback. `stopWeather(scene)` idempotente.
  - Puras y testeadas: `isRainForced`, `nextShowerDelayMs`, `showerDurationMs`.
  - water.ts NO se toca: no expone ningún generador de ondas reutilizable,
    así que las ondas de lluvia son elipses propias y acotadas.
- NUEVO `src/game/fx/vfx.ts` (solo `import type`):
  - `dustBurst(scene,x,y,{count?})`, `builtBurst(scene,x,y)`,
    `hitFlash(target)` (la escena sale de `target.scene`; vale para sprites
    Y contenedores como los edificios), `recruitRing`, `harvestSparkle`,
    `smokeColumn`. Todo con `glow`/`shadow`/círculos + tweens acotados
    (ningún `repeat: -1`); 1-11 objetos por llamada, vida < 1.2 s.
- NUEVO `tests/unit/weather.test.ts` (8) y `tests/unit/vfx.test.ts` (8).
- BootScene SIN cambios: no se necesitó ninguna textura nueva (la lluvia usa
  la primitiva Rectangle y los VFX `glow`/`shadow`/círculos existentes).

## Integración (para quien toque GameScene.ts)
Ver bloques exactos en el mensaje de entrega: imports, campo `weather`,
`initWeather` + `stopWeather` en create(), `registerWeatherCloud` en
setupAmbient, `builtBurst` en tryPlace-onComplete, `hitFlash`×2 +
`smokeColumn` en combatTick, `dustBurst`+`smokeColumn` en destroyBuilding,
`dustBurst` en killEnemy, `harvestSparkle` en wheatTick, `recruitRing`×2
en recruit. Nada existente se borra: solo líneas AÑADIDAS.

## Verificación
- `npx tsc --noEmit` limpio.
- `npm test` en verde: 104/104 (16 nuevos).
- No se arrancan servidores. Sin assets de terceros: todo procedural.
- Capturas con lluvia: `/?lluvia=1` (combinable con `?dia=1`).
