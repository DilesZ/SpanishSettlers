'use client';

import { useEffect, useRef, useState } from 'react';
import { BUILDINGS, type BuildingId } from '@/game/data/buildings';
import { Chip } from './ui';
import type { GameViewHandle, Hud3D, Select3D } from '@/three/GameView3D';

// Paleta de obra de la vista 3D (subconjunto esencial, mismos costes).
const PALETTE: BuildingId[] = [
  'cabanaLenador',
  'aserradero',
  'granja',
  'molino',
  'residenciaS',
  'torre',
];

// Como GameCanvas: three (~600KB) nunca en SSR ni en el chunk inicial.
export default function ThreeCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GameViewHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud3D | null>(null);
  const [tool, setToolState] = useState<BuildingId | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [sel, setSel] = useState<Select3D | null>(null);

  useEffect(() => {
    let handle: GameViewHandle | null = null;
    let disposed = false;
    let t: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const { createGameView3D } = await import('@/three/GameView3D');
        if (disposed || !hostRef.current) return;
        hostRef.current.innerHTML = '';
        handle = createGameView3D(hostRef.current, {
          onHud: (h) => {
            if (!disposed) setHud(h);
          },
          onSelect: (s) => {
            if (!disposed) setSel(s);
          },
        });
        handleRef.current = handle;
        t = setInterval(() => {
          if (!disposed && handle) setHud(handle.snapshot());
        }, 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar Three.js');
      }
    })();

    return () => {
      disposed = true;
      if (t) clearInterval(t);
      try {
        handle?.dispose();
      } catch {
        /* limpieza best-effort */
      }
      handle = null;
      handleRef.current = null;
    };
  }, []);

  const pickTool = (id: BuildingId) => {
    const next = tool === id ? null : id;
    setToolState(next);
    handleRef.current?.setTool(next);
    setSel(null);
  };

  const changeSpeed = (n: number) => {
    setSpeedState(n);
    handleRef.current?.setSpeed(n);
  };

  if (error) return <div className="p-6 text-red-300">Error 3D: {error}</div>;
  return (
    <div className="w-full space-y-3">
      <div className="relative h-[70vh] w-full overflow-hidden rounded-2xl border border-amber-200/15 bg-[#0d1f16]">
        <div ref={hostRef} className="absolute inset-0" />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200/15 bg-[#101a12]/95 px-3 py-2">
        {hud ? (
          <>
            {(Object.entries(hud.stock) as [string, number][])
              .filter(([, v]) => v > 0)
              .slice(0, 10)
              .map(([k, v]) => (
                <Chip key={k} title={k}>
                  {k} {v}
                </Chip>
              ))}
            <span className="ml-auto text-[11px] text-amber-100/60 tabular-nums">
              🏠 {hud.counts} · ⏱ {hud.tickNo}s
            </span>
          </>
        ) : (
          <span className="text-xs text-amber-100/60">Cargando colonia…</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PALETTE.map((id) => {
          const def = BUILDINGS[id];
          const active = tool === id;
          return (
            <button
              key={id}
              onClick={() => pickTool(id)}
              aria-pressed={active}
              title={`${def.descripcion} — ${Object.entries(def.coste).map(([k, v]) => `${v}× ${k}`).join(' + ') || 'gratis'}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                  : 'border-white/10 bg-white/[0.04] text-amber-100/70 hover:border-amber-200/30'
              }`}
            >
              🧱 {def.nombre}
            </button>
          );
        })}
        <span className="ml-auto flex gap-1.5">
          {[1, 2].map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              aria-pressed={speed === s}
              className={`rounded-full border px-3 py-1.5 text-xs font-black tabular-nums transition ${
                speed === s
                  ? 'border-amber-300/60 bg-amber-300/20 text-amber-100'
                  : 'border-white/10 text-amber-100/70'
              }`}
            >
              ×{s}
            </button>
          ))}
        </span>
      </div>
      {sel && (
        <div className="rounded-2xl border border-amber-200/15 bg-[#101a12]/95 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-amber-50">{sel.nombre}</h2>
              <p className="mt-1 text-sm leading-6 text-amber-50/85">{sel.descripcion}</p>
            </div>
            <button
              onClick={() => {
                setSel(null);
              }}
              className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-amber-100/80 transition hover:border-amber-200/40 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
