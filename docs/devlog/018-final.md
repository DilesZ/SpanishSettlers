# Devlog 018 — Victoria, derrota y oleadas con arqueros (rama B)

## Cambios
- **Final de partida**: victoria al rechazar 10 oleadas (`VICTORY_WAVES`),
  derrota si cae el almacén. Pantalla final con bajas, edificios y tiempo +
  botón de reinicio. Estado expuesto por `__game.status()`.
- Oleadas con arqueros incursores cada 3 oleadas (atacan a distancia 3).
- Guardado ampliado con `gameStatus` (cargar una partida acabada la reabre
  en `playing`).

## Verificación
- `npm test`: 45/45. `npm run build`: OK. E2E 2/2 OK.
