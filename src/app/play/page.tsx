'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { playSfx, unlockAudio } from '@/game/audio';
import { BUILDINGS, type BuildingId, type ResourceId } from '@/game/data/buildings';

// Dynamic import: el canvas pesado solo en cliente (skill bundle-dynamic-imports).
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });

// Pack de arte por proyecto Vercel (NEXT_PUBLIC_PACK=a|b). En 'a' no hay puerto.
// Los <img> llevan fallback cruzado para que dev sin env también funcione.
const PACK = process.env.NEXT_PUBLIC_PACK === 'b' ? 'b' : 'a';

const ORDER: BuildingId[] = [
  'cabanaLenador', 'aserradero', 'cantera', 'residenciaS', 'residenciaM', 'residenciaL',
  'granja', 'molino', 'panaderia', 'pozo', 'pesqueria',
  'minaCarbon', 'minaHierro', 'minaOro', 'fundicion', 'herreria', 'armeria',
  'cuartel', 'torre', 'ornamento',
  ...(PACK === 'b' ? ['puerto' as BuildingId] : []),
];

const iconFor = (id: BuildingId) =>
  PACK === 'b' ? `/assets/wl/icons/${id}.png` : `/assets/buildings/icons/${id}.png`;

const iconFallback = (id: BuildingId) =>
  PACK === 'b' ? `/assets/buildings/icons/${id}.png` : `/assets/wl/icons/${id}.png`;

const resIconFor = (k: ResourceId) =>
  PACK === 'b' ? `/assets/wl/icons/res-${k}.png` : null;

const onImgFallback = (fb: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  if (!t.dataset.fb && fb) {
    t.dataset.fb = '1';
    t.src = fb;
  }
};

interface Inspect {
  id: BuildingId;
  nombre: string;
  descripcion: string;
  categoria: string;
  receta?: { in: [string, number][]; out: [string, number][] };
  produciendo: boolean;
}

export default function PlayPage() {
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const w = window as unknown as { __stock?: Record<string, number>; __inspect?: Inspect | null };
      if (w.__stock) setStock({ ...w.__stock });
      if ('__inspect' in w) {
        setInspect(w.__inspect ?? null);
        delete w.__inspect;
      }
    }, 400);
    return () => clearInterval(t);
  }, []);

  const build = (id: BuildingId) => {
    unlockAudio();
    playSfx('click');
    const w = window as unknown as { __game?: { place: (id: BuildingId) => void } };
    w.__game?.place(id);
    setSelected(id);
    setInspect(null);
  };

  return (
    <main className="min-h-screen bg-[#0b1410] text-amber-50">
      <header className="flex items-center justify-between border-b border-amber-200/15 px-4 py-3">
        <a href="/" className="text-sm text-amber-200/80 hover:text-amber-100">← Volver</a>
        <h1 className="text-lg font-bold tracking-wide">SpanishSettlers — partida web</h1>
        <div className="text-xs text-amber-200/70">Arrastra con botón derecho · Rueda = zoom · WASD = mover · Clic en edificio = info</div>
      </header>

      {stock && (
        <div className="flex flex-wrap gap-2 px-4 py-2 text-xs">
          {(Object.entries(stock) as [ResourceId, number][]).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
              {resIconFor(k) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resIconFor(k)!} alt={k} width={16} height={16} className="h-4 w-4" onError={onImgFallback('')} />
              )}
              <span className="text-white/60">{k}:</span> <b>{v}</b>
            </span>
          ))}
        </div>
      )}

      <div className="px-4"><GameCanvas /></div>

      {inspect && (
        <section className="mx-4 mt-2 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconFor(inspect.id)} alt="" width={40} height={40} className="h-10 w-10 rounded bg-black/40" onError={onImgFallback(iconFallback(inspect.id))} />
          <div className="flex-1">
            <div className="font-bold">{inspect.nombre} <span className="ml-1 rounded bg-white/10 px-1 text-[10px] text-white/60">{inspect.categoria}</span></div>
            <div className="text-white/70">{inspect.descripcion}</div>
            {inspect.receta && (
              <div className="mt-1 text-amber-200/90">
                Produce: {inspect.receta.in.map(([k, v]) => `${v}×${k}`).join(' + ') || '—'} → {inspect.receta.out.map(([k, v]) => `${v}×${k}`).join(' + ')}
                {inspect.produciendo ? ' ●' : ' ○'}
              </div>
            )}
            {inspect.id === 'cuartel' && (
              <button
                onClick={() => {
                  unlockAudio();
                  const w = window as unknown as { __game?: { recruit: () => boolean } };
                  w.__game?.recruit();
                }}
                className="mt-2 rounded-full bg-red-700/60 px-3 py-1 text-xs font-bold hover:bg-red-600/60"
              >
                ⚔ Reclutar (1⚔ + 1🍞)
              </button>
            )}
          </div>
          <button onClick={() => setInspect(null)} className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10">Cerrar</button>
        </section>
      )}

      <section className="px-4 py-3">
        <h2 className="mb-2 text-sm font-semibold text-amber-200">Construir {selected ? `→ ${BUILDINGS[selected].nombre} (clic en una loseta)` : '(elige un edificio)'}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ORDER.map((id) => (
            <button
              key={id}
              onClick={() => build(id)}
              className={`flex gap-2 rounded-lg border p-2 text-left text-xs transition ${selected === id ? 'border-amber-300 bg-amber-300/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              title={BUILDINGS[id].descripcion}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconFor(id)} alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded bg-black/40" onError={onImgFallback(iconFallback(id))} />
              <span>
                <div className="font-bold">{BUILDINGS[id].nombre}</div>
                <div className="text-white/60">{BUILDINGS[id].descripcion}</div>
                <div className="mt-1 text-amber-200/80">
                  {Object.entries(BUILDINGS[id].coste).map(([k, v]) => `${k}:${v}`).join(' · ') || 'gratis'}
                </div>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
