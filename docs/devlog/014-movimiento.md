# Devlog 014 — Movimiento real + terreno suave (rama B, 2026-09-07)

## Movimiento (antes: deslizamiento fantasma en línea recta)
- `systems/pathfinding.ts` (nuevo, testeado): A* en vecindad de 4 sobre la
  rejilla, con destino siempre transitable y `smoothPath` que colapsa rectas
  libres. Agua, montaña y edificios bloquean.
- Motor `Walker` en GameScene: waypoints a velocidad constante (~68 px/s),
  sprites direccionales reales (6 dirs WL: e/se/sw/w/nw/ne por ángulo),
  estados idle/work/walk, sombras que siguen y profundidad continua.
- Cerebros por oficio: leñador tala con hacha+sonido y vuelve a la cabaña,
  minero mina→almacén, portador vacío→cargado, tropa patrulla, fauna pasea
  (patos nadan, el resto evita el agua).
- Importadas anims `idle` (8/8), `hack` (leñador) y `walkload` en 6 dirs.

## Terreno
- Tiles sin borde de rejilla (stroke 0.10→0.04).
- Sombras al sur de cada montaña (relieve) + destellos parpadeantes en el agua.
- BootScene sin texturas muertas; surroundings con arbustos WL.

## Verificación
- `npm test`: 32/32 (6 nuevos de A*). `npm run build`: OK. Capturas local/prod.
- Desplegado a https://spanish-settlers-b-dileszs-projects.vercel.app
