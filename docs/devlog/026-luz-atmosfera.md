# Devlog 026 — Luz y atmósfera (rama luz-atmósfera, 2026-09-09)

## Objetivo
Iluminación y atmósfera de nivel "indie moderno": el día/noche era un simple
tinte HTML y los faroles puntos sin vida (`glow` estático con alpha por
`skyTick`). Sin romper nada existente (nubes con sombra, humo, estrellas).

## Cambios
- NUEVO `src/game/fx/atmosphere.ts` (solo `import type` de Phaser: sin coste
  en runtime, testeable en vitest/node):
  - `initAtmosphere(scene)`: crea luciérnagas (tope 24) y arranca UN solo
    tween global que anima parpadeo de faroles + titileo de estrellas +
    guiños de luciérnagas (sin objetos temporales por frame).
  - `updateSky(scene, sky)`: publica `window.__sky` (+`warm`), sincroniza FX
    de faroles con altas/bajas automáticas (halo + charco, limpieza de
    huérfanos tras demoliciones/cargas), guarda bases de estrellas y
    luciérnagas, y retoca nubes registradas.
  - `registerCloud(scene, cloud, shade?)`: la sombra se atenúa de noche
    (×(1−oscuridad·0.75)) y la nube se tiñe cálida al amanecer/atardecer
    (`0xffd9b0`) y fría de noche (`0x9fb4dd`).
  - `shutdownAtmosphere(scene)`: idempotente, mata tweens y destruye FX.
- `BootScene.ts` (SOLO añadidos, nada existente tocado): `makeAtmosphere()`
  con 4 texturas procedurales originales — `lantern-halo` (128), `light-pool`
  (96×48), `soft-shadow` (64), `firefly` (12). Fallback a `glow` si alguna
  falta (integración a medias no rompe).
- `GameCanvas.tsx`: poll de `__sky` a 250 ms + transición CSS (el navegador
  interpola por GPU), resplandor cálido de horizonte al amanecer/atardecer
  (`warm`), viñeta radial sutil permanente. Todo `pointer-events-none`.
- NUEVO `tests/unit/atmosphere.test.ts` (9 tests con escena simulada).

## Integración (para quien toque GameScene.ts)
Ver bloques exactos en el mensaje de entrega: importar `initAtmosphere` /
`updateSky` / `registerCloud`, llamar a `initAtmosphere(this)` tras
`setupNight()`, sustituir el cuerpo de `skyTick()` por `updateSky`, y
registrar cada nube en `setupAmbient()`. Nada queda obsoleto salvo las dos
líneas del bucle manual de `skyTick()` (se borran).

## Verificación
- `npx tsc --noEmit` limpio.
- `npm test` en verde (incluye los 9 tests nuevos).
- No se arrancan servidores. Sin assets de terceros: todo procedural.
