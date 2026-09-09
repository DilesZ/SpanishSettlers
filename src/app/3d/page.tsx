'use client';

import dynamic from 'next/dynamic';

const ThreeCanvas = dynamic(() => import('@/components/ThreeCanvas'), { ssr: false });

export default function ThreePage() {
  return (
    <main className="min-h-screen bg-[#0b1410] text-amber-50">
      <header className="flex items-center justify-between border-b border-amber-200/15 px-4 py-3">
        <a href="/" className="text-sm text-amber-200/80 hover:text-amber-100">← Volver</a>
        <h1 className="text-lg font-bold tracking-wide">SpanishSettlers — prototipo 3D</h1>
        <span className="text-xs text-amber-200/70">Arrastra = mover · Rueda = zoom</span>
      </header>
      <div className="px-4 py-3"><ThreeCanvas /></div>
    </main>
  );
}
