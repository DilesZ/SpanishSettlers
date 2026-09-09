# Devlog 021 — Fase 1: cámara suave, terreno rico, HUD único (auditoría visual)

## Motivación
Auditoría visual completa del proyecto (Fase 0): el juego ya era un RTS
funcional (22 edificios, 16 recursos, oleadas, puerto, día/noche, guardado),
pero la presentación tenía fugas de calidad moderna:
- Rejilla del terreno visible (trazo oscuro por loseta) y tiles planos.
- HUD duplicado: barra de recursos en Phaser + barra en React superpuestas.
- `createCursorKeys()` creado en cada frame + cámara rígida sin inercia.
- `pixelArt:true` con arte pictórico Widelands (aliasing en zoom).
- Pack de iconos 'a' por defecto en local: ~40 × 404 con parpadeo de fallback.

## Cambios
- **Cámara suave** (`GameScene`): velocidad con inercia exponencial, zoom
  interpolado anclado al cursor (rueda = objetivo), teclas Q/E para zoom,
  edge scrolling con armado tras el primer `pointermove` real, `pan()` suave
  al viajar por minimapa y al seleccionar edificio, `fadeIn` al arrancar.
  Cursores de teclado cacheados (se elimina la asignación por frame).
- **Terreno rico** (`scripts/make-terrain.mjs` + `terrain-sheet.png`
  regenerado): 46 manchas + 40 puntos de micro-grano por loseta, luz
  cenital/sombra basal más marcadas, viñeta interior por diamante y
  **eliminado el trazo de rejilla**.
- **Render suave** (`config.ts`): `pixelArt:false`, `antialias:true`,
  `roundPixels:false`, `banner:false`, `disableContextMenu:true`.
- **HUD único**: se elimina el `hudText` de Phaser (la barra vive en React
  vía `window.__stock`); en Phaser solo quedan los avisos `hintText`.
- **Iconos**: pack por defecto 'b' en local (respeta `NEXT_PUBLIC_PACK=a`
  explícito en Vercel); minimapa ignora estrellas y avisos.
- **QA visual con Playwright**: el edge-scroll sin armar expulsaba la cámara
  a una esquina en cada carga sin ratón (campo marrón por overlay de
  amanecer sobre el vacío). Reproducido, diagnosticado y corregido;
  capturas `shot-dia.png` / `shot-noche.png` regeneradas.

## Verificación
- `npm test`: 49/49. `npx tsc --noEmit`: limpio. `npm run build`: OK.
- `npx playwright test`: 2/2 (landing + inspección).
- Capturas headless: carga sin ratón (isla visible), `?dia=1`, `?noche=1`.
