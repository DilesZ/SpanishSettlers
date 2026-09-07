# Devlog 003 — Salto visual con arte original (2026-09-07)

## Aclaración legal
El usuario pidió "clonar los assets y después modificarlos".
**Rechazado**: copiar sprites/música/nombres de The Settlers IV (Ubisoft/Blue Byte)
infringiría copyright aunque sea temporal. En su lugar se subió la calidad con
**arte 100% original generado por código** + dirección "terracota ibérica".

## Cambios
- `BootScene` reescrita: 8 tiles con moteado (hierba x3, arena, agua x2 animada,
  bosque, montaña), deco (pino, roble, roca, flores, sombra), 7 personajes
  (colono, leñador con hacha, portador con saco, soldado con espada, arquero,
  minero, pescador) y 20 edificios isométricos originales (muros encalados,
  entramado, tejados rojizos, torre con almenas+bandera, molino con aspas,
  andamio de obra).
- `GameScene`: usa texturas por edificio, decoración por bioma, agua animada
  (alterna frames cada 700ms), andamio que se desvanece, humo en industrias,
  población por oficios (17), hover con tinte, bloqueo de construir en agua,
  hints de obra/recursos, HUD con iconos.
- Fix TS: `speckles: [number,number,number][]`.

## Verificación
- `npm test`: 8/8 verde. `npm run build`: OK (`/`, `/play` estáticas).
- Smoke anterior `localhost:3000` HTTP 200 (reabrir `/play` para ver el cambio).

## Checkpoint
- Tag previsto: `v0.5.0-visual`.
