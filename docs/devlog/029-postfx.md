# Devlog 029 — PostFX fílmico barato (gradación, sombras, glow)

## Motivación
Acabado fílmico sin cambiar arte ni añadir assets: gradación de color global
sutil, sombras direccionales coherentes con una luz del noroeste y un
bloom/glow barato en selección y fantasma. Todo con texturas procedurales ya
generadas en `BootScene` y con degradación limpia a Canvas (renderer AUTO).

## Cambios
- **NUEVO `src/game/fx/postfx.ts`** (solo `import type Phaser`, 100% original):
  - `initCameraGrade(scene)`: `camera.postFX.addColorMatrix()` sobre
    `cameras.main` (NO el minimapa) con saturar ~1.08 (`saturate(0.12)`),
    contraste ~1.04 (`contrast(0.04)`) y lift cálido (+R/+G, −B leve).
    Idempotente; en Canvas o sin `postFX` real devuelve `false` sin tocar nada.
  - `setNightGrade(scene, on)`: re-aplica la matriz del MISMO controlador
    (plan noche: desaturación leve + lift azul). Sin reallocs; no-op si no
    hubo grade.
  - `attachBuildingShadow(container, w, h)`: imagen `soft-shadow` (fallback
    `shadow`) al sureste (+14% W, +5% H), elipse ancha, alpha 0.35, insertada
    en índice 0 del container. El integrador la SUSTITUYE por la sombra
    centrada actual de `tryPlace` (no la complementa).
  - `selectGlow(scene, x, y)` / `discardSelectGlow`: halo `lantern-halo`
    (fallback `glow`) en ADD bajo el anillo (depth 9489 < 9490), un solo
    tween pulsante. El anillo es `Graphics` y NO admite postFX: por eso es
    sprite.
  - `glowGhost(scene, ghost, ok)`: `postFX.addGlow` verde/rojo sobre el
    fantasma (es `Image`, sí admite postFX), solo cuando `ok` cambia; en
    Canvas no-op (el `setTint` existente ya basta).
  - `shutdownPostFx(scene)`: olvida el estado y resetea pipelines de cámara.
  - Puro y testeado: `gradePlan`, `applyGradeMatrix`, `shadowLayout`,
    `pickFxTexture`, `isWebGLType`/`isWebGLScene`.
- **NUEVO `tests/unit/postfx.test.ts`**: 19 casos (planes día/noche,
  secuencia de matriz, geometría SE, fallbacks, no-ops Canvas, idempotencia,
  un-solo-tween, glow   solo-al-cambiar, shutdown).

## Integración (GameScene sigue siendo solo-lectura aquí)
Ver instrucciones exactas en el mensaje de entrega: import + 1 llamada en
`create()`, sustitución de 1 línea en `tryPlace()`, 3 líneas en
`showSelectRing`/`hideSelectRing`/`updateGhost` y 1 línea en `skyTick()`.

## Verificación
- `npx tsc --noEmit` limpio y `npm test` en verde (incluye los 19 nuevos).
- Servidores: no arrancados (verificación solo estática + unitaria).
