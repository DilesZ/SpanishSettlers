# Devlog 017 — Minimapa, guardado y objetivos (rama B)

## Cambios
- **Minimapa clicable**: clic en el minimapa centra la cámara principal
  (`getWorldPoint` + viewport calculado).
- **Guardado**: snapshot en localStorage (stock, edificios, oleada, bajas,
  objetivos) + autoguardado cada 60 s + botones 💾/📂 en cabecera.
- **Objetivos** (`systems/objectives.ts` testeado): 5 con recompensa
  (aserradero, puerto, 3 soldados, 2 oleadas, 10 edificios), panel con
  progreso en `/play`, comprobación cada tick.

## Verificación
- `npm test`: 44/44 (4 de objetivos). `npm run build`: OK. Captura con
  panel 3/5 y botones de guardado visibles.
