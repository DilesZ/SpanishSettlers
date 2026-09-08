# Devlog 019 — Música, landing y final de partida (rama B)

## Cambios
- **Música ambiental generativa** (`music.ts`, testeada): laúd dórico con
  bordón grave, más lenta de noche (lee `__sky`), botón ♪ con persistencia.
  Sin assets: 100% WebAudio.
- **Landing renovada**: capturas reales día/noche, lista de features actual,
  crédito GPL a Widelands.
- **Victoria/derrota**: 10 oleadas o caída del almacén, pantalla final con
  estadísticas y reinicio.

## Verificación
- `npm test`: 49/49. `npm run build`: OK. E2E OK.
