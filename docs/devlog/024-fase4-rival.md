# Devlog 024 — Fase 4: colonia rival con las mismas reglas

## Diseño
Una IA al otro lado de la isla que juega honesto: mismos costes, mismas
recetas, mismos productores y mismos costes de recluta. Crece por orden
de construcción, guarnece tropas y lanza incursiones; arrasar su almacén
da la victoria (simétrico a la derrota propia). Sus edificios viven en la
misma lista `placed` con `owner`, así que render, HP, minimapa y guardado
se reutilizan.

## Cambios
- **`systems/rival.ts` (nuevo, puro/testeable)**: `RIVAL_ORDER` (19) +
  `RIVAL_LATE` (rotación), `nextRivalBuild` (lo pendiente que pueda pagar,
  si no espera), `lateRivalBuild`, `rivalStartingStock` (finito),
  `findRivalBase` (tierra a 6-10 losetas con barrio libre).
- **`systems/economy.ts`**: `tickAutoProducers(stock, ids, tickNo)` puro
  (extraído de la escena sin cambiar conducta) + minas que comen 1 pan
  cada 4 ticks (con 1 pan/s ni jugador ni IA sostenían la cadena del
  metal: arreglo de balance compartido).
- **`GameScene`**: `Placed.owner` + `tryPlace(..., owner)`; jobs de receta
  por instancia (`key: "tx,ty"`, antes uno global por tipo); economía y
  vivienda/objetivos/inspección filtradas por bando; `Walker.faction`
  (colonos rivales deambulan su base) y `Enemy.side/mode`
  (incursor neutral / tropa rival en guarnición o incursión); director
  cada ~12s de pared (construir, cuadrilla visible, reclutar con
  `recruitCost`, incursión de hasta 3 cada ~75s); asedio del jugador a
  edificios rivales; victoria al caer su almacén; banderín rojo + `⚔` en
  nombres; guardado v4 (owner, aiStock); puente `status.rival/aiBase/ai`,
  `focus()` y `debugClick()` como hooks QA.
- **`play/page.tsx`**: chip "⚔ Rival: N" y distintivo "⚔ Rival" en la
  ficha; landing menciona a la IA.
- **Paneado manual**: los `cam.pan()` no se movían junto al control por
  velocidad (verificado por sonda: la cámara no llegaba); ahora
  `panTarget` interpolado en `update()` para minimapa, selección y `focus`.

## Verificación (TDD + sondas)
- `npm test`: 68/68 (nuevos `rival.test.ts`, productores, minas 1/4).
- `tsc` limpio, `build` OK, `playwright` 2/2.
- Sonda larga (~5 min, temporal, eliminada): rival 3→22 edificios a
  +1/12s; cadena del metal viva (pan 0-1, hierro→lingote→espada);
  tropas 0→2 y **incursión observada** (`raids: 1`); base con banderines
  y colonos propios en captura.
- Deuda: oleadas neutrales siguen a reloj de juego (en PC lentos llegan
  tarde; en 60 FPS van en hora); `GameScene` sigue pidiendo partición.
