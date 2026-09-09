# SpanishSettlers — RTS de colonos original para la web

Juego web de estrategia con economía viva, territorio, población y colonia
rival. **Proyecto 100% original**: código, arte procedural y textos propios.
No contiene assets, código ni nombres de The Settlers IV (Ubisoft/Blue Byte).

## Stack
- Next.js 16 (App Router) + React 19 + Tailwind 4 — desplegado en Vercel
- Phaser 3.90 (solo cliente, `next/dynamic ssr:false`) — motor isométrico
- TypeScript estricto, Vitest (unit), Playwright (e2e)

## Desarrollo
```bash
npm install
npm run dev      # http://localhost:3000  (juego en /play)
npm test         # 77 tests unitarios (economía, caminos, población, rival…)
npm run lint     # ESLint (hay avisos/errores previos pendientes)
npm run build    # verificación prod (Turbopack + tsc)
```

## Controles
- Clic en edificio → clic en loseta para construir · 🛤 Camino: clic o arrastra (clic en camino = quitar) · `ESC` cancela
- Rueda = zoom suave · Arrastrar botón derecho = pan · `WASD`/flechas = mover · `Q`/`E` = zoom · Minimapa = viajar

## Mecánicas (fases 1–4)
- 22 edificios, 16 recursos, 8 recetas encadenadas (madera→tablón, grano→harina→pan, hierro+carbón→lingote→herramientas/armas)
- Caminos trazables: los colonos los prefieren y van ×1.5; avisos ⚠ de producción parada
- Población real: vivienda, comida (pan/pescado), moral, inmigración/emigración visible; reclutar viste colonos
- Colonia rival IA con las mismas reglas: crece por orden, produce, recluta e incursiona; arrasar su almacén da la victoria
- Territorio: base + torres · Militar: espadachines/arqueros + oleadas neutrales hasta 10 para ganar
- Economía a 1 tick/s de pared (independiente de FPS), guardado localStorage v4, HUD React con stock/censo/rival en vivo

## Docs y checkpoints
- `CHANGELOG.md` + `docs/devlog/001…024-*` por fase
- Ramas: `proto-b-widelands` (arte Widelands, proyecto Vercel B) y `proto-a-hibrida` (proyecto Vercel A)

## Aviso legal
Inspirado en mecánicas genéricas del género, con assets originales.
No afiliado a Ubisoft/Blue Byte.
