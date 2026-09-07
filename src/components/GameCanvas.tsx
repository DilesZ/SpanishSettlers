'use client';

import { useEffect, useRef, useState } from 'react';

// Skill vercel-react-best-practices: bundle-dynamic-imports — Phaser (~1MB) nunca en SSR ni en chunk inicial.
export default function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
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

    return () => {
      disposed = true;
      game?.destroy(true);
      game = null;
    };
  }, []);

  if (error) return <div className="p-6 text-red-300">Error del motor: {error}</div>;
  return <div ref={hostRef} className="h-[70vh] w-full overflow-hidden rounded-xl border border-amber-200/20 bg-[#0d1f16]" />;
}
