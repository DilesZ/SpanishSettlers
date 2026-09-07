# Devlog 011 — Despliegue en Vercel (2026-09-07)

## Proyectos (cuenta dileszs-projects, token del titular, solo en memoria)
- A: `spanish-settlers-a` → https://spanish-settlers-a-dileszs-projects.vercel.app
- B: `spanish-settlers-b` → https://spanish-settlers-b-dileszs-projects.vercel.app
- Links locales: `.vercel-a` / `.vercel-b` (gitignorados vía `.vercel-*`).
  Para redesplegar: copiar el correspondiente a `.vercel`, `vercel deploy --prod`,
  borrar `.vercel`.

## Incidencias resueltas
1. `regions: ["mad1"]` inválido → eliminado de `vercel.json` (ambas ramas).
2. El deploy de B salió sin el fix del hoverMarker → pantalla rota en prod,
   detectado por captura Playwright, corregido y redesplegado.
3. **Deployment Protection (SSO) activa por defecto**: los proyectos pedían
   login. Desactivada con `vercel project protection disable <p> --sso`.
4. `scripts/shoot.mjs` ahora admite URL completa + diagnostica (HTTP 4xx,
   estado `__game/__stock`, captura siempre) para verificar producción.

## Verificación
- Capturas del juego corriendo en prod: A y B con colonia, HUD, minimapa y menú.
- HTTP 200 en `/` y `/play` de ambos dominios de producción.
