# Devlog 016 — Combate defensivo (rama B, fecha UTC abajo)

## Cambios
- `systems/combat.ts` (nuevo, testeado): oleadas crecientes con tope (8),
  DPS de torre/soldado por rango, daño con muerte, coste de recluta que
  encarece el pan con el ejército.
- Oleadas de incursores (tinte rojo) desde el borde cada 100 s (primera a
  75 s): buscan el edificio más cercano por A*, lo asedian con barra de PV.
- Torres disparan proyectiles a 5 losetas; soldados/arqueros propios traban
  combate cuerpo a cuerpo con represalia y muerte en ambos bandos.
- Edificios con 100 PV, barra amarilla, sacudida al recibir daño y demolición
  con limpieza (trigales, farol, defensores reasignados, aviso 🔥).
- Reclutamiento en el cuartel desde el panel (1⚔+1🍞, tope 12, alterna
  espadachín/arquero). Botín: +1 oro cada 2 bajas, +2 al rechazar oleada.
- `?demo=raid`: oleada a los 6 s para fotos/tests.

## Verificación
- `npm test`: 40/40 (4 de combate). `npm run build`: OK. E2E 2/2 OK.
