import { describe, expect, it } from 'vitest';
import { canAfford, createInitialStock, militaryStrengthFactor, payCost, settlementValue, tickJob } from '@/game/systems/economy';

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
});
