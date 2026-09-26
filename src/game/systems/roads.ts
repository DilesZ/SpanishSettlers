// Red de caminos (lógica pura, testeable sin Phaser) — skill TDD.
// Los colonos prefieren caminar por caminos: el A* los pondera baratos
// (ROAD_COST) frente al campo a través (OFFROAD_COST) y van más rápido
// sobre ellos. El render vive en GameScene; aquí solo datos y costes.

export type RoadNet = Set<string>;

export const ROAD_COST = 1;
export const OFFROAD_COST = 4;

/** Bonus de velocidad sobre camino (×1.5 para colonos). */
export const ROAD_SPEED_BONUS = 1.5;

export function roadKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function createRoadNet(): RoadNet {
  return new Set<string>();
}

export function hasRoad(net: RoadNet, x: number, y: number): boolean {
  return net.has(roadKey(x, y));
}

/** Idempotente: pintar dos veces no duplica. */
export function addRoad(net: RoadNet, x: number, y: number): void {
  net.add(roadKey(x, y));
}

export function removeRoad(net: RoadNet, x: number, y: number): void {
  net.delete(roadKey(x, y));
}

export function roadCount(net: RoadNet): number {
  return net.size;
}

/** Vecinos ortogonales (4-dir, como el A*) que también tienen camino. */
export function roadNeighbors(net: RoadNet, x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (hasRoad(net, x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
  }
  return out;
}

/** Coste de entrar en una loseta para el A* ponderado. */
export function tileCost(net: RoadNet, x: number, y: number): number {
  return hasRoad(net, x, y) ? ROAD_COST : OFFROAD_COST;
}

/** BFS sobre la red de caminos: ¿conectado y a qué distancia por carretera?
 *  Council Fase 1: cortar un camino debe doler (ETA x2+2 campo a través).
 *  Puro y acotado (maxVisit) para no congelar el tick con redes grandes. */
export function roadDistance(
  net: RoadNet,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxVisit = 400,
): { connected: boolean; distance: number } {
  fromX = Math.round(fromX);
  fromY = Math.round(fromY);
  toX = Math.round(toX);
  toY = Math.round(toY);
  if (fromX === toX && fromY === toY) return { connected: true, distance: 0 };
  const fromOnRoad = hasRoad(net, fromX, fromY);
  const toOnRoad = hasRoad(net, toX, toY);
  // Si ninguno pisa camino, es campo a través puro (distancia Manhattan).
  if (!fromOnRoad && !toOnRoad) {
    return { connected: false, distance: Math.abs(fromX - toX) + Math.abs(fromY - toY) };
  }
  // BFS desde el/los puntos de entrada a la red.
  const start: { x: number; y: number }[] = [];
  if (fromOnRoad) start.push({ x: fromX, y: fromY });
  else {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (hasRoad(net, fromX + dx, fromY + dy)) start.push({ x: fromX + dx, y: fromY + dy });
    }
  }
  if (!start.length) {
    return { connected: false, distance: Math.abs(fromX - toX) + Math.abs(fromY - toY) + 2 };
  }
  const targetKeys = new Set<string>();
  targetKeys.add(roadKey(toX, toY));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    targetKeys.add(roadKey(toX + dx, toY + dy));
  }
  const seen = new Set<string>();
  const queue: { x: number; y: number; d: number }[] = start.map((p) => ({ ...p, d: fromOnRoad ? 0 : 1 }));
  for (const s of start) seen.add(roadKey(s.x, s.y));
  let visited = 0;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (++visited > maxVisit) break;
    if (targetKeys.has(roadKey(cur.x, cur.y))) {
      const tail = toOnRoad ? 0 : 1;
      return { connected: true, distance: cur.d + tail };
    }
    for (const nb of roadNeighbors(net, cur.x, cur.y)) {
      const k = roadKey(nb.x, nb.y);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ x: nb.x, y: nb.y, d: cur.d + 1 });
    }
  }
  return { connected: false, distance: Math.abs(fromX - toX) + Math.abs(fromY - toY) + 4 };
}

/** ¿Hay ruta por carretera entre dos banderas? (atajo legible para la sim). */
export function roadConnected(net: RoadNet, fromX: number, fromY: number, toX: number, toY: number): boolean {
  return roadDistance(net, fromX, fromY, toX, toY).connected;
}

/** Serialización para guardado (array de "x,y"). */
export function serializeRoads(net: RoadNet): string[] {
  return [...net];
}

export function deserializeRoads(items: string[] | undefined): RoadNet {
  const net = createRoadNet();
  if (!Array.isArray(items)) return net;
  for (const k of items) {
    if (typeof k !== 'string') continue;
    const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(k);
    if (!m) continue;
    // Normaliza llaves fraccionales de guardados antiguos a la rejilla.
    net.add(`${Math.round(Number(m[1]))},${Math.round(Number(m[2]))}`);
  }
  return net;
}
