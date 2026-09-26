// A* sobre rejilla de losetas para colonos (lógica pura, testeable).
// Vecindad de 4 (aristas del diamante): el coste iso es uniforme y se evitan
// los cortes en diagonal a través de esquinas bloqueadas.
// Council Fase 1 (Skeptic): open-list con heap binario O(log n) en vez de
// escaneo lineal O(n) + caché LRU para no recalcular la misma ruta cada tick.

export interface GridPos { x: number; y: number }

export type BlockedFn = (x: number, y: number) => boolean;

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function heuristic(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Heap binario mínimo por f-score (reemplaza el escaneo lineal O(n)). */
class MinHeap {
  private items: { pos: GridPos; f: number }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(pos: GridPos, f: number): void {
    const a = this.items;
    a.push({ pos, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): GridPos | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0].pos;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// Caché LRU de rutas (los porteadores repiten almacén↔edificio cada pocos
// segundos; evita recalcular A* idénticos). Solo para costFn estable por
// versión de red: la escena la invalida al pintar/quitar camino o edificio.
const PATH_CACHE = new Map<string, GridPos[]>();
const PATH_CACHE_MAX = 240;
let pathCacheVersion = 0;

export function bumpPathCache(): void {
  pathCacheVersion++;
  if (PATH_CACHE.size > PATH_CACHE_MAX) PATH_CACHE.clear();
}

export function clearPathCache(): void {
  PATH_CACHE.clear();
}

function cacheKey(start: GridPos, goal: GridPos, costTag: string): string {
  return `${pathCacheVersion}|${start.x},${start.y}>${goal.x},${goal.y}|${costTag}`;
}

/** Camino de start a goal (ambos incluidos) o null si no hay ruta.
 *  costFn pondera entrar en cada loseta (por defecto 1: coste uniforme).
 *  Úsalo con tileCost() de roads.ts para que los colonos prefieran caminos. */
export function findPath(
  start: GridPos,
  goal: GridPos,
  width: number,
  height: number,
  blocked: BlockedFn,
  maxIter = 4000,
  costFn: (x: number, y: number) => number = () => 1,
): GridPos[] | null {
  if (start.x === goal.x && start.y === goal.y) return [{ ...start }];
  // el destino siempre es transitable (edificio/mina/árbol al que se va)
  const isBlocked = (x: number, y: number) =>
    (x === goal.x && y === goal.y) ? false : blocked(x, y);
  if (isBlocked(start.x, start.y)) return null;

  const open = new MinHeap();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  const closed = new Set<string>();
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let iter = 0;

  open.push({ ...start }, heuristic(start, goal));

  while (open.size > 0) {
    if (++iter > maxIter) return null;
    const current = open.pop()!;
    const curKey = key(current.x, current.y);
    if (closed.has(curKey)) continue;
    closed.add(curKey);
    if (current.x === goal.x && current.y === goal.y) {
      const path: GridPos[] = [current];
      let k = key(current.x, current.y);
      while (cameFrom.has(k)) {
        k = cameFrom.get(k)!;
        const [x, y] = k.split(',').map(Number);
        path.unshift({ x, y });
      }
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (isBlocked(nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const tentative = (gScore.get(key(current.x, current.y)) ?? Infinity) + Math.max(0.1, costFn(nx, ny));
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, key(current.x, current.y));
        gScore.set(nk, tentative);
        open.push({ x: nx, y: ny }, tentative + heuristic({ x: nx, y: ny }, goal));
      }
    }
  }
  return null;
}

/**
 * A* con caché LRU para rutas repetidas (porteadores almacén↔edificio).
 * costTag debe cambiar si la red de caminos cambia (usa bumpPathCache()).
 */
export function findPathCached(
  start: GridPos,
  goal: GridPos,
  width: number,
  height: number,
  blocked: BlockedFn,
  maxIter = 4000,
  costFn: (x: number, y: number) => number = () => 1,
  costTag = 'default',
): GridPos[] | null {
  const ck = cacheKey(start, goal, costTag);
  const hit = PATH_CACHE.get(ck);
  if (hit) return hit.map((p) => ({ ...p }));
  const res = findPath(start, goal, width, height, blocked, maxIter, costFn);
  if (res) {
    if (PATH_CACHE.size >= PATH_CACHE_MAX) {
      const first = PATH_CACHE.keys().next().value;
      if (first) PATH_CACHE.delete(first);
    }
    PATH_CACHE.set(ck, res.map((p) => ({ ...p })));
  }
  return res;
}

/** Suaviza el camino eliminando nodos intermedios en línea recta libre. */
export function smoothPath(path: GridPos[], blocked: BlockedFn): GridPos[] {
  if (path.length < 3) return path;
  const out: GridPos[] = [path[0]];
  let anchor = 0;
  const clearLine = (a: GridPos, b: GridPos): boolean => {
    // solo líneas rectas (el suavizado no crea diagonales)
    if (a.x !== b.x && a.y !== b.y) return false;
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x + dx;
    let y = a.y + dy;
    while (x !== b.x || y !== b.y) {
      if (blocked(x, y)) return false;
      x += dx;
      y += dy;
    }
    return true;
  };
  for (let i = 2; i < path.length; i++) {
    if (!clearLine(path[anchor], path[i])) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}
