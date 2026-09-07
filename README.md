# SpanishSettlers — clon web original inspirado en RTS de colonos

Juego web de estrategia con economía viva, territorio y combate básico.
**Proyecto 100% original**: código, arte procedural y textos propios.
No contiene assets, código ni nombres de The Settlers IV (Ubisoft/Blue Byte).

## Stack
- Next.js 16 (App Router) + React 19 + Tailwind 4 — desplegado en Vercel
- Phaser 3.90 (solo cliente, `next/dynamic ssr:false`) — motor isométrico
- TypeScript estricto, Vitest (unit), Playwright (e2e)

## Desarrollo
```bash
npm install
npm run dev      # http://localhost:3000  (juego en /play)
npm test         # 8 tests unitarios (economía + territorio)
npm run build    # verificación prod (Turbopack + tsc)
```

## Controles
- Clic en edificio → clic en loseta para construir · `ESC` cancela
- Rueda = zoom · Arrastrar botón derecho = pan · `WASD`/flechas = mover

## Mecánicas (MVP v0.4.0)
- 21 edificios, 16 recursos, 8 recetas encadenadas (madera→tablón, grano→harina→pan→minería, hierro+carbón→lingote→herramientas/armas)
- Territorio: base + torres (guarnición) · Pioneros (próximo)
- Militar: espadachines/arqueros N1-N3 + líder; fuerza fuera de casa ligada al valor económico + ornamentos x2
- HUD React con stock en vivo vía `window.__stock`

## Docs y checkpoints
- `CHANGELOG.md` + `docs/devlog/001-scaffold.md`, `002-mvp.md`
- Tags: `v0.1.0-scaffold`, `v0.2.0-map`, `v0.3.0-economy`, `v0.4.0-military`
- Skills (skills.sh) en `.agents/skills/`: vercel-* (4), superpowers (5), phaser (7)

## Aviso legal
Clon **inspirado en mecánicas genéricas del género**, con assets originales.
No afiliado a Ubisoft/Blue Byte.
