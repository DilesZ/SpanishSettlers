import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1410] px-6 py-16 font-sans text-amber-50">
      <main className="w-full max-w-4xl rounded-2xl border border-amber-200/15 bg-white/5 p-8 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Estrategia en tiempo real · En tu navegador</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Spanish<span className="text-amber-300">Settlers</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70">
          Levanta tu colonia: tala, cantea, cultiva trigo que <b>crece de verdad</b>,
          hornea pan, funde hierro, bota barcos desde tu puerto, comercia con objetivos
          y <b>defiende tus murallas</b> de las oleadas incursores — de día y de noche.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/play"
            className="rounded-full bg-amber-300 px-6 py-3 text-sm font-bold text-black transition hover:bg-amber-200"
          >
            ▶ Jugar ahora
          </Link>
          <a
            href="https://github.com/DilesZ/SpanishSettlers"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            Ver repositorio
          </a>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shot-dia.png" alt="Colonia de día" className="w-full" />
            <figcaption className="bg-black/40 px-3 py-1 text-left text-xs text-white/60">De día: trigales, fauna y barcos</figcaption>
          </figure>
          <figure className="overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shot-noche.png" alt="Colonia de noche" className="w-full" />
            <figcaption className="bg-black/40 px-3 py-1 text-left text-xs text-white/60">De noche: faroles y estrellas</figcaption>
          </figure>
        </div>
          <div className="mt-6 grid grid-cols-1 gap-2 text-left text-xs text-white/60 sm:grid-cols-3">
            <div className="rounded-lg bg-black/30 p-3">🌾 <b>Economía viva:</b> 16 recursos, recetas, caminos, puerto y cosechas.</div>
            <div className="rounded-lg bg-black/30 p-3">⚔️ <b>Rival y defensa:</b> una colonia IA que crece, comercia y ataca; torres y 10 oleadas hasta la victoria.</div>
            <div className="rounded-lg bg-black/30 p-3">💾 <b>Tu ritmo:</b> guardado automático, objetivos y minimapa.</div>
          </div>
        <p className="mt-6 text-[11px] text-white/40">
          Arte de edificios, colonos y fauna © Widelands Development Team (GPL-2.0+).
          Código y resto de assets propios. Proyecto sin afiliación con Ubisoft/Blue Byte.
        </p>
      </main>
    </div>
  );
}
