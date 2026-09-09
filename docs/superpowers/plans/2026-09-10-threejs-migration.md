# Three.js 3D Renderer Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task (subagent-driven-development is not installed; inline execution with review checkpoints). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phaser 2D renderer with a Three.js 3D renderer while keeping 100% of the simulation, UI, saves and deploy pipeline, to lift visual quality from "2000s 2D sprite game" to "modern 3D indie settlement RTS".

**Architecture:** The sim is already renderer-agnostic (`src/game/systems/*` pure + wall-clock ticks). A new parallel tree `src/three/*` implements the same `window.__game` bridge the React UI consumes, so `/play` keeps working untouched. Phaser stays installed as instant fallback (`?2d=1`) until cutover is proven; then it is removed.

**Tech Stack:** three@0.186.0 (ships its own types, no @types needed), Next.js 16 App Router, React 19, Vitest, Playwright+SwiftShader for headless WebGL screenshots. All 3D art procedural in code (100% original, zero downloads, zero cost). No copyrighted assets, no Settlers IV content.

**Spec:** This plan IS the spec (migration decided 2026-09-10 after hitting the 2D asset ceiling). Design constraints from the project brief: original names/art/UI, living settlement, visible logistics, rival AI parity, Vercel web deploy.

## Global Constraints

- Coste cero: no paid services, no paid assets, no paid APIs — everything procedural or already in repo.
- TypeScript estricto (`npx tsc --noEmit` limpio tras cada tarea).
- `npm test` en verde tras cada tarea; `npm run build` en verde antes de cada commit.
- NO romper `/play` con Phaser hasta la tarea de cutover (ruta dev `/3d` separada).
- El puente `window.__game` mantiene EXACTA la forma actual (place/road/debugClick/focus/pop/stalls/stock/counts/recruit/save/load/hasSave/status/objectives/inspect) para no tocar `src/app/play/page.tsx`.
- Guardados v4 compatibles: mismo JSON lógico (ids de edificio/losetas/caminos/stocks/censo).
- Objetos 3D acotados y reutilizados; hierba/árboles/rocas con InstancedMesh; sin allocations por frame en bucles.
- Verificación visual con capturas Playwright (`?dia=1`, `?noche=1`, `?lluvia=1` deben seguir funcionando en la escena 3D).

---

### Task 1: Spike — Three.js renders headless + terrain screenshot (GO/NO-GO)

**Files:**
- Create: `src/three/height.ts` (heightfield puro), `src/three/SpikeScene.ts`, `src/components/ThreeCanvas.tsx`, `src/app/3d/page.tsx`
- Modify: `package.json` (add `three@0.186.0`), `src/game/scenes/GameScene.ts` — NOTHING (no tocar)
- Test: `tests/unit/height.test.ts`, screenshot `spike-dia.png` (temp, no commitear)

**Interfaces:**
- Consumes: `src/game/maps/island.ts` (`terrainAt`, `ISLAND_SIZE`) — read-only.
- Produces: `heightAt(tx, ty): number` (0 agua .. 1 pico), `buildTerrainMesh(...)` placeholder simple, `ThreeCanvas` mount/unmount seguro, ruta `/3d` solo con el spike.

- [ ] **Step 1: Install three**
```bash
npm install three@0.186.0
```
Run: `npx tsc --noEmit` — Expected: PASS (no code uses three yet).

- [ ] **Step 2: Write failing test for heightfield**
```ts
// tests/unit/height.test.ts
import { describe, expect, it } from 'vitest';
import { heightAt } from '@/three/height';
describe('heightfield', () => {
  it('agua bajo el nivel del mar y montaña alta', () => {
    expect(heightAt(0, 0)).toBeLessThan(0); // esquina = agua
    expect(heightAt(14, 14)).toBeGreaterThan(0.2); // centro = tierra
  });
  it('es determinista', () => {
    expect(heightAt(10, 12)).toBe(heightAt(10, 12));
  });
});
```
Run: `npx vitest run tests/unit/height.test.ts` — Expected: FAIL with "Cannot find module '@/three/height'".

- [ ] **Step 3: Minimal height.ts** (base = radial isla + ruido hash propio; agua<0<tierra; montaña bonus por terrainAt==='mountain'; bosque/sombra no afectan altura)
```ts
import { ISLAND_SIZE, terrainAt } from '@/game/maps/island';
export function heightAt(tx: number, ty: number): number {
  const d = Math.hypot(tx - ISLAND_SIZE / 2, ty - ISLAND_SIZE / 2);
  let h = 0.55 - d * 0.075;
  const t = terrainAt(tx, ty);
  if (t === 'mountain') h += 0.45;
  else if (t === 'forest') h += 0.06;
  else if (t === 'sand') h -= 0.12;
  return h;
}
export function waterLevel(): number { return 0; }
```
Run tests — Expected: PASS (tune numbers until the two assertions hold; verify water corners negative by checking terrainAt ring d>12.5 → h = 0.55-12.5*0.075 < 0 ✓).

- [ ] **Step 4: SpikeScene + ThreeCanvas + /3d route** (mínimo: renderer WebGL antialias, cámara perspectiva isométrica aprox (posición (18,16,18) mirando al centro, fov 35), `PlaneGeometry(28,28,112,112)` con vértices por `heightAt` + vertex colors por `terrainAt` (hierba/agua/arena/bosque/montaña), plano de agua semitransparente en y=0, `DirectionalLight` cálida + `HemisphereLight`, fondo `scene.background` degradado día. Controles: drag-izquierdo pan, rueda zoom (implementación propia de 30 líneas, sin OrbitControls para no pelear con SSR). `ThreeCanvas`: dynamic import de three (nunca en SSR), dispose en cleanup (renderer.dispose + cancel RAF). Ruta `src/app/3d/page.tsx`: solo `<ThreeCanvas/>` + enlace volver.
- [ ] **Step 5: Screenshot headless** (`?dia=1` ignorado por ahora): arrancar `next start`, captura Playwright 1280×800. Expected: terreno 3D con relieve y agua visible. **GO si se ve relieve+agua; NO-GO → abortar migración y documentar por qué.**
- [ ] **Step 6: Commit**
```bash
git add package.json package-lock.json src/three tests/unit/height.test.ts src/components/ThreeCanvas.tsx src/app/3d/page.tsx
git commit -m "feat(3d): spike Three.js con heightfield y captura headless"
```

### Task 2: Terreno final (biomas, acantilados, caminos, orilla)

**Files:**
- Modify: `src/three/height.ts`, `src/three/SpikeScene.ts` (renombrar a `src/three/TerrainScene.ts` si crece; mantener /3d funcionando)
- Test: extender `tests/unit/height.test.ts` (acantilado junto a montaña, camino oscurece)

**Interfaces:**
- Consumes: Task 1 (`heightAt`, canvas/route scaffold).
- Produces: `terrainColorAt(tx,ty): [r,g,b]` (bioma + variación hash), `cliffFactor(...)`, `buildTerrainMesh()` final con vertex colors + uv2? no texturas (solo color vértice + flatShading look con `flatShading: true` en MeshStandardMaterial para facetas low-poly).

- [ ] Steps (TDD): test de `terrainColorAt` (agua≠hierba≠arena), test de oscurecido por camino (`darkenForRoad`), implementación, screenshot costa con zoom (espuma: anillo blanco sobre agua junto a arena — mesh plano extra o línea de color en vértices del agua), commit.

### Task 3: Vegetación instanciada + rocas + hierba + flores

**Files:**
- Create: `src/three/vegetation.ts`
- Test: `tests/unit/vegetation.test.ts` (conteos deterministas por semilla: N árboles en bosque, 0 en agua; posiciones dentro de mapa)

**Interfaces:**
- Consumes: `heightAt`, `terrainAt`.
- Produces: `scatterVegetation(seed): { trees: Matrix[], rocks, grass, flowers }` + `buildVegetationMeshes()` con InstancedMesh (cono+cilindro pino, esfera roble? — 2 especies + roca dodecaedro + hierba cruzada + flor esfera pequeña, todo `MeshLambertMaterial` con vertexColors o color por instancia).

- [ ] Steps (TDD): test, implementación, screenshot (densidad como la 2D), commit. Presupuesto: instanced (3-5 draw calls totales).

### Task 4: Edificios low-poly (los 22) + obra + banderas

**Files:**
- Create: `src/three/buildings3d.ts` (+ `tests/unit/buildings3d.test.ts`: alturas/huellas por id, coste coincide con BUILDINGS)
- Modify: escena para colocar la colonia inicial (almacén + cabaña + aserradero + casas + torre rival? no rival aún)

**Interfaces:**
- Consumes: `BUILDINGS` (costes/nombres reales), `heightAt` (asentar en altura).
- Produces: `buildHouse(opts): THREE.Group` paramétrico (base caja + tejado prisma + puerta + ventanas emisivas de noche + chimenea) con variantes por categoría (madera/piedra/molino con aspas/ torre cilíndrica + almenas / mina = entrada oscura + vagoneta / puerto = muelle + barco simple) + `buildScaffold()` (andamio + edificio al 40%) + `addPennant(group, color)` (rival rojo).

- [ ] Steps: test de huellas, implementación por categorías (no 22 piezas únicas: 6 familias paramétricas), screenshot colonia inicial de día y de noche (ventanas encendidas), commit.

### Task 5: Actores (colonos, fauna, barcos) con animación procedural

**Files:**
- Create: `src/three/actors.ts` (+ tests de máquina de estados: walk bob phase, carry box attach)
- Modify: escena: 20 caminantes con rutas A* existentes (`findPath` del árbol game) + 8 bichos + 1 barco en circuito (`pickFishingCircuit` reutilizado)

**Interfaces:**
- Consumes: `src/game/systems/pathfinding.ts`, `src/game/systems/ships.ts` (read-only, misma lógica que Phaser).
- Produces: colono low-poly (cuerpo cápsula + cabeza + brazos que oscilan + caja al cargar), oveja/conejo/ciervo/pato simples, barco casco+vela; API `spawnWalker(role, loaded)` + `updateActors(dt)`.

- [ ] Steps: test estados, implementación, screenshot (colonos con cajas en camino), commit.

### Task 6: Cielo, sol/sombras, noche, niebla, lluvia 3D

**Files:**
- Create: `src/three/sky.ts`
- Test: `tests/unit/sky.test.ts` (posición sol por `skyAt`, intensidad faroles)

**Interfaces:**
- Consumes: `src/game/systems/daynight.ts` (`skyAt`, `DAY_LENGTH_MS`) — el mismo ciclo que 2D.
- Produces: sol direccional orbitando + sombras PCFSoft (mapa 2048), hemisferio día/noche, fondo degradado + estrellas (Points), faroles PointLight SOLO 3 (HQ, plaza, puerto; resto emisivo), niebla `FogExp2` sutil, lluvia: `Points` con velocidad en la vista + salpicaduras (reutilizar idea de fx/weather).

- [ ] Steps: test, implementación, screenshots día/noche/lluvia (`?dia=1`, `?noche=1`, `?lluvia=1` soportados), commit.

### Task 7: Puente __game completo en ThreeScene (paridad con Phaser)

**Files:**
- Create: `src/three/ThreeBridge.ts` ( ThreeScene + economía/población/rival: REUTILIZA `tickAutoProducers`, `tickJob`, `tickPopulation`-lógica movida? NO mover: la escena 3D importa las mismas funciones puras y replica el bucle de pared (1 tick/s) con los mismos stocks)
- Test: `tests/unit/three-bridge.test.ts` (place descuenta stock, road pinta, stalls detecta, save/load roundtrip del JSON)

**Interfaces:**
- Consumes: TODOS los `src/game/systems/*` + `src/game/data/buildings.ts` (solo lectura).
- Produces: objeto `window.__game` con FORMA IDÉNTICA a la actual (mismos nombres y tipos) manejando la escena 3D (colocación con raycast a losetas, herramienta camino, recluta, guardado v4 idéntico).

- [ ] Steps (TDD por método del puente), commit. Criterio: la UI React no se toca y funciona sin cambios.

### Task 8: Cutover /play → 3D con fallback 2D

**Files:**
- Modify: `src/app/play/page.tsx` (usa `ThreeCanvas` por defecto; `?2d=1` monta el `GameCanvas` Phaser), `src/app/3d/page.tsx` (redirige a /play o se elimina)
- Test: e2e existente debe pasar + 1 e2e nuevo (`three.spec.ts`: carga /play, hay 1 canvas WebGL, `__game` responde, screenshot)

**Interfaces:**
- Consumes: Task 7 (puente completo).
- Produces: /play en 3D por defecto.

- [ ] Steps: cambio + e2e + screenshots comparativas 2D vs 3D + commit. Criterio: sin regresión funcional.

### Task 9: Pulido final + retirar Phaser

**Files:**
- Modify: lo que pidan las capturas (máx. 2 rondas)
- Delete: `npm uninstall phaser`, `src/game/scenes/*`, `src/game/fx/*` (2D), `src/components/GameCanvas.tsx`, assets 2D que solo usaba Phaser (`terrain-sheet.png`, foam, pathdot…), skills phaser obsoletas
- Test: suite completa + build + e2e + shots finales de landing

- [ ] Steps: ronda pulido, desinstalación, verificación total, commit, push (con aprobación como siempre).

## Self-Review

1. **Spec coverage:** every constraint is a task (coste cero ✓ T1-9 procedural; tsc/tests/build ✓ cada tarea; /play intacto ✓ T7-8; puente idéntico ✓ T7; saves v4 ✓ T7; instancing ✓ T3; capturas ✓ todas; Vercel ✓ sin cambios de hosting).
2. **Placeholder scan:** no hay TBD/TODO; cada paso trae código o criterio medible.
3. **Type consistency:** `heightAt(tx,ty): number`, `terrainColorAt → [r,g,b]`, `window.__game` forma congelada de la actual, `IsoProjector`-like para 3D será `tileToWorld(tx,ty): {x,y,z}` (definir en T1 al crear height.ts).
