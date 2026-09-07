# Devlog 001 — Scaffold + auth (2026-09-07)

## Cambios
- Remoto `origin` → `https://github.com/DilesZ/SpanishSettlers.git` (remoto vacío confirmado con `git ls-remote`).
- Browsers abiertos a GitHub + `vercel.com/login` para que el usuario autorice.
- `vercel whoami` → token inválido: pendiente `vercel login` manual del usuario. El deploy queda cubierto por la integración GitHub→Vercel al pushear a `master`.
- Scaffold: `create-next-app` falló por mayúsculas en `SpanishSettlers` → generado en `Temp/opencode/spanish-settlers-tmp` y copiado sin `.next`/`node_modules`.
- `package.json`: renombrado a `spanish-settlers`, añadidos `phaser`, `vitest`, `playwright`, scripts `test`/`test:e2e`.
- `npm install`: 404 paquetes, 0 errores (5 vulns heredadas de template, no bloqueantes).

## Skills usadas
- `vercel-react-best-practices` (leer SKILL.md): decide `next/dynamic` + import dinámico Phaser.
- `game-setup-and-config`: decide `Phaser.AUTO + pixelArt + Scale.RESIZE`.
- `test-driven-development`: tests primero para economía/territorio.

## Checkpoint
- Tag previsto: `v0.1.0-scaffold`.
