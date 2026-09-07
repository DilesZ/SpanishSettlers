# Devlog 013 — Trigales, noche y humo (rama B, 2026-09-07)

## Cambios
- Trigales vivos: `WL_WHEAT` (5 etapas tiny→…→ripe→harvested) importadas;
  cada granja planta 3 parcelas que crecen cada 6 s y al cosecharse suman
  +1 grano visible en el HUD. `?noche=1` y `?dia=1` para forzar momento.
- Ciclo día/noche (4 min, `systems/daynight.ts` + tests): overlay en div HTML
  sobre el canvas (los overlays Phaser daban cobertura parcial con zoom),
  80 estrellas, faroles ADD en cada edificio que encienden de noche.
- Humo mejorado: doble penacho (halo + núcleo) con viento al este.
- Fauna: los terrestres evitan el agua (los patos sí nadan).
- `scripts/shoot.mjs`: diagnostica HTTP 4xx y estado del juego.

## Bugs cazados
- `ReferenceError: w` (variable borrada a medias) rompía `create()`.
- Overlay Phaser parcial: migrado a div HTML (`GameCanvas` lee `window.__sky`).

## Verificación
- `npm test`: 26/26. `npm run build`: OK. Capturas día + noche.
- Desplegado a https://spanish-settlers-b-dileszs-projects.vercel.app
