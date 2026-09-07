# Devlog 015 — Puerto, barcos, panel info y carga visible (rama B, 2026-09-07)

## Cambios
- **Puerto (edificio 22)**: astillero bárbaro WL; solo junto al agua
  (`touchesWater`, también para pesquería). Al terminarse bota hasta 2 barcos.
- **Barcos**: drakkar con velas en 6 direcciones (20f), circuitos de pesca
  (`pickFishingCircuit` + A* acuático), estela, +2 pez por travesía, `?demo=puerto`.
- **Panel de inspección**: clic en edificio → ficha React (icono, categoría,
  receta con entradas/salidas, estado). Bridge `__game.inspect` + `__inspect`.
- **Portadores con mercancía**: icono del recurso según origen (`goodsFor`)
  sobre el colono cargado.
- **SFX**: cosecha (pluck), barco/puerto (splash), obra terminada (built).
- **PACK por proyecto** (`NEXT_PUBLIC_PACK=a|b` en Vercel): menú/iconos por
  pack + fallback cruzado de `<img>` para dev. Proyecto A=a, B=b.
- `systems/ships.ts` + tests (lógica naval pura).

## Bugs cazados
- Anims `wl-build-*` solo para sheets → bucle separado (E2E lo delató).
- Frames fuera de rango en sheets → `capFrames` (celdas físicas).
- Error de sintaxis por edit (línea huérfana) → E2E lo delató.

## Verificación
- `npm test`: 36/36 (4 naval). E2E inspect OK. `npm run build`: OK.
- Desplegado a https://spanish-settlers-b-dileszs-projects.vercel.app
