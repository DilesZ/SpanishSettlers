# Devlog 023 — Fase 3: población (techo, comida, moral, censo visible)

## Diseño
Las casas dejan de ser decorado: dan techo real. La colonia come pan y
luego pescado cada tick; la moral (techo + despensa) mueve el crecimiento.
Con techo y comida llegan inmigrantes andando desde el borde; con hambre o
hacinamiento hay emigración por el borde. El censo equivale a caminantes:
reclutar viste a un colono en vez de crearlo de la nada, y las bajas
descuentan.

## Cambios
- **`systems/population.ts` (nuevo, puro/testeable)**: `housingFor`
  (almacén 10, S 10, M 20, L 50), `moraleOf` (30 + 40·techo + 30·despensa),
  `growthPerTick` (+ con techo/comida, 0 sin techo, − con hambre o
  hacinamiento), `foodPerTick` (pop/200 por tick).
- **`GameScene`**: `tickPopulation()` en el tick de economía (come con
  arrastre fraccional y deuda topada), `immigrateOne()` (del borde al
  almacén, tope 44 caminantes), `emigrateOne()` (abandono visible +
  `killWalkerSilent`), `killWalker` descuenta censo, `recruit` convierte
  un colono ambiente (reserva: generar +1), reposición de caminantes al
  cargar partida, guardado v3 con censo, puente `pop()`.
- **`play/page.tsx`**: franja 👥 pop/techo · moral · −comida/s + alertas
  "Sin vivienda" y "Sin comida".

## Verificación (TDD + sonda)
- `npm test`: 61/61 (nuevo `population.test.ts`, 6 casos).
- `tsc` limpio, `build` OK, `playwright` 2/2.
- Sonda E2E (temporal, eliminada): 20→21 colonos en ~40s, pan 4→0 a
  0.1/s, moral 100→70 al vaciarse la despensa, franja "⚠ Sin comida:
  hambre" visible en captura.
