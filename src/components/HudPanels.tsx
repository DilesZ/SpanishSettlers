// SpanishSettlers — paneles presentacionales del HUD (Anno/Northgard en web).
// Componentes puros: reciben datos por props y emiten callbacks. No leen ni
// escriben window.__game; todos los flujos viven en src/app/play/page.tsx.

import type { BuildingId, ResourceId } from '@/game/data/buildings';
import { iconFallback, iconFor, onImgFallback, resIconFor } from './hud-icons';

// Estilo unificado de tarjeta (verde noche + ámbar, tipografía del sistema).
const CARD =
  'rounded-xl border border-amber-200/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_10px_30px_-15px_rgba(0,0,0,0.8)]';
const CARD_TITLE = 'text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/90';

// ---------------------------------------------------------------- TopBar ---

interface TopBarProps {
  music: boolean;
  savedAt: string | null;
  onToggleMusic: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export function TopBar({ music, savedAt, onToggleMusic, onSave, onLoad }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-amber-200/15 bg-[#0b1410]/92 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 md:px-5">
        <a
          href="/"
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-amber-100/85 transition hover:border-amber-200/40 hover:bg-white/10 hover:text-amber-50"
        >
          ← Volver
        </a>
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/40 bg-gradient-to-br from-amber-300/25 via-amber-500/10 to-transparent text-lg font-black text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
          >
            S
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black tracking-wide text-amber-50 md:text-lg">
              Spanish<span className="text-amber-300">Settlers</span>
            </h1>
            <p className="hidden text-[11px] text-amber-100/60 sm:block">
              Clic en edificio = info · Minimapa = viajar
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleMusic}
            title="Música ambiental"
            aria-pressed={music}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-amber-100/85 transition hover:border-amber-200/40 hover:bg-white/10"
          >
            {music ? '♪ Música on' : '♪ Música off'}
          </button>
          <button
            onClick={onSave}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-amber-100/85 transition hover:border-amber-200/40 hover:bg-white/10"
          >
            💾 Guardar{savedAt ? ` · ${savedAt}` : ''}
          </button>
          <button
            onClick={onLoad}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-amber-100/85 transition hover:border-amber-200/40 hover:bg-white/10"
          >
            📂 Cargar
          </button>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------- ResourceBar ---

export function ResourceBar({ stock }: { stock: Record<string, number> | null }) {
  if (!stock) return null;
  return (
    <div
      role="status"
      aria-label="Recursos del almacén"
      className={`mt-3 overflow-x-auto rounded-xl border border-amber-200/15 bg-[#101a12]/95 px-2 py-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]`}
    >
      <div className="flex min-w-max items-stretch gap-1.5">
        {(Object.entries(stock) as [ResourceId, number][]).map(([k, v]) => (
          <span
            key={k}
            title={k}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.05] px-2.5 py-1.5 text-xs whitespace-nowrap"
          >
            {resIconFor(k) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resIconFor(k)!}
                alt=""
                aria-hidden
                width={16}
                height={16}
                className="h-4 w-4"
                onError={onImgFallback('')}
              />
            )}
            <span className="text-amber-100/70">{k}</span>
            <b className={`tabular-nums ${v < 1 ? 'text-red-200' : 'text-amber-50'}`}>{v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- ColonyPanel ---

export interface Objective {
  id: string;
  text: string;
  done: boolean;
}

export interface StallInfo {
  id: BuildingId;
  nombre: string;
  tx: number;
  ty: number;
  faltan: string[];
}

export interface PopInfo {
  pop: number;
  cap: number;
  morale: number;
  eating: number;
}

const moraleFace = (m: number) => (m >= 75 ? '😊' : m >= 50 ? '🙂' : m >= 35 ? '😐' : '😟');

interface ColonyPanelProps {
  objectives: Objective[];
  pop: PopInfo | null;
  stalls: StallInfo[];
  stock: Record<string, number> | null;
}

export function ColonyPanel({ objectives, pop, stalls, stock }: ColonyPanelProps) {
  if (objectives.length === 0 && !pop && stalls.length === 0) return null;
  const done = objectives.filter((o) => o.done).length;

  return (
    <section aria-label="Estado de la colonia" className={`${CARD} space-y-4 p-4`}>
      {objectives.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={CARD_TITLE}>🏆 Objetivos</h2>
            <span className="text-[11px] font-bold text-amber-100/80 tabular-nums">
              {done}/{objectives.length}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={objectives.length}
            aria-label="Progreso de objetivos"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all"
              style={{ width: `${objectives.length ? (done / objectives.length) * 100 : 0}%` }}
            />
          </div>
          <ul className="mt-2 space-y-1.5">
            {objectives.map((o) => (
              <li
                key={o.id}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs leading-5 ${
                  o.done
                    ? 'bg-emerald-400/10 text-emerald-100/90 line-through'
                    : 'bg-white/[0.04] text-amber-50/90'
                }`}
              >
                <span aria-hidden className={o.done ? 'text-emerald-300' : 'text-amber-300/70'}>
                  {o.done ? '✓' : '○'}
                </span>
                {o.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pop && (
        <div className="border-t border-white/[0.07] pt-3">
          <h2 className={CARD_TITLE}>👥 Población</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              title="Población / vivienda"
              className={`rounded-full border px-2.5 py-1 font-bold tabular-nums ${
                pop.pop >= pop.cap
                  ? 'border-red-400/50 bg-red-500/15 text-red-100'
                  : 'border-white/10 bg-white/[0.05] text-amber-50'
              }`}
            >
              👥 {pop.pop}/{pop.cap}
            </span>
            <span
              title="Moral de la colonia"
              className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 font-semibold text-amber-50 tabular-nums"
            >
              {moraleFace(pop.morale)} {pop.morale}
            </span>
            <span
              title="Comida consumida por segundo"
              className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-amber-100/75 tabular-nums"
            >
              🍞 −{pop.eating.toFixed(1)}/s
            </span>
          </div>
          {pop.pop >= pop.cap && (
            <p className="mt-2 rounded-lg border border-red-400/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-100">
              ⚠ Sin vivienda: la colonia no crece. Construye casas.
            </p>
          )}
          {stock && (stock.pan ?? 0) + (stock.pez ?? 0) <= 0.5 && (
            <p className="mt-2 rounded-lg border border-red-400/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-100">
              ⚠ Sin comida: tus colonos pasan hambre.
            </p>
          )}
        </div>
      )}

      {stalls.length > 0 && (
        <div className="border-t border-white/[0.07] pt-3">
          <h2 className={`${CARD_TITLE} !text-red-200/90`}>⚠ Producción parada ({stalls.length})</h2>
          <ul className="mt-2 space-y-1.5">
            {stalls.map((s) => (
              <li
                key={`${s.tx},${s.ty}`}
                className="rounded-lg border border-red-400/25 bg-red-500/[0.08] px-2.5 py-1.5 text-xs text-red-100"
              >
                <b>{s.nombre}</b>
                <span className="text-red-100/75"> · falta {s.faltan.join(', ') || '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------- InspectCard ---

export interface InspectInfo {
  id: BuildingId;
  nombre: string;
  descripcion: string;
  categoria: string;
  receta?: { in: [string, number][]; out: [string, number][] };
  produciendo: boolean;
  faltan?: string[];
  bando: 'tuya' | 'rival';
}

interface InspectCardProps {
  inspect: InspectInfo;
  onClose: () => void;
  onRecruit: () => void;
}

export function InspectCard({ inspect, onClose, onRecruit }: InspectCardProps) {
  const isRival = inspect.bando === 'rival';
  return (
    <section
      aria-label={`Inspección: ${inspect.nombre}`}
      className={`${CARD} relative overflow-hidden p-4 ${
        isRival ? '!border-red-400/40' : '!border-amber-300/30'
      }`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${
          isRival
            ? 'bg-gradient-to-r from-red-500/70 via-red-400/30 to-transparent'
            : 'bg-gradient-to-r from-amber-300/80 via-amber-300/25 to-transparent'
        }`}
      />
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconFor(inspect.id)}
          alt=""
          aria-hidden
          width={52}
          height={52}
          className="h-[52px] w-[52px] shrink-0 rounded-xl border border-white/10 bg-black/50 p-1"
          onError={onImgFallback(iconFallback(inspect.id))}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-base font-black text-amber-50">{inspect.nombre}</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-100/75 uppercase">
              {inspect.categoria}
            </span>
            {isRival && (
              <span className="rounded-full border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-black tracking-wide text-red-100 uppercase">
                ⚔ Rival
              </span>
            )}
            <span
              className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                inspect.produciendo
                  ? 'bg-emerald-400/15 text-emerald-100'
                  : 'bg-white/[0.06] text-amber-100/70'
              }`}
              title={inspect.produciendo ? 'Produciendo ahora mismo' : 'En pausa o sin trabajo'}
            >
              <span aria-hidden className={inspect.produciendo ? 'text-emerald-300' : 'text-amber-100/50'}>
                ●
              </span>
              {inspect.produciendo ? 'En marcha' : 'En pausa'}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-amber-50/85">{inspect.descripcion}</p>
          {inspect.receta && (
            <p className="mt-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs leading-5 text-amber-100/90">
              <span className="font-bold text-amber-200">⚙ Receta:</span>{' '}
              {inspect.receta.in.map(([k, v]) => `${v}× ${k}`).join(' + ') || '—'}
              {' → '}
              {inspect.receta.out.map(([k, v]) => `${v}× ${k}`).join(' + ')}
            </p>
          )}
          {inspect.faltan && inspect.faltan.length > 0 && (
            <p className="mt-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-100">
              ⚠ Parado: falta {inspect.faltan.join(', ')}
            </p>
          )}
          {inspect.id === 'cuartel' && (
            <button
              onClick={onRecruit}
              className="mt-2.5 rounded-full bg-gradient-to-b from-red-500 to-red-700 px-4 py-1.5 text-xs font-black tracking-wide text-red-50 uppercase shadow-[0_6px_16px_-6px_rgba(220,38,38,0.8)] transition hover:brightness-110 active:brightness-95"
            >
              ⚔ Reclutar (1⚔ + 1🍞)
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-amber-100/80 transition hover:border-amber-200/40 hover:bg-white/10"
        >
          Cerrar
        </button>
      </div>
    </section>
  );
}

// -------------------------------------------------------- EndingOverlay ---

export interface EndingInfo {
  status: string;
  wave: number;
  kills: number;
  buildings: number;
  timeSec: number;
}

export function EndingOverlay({ ending }: { ending: EndingInfo | null }) {
  if (!ending) return null;
  const victory = ending.status === 'victory';
  const mm = Math.floor(ending.timeSec / 60);
  const ss = String(ending.timeSec % 60).padStart(2, '0');
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={victory ? 'Victoria' : 'Derrota'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-2xl border bg-[#131b12] text-center shadow-2xl ${
          victory ? 'border-amber-300/50' : 'border-red-400/40'
        }`}
      >
        <div
          aria-hidden
          className={`h-1.5 w-full ${
            victory
              ? 'bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500'
              : 'bg-gradient-to-r from-red-800 via-red-500 to-red-800'
          }`}
        />
        <div className="p-8">
          <div aria-hidden className="text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
            {victory ? '🏆' : '💀'}
          </div>
          <p className="mt-3 text-[11px] font-bold tracking-[0.3em] text-amber-200/70 uppercase">
            {victory ? 'La colonia perdura' : 'La colonia cae'}
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-amber-50">
            {victory ? '¡Victoria!' : 'Derrota'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-amber-50/80">
            {victory
              ? `Rechazaste ${ending.wave} oleadas y tu colonia perdura entre trigales y faroles.`
              : 'Tu almacén ha caído. La colonia se dispersa entre las ruinas…'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-amber-50 tabular-nums">
              ⚔ {ending.kills} bajas
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-amber-50 tabular-nums">
              🏠 {ending.buildings} edificios
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-amber-50 tabular-nums">
              ⏱ {mm}:{ss}
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-full bg-gradient-to-b from-amber-200 to-amber-400 px-6 py-3 text-sm font-black tracking-wide text-black uppercase shadow-[0_10px_24px_-8px_rgba(251,191,36,0.7)] transition hover:brightness-105 active:brightness-95"
          >
            ↻ Jugar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
