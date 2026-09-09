import { describe, expect, it } from 'vitest';
import {
  addRoad,
  createRoadNet,
  hasRoad,
  OFFROAD_COST,
  removeRoad,
  ROAD_COST,
  roadCount,
  roadNeighbors,
  tileCost,
} from '@/game/systems/roads';

describe('red de caminos', () => {
  it('añadir / consultar / quitar losetas', () => {
    const net = createRoadNet();
    expect(hasRoad(net, 3, 4)).toBe(false);
    addRoad(net, 3, 4);
    expect(hasRoad(net, 3, 4)).toBe(true);
    expect(roadCount(net)).toBe(1);
    addRoad(net, 3, 4); // idempotente
    expect(roadCount(net)).toBe(1);
    removeRoad(net, 3, 4);
    expect(hasRoad(net, 3, 4)).toBe(false);
  });

  it('vecinos solo ortogonales con camino', () => {
    const net = createRoadNet();
    addRoad(net, 5, 5);
    addRoad(net, 5, 6);
    addRoad(net, 6, 5);
    const nb = roadNeighbors(net, 5, 5);
    expect(nb).toContainEqual({ x: 5, y: 6 });
    expect(nb).toContainEqual({ x: 6, y: 5 });
    expect(nb).toHaveLength(2);
  });

  it('el coste en camino es menor que fuera de él', () => {
    const net = createRoadNet();
    addRoad(net, 1, 1);
    expect(tileCost(net, 1, 1)).toBe(ROAD_COST);
    expect(tileCost(net, 2, 2)).toBe(OFFROAD_COST);
    expect(ROAD_COST).toBeLessThan(OFFROAD_COST);
  });
});
