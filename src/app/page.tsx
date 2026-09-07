import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1410] px-6 py-16 font-sans text-amber-50">
      <main className="w-full max-w-3xl rounded-2xl border border-amber-200/15 bg-white/5 p-8 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Proyecto original · Hecho con Next.js + Phaser</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Spanish<span className="text-amber-300">Settlers</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70">
          Clon web <b>no oficial e inspirado</b> en los RTS clásicos de colonos: tala, cantea,
          cultiva grano, hornea pan para tus mineros, funde hierro, forja herramientas y
          espadas, expande tu territorio con torres y defiende tu colonia.
          Todo el código y arte de esta web son originales.
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
        <div className="mt-6 grid grid-cols-1 gap-2 text-left text-xs text-white/60 sm:grid-cols-3">
          <div className="rounded-lg bg-black/30 p-3">🌲 <b>Economía viva:</b> 16 recursos y 8 recetas encadenadas.</div>
          <div className="rounded-lg bg-black/30 p-3">🗼 <b>Territorio:</b> torres y cuartel, soldados N1-N3.</div>
          <div className="rounded-lg bg-black/30 p-3">⚔️ <b>Táctica:</b> tu fuerza fuera de casa depende de tu economía.</div>
        </div>
      </main>
    </div>
  );
}
