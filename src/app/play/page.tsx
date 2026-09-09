'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { playSfx, unlockAudio } from '@/game/audio';
import { isMusicEnabled, setMusicEnabled, startMusic } from '@/game/music';
import { BUILDINGS, type BuildingId, type ResourceId } from '@/game/data/buildings';

// Dynamic import: el canvas pesado solo en cliente (skill bundle-dynamic-imports).
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });

// Pack de arte por proyecto Vercel (NEXT_PUBLIC_PACK=a|b). En local (sin env)
// se usa 'b' (arte wl commiteado) para evitar 404s con fallback parpadeante.
const PACK = process.env.NEXT_PUBLIC_PACK === 'a' ? 'a' : 'b';

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
  faltan?: string[];
  bando: 'tuya' | 'rival';
}

interface Stall {
  id: BuildingId;
  nombre: string;
  tx: number;
  ty: number;
  faltan: string[];
}

interface Pop {
  pop: number;
  cap: number;
  morale: number;
  eating: number;
}

const moraleFace = (m: number) => (m >= 75 ? '😊' : m >= 50 ? '🙂' : m >= 35 ? '😐' : '😟');

export default function PlayPage() {
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const [roadMode, setRoadMode] = useState(false);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [pop, setPop] = useState<Pop | null>(null);
  const [rival, setRival] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [music, setMusic] = useState(true);
  const [objectives, setObjectives] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [ending, setEnding] = useState<{ status: string; wave: number; kills: number; buildings: number; timeSec: number } | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const w = window as unknown as {
        __stock?: Record<string, number>;
        __inspect?: Inspect | null;
        __game?: {
          objectives: () => { id: string; text: string; done: boolean }[];
          status: () => { status: string; wave: number; kills: number; buildings: number; timeSec: number; rival: number; aiBase: { x: number; y: number } | null; ai: { espada: number; pan: number; hierro: number; carbon: number; lingote: number; troops: number; raids: number } };
          stalls: () => Stall[];
          pop: () => Pop;
        };
      };
      if (w.__stock) setStock({ ...w.__stock });
      if ('__inspect' in w) {
        setInspect(w.__inspect ?? null);
        delete w.__inspect;
      }
      try {
        const objs = w.__game?.objectives();
        if (objs) setObjectives(objs);
        const st = w.__game?.status();
        if (st && st.status !== 'playing') setEnding(st);
        else if (st) setEnding(null);
        if (st) setRival(st.rival);
        const sl = w.__game?.stalls();
        if (sl) setStalls(sl);
        const pp = w.__game?.pop();
        if (pp) setPop(pp);
      } catch { /* juego aún arrancando */ }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const game = () => (window as unknown as {
    __game?: {
      place: (id: BuildingId) => void;
      road: () => void;
      save: () => string | null;
      load: () => boolean;
      hasSave: () => string | null;
    };
  }).__game;

  const refreshSave = () => setSavedAt(game()?.hasSave() ?? null);

  useEffect(() => {
    const t = setInterval(refreshSave, 5000);
    const id = setTimeout(refreshSave, 3000);
    return () => { clearInterval(t); clearTimeout(id); };
  }, []);

  useEffect(() => {
    setMusic(isMusicEnabled());
    const start = () => startMusic();
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, []);

  const toggleMusic = () => {
    const next = !music;
    setMusic(next);
    setMusicEnabled(next);
    if (next) startMusic();
  };

  const build = (id: BuildingId) => {
    unlockAudio();
    playSfx('click');
    game()?.place(id);
    setSelected(id);
    setRoadMode(false);
    setInspect(null);
  };

  const startRoad = () => {
    unlockAudio();
    playSfx('click');
    game()?.road();
    setRoadMode(true);
    setSelected(null);
    setInspect(null);
  };

  const doSave = () => {
    unlockAudio();
    const at = game()?.save() ?? null;
    setSavedAt(at);
  };

  const doLoad = () => {
    unlockAudio();
    if (game()?.load()) setInspect(null);
  };

  return (
    <main className="min-h-screen bg-[#0b1410] text-amber-50">
      <header className="flex items-center justify-between border-b border-amber-200/15 px-4 py-3">
        <a href="/" className="text-sm text-amber-200/80 hover:text-amber-100">← Volver</a>
        <h1 className="text-lg font-bold tracking-wide">SpanishSettlers — partida web</h1>
        <div className="flex items-center gap-2 text-xs text-amber-200/70">
          <span className="hidden md:inline">Clic en edificio = info · Minimapa = viajar</span>
          <button onClick={toggleMusic} className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10" title="Música ambiental">
            {music ? '♪ On' : '♪ Off'}
          </button>
          <button onClick={doSave} className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">💾 Guardar{savedAt ? ` (${savedAt})` : ''}</button>
          <button onClick={doLoad} className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">📂 Cargar</button>
        </div>
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

      {ending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="max-w-md rounded-2xl border border-amber-300/40 bg-[#141b12] p-8 text-center">
            <div className="text-5xl">{ending.status === 'victory' ? '🏆' : '💀'}</div>
            <h2 className="mt-2 text-2xl font-black">
              {ending.status === 'victory' ? '¡Victoria!' : 'Derrota'}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              {ending.status === 'victory'
                ? `Rechazaste ${ending.wave} oleadas y tu colonia perdura.`
                : 'Tu almacén ha caído. La colonia se dispersa...'}
            </p>
            <div className="mt-3 flex justify-center gap-3 text-xs text-white/80">
              <span>⚔ {ending.kills} bajas</span>
              <span>🏠 {ending.buildings} edificios</span>
              <span>⏱ {Math.floor(ending.timeSec / 60)}:{String(ending.timeSec % 60).padStart(2, '0')}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-full bg-amber-300 px-6 py-2 text-sm font-bold text-black hover:bg-amber-200"
            >
              ↻ Jugar de nuevo
            </button>
          </div>
        </div>
      )}

      {objectives.length > 0 && (
        <section className="mx-4 mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          <div className="mb-1 font-bold text-amber-200">🏆 Objetivos ({objectives.filter((o) => o.done).length}/{objectives.length})</div>
          <div className="flex flex-wrap gap-2">
            {objectives.map((o) => (
              <span key={o.id} className={`rounded-full px-2 py-1 ${o.done ? 'bg-green-700/40 text-green-200 line-through' : 'bg-white/10 text-white/80'}`}>
                {o.done ? '✓ ' : '○ '}{o.text}
              </span>
            ))}
          </div>
        </section>
      )}

      {pop && (
        <section className="mx-4 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <span title="Población / vivienda" className={pop.pop >= pop.cap ? 'font-bold text-red-300' : 'text-white/85'}>
            👥 {pop.pop}/{pop.cap}
          </span>
          <span title="Moral de la colonia" className="text-white/85">
            {moraleFace(pop.morale)} {pop.morale}
          </span>
          <span title="Comida consumida por segundo" className="text-white/60">
            🍞 −{pop.eating.toFixed(1)}/s
          </span>
          {pop.pop >= pop.cap && (
            <span className="font-semibold text-red-300">⚠ Sin vivienda: no crece</span>
          )}
          {stock && (stock.pan ?? 0) + (stock.pez ?? 0) <= 0.5 && (
            <span className="font-semibold text-red-300">⚠ Sin comida: hambre</span>
          )}
        </section>
      )}

      {stalls.length > 0 && (
        <section className="mx-4 mt-2 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-xs">
          <div className="mb-1 font-bold text-red-200">⚠ Producción parada ({stalls.length})</div>
          <div className="flex flex-wrap gap-2">
            {stalls.map((s) => (
              <span key={`${s.tx},${s.ty}`} className="rounded-full bg-red-900/40 px-2 py-1 text-red-100">
                {s.nombre}: falta {s.faltan.join(', ') || '—'}
              </span>
            ))}
          </div>
        </section>
      )}

      {inspect && (
        <section className="mx-4 mt-2 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconFor(inspect.id)} alt="" width={40} height={40} className="h-10 w-10 rounded bg-black/40" onError={onImgFallback(iconFallback(inspect.id))} />
          <div className="flex-1">
            <div className="font-bold">{inspect.nombre} <span className="ml-1 rounded bg-white/10 px-1 text-[10px] text-white/60">{inspect.categoria}</span>
              {inspect.bando === 'rival' && (
                <span className="ml-1 rounded bg-red-500/30 px-1 text-[10px] font-bold text-red-200">⚔ Rival</span>
              )}
            </div>
            <div className="text-white/70">{inspect.descripcion}</div>
            {inspect.receta && (
              <div className="mt-1 text-amber-200/90">
                Produce: {inspect.receta.in.map(([k, v]) => `${v}×${k}`).join(' + ') || '—'} → {inspect.receta.out.map(([k, v]) => `${v}×${k}`).join(' + ')}
                {inspect.produciendo ? ' ●' : ' ○'}
              </div>
            )}
            {inspect.faltan && inspect.faltan.length > 0 && (
              <div className="mt-1 font-semibold text-red-300">
                ⚠ Parado: falta {inspect.faltan.join(', ')}
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
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-amber-200">
            Construir {selected ? `→ ${BUILDINGS[selected].nombre} (clic en una loseta)` : roadMode ? '→ Camino (clic o arrastra, ESC termina)' : '(elige un edificio)'}
          </h2>
          <button
            onClick={startRoad}
            title="Traza caminos: los colonos los prefieren y van más rápido por ellos"
            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${roadMode ? 'border-amber-300 bg-amber-300/20 text-amber-100' : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}
          >
            🛤 Camino
          </button>
          {rival !== null && rival > 0 && (
            <span title="Edificios de la colonia rival" className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">
              ⚔ Rival: {rival}
            </span>
          )}
        </div>
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
