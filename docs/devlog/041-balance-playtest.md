# 041 — Balance comida-metal + playtest que juega de verdad

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).

## Balance (problema real, no de test)
- Las minas comían cada 4 ticks (0.75 pan/tick con 3 minas) y evaporaban la
  despensa: la cadena del metal no arrancaba nunca. Ahora cada 12 ticks.
- Censo come pop/300 (antes /200): 1 panadería sostiene censo inicial + 1 mina.
- Recetas con sus tiempos reales (harina/pan 6 s; antes todo a 8 s fijos).

## Playtest `gameplay.spec.ts` (~5 min, en verde)
- Casa, panaderías y mina por UI verificando **por id propio** (los counts los
  mueve también el rival: falsos positivos detectados y eliminados).
- Caminos con drag, economía x4, quest, recluta, especialistas, prioridades,
  oleada con bajas, supervivencia, veta consumida, save/load idéntico y **cero
  errores de consola**.
- Lecciones: clics con deriva en slow-motion (espiral tolerante + espera con
  fallback), mina arrasable por la oleada (reintento), headless a ~3 fps
  (relojes Phaser en slow-motion; la economía de reloj propio no se entera).

## Verificación
- 166 unit, tsc limpio, build OK, e2e 3/3, lint sin errores nuevos.
