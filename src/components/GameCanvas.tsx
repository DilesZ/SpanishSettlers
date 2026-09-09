'use client';

import { useEffect, useRef, useState } from 'react';

// Skill vercel-react-best-practices: bundle-dynamic-imports — Phaser (~1MB) nunca en SSR ni en chunk inicial.
export default function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const warmRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let disposed = false;

    (async () => {
      try {
        const Phaser = (await import('phaser')).default;
        const { createGameConfig } = await import('@/game/config');
        if (disposed || !hostRef.current) return;
        hostRef.current.innerHTML = '';
        game = new Phaser.Game(createGameConfig(hostRef.current));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar Phaser');
      }
    })();

    // Tinte día/noche: el juego publica window.__sky (ver game/fx/atmosphere.ts).
    // Poll rápido (250 ms) + transición CSS = degradado suave sin coste de
    // render: el navegador interpola background-color/opacity por GPU.
    const t = setInterval(() => {
      const el = skyRef.current;
      if (!el) return;
      const sky = (window as unknown as { __sky?: { color: number; alpha: number; warm?: number } }).__sky;
      if (!sky) return;
      const hex = `#${sky.color.toString(16).padStart(6, '0')}`;
      el.style.backgroundColor = hex;
      el.style.opacity = String(Math.min(0.55, Math.max(0, sky.alpha)));
      const warm = warmRef.current;
      if (warm) warm.style.opacity = String(sky.warm ? Math.min(0.5, Math.max(0, sky.alpha * 2.2)) : 0);
    }, 250);

    return () => {
      disposed = true;
      clearInterval(t);
      game?.destroy(true);
      game = null;
    };
  }, []);

  if (error) return <div className="p-6 text-red-300">Error del motor: {error}</div>;
  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-amber-200/20 bg-[#0d1f16]">
      <div ref={hostRef} className="absolute inset-0" />
      {/* Tinte día/noche: gradación cálida de día / azulada de noche. */}
      <div
        ref={skyRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-[background-color,opacity] duration-500 ease-linear"
      />
      {/* Resplandor cálido de horizonte al amanecer/atardecer. */}
      <div
        ref={warmRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 ease-linear"
        style={{ background: 'linear-gradient(to top, rgba(255,150,60,0.55), rgba(255,120,40,0.12) 45%, transparent 70%)' }}
      />
      {/* Viñeta sutil permanente: focos al centro sin bloquear clics. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(5,10,8,0.42) 100%)' }}
      />
    </div>
  );
}
