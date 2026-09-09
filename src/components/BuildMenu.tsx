// SpanishSettlers — menú de construcción por categorías (muelle estilo Anno).
// Presentacional: filtra ORDER por categoría y llama a onBuild/onRoad.
// El botón Camino se renderiza siempre, haya o no selección.

import { useState } from 'react';
import { BUILDINGS, type BuildingId, type ResourceId } from '@/game/data/buildings';
import {
  CATEGORIES,
  ORDER,
  iconFallback,
  iconFor,
  onImgFallback,
  resIconFor,
  type CategoryId,
} from './hud-icons';

interface BuildMenuProps {
  selected: BuildingId | null;
  roadMode: boolean;
  rival: number | null;
  stock: Record<string, number> | null;
  onBuild: (id: BuildingId) => void;
  onRoad: () => void;
}

export function BuildMenu({ selected, roadMode, rival, stock, onBuild, onRoad }: BuildMenuProps) {
  const [tab, setTab] = useState<CategoryId>('todos');

  const countFor = (c: CategoryId) =>
    c === 'todos' ? ORDER.length : ORDER.filter((id) => BUILDINGS[id].categoria === c).length;
  const visibleTabs = CATEGORIES.filter((c) => countFor(c.id) > 0);
  const ids = tab === 'todos' ? ORDER : ORDER.filter((id) => BUILDINGS[id].categoria === tab);

  const hint = selected
    ? `→ ${BUILDINGS[selected].nombre} (clic en una loseta)`
    : roadMode
      ? '→ Camino (clic o arrastra, ESC termina)'
      : '(elige un edificio)';

  return (
    <section aria-label="Menú de construcción" className="mt-3 overflow-hidden rounded-2xl border border-amber-200/15 bg-[#101a12]/95 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]">
      {/* Barra del muelle: estado + camino siempre visible + rival */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2.5 md:px-4">
        <h2 className="mr-auto text-sm font-bold text-amber-100">
          🧱 Construir <span className="font-semibold text-amber-100/70">{hint}</span>
        </h2>
        {rival !== null && rival > 0 && (
          <span
            title="Edificios de la colonia rival"
            className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-100 tabular-nums"
          >
            ⚔ Rival: {rival}
          </span>
        )}
        <button
          onClick={onRoad}
          title="Traza caminos: los colonos los prefieren y van más rápido por ellos"
          aria-pressed={roadMode}
          className={`rounded-full border px-4 py-1.5 text-xs font-black tracking-wide uppercase transition ${
            roadMode
              ? 'border-amber-300 bg-amber-300/20 text-amber-100 shadow-[0_0_16px_-4px_rgba(251,191,36,0.8)]'
              : 'border-amber-200/30 bg-gradient-to-b from-white/10 to-white/[0.03] text-amber-50 hover:border-amber-200/60 hover:bg-white/10'
          }`}
        >
          🛤 Camino
        </button>
      </div>

      {/* Pestañas por categoría */}
      <div role="tablist" aria-label="Categorías de edificios" className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 md:px-4">
        {visibleTabs.map((c) => {
          const active = tab === c.id;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                active
                  ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                  : 'border-white/10 bg-white/[0.04] text-amber-100/70 hover:border-amber-200/30 hover:text-amber-50'
              }`}
            >
              <span aria-hidden>{c.glyph}</span>
              {c.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? 'bg-amber-300/25 text-amber-100' : 'bg-black/40 text-amber-100/60'
                }`}
              >
                {countFor(c.id)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tarjetas */}
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:p-4">
        {ids.map((id) => {
          const def = BUILDINGS[id];
          const costs = Object.entries(def.coste) as [ResourceId, number][];
          const costText = costs.map(([k, v]) => `${v}× ${k}`).join(' + ') || 'gratis';
          const affordable =
            !stock || costs.every(([k, v]) => (stock[k] ?? 0) >= v);
          const active = selected === id;
          return (
            <button
              key={id}
              onClick={() => onBuild(id)}
              aria-pressed={active}
              title={`${def.descripcion} — Coste: ${costText} · Obra: ${Math.round(def.tiempoConstruccionMs / 1000)} s`}
              className={`group flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                active
                  ? 'border-amber-300/80 bg-amber-300/[0.13] shadow-[0_0_20px_-6px_rgba(251,191,36,0.7)]'
                  : 'border-white/[0.08] bg-white/[0.04] hover:border-amber-200/40 hover:bg-white/[0.07]'
              } ${affordable ? '' : 'opacity-85'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={iconFor(id)}
                alt=""
                aria-hidden
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-lg border border-white/10 bg-black/50 p-0.5 transition group-hover:scale-105"
                onError={onImgFallback(iconFallback(id))}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black text-amber-50">
                  {def.nombre}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-amber-100/65">
                  {def.descripcion}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {costs.length === 0 && (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-100">
                      gratis
                    </span>
                  )}
                  {costs.map(([k, v]) => {
                    const lack = (stock?.[k] ?? 0) < v;
                    return (
                      <span
                        key={k}
                        title={`${v}× ${k}`}
                        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                          lack && stock
                            ? 'border-red-400/40 bg-red-500/10 text-red-100'
                            : 'border-white/10 bg-black/30 text-amber-100/90'
                        }`}
                      >
                        {resIconFor(k) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resIconFor(k)!}
                            alt=""
                            aria-hidden
                            width={14}
                            height={14}
                            className="h-3.5 w-3.5"
                            onError={onImgFallback('')}
                          />
                        ) : (
                          <span aria-hidden>·</span>
                        )}
                        {v} {k}
                      </span>
                    );
                  })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
