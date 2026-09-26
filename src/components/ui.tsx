// SpanishSettlers — primitivas visuales compartidas (pureza).
// Una sola tarjeta, una sola pastilla, un solo título de sección, un solo
// aviso. Los paneles no duplican clases: importan de aquí. Sin lógica.

import type { ReactNode } from 'react';

/** Tarjeta base: mismo radio, borde, fondo y sombra en todo el HUD. */
export const CARD =
  'rounded-2xl border border-amber-200/15 bg-[#101a12]/95 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]';

/** Micro-título de sección en versales ámbar. */
export const SECTION_TITLE =
  'text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/90';

export function Card({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={`${CARD} space-y-4 p-4 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={SECTION_TITLE}>{children}</h2>;
}

/** Pastilla de dato (censo, moral, ritmo, transporte). */
export function Chip({
  title,
  className = '',
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-amber-50 tabular-nums ${className}`}
    >
      {children}
    </span>
  );
}

/** Aviso rojo unificado (vivienda, comida, producción parada). */
export function Warn({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-100">
      {children}
    </p>
  );
}
