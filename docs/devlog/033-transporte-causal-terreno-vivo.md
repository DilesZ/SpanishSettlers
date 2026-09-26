# 033 — Transporte causal + terreno vivo (council Fase 1)

- Fecha: 2026-09-26 · Rama: `proto-b-widelands` · Council: 4 miembros + peer review (ver `~/.council/20260926-settlers4/` y `20260926-autopush-flow/`).
- Objetivo: que el juego se parezca a S4 en logística (fricción visible) y en colono↔terreno, sin copiar expresión de Blue Byte.

## Cambio
- `systems/transport.ts` (nuevo): buffers locales por edificio, cola con prioridades (comida primero) y ETA por distancia de caminos. Sin camino = ETA ×2+2. Atascos (`congestedKeys`) y trabajo causal para porteadores.
- `systems/terrain.ts` (nuevo): `terrainSpeed` (hierba 1.0, arena 0.8, bosque 0.65), `isBlockedTerrain`, nodos vivos + `nearestLivingWood`.
- `GameScene`: productores vierten a buffers; porteadores recogen 1 ud. real del buffer prioritario; pilas físicas (icono + 📦N); cabaña solo produce con bosque vivo en radio 6; leñador tala árboles reales (rebrote 60-90 s); pescador chapotea; polvo de pasos; barra de obra; velocidad ×1/×2/×4; guardado v5 (migra v4).
- `roads.ts`: `roadDistance` BFS. `pathfinding.ts`: heap O(log n) + caché LRU. HUD: `SpeedControl` (ritmo + pilas/en ruta/atascos).
- `fx/vfx.ts`: `chopBurst`, `splashPuff`, `stepPuff` (1 objeto, acotados).

## Test / build
- 151 unit (transport 6, terrain 4+2 PNG restaurados), tsc limpio, build OK. Lint: 0 errores nuevos (5 previos intactos).

## Decisión
- Híbrido sim/visual, no fake (peer review 4/4 contra porteadores decorativos) y no rewrite total. Rival sigue abstracto con mismas reglas (deuda). Rocas registradas para gating de cantera (siguiente).

## Siguiente paso
- Gating cantera↔rocas, humo solo produciendo, niebla que bloquee construcción.
