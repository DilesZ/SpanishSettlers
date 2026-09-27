# 042 — Nuevo motor gráfico: vista 3D viva (Three.js, arte propio)

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).
- Mandato: cambiar el motor con calidad S4 pero 100% legal (council s4look:
  nada de arte/UI/nombres del original; distancia deliberada).

## Cambio
- `three/sim3d.ts` (nuevo, puro + tests): misma planta inicial, mismas reglas
  (economía, transporte causal, recetas, A*, costes). La vista 3D es otro
  render del mismo diseño, no otro juego.
- `three/GameView3D.ts` (nuevo): terreno con relieve + biomas, agua, sol con
  sombras + día/noche, nubes, estrellas, vegetación/rocas instanciadas, barco,
  los 22 edificios low-poly propios (`buildings3d`), 10 colonos con oficios
  (porteadores que cargan de verdad, leñadores al bosque), picking por raycast
  (construir con coste real + ficha), pan/zoom, paleta de 6 + velocidad ×1/×2.
- `/3d` ahora es jugable (antes demo): HUD de stock, selección y obra.
- Limpieza: reloj manual (THREE.Clock deprecado), sombras 1024, terreno SEG 80.

## Test / build
- 170 unit (sim3d 4), tsc limpio, build OK, e2e 4/4 (nuevo `three.spec.ts`),
  lint sin errores nuevos.

## Hoja de ruta 3D (no en este corte)
- Rival, oleadas, niebla, especialistas, caminos y guardado compartido con 2D.
