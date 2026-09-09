import { describe, expect, it } from 'vitest';
import { findPath, smoothPath, type GridPos } from '@/game/systems/pathfinding';

const W = 10;
const H = 10;
const free = () => false;

describe('A* colonos', () => {
  it('ruta recta en mapa libre', () => {
    const p = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, W, H, free);
    expect(p).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  });

  it('rodea un lago', () => {
    const blocked = (x: number, y: number) => x >= 2 && x <= 4 && y >= 0 && y <= 4;
    const p = findPath({ x: 0, y: 2 }, { x: 6, y: 2 }, W, H, blocked);
    expect(p).not.toBeNull();
    for (const n of p!) {
      expect(blocked(n.x, n.y)).toBe(false);
    }
    expect(p![p!.length - 1]).toEqual({ x: 6, y: 2 });
  });

  it('el destino bloqueado (edificio) sigue siendo alcanzable', () => {
    const blocked = (x: number, y: number) => x === 5 && y === 5;
    const p = findPath({ x: 3, y: 5 }, { x: 5, y: 5 }, W, H, blocked);
    expect(p).not.toBeNull();
    expect(p![p!.length - 1]).toEqual({ x: 5, y: 5 });
  });

  it('sin ruta devuelve null', () => {
    const blocked = (x: number, _y: number) => x === 1;
    expect(findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, 3, 1, blocked)).toBeNull();
  });

  it('suavizado colapsa rectas', () => {
    const line: GridPos[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    expect(smoothPath(line, free)).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
  });

  it('suavizado no atraviesa bloqueos', () => {
    const blocked = (x: number, y: number) => x === 1 && y === 1;
    const path: GridPos[] = [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }];
    const s = smoothPath(path, blocked);
    expect(s[0]).toEqual({ x: 0, y: 1 });
    expect(s[s.length - 1]).toEqual({ x: 2, y: 2 });
  });

  it('coste ponderado: prefiere el camino aunque sea más largo', () => {
    // Corredor barato por y=2 frente a la recta por y=0 (cara).
    const costFn = (_x: number, y: number) => (y === 2 ? 1 : 10);
    const p = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, 5, 3, free, 4000, costFn);
    expect(p).not.toBeNull();
    expect(p!.some((n) => n.y === 2)).toBe(true);
  });

  it('sin costFn el comportamiento no cambia (coste uniforme)', () => {
    const p = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, W, H, free);
    expect(p).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  });
});
