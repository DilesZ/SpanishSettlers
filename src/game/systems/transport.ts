// Transporte causal estilo S4 (lógica pura, testeable sin Phaser) — council Fase 1.
// Idea híbrida: los productores vierten a un buffer local (pila delante del
// edificio); una cola con prioridades y ETA por distancia mueve la mercancía
// al almacén. Cortar un camino NO teletransporta: alarga el ETA y atasca.
// El render (porteadores, pilas) solo visualiza este estado, nunca lo inventa.

import type { ResourceId } from '../data/buildings';

export type BufferMap = Record<string, Partial<Record<ResourceId, number>>>;

export interface PendingLot {
  fromKey: string;
  resource: ResourceId;
  amount: number;
  etaTicks: number;
  priority: number;
}

export interface TransportState {
  buffers: BufferMap;
  queue: PendingLot[];
  tickNo: number;
}

/** Comida primero (minas y molinos no se paran), luego madera/piedra, luego industria/militar. */
export const TRANSPORT_PRIORITY: ResourceId[] = [
  'pan', 'pez', 'harina', 'grano', 'agua',
  'madera', 'tablon', 'piedra',
  'carbon', 'hierro', 'oro',
  'lingoteHierro', 'lingoteOro', 'herramienta',
  'espada', 'arco',
];

export function priorityOf(r: ResourceId): number {
  const i = TRANSPORT_PRIORITY.indexOf(r);
  return i < 0 ? 99 : i;
}

export function createTransportState(): TransportState {
  return { buffers: {}, queue: [], tickNo: 0 };
}

export function bufferTotal(buf: Partial<Record<ResourceId, number>> | undefined): number {
  if (!buf) return 0;
  return Object.values(buf).reduce((a, b) => a + (b ?? 0), 0);
}

export function bufferKey(tx: number, ty: number): string {
  return `${Math.round(tx)},${Math.round(ty)}`;
}

/** Vierte producción al buffer local. Devuelve overflow (true = pila llena, atasco). */
export function pushOutput(
  state: TransportState,
  fromKey: string,
  resource: ResourceId,
  amount: number,
  capacityPerResource = 12,
): boolean {
  const buf = (state.buffers[fromKey] ??= {});
  const cur = buf[resource] ?? 0;
  const room = Math.max(0, capacityPerResource - cur);
  const add = Math.min(room, amount);
  buf[resource] = cur + add;
  return add < amount;
}

export function takeFromBuffer(
  state: TransportState,
  fromKey: string,
  resource: ResourceId,
  amount: number,
): number {
  const buf = state.buffers[fromKey];
  if (!buf) return 0;
  const cur = buf[resource] ?? 0;
  const take = Math.min(cur, amount);
  buf[resource] = cur - take;
  if (buf[resource] === 0) delete buf[resource];
  if (Object.keys(buf).length === 0) delete state.buffers[fromKey];
  return take;
}

export interface DistanceInfo {
  connected: boolean;
  distance: number;
}

/**
 * Mueve mercancía de buffers a la cola con ETA por distancia.
 * - bandwidth: unidades totales que los porteadores dan abasto este tick.
 * - distanceOf: (key) => {connected, distance} desde el almacén.
 * - Sin camino: ETA x2+2 (campo a través lento, council: cortar duele).
 * Orden: prioridad comida primero, luego buffers más llenos.
 */
export function requestShipments(
  state: TransportState,
  opts: {
    bandwidth: number;
    centralKey: string;
    distanceOf: (fromKey: string) => DistanceInfo;
  },
): { moved: PendingLot[]; stillWaiting: number } {
  const entries: { key: string; resource: ResourceId; amount: number; pri: number; total: number }[] = [];
  for (const [key, buf] of Object.entries(state.buffers)) {
    if (key === opts.centralKey) continue;
    for (const [rk, v] of Object.entries(buf)) {
      const amount = v ?? 0;
      if (amount <= 0) continue;
      const resource = rk as ResourceId;
      entries.push({ key, resource, amount, pri: priorityOf(resource), total: bufferTotal(buf) });
    }
  }
  entries.sort((a, b) => a.pri - b.pri || b.total - a.total);
  let left = Math.max(0, opts.bandwidth);
  const moved: PendingLot[] = [];
  for (const e of entries) {
    if (left <= 0) break;
    const take = Math.min(e.amount, left);
    const got = takeFromBuffer(state, e.key, e.resource, take);
    if (got <= 0) continue;
    const d = opts.distanceOf(e.key);
    const base = 1 + Math.floor(Math.max(0, d.distance) / 3);
    const eta = d.connected ? base : base * 2 + 2;
    const lot: PendingLot = { fromKey: e.key, resource: e.resource, amount: got, etaTicks: eta, priority: e.pri };
    state.queue.push(lot);
    moved.push(lot);
    left -= got;
  }
  // La cola también prioriza comida al entregar (estable).
  state.queue.sort((a, b) => a.priority - b.priority || a.etaTicks - b.etaTicks);
  const stillWaiting = Object.values(state.buffers).reduce((a, b) => a + bufferTotal(b), 0);
  return { moved, stillWaiting };
}

/** Avanza 1 tick: decrementa ETAs y devuelve lo llegado al almacén. */
export function tickQueue(state: TransportState): { deliveries: Partial<Record<ResourceId, number>>; arrived: PendingLot[] } {
  state.tickNo++;
  const deliveries: Partial<Record<ResourceId, number>> = {};
  const arrived: PendingLot[] = [];
  const pending: PendingLot[] = [];
  for (const lot of state.queue) {
    const eta = lot.etaTicks - 1;
    if (eta <= 0) {
      arrived.push({ ...lot, etaTicks: 0 });
      deliveries[lot.resource] = (deliveries[lot.resource] ?? 0) + lot.amount;
    } else {
      pending.push({ ...lot, etaTicks: eta });
    }
  }
  state.queue = pending;
  return { deliveries, arrived };
}

/** Banderas atascadas (pila >= umbral): goods-stuck visible estilo S4. */
export function congestedKeys(state: TransportState, threshold = 6): string[] {
  const out: string[] = [];
  for (const [key, buf] of Object.entries(state.buffers)) {
    if (bufferTotal(buf) >= threshold) out.push(key);
  }
  return out;
}

/** Trabajo para un porteador visible: el lote más prioritario/lleno (causal, no fake). */
export function pickCarrierJob(
  state: TransportState,
  centralKey: string,
): { fromKey: string; resource: ResourceId } | null {
  let best: { fromKey: string; resource: ResourceId; pri: number; total: number } | null = null;
  for (const [key, buf] of Object.entries(state.buffers)) {
    if (key === centralKey) continue;
    const total = bufferTotal(buf);
    if (total <= 0) continue;
    for (const [rk, v] of Object.entries(buf)) {
      if ((v ?? 0) <= 0) continue;
      const resource = rk as ResourceId;
      const pri = priorityOf(resource);
      if (!best || pri < best.pri || (pri === best.pri && total > best.total)) {
        best = { fromKey: key, resource, pri, total };
      }
    }
    // Solo el mejor recurso de cada bandera compite (evita O(n²)).
    if (best && best.fromKey === key) continue;
  }
  return best ? { fromKey: best.fromKey, resource: best.resource } : null;
}

export function serializeTransport(state: TransportState): { buffers: BufferMap; queue: PendingLot[]; tickNo: number } {
  return { buffers: { ...state.buffers }, queue: state.queue.map((l) => ({ ...l })), tickNo: state.tickNo };
}

export function deserializeTransport(data: unknown): TransportState {
  const s = createTransportState();
  if (!data || typeof data !== 'object') return s;
  const d = data as Partial<TransportState>;
  if (d.buffers && typeof d.buffers === 'object') {
    for (const [k, v] of Object.entries(d.buffers)) {
      if (typeof k !== 'string' || !v || typeof v !== 'object') continue;
      if (!/^-?\d+,-?\d+$/.test(k)) continue;
      s.buffers[k] = { ...(v as Partial<Record<ResourceId, number>>) };
    }
  }
  if (Array.isArray(d.queue)) {
    for (const l of d.queue) {
      if (!l || typeof l.fromKey !== 'string' || typeof l.resource !== 'string') continue;
      s.queue.push({ fromKey: l.fromKey, resource: l.resource as ResourceId, amount: Math.max(0, Math.floor(l.amount ?? 0)), etaTicks: Math.max(0, Math.floor(l.etaTicks ?? 0)), priority: priorityOf(l.resource as ResourceId) });
    }
  }
  if (typeof d.tickNo === 'number') s.tickNo = Math.max(0, Math.floor(d.tickNo));
  return s;
}
