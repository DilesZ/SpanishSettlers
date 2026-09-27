# 040 — Playtest real: desembarco + partida jugable

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).
- Método: `tests/e2e/gameplay.spec.ts` juega de verdad (casa por UI, caminos con drag, economía x4, recluta, oleada, save/load) y falla ante cualquier error de consola.

## Hallazgo raíz (systematic-debugging)
- La oleada 1 nunca llegaba: en isla 64 el anillo perimetral es todo mar y `land` quedaba vacío (también rompía inmigración/emigración en silencio).
- Fix en la causa: `shoreLandTiles()` (`island.ts` + test) y orillas cacheadas; oleadas e inmigrantes **desembarcan**. Paseos y scouts evitan agua/montaña. Hook QA `wave()` en el puente (como `focus`).
- Headless/SwiftShader va a ~3 fps y el Clock Phaser corre en slow-motion (~60×): los temporizadores tardan, no fallan. En navegadores reales a 60 fps todo llega a su hora. La economía (reloj de pared propio) no se ve afectada.

## Verificación
- Playtest e2e en verde: casa colocada, madera en flujo, quest, recluta invocable, oleada con bajas y colonia en pie, save/load idéntico, **cero errores de consola**.
- 162 unit, tsc limpio, build OK, e2e 3/3, lint sin errores nuevos.
