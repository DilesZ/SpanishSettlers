# Devlog 032 — Iteración visual 2 (integración propia)

## Cambios sobre la oleada de subagentes
- **Lluvia legible**: gotas 1.8×10@0.55 → 2.6×15@0.75, tope 40→90,
  3-5 por tick; salpicaduras con más trazo (test de presupuesto
  actualizado). Verificado con zoom: al menos 1 trazo visible en
  400×300 a 3.8 FPS (en 60 FPS la cortina es densa).
- **Humo doméstico**: viviendas/cuartel/armería/torre humean tenue
  (1700 ms, alfa 0.7) frente a forjas (850 ms). `addSmoke` con
  `rateMs/alphaMul`.
- **Fronteras**: el círculo amarillo se sustituye por elipse tenue +
  anillo de postes con banderín (`post` procedural en BootScene,
  `drawTerritoryPosts()` reconstruido al poner torres y al cargar).
- **Alcance de torre al colocar**: elipse ámbar/roja de 5 losetas sobre
  el fantasma (`ghostRange`, oculta del minimapa).
- **Paneado manual** (`panTarget`): los `cam.pan()` no se movían junto
  al control por velocidad (sonda: la cámara no llegaba); minimapa,
  selección y `focus()` usan la interpolación propia.
- **Guard lluvia/nubes**: `updateClouds` respeta `__weather.raining`
  (0|1 → Boolean) para no pelear el tinte gris.

## Lecciones de QA headless (repetidas)
- `?noche=1` "no funcionaba": el overlay estaba a 0.42 verificado por
  DOM; era error de apreciación. Instrumentos > ojos.
- `?lluvia=1` "no arrancaba": dilatación ~10× de TimerEvents a 3.8 FPS;
  la lluvia llegaba a los ~20-30 s de pared. Sondas con espera por
  condición (`__weather.raining`), no con tiempos fijos.
- Editar y disparar la sonda sin `build` intermedio enseña el build
  viejo: build siempre antes de capturar.

## Verificación
- `npm test`: 123/123. `tsc` limpio, `build` OK, `playwright` 2/2.
- Capturas: frontera (postes), torre (rango), lluvia con zoom,
  día/noche/UI ya en 028.
