# CHANGELOG — SpanishSettlers

Todos los cambios documentados por checkpoint (tags `v*`).

## [sin tag] — Fase 4: colonia rival con las mismas reglas
- IA que construye por orden, produce, recluta e incursiona con los mismos
  costes/recetas; guarnición, asedio del jugador y victoria al arrasar su
  almacén (ver `docs/devlog/024-fase4-rival.md`).
- Soporte: `owner` en edificios, jobs por instancia, filtros por bando,
  minas que comen 1 pan/4 ticks (balance compartido), paneado manual,
  guardado v4, chip "⚔ Rival" y distintivo en ficha.
- Verificación: 68/68 unit, tsc limpio, build OK, e2e 2/2, sonda de
  ~5 min (rival 3→22, cadena del metal, tropas e incursión observada).

## [sin tag] — Fase 3: población (techo, comida, moral)
- Censo real: las casas dan techo, la colonia come pan/pescado, la moral
  mueve inmigración/emigración visibles por el borde; reclutar convierte
  colonos y las bajas descuentan (ver
  `docs/devlog/023-fase3-poblacion.md`).
- HUD 👥 pop/techo · moral · consumo + alertas de vivienda y comida;
  guardado v3 con censo y reposición de caminantes al cargar.
- Verificación: 61/61 unit, tsc limpio, build OK, e2e 2/2, sonda funcional
  (20→21, despensa 4→0, moral 100→70, aviso de hambre).

## [sin tag] — Fase 2: caminos y logística visible
- Red vial pintable (clic/drag/ESC) con decals conectados; A* ponderado y
  ×1.5 de velocidad sobre caminos; guardado v2 (ver
  `docs/devlog/022-fase2-caminos.md`).
- Producción bloqueada visible: ⚠ flotante + franja en React + faltantes
  en la ficha (`stalls()` en el puente).
- Economía a reloj de pared (1 tick/s real a cualquier FPS).
- Cámara inicial al HQ; `tryPlace` valida (sin apilar ni perder recursos);
  losetas normalizadas; fuera la cantera duplicada.
- Verificación: 55/55 unit, tsc limpio, build OK, e2e 2/2, sonda funcional
  (1 ciclo → bloqueo con aviso) y capturas regeneradas.

## [sin tag] — Fase 1: cámara suave + terreno rico (auditoría visual)
- Cámara con inercia, zoom interpolado anclado al cursor, Q/E, edge scrolling
  armado tras movimiento real del puntero, pan suave (minimapa/selección) y
  fade-in; cursores cacheados (ver `docs/devlog/021-fase1-camara-terreno.md`).
- Terreno regenerado: micro-grano, viñeta por loseta, sin rejilla visible.
- Render suave (`pixelArt:false` + antialias), HUD único en React, pack de
  iconos 'b' por defecto en local (cero 404s).
- Corrección QA: la cámara ya no se expulsa a una esquina al cargar sin ratón.
- Verificación: 49/49 unit, tsc limpio, build OK, e2e 2/2, capturas de día y
  de noche regeneradas.

## [v0.1.0-scaffold] — Base Next.js + Phaser + TS
- Scaffold Next.js 16 App Router + Tailwind + ESLint + TS (nombre npm `spanish-settlers`).
- Deps: `phaser@3.90`, `vitest`, `@playwright/test`.
- Skills instaladas: `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `deploy-to-vercel`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `executing-plans`, `writing-plans`, Phaser (`game-setup-and-config`, `scenes`, `tilemaps`, `sprites-and-images`, `scale-and-responsive`, `cameras`, `input-keyboard-mouse-touch`).
- Docs: `docs/devlog/` por checkpoint.

## [v0.2.0-map] — Motor isométrico + cámara
- `BootScene`: texturas procedurales originales (hierba/agua/bosque/montaña, colono/soldado/portador).
- `GameScene`: mapa 28x28 isométrico 64x32, zoom rueda (0.4-2.5), drag botón derecho, WASD/flechas, borde de territorio.
- `GameCanvas`: `next/dynamic ssr:false` + import dinámico de Phaser (bundle optimization).

## [v0.3.0-economy] — Economía encadenada + tests
- `data/buildings.ts`: 21 edificios, 8 recetas, stock inicial.
- `systems/economy.ts`: `canAfford/payCost/tickJob/settlementValue/militaryStrengthFactor`.
- Tests unitarios `economy.test.ts` (5 casos) en verde.

## [v0.4.0-military] — Territorio + militar básico (MVP)
- `systems/territory.ts`: `insideTerritory/soldierCost/soldierPower/fightRound`.
- Torres expanden radio, cuartel genera soldado, ornamentos dan bonus doble.
- Tests `territory.test.ts` (3 casos) en verde.
- UI `/play`: HUD de 16 recursos + 20 botones de construcción conectados a Phaser vía `window.__game`.
