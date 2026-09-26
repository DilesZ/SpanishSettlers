# 036 — Root R1: escasez + deadline + quest + juice

- Fecha: 2026-09-27 · Rama: `proto-b-widelands` (merge a master para publicar).
- Council raíz: motor/tests/saves intactos; la cura es loop, no arquitectura (`~/.council/2026-09-27-root-rework/`). Plan: `docs/superpowers/plans/2026-09-27-root-rework-r1.md`.

## Cambio (6 commits)
- `14f255a` vetas finitas en `economy.ts` (`reserve`/`depletedKeys`/`consumed`, TDD).
- `0442c9d` reservas por mina (30, `mineReserves`), aviso ⛏, guardado v7 (migra v6).
- `d6b66ca` reloj de asedio: `siege()` + `SiegeBar` (cuenta atrás + oleada x/10).
- `9bee4b7` quest 3 pasos (`quest.ts` puro + `QuestTracker` + pulso en BuildMenu).
- `10882c3` juice: `floatText` (+N, ✓) + blips WebAudio (pop/coin/horn) en entrega, obra y avistamiento.
- Cierre: este devlog + CHANGELOG.

## Test / build
- 159 unit (economy 10, quest 3, vfx 9), tsc limpio, build OK, e2e 2/2, lint sin errores nuevos.

## Validación jugable (pendiente del autor, 15 min)
- ¿Se agota una veta antes del min 15? (30 uds ÷ ~0.5 ud/s por mina ≈ 15 min con 1 mina activa... verificar jugando.)
- ¿El reloj se entiende sin leer la guía? ¿La quest se completa solo jugando?
- Fuera de R1 (a validar después): campaña 3 actos, recorte de recursos, split sim/view, maná.
