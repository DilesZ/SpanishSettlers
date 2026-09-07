# CHANGELOG — SpanishSettlers

Todos los cambios documentados por checkpoint (tags `v*`).

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
