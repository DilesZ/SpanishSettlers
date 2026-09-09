'use client';

import { useEffect, useRef, useState } from 'react';

// Como GameCanvas: three (~600KB) nunca en SSR ni en el chunk inicial.
export default function ThreeCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let handle: { dispose: () => void; setNight?: (on: boolean) => void } | null = null;
    let disposed = false;

    (async () => {
      try {
        const { createSpikeScene } = await import('@/three/SpikeScene');
        if (disposed || !hostRef.current) return;
        hostRef.current.innerHTML = '';
        handle = createSpikeScene(hostRef.current);
        try {
          if (new URLSearchParams(window.location.search).get('noche') === '1') {
            handle.setNight?.(true);
          }
        } catch { /* sin query: día */ }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar Three.js');
      }
    })();

    return () => {
      disposed = true;
      try {
        handle?.dispose();
      } catch {
        /* limpieza best-effort */
      }
      handle = null;
    };
  }, []);

  if (error) return <div className="p-6 text-red-300">Error 3D: {error}</div>;
  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-amber-200/20 bg-[#0d1f16]">
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
