# Devlog 022 — Fase 2: caminos, logística visible y economía a reloj de pared

## Diseño
Red vial pintable (gratis, estilo S4): los colonos la prefieren (A*
ponderado) y van ×1.5 sobre ella. Producción bloqueada visible en el mundo
(⚠ flotante), en la ficha (faltantes) y en una franja de alertas en React.

## Cambios
- **`systems/roads.ts` (nuevo, puro/testeable)**: `RoadNet` (Set de
  `"x,y"`), `tileCost` (1 en camino / 4 campo a través),
  `ROAD_SPEED_BONUS = 1.5`, vecinos ortogonales, serialización con
  normalización a la rejilla.
- **`systems/pathfinding.ts`**: `findPath` acepta `costFn` opcional
  (por defecto 1: comportamiento anterior intacto).
- **`systems/economy.ts`**: `missingInputs()` (qué falta para una receta).
- **`GameScene`**: herramienta Camino (clic alterna, arrastrar pinta, ESC
  termina), decals de tierra conectada (base con borde + salientes a
  vecinos), `sendWalker` pondera caminos (la fauna no), bonus de velocidad
  sobre camino, marcas ⚠ con `stallInfo`, puente `road()/stalls()`,
  `inspect` con `faltan` y `produciendo` real, guardado v2 con caminos,
  `debugClick()` como hook QA.
- **`play/page.tsx`**: botón 🛤 Camino, franja "⚠ Producción parada" y
  faltantes en la ficha.
- **Correcciones encontradas por QA visual/sondas Playwright**:
  - Economía a reloj de pared: a 3.8 FPS (SwiftShader) el `TimerEvent` de
    1s disparaba ~1 vez/20s y la economía se paraba; ahora el acumulador en
    `update()` con `performance.now()` tiquea 1/s real con tope
    anti-espiral (ver `econAcc/econLast`). Mejora también PC lentos.
  - Cámara inicial al HQ (`iso(center)` en vez de `(0,450)` que dejaba el
    almacén fuera de vista); minimapa alineado.
  - `tryPlace` ahora valida (ocupada / terreno / agua) y no pierde recursos
    en colocaciones inválidas; un edificio absorbe el camino bajo él.
  - Losetas normalizadas con `Math.round` en entradas (clics, drag,
    `tryPlace`, caminos, carga de guardados).
  - Se elimina la cantera duplicada (capa Lógica + `placeExtraInitial`
    apilaban doble producción de piedra).
- Deuda documentada (no se toca): la rejilla lógica del pueblo tiene un
  desplazamiento sistemático de ~1 loseta respecto a la nominal de
  `gen-map.mjs` (`worldToTileXY` del vértice del diamante); es
  autoconsistente y no afecta al juego. Candidata a la refactorización de
  `GameScene`.

## Verificación (TDD + sondas)
- `npm test`: 55/55 (nuevo `roads.test.ts` + costes en A* + `missingInputs`).
- `tsc` limpio, `build` OK, `playwright` 2/2.
- Sonda E2E (script temporal, eliminado): construir fundición por UI →
  1 ciclo exacto (hierro 2→0, carbon 2→1, lingote +1) → ⚠ + franja
  "Fundición: falta hierro" estables; caminos pintados por drag visibles.
- Capturas `shot-dia/noche.png` regeneradas (nuevo encuadre al HQ).
