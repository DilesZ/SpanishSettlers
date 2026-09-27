'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { playSfx, unlockAudio } from '@/game/audio';
import { isMusicEnabled, setMusicEnabled, startMusic } from '@/game/music';
import type { BuildingId } from '@/game/data/buildings';
import { BuildMenu } from '@/components/BuildMenu';
import { ColonyPanel, EndingOverlay, InspectCard, QuestTracker, ResourceBar, SiegeBar, SpeedControl, TopBar, type QuestInfo, type SiegeInfo, type TransportInfo } from '@/components/HudPanels';

// Dynamic import: el canvas pesado solo en cliente (skill bundle-dynamic-imports).
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });

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
  const [speed, setSpeed] = useState(1);
  const [transport, setTransport] = useState<TransportInfo | null>(null);
  const [explored, setExplored] = useState<number | null>(null);
  const [siege, setSiege] = useState<SiegeInfo | null>(null);
  const [quest, setQuest] = useState<QuestInfo | null>(null);

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
          transport: () => TransportInfo;
          map: () => { explored: number };
          siege: () => SiegeInfo;
          quest: () => QuestInfo & { target: BuildingId | null };
          speed: () => number;
          setSpeed: (s: number) => void;
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
        try {
          const tr = w.__game?.transport();
          if (tr) setTransport(tr);
          const mp = w.__game?.map();
          if (mp && typeof mp.explored === 'number') setExplored(mp.explored);
          const sg = w.__game?.siege();
          if (sg && typeof sg.nextWaveIn === 'number') setSiege(sg);
          const qu = w.__game?.quest();
          if (qu && typeof qu.step === 'number') setQuest(qu);
          const sp = w.__game?.speed();
          if (typeof sp === 'number') setSpeed(sp);
        } catch { /* transporte aún no listo */ }
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
      setSpeed: (s: number) => void;
    };
  }).__game;

  const changeSpeed = (s: number) => {
    unlockAudio();
    game()?.setSpeed(s);
    setSpeed(s);
  };

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

  const recruit = () => {
    unlockAudio();
    const w = window as unknown as { __game?: { recruit: () => boolean } };
    w.__game?.recruit();
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
    <main className="min-h-screen bg-[#0b1410] font-sans text-amber-50">
      {/* Atmósfera: resplandores verdes/noche + veta ámbar (solo CSS, sin assets) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_420px_at_15%_-5%,rgba(251,191,36,0.08),transparent),radial-gradient(1000px_500px_at_90%_10%,rgba(34,197,94,0.10),transparent),radial-gradient(700px_600px_at_50%_110%,rgba(120,53,15,0.12),transparent)]" />

      <TopBar music={music} savedAt={savedAt} onToggleMusic={toggleMusic} onSave={doSave} onLoad={doLoad} />

      <div className="relative mx-auto w-full max-w-[1440px] px-3 pb-8 md:px-5">
        <ResourceBar stock={stock} />
        <SpeedControl speed={speed} transport={transport} explored={explored} onSpeed={changeSpeed} />
        <QuestTracker quest={quest} />
        <SiegeBar siege={siege} />

        <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          {/* Construcción: lateral en xl (una sola instancia, compacta por CSS) */}
          <aside aria-label="Construcción" className="order-2 min-w-0 lg:col-span-2 xl:order-1 xl:col-span-1">
            <BuildMenu
              selected={selected}
              roadMode={roadMode}
              rival={rival}
              stock={stock}
              questTarget={quest && !quest.complete ? (quest as QuestInfo & { target: BuildingId | null }).target : null}
              onBuild={build}
              onRoad={startRoad}
            />
          </aside>
          {/* Columna principal: mapa + inspección */}
          <div className="order-1 min-w-0 space-y-3 xl:order-2">
            <section aria-label="Mapa de la colonia" className="overflow-hidden rounded-2xl border border-amber-200/15 bg-[#0d1f16] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2 md:px-4">
                <span aria-hidden className="flex gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <i className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                  <i className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </span>
                <p className="text-xs font-bold tracking-wide text-amber-100/85">
                  🗺 Isla principal
                </p>
                <p className="ml-auto hidden text-[11px] text-amber-100/55 sm:block">
                  Arrastra para mover · Rueda para zoom · Clic en edificio = info · Clic en colono = ordenar
                </p>
                {(selected || roadMode) && (
                  <p role="status" className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-100">
                    {selected ? `🧱 Colocando: ${selected}` : '🛤 Trazando camino (ESC termina)'}
                  </p>
                )}
              </div>
              <div className="p-2 md:p-2.5">
                <GameCanvas />
              </div>
            </section>

            {inspect && (
              <InspectCard inspect={inspect} onClose={() => setInspect(null)} onRecruit={recruit} />
            )}
          </div>

          {/* Columna lateral: ayuda (las misiones van bajo el mapa) */}
          <aside className="order-3 min-w-0 space-y-3">
            <section aria-label="Ayuda rápida" className="rounded-2xl border border-amber-200/15 bg-[#101a12]/95 p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/90">
                🧭 Guía del colono
              </h2>
              <ol className="mt-2 space-y-1.5 text-xs leading-5 text-amber-50/85">
                <li><b className="text-amber-200">1.</b> Tala y cantea: cabaña + cantera primero.</li>
                <li><b className="text-amber-200">2.</b> Come: granja → molino → panadería + pozo.</li>
                <li><b className="text-amber-200">3.</b> Forja: minas → fundición → armería → cuartel.</li>
                <li><b className="text-amber-200">4.</b> Une todo con 🛤 caminos: sin camino la mercancía tarda (📦 pilas, 🚚 atascos).</li>
                <li><b className="text-amber-200">5.</b> Explora con 🔭 (cada torre suma uno): la 🌫 niebla esconde terreno y al rival.</li>
                <li><b className="text-amber-200">6.</b> Vigila ⚠ paradas y guarnece torres: el rival ataca.</li>
                <li><b className="text-amber-200">7.</b> Clic en un colono y luego en el mapa para mandarlo a un punto.</li>
              </ol>
            </section>
          </aside>
        </div>

        {/* Misiones y estado bajo el mapa (ancho completo) */}
        <div className="mt-3">
          <ColonyPanel objectives={objectives} pop={pop} stalls={stalls} stock={stock} />
        </div>

        <footer className="mt-4 text-center text-[11px] leading-5 text-amber-100/45">
          Arte de edificios, colonos y fauna © Widelands Development Team (GPL-2.0+). Proyecto sin
          afiliación con Ubisoft/Blue Byte.
        </footer>
      </div>

      <EndingOverlay ending={ending} />
    </main>
  );
}
