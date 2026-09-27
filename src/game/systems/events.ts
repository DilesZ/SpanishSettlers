// Ticker de eventos (lógica pura, testeable) — cinta de avisos estilo género.
// Textos propios y neutros; el juego emite, React muestra los últimos.

export interface GameEvent {
  id: number;
  text: string;
}

export function pushEvent(
  log: GameEvent[],
  nextId: number,
  text: string,
  cap = 30,
): { log: GameEvent[]; nextId: number } {
  const out = [...log, { id: nextId, text }];
  while (out.length > cap) out.shift();
  return { log: out, nextId: nextId + 1 };
}
