import { describe, expect, it } from 'vitest';
import {
  bufferTotal,
  congestedKeys,
  createTransportState,
  moveGroup,
  orderFromGroups,
  pickCarrierJob,
  PRIORITY_GROUPS,
  pushOutput,
  requestShipments,
  sanitizeOrder,
  tickQueue,
  TRANSPORT_PRIORITY,
} from '@/game/systems/transport';

describe('transporte causal (council Fase 1)', () => {
  it('los productores vierten al buffer local, no al stock global', () => {
    const s = createTransportState();
    expect(pushOutput(s, '5,5', 'madera', 2)).toBe(false);
    expect(bufferTotal(s.buffers['5,5'])).toBe(2);
  });

  it('la pila llena devuelve overflow (atasco)', () => {
    const s = createTransportState();
    for (let i = 0; i < 6; i++) pushOutput(s, '5,5', 'madera', 2);
    expect(bufferTotal(s.buffers['5,5'])).toBe(12);
    expect(pushOutput(s, '5,5', 'madera', 2)).toBe(true);
    expect(congestedKeys(s, 6)).toContain('5,5');
  });

  it('la comida tiene prioridad sobre la madera', () => {
    const s = createTransportState();
    pushOutput(s, '1,1', 'madera', 4);
    pushOutput(s, '2,2', 'pan', 2);
    const { moved } = requestShipments(s, {
      bandwidth: 2,
      centralKey: '0,0',
      distanceOf: () => ({ connected: true, distance: 0 }),
    });
    expect(moved).toHaveLength(1);
    expect(moved[0].resource).toBe('pan');
  });

  it('cortar el camino alarga el ETA (campo a través lento)', () => {
    const onRoad = createTransportState();
    pushOutput(onRoad, '9,9', 'piedra', 2);
    const r1 = requestShipments(onRoad, {
      bandwidth: 2,
      centralKey: '0,0',
      distanceOf: () => ({ connected: true, distance: 6 }),
    });
    const offRoad = createTransportState();
    pushOutput(offRoad, '9,9', 'piedra', 2);
    const r2 = requestShipments(offRoad, {
      bandwidth: 2,
      centralKey: '0,0',
      distanceOf: () => ({ connected: false, distance: 6 }),
    });
    expect(r2.moved[0].etaTicks).toBeGreaterThan(r1.moved[0].etaTicks);
  });

  it('la cola entrega tras el ETA', () => {
    const s = createTransportState();
    pushOutput(s, '3,3', 'madera', 2);
    requestShipments(s, {
      bandwidth: 2,
      centralKey: '0,0',
      distanceOf: () => ({ connected: true, distance: 0 }),
    });
    const d1 = tickQueue(s);
    expect(d1.deliveries.madera).toBe(2);
    expect(s.queue).toHaveLength(0);
  });

  it('el orden del jugador manda sobre el defecto', () => {
    const s = createTransportState();
    pushOutput(s, '1,1', 'madera', 4);
    pushOutput(s, '2,2', 'pan', 2);
    const metalFirst = [...TRANSPORT_PRIORITY].sort((a, b) =>
      (a === 'madera' ? 0 : 1) - (b === 'madera' ? 0 : 1),
    );
    const { moved } = requestShipments(s, {
      bandwidth: 2,
      centralKey: '0,0',
      distanceOf: () => ({ connected: true, distance: 0 }),
      order: metalFirst,
    });
    expect(moved[0].resource).toBe('madera');
  });

  it('mover grupos ▲▼ y sanear órdenes', () => {
    const gs = PRIORITY_GROUPS.map((g) => g.id);
    expect(moveGroup(gs, 0, -1)).toEqual(gs);
    expect(moveGroup(gs, 0, 1)[0]).toBe('madera');
    expect(orderFromGroups(PRIORITY_GROUPS).slice(0, 5)).toEqual(['pan', 'pez', 'harina', 'grano', 'agua']);
    expect(sanitizeOrder(['espada', 'nope', 'espada'])[0]).toBe('espada');
    expect(sanitizeOrder(null)).toEqual(TRANSPORT_PRIORITY);
    expect(sanitizeOrder(['pan']).length).toBe(TRANSPORT_PRIORITY.length);
  });

  it('el porteador visible recoge trabajo causal (no fake)', () => {
    const s = createTransportState();
    expect(pickCarrierJob(s, '0,0')).toBeNull();
    pushOutput(s, '4,4', 'madera', 3);
    pushOutput(s, '5,5', 'pan', 1);
    const job = pickCarrierJob(s, '0,0');
    expect(job?.resource).toBe('pan');
  });
});
