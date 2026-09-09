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
