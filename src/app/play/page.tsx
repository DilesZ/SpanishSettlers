'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { BUILDINGS, type BuildingId, type ResourceId } from '@/game/data/buildings';

// Dynamic import: el canvas pesado solo en cliente (skill bundle-dynamic-imports).
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });

const ORDER: BuildingId[] = [
  'cabanaLenador', 'aserradero', 'cantera', 'residenciaS', 'residenciaM', 'residenciaL',
  'granja', 'molino', 'panaderia', 'pozo', 'pesqueria',
  'minaCarbon', 'minaHierro', 'minaOro', 'fundicion', 'herreria', 'armeria',
  'cuartel', 'torre', 'ornamento',
];

export default function PlayPage() {
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const [selected, setSelected] = useState<BuildingId | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const w = window as unknown as { __stock?: Record<string, number> };
      if (w.__stock) setStock({ ...w.__stock });
    }, 800);
    return () => clearInterval(t);
  }, []);

  const build = (id: BuildingId) => {
    const w = window as unknown as { __game?: { place: (id: BuildingId) => void } };
    w.__game?.place(id);
    setSelected(id);
  };

  return (
    <main className="min-h-screen bg-[#0b1410] text-amber-50">
      <header className="flex items-center justify-between border-b border-amber-200/15 px-4 py-3">
        <a href="/" className="text-sm text-amber-200/80 hover:text-amber-100">← Volver</a>
        <h1 className="text-lg font-bold tracking-wide">SpanishSettlers — partida web</h1>
        <div className="text-xs text-amber-200/70">Arrastra con botón derecho · Rueda = zoom · WASD = mover</div>
      </header>

      {stock && (
        <div className="flex flex-wrap gap-2 px-4 py-2 text-xs">
          {(Object.entries(stock) as [ResourceId, number][]).map(([k, v]) => (
            <span key={k} className="rounded-full bg-white/10 px-2 py-1">{k}: <b>{v}</b></span>
          ))}
        </div>
      )}

      <div className="px-4"><GameCanvas /></div>

      <section className="px-4 py-3">
        <h2 className="mb-2 text-sm font-semibold text-amber-200">Construir {selected ? `→ ${BUILDINGS[selected].nombre} (clic en una loseta)` : '(elige un edificio)'}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ORDER.map((id) => (
            <button
              key={id}
              onClick={() => build(id)}
              className={`rounded-lg border p-2 text-left text-xs transition ${selected === id ? 'border-amber-300 bg-amber-300/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              title={BUILDINGS[id].descripcion}
            >
              <div className="font-bold">{BUILDINGS[id].nombre}</div>
              <div className="text-white/60">{BUILDINGS[id].descripcion}</div>
              <div className="mt-1 text-amber-200/80">
                {Object.entries(BUILDINGS[id].coste).map(([k, v]) => `${k}:${v}`).join(' · ') || 'gratis'}
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
