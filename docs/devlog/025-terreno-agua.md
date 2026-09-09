# Devlog 025 — Terreno rico + FX de agua (sin parpadeo)

## Objetivo
Salto visual del suelo y el agua del mapa isométrico (diamantes 132x66,
28x28): romper el plano liso, dar relieve legible y sustituir el parpadeo
de tiles de `animateWater` (gid 6 <-> 7) por destellos/ondas baratos con
tweens. Profundidades respetadas: suelo 0, espuma 50, destellos 51,
ondas 52, caminos 90, decoración 100+.

## Cambios
- **`scripts/make-terrain.mjs` (reescrito por dentro, misma salida)**:
  rejilla 5x2 de 132x66 y mismos 10 GIDs en el mismo orden
  (`grass, grassB, grassC, dirt, sand, water, waterB, waterC, forest,
  mountain`). Novedades por tipo:
  - Común: relieve radial centrado (luz cenital + sombra inferior, nunca
    trazos en el borde), moteado + **grano de dos octavas** (fino nítido
    para zoom + grueso suave). Los moteados se atenúan cerca del borde
    (`edgeFade`) para que NO aparezca rejilla entre tiles iguales.
  - Hierba/bosque: ~70 **briznas** por tile + chinas; bosque con
    sotobosque oscuro y agujas.
  - Tierra: chinas con luz/sombra (guijarros) + vetas.
  - Arena: hondonada húmeda centrada al sur (se difumina antes de las
    esquinas) + granos claros tipo conchita.
  - Agua: **moteado de profundidad** azul oscuro + vetas claras +
    **26 destellos** intra-tile (3 tonos sin necesidad de contexto).
  - Montaña: facetas de roca N iluminada / S en sombra + **7 grietas con
    realce** (línea oscura + eco claro) + pedrera.
  - `foam-{ne,se,sw,nw}.png`: banda ancha suave + núcleo nítido + encaje
    discontinuo de 11 segmentos + 16 burbujas deterministas por borde.
- **`public/assets/terrain-sheet.png` + `foam-*.png` regenerados** con
  `node scripts/make-terrain.mjs` (determinista, seed fijo). Sheet 660x132,
  espumas 132x66. Verificado con `terrain.test.ts` en verde.
- **`src/game/fx/water.ts` (nuevo)**: API mínima
  - `LEGACY_WATER_BLINK_ENABLED = false`, `MAX_WATER_FX = 30`,
    `WATER_FX_DEPTHS = { foam: 50, sparkle: 51, ripple: 52 }`.
  - `isWaterKey(t)`, `pickSparkleCells(cells, max, seed)` (puro,
    determinista, sin Phaser).
  - `initWaterFX(scene, waterCells, iso, opts?)`: destellos persistentes
    (elipses, tween `Sine.easeInOut` yoyo, hasta la mitad del presupuesto)
    + generador de ondas transitorias (elipse que se expande y se
    desvanece en ~1.2-1.9s, 1-2 por pulso de 1100ms). Nunca más de 30
    objetos vivos. Devuelve `WaterFX` con `stop()` idempotente.
  - `updateWaterFX(fx?, dt?)`: no-op intencionado (todo lo mueven tweens
    y el temporizador); gancho estable para el integrador.
  - Solo APIs Phaser 3.90 (`add.ellipse`, `tweens.add`, `time.addEvent`);
    `import type Phaser` para no arrastrar runtime (vitest en node OK).

## Integración en GameScene (para el integrador, escena SOLO-lectura aquí)
Ver bloques exactos en el mensaje de entrega: importar el módulo, añadir
campo `waterFX`, sustituir el `time.addEvent(700ms, animateWater)` por
guardia + `initWaterFX`, comentar `placeSparkles()`, guardar
`animateWater()` con retorno temprano y llamar `updateWaterFX()` al final
de `update()`.

## Verificación
- `npx tsc --noEmit` limpio.
- `npm test`: 68/68 (vitest), incluidos `tilemap.test.ts` y
  `terrain.test.ts` sin cambios.
- PNG: sheet 660x132 (~75KB), espumas 132x66.
- Sin servidores arrancados.

## Licencia / atribución
Arte 100% original y procedural (`make-terrain.mjs` + primitivas Phaser en
`water.ts`). Nada copiado de terceros ni de The Settlers IV. No se toca el
arte Widelands (GPL, ver `docs/ATRIBUCION.md`); el terreno común sigue
siendo obra propia como ya indicaba la atribución.

## Limitaciones conocidas
- Sin sombreado por contexto (orilla→profunda real exigiría autotiling o
  capa de sombras por vecino; el moteado intra-tile solo lo sugiere).
- Las ondas son elipses planas, sin normal maps ni reflejos de edificios.
- `updateWaterFX` es no-op: si se quiere oleaje atado a cámara/tiempo habrá
  que implementarlo.
- El relieve es pictórico (dentro del diamante), sin geometría ni altura
  de juego: no afecta a pathfinding ni a profundidades de edificios.
