// A* sobre rejilla de losetas para colonos (lógica pura, testeable).
// Vecindad de 4 (aristas del diamante): el coste iso es uniforme y se evitan
// los cortes en diagonal a través de esquinas bloqueadas.

export interface GridPos { x: number; y: number }

export type BlockedFn = (x: number, y: number) => boolean;

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function heuristic(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Camino de start a goal (ambos incluidos) o null si no hay ruta. */
export function findPath(
  start: GridPos,
  goal: GridPos,
  width: number,
  height: number,
  blocked: BlockedFn,
  maxIter = 4000,
): GridPos[] | null {
  if (start.x === goal.x && start.y === goal.y) return [{ ...start }];
  // el destino siempre es transitable (edificio/mina/árbol al que se va)
  const isBlocked = (x: number, y: number) =>
    (x === goal.x && y === goal.y) ? false : blocked(x, y);
  if (isBlocked(start.x, start.y)) return null;

  const open: GridPos[] = [{ ...start }];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  const inOpen = new Set<string>([key(start.x, start.y)]);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let iter = 0;

  const fOf = (p: GridPos) => (gScore.get(key(p.x, p.y)) ?? Infinity) + heuristic(p, goal);

  while (open.length > 0) {
    if (++iter > maxIter) return null;
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (fOf(open[i]) < fOf(open[bi])) bi = i;
    }
    const current = open.splice(bi, 1)[0];
    inOpen.delete(key(current.x, current.y));
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
      const tentative = (gScore.get(key(current.x, current.y)) ?? Infinity) + 1;
      if (tentative < (gScore.get(key(nx, ny)) ?? Infinity)) {
        cameFrom.set(key(nx, ny), key(current.x, current.y));
        gScore.set(key(nx, ny), tentative);
        if (!inOpen.has(key(nx, ny))) {
          open.push({ x: nx, y: ny });
          inOpen.add(key(nx, ny));
        }
      }
    }
  }
  return null;
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
