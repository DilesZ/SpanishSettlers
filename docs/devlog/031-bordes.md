# Devlog 031 — Bordes de terreno con relieve

## Motivación
Cada loseta terminaba de golpe en su vecina: la arena cortaba contra el
agua, la hierba contra el bosque y la tierra contra la montaña. Sin
geometría 3D, la forma barata de sugerir relieve es una banda de sombra
suave en la loseta baja, del lado del vecino alto (orilla húmeda,
sotobosque, sombra de peña).

## Cambios
- **NUEVO `src/game/fx/edges.ts`** (lógica pura + dibujado, 100% original):
  - `computeEdges(terrain, size)`: escaneo 4-vecindad determinista que
    devuelve `{tx,ty,kind}[]` con `kind ∈ shore | treeshade | cliffshade`.
    Receptores: `shore` = arena junto a agua; `treeshade` = hierba/tierra
    junto a bosque; `cliffshade` = tierra/arena/bosque junto a montaña.
    Prioridad ante solape: `cliffshade > treeshade > shore`; como máximo
    una banda por loseta; fuera de mapa se ignora.
  - `edgeDirFor` / `edgeScreenAngle`: dirección al vecino relevante (sur
    primero, el frente visible en iso) y ángulo pantalla con la misma
    matemática que los stubs de caminos (`atan2` del desplazamiento iso).
  - `placeEdges(scene, list, iso)`: una imagen estática por loseta con la
    textura BootScene correspondiente, desplazada ~1/4 hacia el vecino y
    rotada hacia él (`setRotation`, como `renderRoadTile`). Alfa sutil
    (0.3-0.4) y depth 20/30/35: entre suelo (0) y espuma (50), sin tapar
    caminos (90) ni decor (100+). Sin tweens ni update.
- **EDIT `src/game/scenes/BootScene.ts`** (solo añadidos): `makeEdges()`
  genera `shore-shade` (azulada húmeda), `forest-shade` (verde oscura) y
  `cliff-shade` (gris pizarra) como elipses concéntricas de 64x32; ninguna
  función existente tocada.
- **NUEVO `tests/unit/edges.test.ts`**: 11 casos (receptores, prioridad,
  solo-4-vecinos, bordes de mapa, determinismo y orden, tope 1/loseta en
  la isla real, dirección sur-primero, matemática iso).

## Integración (pendiente del motor: GameScene es solo-lectura aquí)
Ver sección "Instrucciones de integración" en el mensaje de entrega: una
llamada en `buildTilemap()` tras `placeFoam()`.

## Verificación
- `npx tsc --noEmit` limpio y `npm test` en verde (incluye los 11 nuevos).

## Límites honestos
Es un truco 2D, no geometría: con zoom alto la elipse rotada se adivina
como mancha. La arena junto a bosque no recibe banda (decisión: las
palmeras ya visten esa orilla) y dos vecinos opuestos solo sombrean un
lado (el sur). Si algún día el mapa deja de salir de `terrainAt`, pasar
la `terrainFn` real como 4.º argumento de `placeEdges`.
