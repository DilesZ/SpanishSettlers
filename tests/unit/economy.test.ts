import { describe, expect, it } from 'vitest';
import { canAfford, createInitialStock, militaryStrengthFactor, missingInputs, payCost, produceToBuffers, settlementValue, tickAutoProducers, tickJob, type Stock } from '@/game/systems/economy';

describe('economia', () => {
  it('stock inicial tiene madera y herramientas', () => {
    const s = createInitialStock();
    expect(s.madera).toBeGreaterThan(0);
    expect(s.herramienta).toBeGreaterThan(0);
  });

  it('no deja pagar sin recursos', () => {
    const s = createInitialStock();
    expect(canAfford(s, { tablon: 9999 })).toBe(false);
    expect(() => payCost(s, { tablon: 9999 })).toThrow();
  });

  it('aserradero convierte madera en tablon al completar', () => {
    let s = createInitialStock();
    s = { ...s, madera: 10, tablon: 0 };
    const r = tickJob(s, { recipeId: 'tablon', edificio: 'aserradero', progresoMs: 0, duracionMs: 100 }, 150);
    expect(r.terminado).toBe(true);
    expect(r.stock.tablon).toBe(1);
    expect(r.stock.madera).toBe(8);
  });

  it('bonus militar: en casa siempre 100%, fuera depende de economia', () => {
    expect(militaryStrengthFactor(10, 100, true)).toBe(1);
    const fuerte = militaryStrengthFactor(200, 50, false);
    const debil = militaryStrengthFactor(10, 200, false);
    expect(fuerte).toBeGreaterThan(debil);
  });

  it('ornamentos valen doble para fuerza', () => {
    const base = settlementValue(createInitialStock(), 5, 0);
    const con = settlementValue(createInitialStock(), 5, 2);
    expect(con - base).toBe(40);
  });

  it('missingInputs dice qué falta para una receta', () => {
    const s = createInitialStock();
    expect(missingInputs(s, {})).toEqual([]);
    expect(missingInputs(s, { madera: 9999 })).toEqual(['madera']);
    expect(missingInputs({ ...s, madera: 5 }, { madera: 2, piedra: 9999 })).toEqual(['piedra']);
  });

  it('productores automáticos generan sin recetas y la mina come pan', () => {
    const base = createInitialStock();
    const s = tickAutoProducers({ ...base, madera: 0, piedra: 0, pan: 3 }, ['cabanaLenador', 'cantera', 'minaHierro']);
    expect(s.madera).toBe(2);
    expect(s.piedra).toBe(2);
    expect(s.hierro).toBeGreaterThan(base.hierro);
    expect(s.pan).toBe(2);
    // sin pan la mina no produce
    const s2 = tickAutoProducers({ ...base, hierro: 0, pan: 0 }, ['minaHierro']);
    expect(s2.hierro).toBe(0);
  });

  it('la mina agota su veta y avisa (escasez R1)', () => {
    const buffers: Record<string, Partial<Record<never, number>>> = {};
    const central: Stock = { ...createInitialStock(), pan: 99 };
    // Las minas producen en ticks múltiplos de 4 y comen pan.
    const r1 = produceToBuffers(buffers, [{ id: 'minaHierro', key: '3,3', reserve: 1 }], central, 4);
    expect(r1.depletedKeys).not.toContain('3,3');
    expect(r1.consumed['3,3']).toBe(1);
    const r2 = produceToBuffers(buffers, [{ id: 'minaHierro', key: '3,3', reserve: 0 }], r1.central, 8);
    expect(r2.depletedKeys).toContain('3,3');
    expect(r2.consumed['3,3'] ?? 0).toBe(0);
  });

  it('sin reserva la producción es infinita como antes', () => {
    const buffers: Record<string, Partial<Record<never, number>>> = {};
    const central: Stock = { ...createInitialStock(), pan: 99 };
    const r = produceToBuffers(buffers, [{ id: 'cabanaLenador', key: '1,1' }], central, 7);
    expect(r.depletedKeys).toEqual([]);
    expect((buffers['1,1'] as Record<string, number>).madera).toBe(2);
  });

  it('las minas solo trabajan 1 de cada 4 ticks (pan sostenible)', () => {
    const base = { ...createInitialStock(), hierro: 0, pan: 10 };
    expect(tickAutoProducers(base, ['minaHierro'], 1).hierro).toBe(0);
    expect(tickAutoProducers(base, ['minaHierro'], 2).hierro).toBe(0);
    const s = tickAutoProducers(base, ['minaHierro'], 4);
    expect(s.hierro).toBe(2);
    expect(s.pan).toBe(9);
  });
});
