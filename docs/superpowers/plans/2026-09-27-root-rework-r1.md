# Root Rework R1 (vertical slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el juego deje de ser mediocre en un slice shippable: escasez real (vetas finitas), deadline visible (reloj de asedio + oleada x/10) y quest de onboarding en 3 pasos, sobre el motor actual sin reescribirlo.

**Architecture:** Strangler sobre la arquitectura existente. `systems/transport.ts`, `economy.ts`, `fog.ts`, `pathfinding.ts` y el formato de guardado (con migración v6→v7) NO se reescriben; se extienden. La sim sigue en `GameScene.ts` (sin split sim/view en R1). HUD React solo lee el puente `window.__game`.

**Tech Stack:** Next.js 16 + React 19 + Phaser 3.90 (cliente), TypeScript estricto, Vitest, Playwright, WebAudio procedural (sin assets nuevos).

**Spec:** Council raíz 2026-09-27 (`~/.council/2026-09-27-root-rework/council.json`): veredicto = motor/tests/saves se quedan (Skeptic+Researcher, rank 2.25); raíz causal = sin escasez ni coste (Architect); feel solo como acompañamiento (Pragmatist, rank 3.0). Fuera de R1: campaña 3 actos, recorte 16→7 recursos, split sim/view, maná, upkeep universal.

## Global Constraints

- TypeScript estricto sin errores (`npm run build` debe pasar tsc).
- No romper guardados: migrar v6→v7 con defaults (vetas llenas, quest en paso 0).
- No copiar expresión de The Settlers IV: nombres, textos y números propios.
- Staging explícito por rutas (`git add <paths>`), nunca `git add .`, nunca `--force`.
- Push a `proto-b-widelands`; publicar = merge --ff a `master` + push (Vercel solo construye master).
- Cada tarea termina en commit atómico con sus tests en verde.

---

### Task 1: Vetas finitas en minas (escasez real)

**Files:**
- Modify: `src/game/systems/economy.ts` (añadir reservas por instancia)
- Test: `tests/unit/economy.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `tickAutoProducers(stock, buildingIds, tickNo)` existente (rival la sigue usando sin cambios).
- Produces: `produceToBuffers(buffers, placements, central, tickNo, reserves?)` extendido — `placements` acepta `{ id, key, reserve?: number }`; devuelve `{ central, overflowKeys, depletedKeys }`. Reserva por defecto 30 para minas, `Infinity` para el resto.

- [ ] **Step 1: Write the failing test**

```ts
it('la mina agota su veta y avisa', () => {
  const buffers: Record<string, Partial<Record<ResourceId, number>>> = {};
  const central = createInitialStock();
  let depleted: string[] = [];
  for (let t = 1; t <= 40; t++) {
    const r = produceToBuffers(buffers, [{ id: 'minaHierro', key: '3,3', reserve: 30 - (t - 1) * 0 }], central, t * 4);
    depleted = r.depletedKeys;
    if (depleted.length) break;
  }
  expect(depleted).toContain('3,3');
});
```

(Ajustar al API final: la reserva vive en el llamante — GameScene guarda `mineReserves: Record<string, number>` — y `produceToBuffers` recibe `reserve` y devuelve `depletedKeys` cuando `reserve <= 0`. Escribir el test contra esa firma exacta.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/economy.test.ts`
Expected: FAIL (firma `reserve`/`depletedKeys` no existe)

- [ ] **Step 3: Write minimal implementation**

```ts
export interface Placement {
  id: BuildingId;
  key: string;
  /** Reserva restante (solo minas). undefined = infinita (rival y resto). */
  reserve?: number;
}

export function produceToBuffers(
  buffers: Record<string, Partial<Record<ResourceId, number>>>,
  placements: Placement[],
  central: Stock,
  tickNo = 0,
  capacityPerResource = 12,
): { central: Stock; overflowKeys: string[]; depletedKeys: string[] } {
  const nextCentral = { ...central };
  const overflowKeys: string[] = [];
  const depletedKeys: string[] = [];
  for (const p of placements) {
    const rule = AUTO_RULES[p.id];
    if (!rule) continue;
    const isMine = p.id === 'minaCarbon' || p.id === 'minaHierro' || p.id === 'minaOro';
    if (isMine && tickNo % 4 !== 0) continue;
    if (isMine && (p.reserve ?? Infinity) <= 0) {
      depletedKeys.push(p.key);
      continue;
    }
    if (!canAfford(nextCentral, rule.in)) continue;
    for (const [k, v] of Object.entries(rule.in)) nextCentral[k as ResourceId] -= v ?? 0;
    const buf = (buffers[p.key] ??= {});
    for (const [k, v] of Object.entries(rule.out)) {
      const rk = k as ResourceId;
      const cur = buf[rk] ?? 0;
      const room = Math.max(0, capacityPerResource - cur);
      const add = Math.min(room, v ?? 0);
      buf[rk] = cur + add;
      if (add < (v ?? 0)) overflowKeys.push(p.key);
    }
    if (isMine && p.reserve !== undefined) p.reserve -= 1;
  }
  return { central: nextCentral, overflowKeys, depletedKeys };
}
```

(Mantener la firma vieja compilando: `placements` como `{ id: BuildingId; key: string }[]` sigue siendo asignable a `Placement[]`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/economy.test.ts`
Expected: PASS (8 tests previos + 1 nuevo)

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/economy.ts tests/unit/economy.test.ts
git commit -m "proto-b: vetas finitas en minas (escasez R1)"
```

### Task 2: Reservas por instancia en GameScene + aviso de agotada

**Files:**
- Modify: `src/game/scenes/GameScene.ts` (campo `mineReserves`, cableado en `tickEconomy`, `tryPlace`, `destroyBuilding`, save/load)
- Test: `tests/unit/economy.test.ts` (cubierto en Task 1; aquí verificación manual: consola sin errores)

**Interfaces:**
- Consumes: `produceToBuffers` con `reserve`/`depletedKeys` (Task 1).
- Produces: `mineReserves: Record<string, number>` persistido en guardado v7.

- [ ] **Step 1: Añadir campo y cableado**

```ts
/** Reserva restante por mina ("x,y" → unidades). Nueva mina = 30. */
private mineReserves: Record<string, number> = {};
```

En `tickEconomy`, construir placements con `reserve: this.mineReserves[key] ?? 30` para minas, y tras `produceToBuffers`:
- decrementar reservas según lo consumido (el sistema muta `p.reserve`; copiar de vuelta: `this.mineReserves[key] = p.reserve`),
- `depletedKeys` → `stallInfo.set(key, ['⛏ veta agotada'])` + marca ⚠ (reusar `refreshStall` con recipeId ficticio: set directo de `stallInfo` + crear `stallMarks` si falta — extraer helper `markStall(key, tx, ty, faltan)` si el duplicado supera 10 líneas),
- minas agotadas se excluyen solas (el sistema las salta).

En `tryPlace`: si `id` es mina, `this.mineReserves[key] = 30`. En `destroyBuilding`: `delete this.mineReserves[key]`.

- [ ] **Step 2: Guardado v7**

En `saveGame`: `v: 7`, añadir `mineReserves: { ...this.mineReserves }`. En `loadGame`: `this.mineReserves = (data.mineReserves && typeof === 'object') ? filtrado a claves "x,y" con valores ≥ 0 : {}` (v6 o ausente → `{}` = vetas llenas al colocar; las minas ya colocadas sin reserva registrada empiezan en 30).

- [ ] **Step 3: Verificar**

Run: `npx vitest run tests/unit/economy.test.ts` → PASS. Run: `npm run build` → tsc limpio.

- [ ] **Step 4: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "proto-b: reservas de veta por mina + aviso y guardado v7"
```

### Task 3: Reloj de asedio visible (deadline)

**Files:**
- Modify: `src/game/scenes/GameScene.ts` (exponer `siege: () => { nextWaveIn: number; wave: number; wavesToWin: number }` en `exposeBridge`)
- Modify: `src/app/play/page.tsx` (poll + barra) y `src/components/HudPanels.tsx` (componente `SiegeBar`)
- Test: verificación e2e existente + comprobación manual del puente en consola (`__game.siege()`)

**Interfaces:**
- Consumes: `waveNo`, `wavesRepelled`, `VICTORY_WAVES` y el temporizador de oleadas existente (`spawnWave` cada 100s tras 75s inicial — leer valores exactos del código, no asumirlos).
- Produces: `siege()` en `window.__game` con segundos reales al próximo `spawnWave` (rastrear `nextWaveAt = this.time.now + delay` cada vez que se programa).

- [ ] **Step 1: Rastrear próxima oleada en GameScene**

```ts
private nextWaveAt = 0;
// donde se programa: this.nextWaveAt = this.time.now + 75000 (inicial) y + 100000 (repetido)
siege: () => ({
  nextWaveIn: Math.max(0, Math.round((this.nextWaveAt - this.time.now) / 1000)),
  wave: this.waveNo,
  wavesToWin: VICTORY_WAVES,
  repelled: this.wavesRepelled,
}),
```

- [ ] **Step 2: Componente SiegeBar en HudPanels**

```tsx
export function SiegeBar({ siege }: { siege: { nextWaveIn: number; wave: number; wavesToWin: number; repelled: number } | null }) {
  if (!siege) return null;
  const mm = Math.floor(siege.nextWaveIn / 60);
  const ss = String(siege.nextWaveIn % 60).padStart(2, '0');
  return (
    <div role="timer" aria-label="Próxima oleada" className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/25 bg-[#101a12]/95 px-3 py-2 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-200/90">⚔ Asedio</span>
      <span className="text-xs font-black text-amber-50 tabular-nums">{mm}:{ss}</span>
      <span className="ml-auto text-[11px] text-amber-100/70 tabular-nums">Oleada {siege.wave}/{siege.wavesToWin} · repelidas {siege.repelled}</span>
    </div>
  );
}
```

- [ ] **Step 3: Cablear page.tsx** (estado `siege`, poll en el intervalo existente, render `<SiegeBar siege={siege} />` bajo `SpeedControl`)

- [ ] **Step 4: Verificar**

Run: `npm run build` → PASS. Manual: abrir `/play`, en consola `__game.siege()` devuelve números que bajan.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/GameScene.ts src/components/HudPanels.tsx src/app/play/page.tsx
git commit -m "proto-b: reloj de asedio visible (deadline R1)"
```

### Task 4: Quest de onboarding en 3 pasos

**Files:**
- Create: `src/game/systems/quest.ts` (máquina de 3 pasos pura + tests)
- Modify: `src/game/scenes/GameScene.ts` (puente `quest()`), `src/app/play/page.tsx`, `src/components/HudPanels.tsx` (`QuestTracker`), `src/components/BuildMenu.tsx` (resaltado contextual)
- Test: `tests/unit/quest.test.ts`

**Interfaces:**
- Consumes: `placed` (ids), `stock`, `wavesRepelled`.
- Produces: `questState(placedIds, stock, wavesRepelled, doneOverride?) → { step: 0|1|2|3; steps: { id, text, done }[] }` donde paso 0 = "Construye una cabaña de leñador", 1 = "Convierte madera en tablones (aserradero)", 2 = "Repele la oleada 1". `step === 3` = completado (tracker se colapsa a ✓).

- [ ] **Step 1: Write the failing test**

```ts
import { questState } from '@/game/systems/quest';
it('avanza 0→1→2→3 con cabaña, tablón y oleada', () => {
  expect(questState([], { tablon: 0 } as never, 0).step).toBe(0);
  expect(questState(['cabanaLenador'], { tablon: 0 } as never, 0).step).toBe(1);
  expect(questState(['cabanaLenador', 'aserradero'], { tablon: 1 } as never, 0).step).toBe(2);
  expect(questState(['cabanaLenador', 'aserradero'], { tablon: 1 } as never, 1).step).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails** (`npx vitest run tests/unit/quest.test.ts` → FAIL, módulo no existe)
- [ ] **Step 3: Implementar `quest.ts`** (30 líneas, sin dependencias Phaser)
- [ ] **Step 4: Run test** → PASS
- [ ] **Step 5: HUD + resaltado** (`QuestTracker` fijo sobre el mapa con los 3 pasos y ✓; `BuildMenu` resalta con pulso la tarjeta del edificio del paso actual — prop `questTarget: BuildingId | null` desde `page.tsx` vía `__game.quest()`)
- [ ] **Step 6: Commit**

```bash
git add src/game/systems/quest.ts tests/unit/quest.test.ts src/game/scenes/GameScene.ts src/components/HudPanels.tsx src/components/BuildMenu.tsx src/app/play/page.tsx
git commit -m "proto-b: quest onboarding 3 pasos (R1)"
```

### Task 5: Juice mínimo (números flotantes + SFX synth)

**Files:**
- Modify: `src/game/fx/vfx.ts` (nuevo `floatText(scene, x, y, text, color)` — 1 objeto texto, tween 800ms, autodestrucción)
- Modify: `src/game/scenes/GameScene.ts` (llamar en entregas de porteador `+1🪵`, fin de obra, cosecha)
- Modify: `src/game/audio.ts` (2-3 blips procedurales: `pop`, `coin`, `horn` con WebAudio — leer el archivo primero, seguir su patrón existente)
- Test: `tests/unit/vfx.test.ts` (patrón existente: funciones no rompen sin escena — seguir el estilo del archivo)

- [ ] **Step 1: Test failing para floatText** (estilo vfx.test.ts actual)
- [ ] **Step 2-4: Implementar + pasar** (`npx vitest run tests/unit/vfx.test.ts`)
- [ ] **Step 5: Cablear 3 llamadas + 3 SFX** (sin cambiar volúmenes ni mezclas existentes)
- [ ] **Step 6: Commit**

```bash
git add src/game/fx/vfx.ts tests/unit/vfx.test.ts src/game/scenes/GameScene.ts src/game/audio.ts
git commit -m "proto-b: juice mínimo R1 (floatText + SFX synth)"
```

### Task 6: Cierre R1 (docs, verificación total, push)

- [ ] **Step 1: Devlog** `docs/devlog/036-root-r1.md` (objetivo, cambio, test/build, decisión, siguiente) + línea CHANGELOG
- [ ] **Step 2: Verificación total**: `npm test` (esperado ≥159), `npm run build` (tsc limpio), `npm run test:e2e` (2/2), lint sin errores nuevos
- [ ] **Step 3: Push + publicar**: `git push origin proto-b-widelands`, merge --ff a master + push (Vercel construye master)
- [ ] **Step 4: Validación jugable** (falsable, manual 15 min): ¿se agota una veta antes del min 15? ¿el reloj de asedio se entiende sin leer la guía? ¿el quest se completa solo jugando? Anotar respuestas en el devlog

## Self-Review

- Spec coverage: escasez (T1+T2) ✓, deadline (T3) ✓, onboarding quest (T4) ✓, juice mínimo (T5) ✓, guardrails motor/tests/saves (Global Constraints + T2) ✓. Fuera de R1 explícito ✓.
- Sin placeholders: cada paso trae código y comandos exactos.
- Tipos: `Placement.reserve?: number`, `depletedKeys: string[]`, `siege()` y `quest()` con formas fijadas arriba; T2/T4 consumen lo que T1/T4 producen.
