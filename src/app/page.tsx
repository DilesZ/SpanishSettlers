import Link from "next/link";

const STATS = [
  { value: "16", label: "recursos" },
  { value: "22", label: "edificios" },
  { value: "10", label: "oleadas" },
  { value: "∞", label: "caminos" },
];

const CHAIN = [
  { glyph: "🪓", title: "Tala y cantea", text: "Madera, tablones y piedra para levantar cada casa." },
  { glyph: "🌾", title: "Cultiva de verdad", text: "Trigo que crece, molino, panadería y puerto pesquero." },
  { glyph: "⚔️", title: "Forja y defiende", text: "Minas, fundición, cuartel, torres y rival IA que ataca." },
];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#0b1410] px-4 py-10 font-sans text-amber-50 sm:px-6 sm:py-16">
      {/* Atmósfera cálida nocturna (solo CSS) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_-5%,rgba(251,191,36,0.12),transparent),radial-gradient(1000px_520px_at_85%_20%,rgba(34,197,94,0.12),transparent),radial-gradient(800px_600px_at_10%_90%,rgba(120,53,15,0.14),transparent)]"
      />

      <main className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-amber-200/15 bg-white/[0.04] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur">
        <div aria-hidden className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
        <div className="p-6 text-center sm:p-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.25em] text-amber-200 uppercase">
            <span aria-hidden>✦</span> Estrategia en tiempo real · En tu navegador
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
            Spanish<span className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">Settlers</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-amber-50/80 sm:text-base sm:leading-7">
            Levanta tu colonia: tala, cantea, cultiva trigo que <b className="text-amber-200">crece de verdad</b>,
            hornea pan, funde hierro, bota barcos desde tu puerto, comercia con objetivos
            y <b className="text-amber-200">defiende tus murallas</b> de las oleadas incursores — de día y de noche.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/play"
              className="w-full rounded-full bg-gradient-to-b from-amber-200 to-amber-400 px-8 py-3.5 text-sm font-black tracking-wide text-black uppercase shadow-[0_14px_30px_-10px_rgba(251,191,36,0.8)] transition hover:brightness-105 active:brightness-95 sm:w-auto"
            >
              ▶ Jugar ahora
            </Link>
            <a
              href="https://github.com/DilesZ/SpanishSettlers"
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-full border border-white/20 px-8 py-3.5 text-sm font-semibold text-amber-50/90 transition hover:border-amber-200/50 hover:bg-white/10 sm:w-auto"
            >
              Ver repositorio
            </a>
          </div>

          <dl className="mx-auto mt-7 grid max-w-lg grid-cols-4 gap-2">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-black/30 px-2 py-3">
                <dt className="order-2 mt-1 block text-[10px] font-semibold tracking-wider text-amber-100/60 uppercase">
                  {s.label}
                </dt>
                <dd className="text-2xl font-black text-amber-200 tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-2xl border border-amber-200/20 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/shot-dia.png" alt="Colonia de día con trigales, fauna y barcos" className="w-full" />
              <figcaption className="bg-black/50 px-3 py-2 text-left text-xs text-amber-100/75">
                ☀ De día: trigales, fauna y barcos
              </figcaption>
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-amber-200/20 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/shot-noche.png" alt="Colonia de noche con faroles y estrellas" className="w-full" />
              <figcaption className="bg-black/50 px-3 py-2 text-left text-xs text-amber-100/75">
                🌙 De noche: faroles y estrellas
              </figcaption>
            </figure>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
            {CHAIN.map((c) => (
              <div key={c.title} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div aria-hidden className="text-2xl">{c.glyph}</div>
                <h2 className="mt-1.5 text-sm font-black text-amber-100">{c.title}</h2>
                <p className="mt-1 text-xs leading-5 text-amber-50/75">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 text-left text-xs sm:grid-cols-3">
            <div className="rounded-xl bg-amber-300/[0.07] p-3 text-amber-50/85">🌾 <b className="text-amber-200">Economía viva:</b> 16 recursos, recetas, caminos, puerto y cosechas.</div>
            <div className="rounded-xl bg-amber-300/[0.07] p-3 text-amber-50/85">⚔️ <b className="text-amber-200">Rival y defensa:</b> una colonia IA que crece, comercia y ataca; torres y 10 oleadas hasta la victoria.</div>
            <div className="rounded-xl bg-amber-300/[0.07] p-3 text-amber-50/85">💾 <b className="text-amber-200">Tu ritmo:</b> guardado automático, objetivos y minimapa.</div>
          </div>

          <p className="mt-6 text-[11px] leading-5 text-amber-100/45">
            Arte de edificios, colonos y fauna © Widelands Development Team (GPL-2.0+).
            Código y resto de assets propios. Proyecto sin afiliación con Ubisoft/Blue Byte.
          </p>
        </div>
      </main>
    </div>
  );
}
