# COMPARATIVA A (original) vs B (Widelands GPL) — Fase 3

Capturas reales headless 1280×800 (`scripts/shoot.mjs`): `a-play.png`, `b-play.png`.
Mismo Terreno (plano S4 común), misma simulación y UI. Solo cambian edificios/personajes.

| Criterio | A — Híbrida original | B — Widelands GPL |
|---|---|---|
| Edificios | 21 SVG propios 128px, estilo terracota coherente | 21 bárbaros dibujados a mano (detalle pictórico superior por sprite) |
| Animación edificios | Aspas molino, humo, halos, andamio | 4 con idle animado real (almacén, aserradero, granja, torre 20f) |
| Colonos | 8 oficios × 3 frames, 1 dirección + flip | 8 workers × 10 frames, 2 direcciones reales (e/w) |
| Iconos HUD | 21 generados 30×30 | 21 `menu.png` oficiales 30×30 |
| Peso assets | ~430 KB (medir en A) | 507 KB total (`wl/` 417 KB) |
| Tests | 16/16 | 17/17 |
| Build | OK | OK |
| Licencia | Propietaria + CC0 (máxima libertad comercial) | **GPL-2.0+ en TODA la rama** (copyleft: el juego siempre será libre) |
| Coherencia con "español" | Alta (mediterráneo) | Media (bárbaro S2: madera oscura, pieles) |
| Margen de mejora | Total (dibujamos lo que sea) | Limitado al catálogo bárbaro (recolor vía `_pc`, más tribus = más trabajo) |

## Recomendación del agente
**A como base + importar de B solo lo que A no puede igualar a corto plazo.**
Pero la decisión es del titular: si elige B, `main` pasa a GPL-2.0+ y se fusiona
`proto-b-widelands`; si elige A, B se archiva como tag y `main` sigue limpio.
Hito: veredicto del usuario → tag `v1.0.0-arte`.
