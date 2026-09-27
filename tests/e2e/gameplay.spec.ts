import { expect, test, type Page } from '@playwright/test';

// Partida playtest: juega de verdad (construir, caminos, economía, recluta,
// oleada, guardado) y falla ante cualquier error de consola. ~5 min.
test.setTimeout(600000);

// OJO: window.__game tiene métodos y no se puede devolver por evaluate
// (structured clone los pela): cada llamada se ejecuta dentro de la página.
async function call<R>(page: Page, method: string, ...args: unknown[]): Promise<R> {
  return page.evaluate(
    ([m, a]) => {
      const game = (window as unknown as { __game: Record<string, (...x: unknown[]) => unknown> }).__game;
      return game[m](...a) as R;
    },
    [method, args] as const,
  );
}

async function clickTile(page: Page, tx: number, ty: number) {
  await call(page, 'focus', tx, ty);
  // En slow-motion headless el paneado tarda: espera lo posible y clica
  // igual (la espiral tolera deriva: reintenta hasta que counts crezca).
  try {
    await page.waitForFunction(
      ([x, y]) => {
        const g = (window as unknown as { __game: { debugClick: (sx: number, sy: number) => { x: number; y: number } | null } }).__game;
        const box = document.querySelector('canvas')!.getBoundingClientRect();
        const t = g.debugClick(box.x + box.width / 2, box.y + box.height / 2);
        return t !== null && Math.abs(t.x - x) <= 2 && Math.abs(t.y - y) <= 2;
      },
      [tx, ty] as const,
      { timeout: 30000 },
    );
  } catch {
    /* deriva aceptada */
  }
  await page.locator('canvas').first().click();
  await page.waitForTimeout(400);
}

test('partida jugable: construir, producir, reclutar, oleada y guardar', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));

  await page.goto('/play');
  await page.waitForFunction(() => (window as unknown as { __game?: object }).__game, null, { timeout: 90000 });
  await page.waitForTimeout(4000);

  expect(await call<number>(page, 'counts')).toBeGreaterThan(3);
  const stock0 = await call<Record<string, number>>(page, 'stock');
  expect(stock0.madera).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/shot-inicio.png' });

  // Ritmo x4 para jugar rápido.
  await call(page, 'setSpeed', 4);

  // 1) Construir buscando loseta libre en espiral (base en 32,32).
  // Verifica por id propio (los counts los mueve también el rival).
  async function buildAt(id: string): Promise<boolean> {
    const has = async () =>
      (await call<{ id: string; tx: number; ty: number }[]>(page, 'buildings')).some((b) => b.id === id);
    for (let r = 3; r <= 10; r++) {
      for (let dx = -r; dx <= r; dx += 1) {
        for (const dy of [-r, r, 0]) {
          const tx = 32 + dx;
          const ty = 32 + dy;
          if (tx < 2 || ty < 2 || tx > 61 || ty > 61) continue;
          if (await has()) return true;
          const free = await call<{ nombre: string } | null>(page, 'inspect', tx, ty).then((v) => v === null);
          if (!free) continue;
          await call(page, 'place', id);
          await clickTile(page, tx, ty);
          await page.keyboard.press('Escape');
          if (await has()) return true;
        }
      }
    }
    return has();
  }
  expect(await buildAt('residenciaS'), 'debería colocar una casa').toBe(true);
  await page.screenshot({ path: 'test-results/shot-casa.png' });
  // 1b) Panaderías + mina de carbón: la cadena comida→metal debe vivir.
  expect(await buildAt('panaderia'), 'debería colocar una panadería').toBe(true);
  await buildAt('panaderia'); // segunda, si hay recursos: más pan para minas
  expect(await buildAt('minaCarbon'), 'debería colocar una mina').toBe(true);

  // 2) Caminos: herramienta + arrastre + ESC sin errores.
  await call(page, 'road');
  const box = await page.locator('canvas').first().boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2 - 60, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');

  // 3) Economía viva: la madera no cae y el transporte existe.
  await page.waitForTimeout(20000);
  const stock1 = await call<Record<string, number>>(page, 'stock');
  expect(stock1.madera, `madera inicial ${stock0.madera}`).toBeGreaterThanOrEqual(stock0.madera);
  const pop = await call<{ pop: number; cap: number; morale: number }>(page, 'pop');
  expect(pop.morale).toBeGreaterThan(30);
  const q = await call<{ step: number; complete: boolean }>(page, 'quest');
  expect(q.step).toBeGreaterThanOrEqual(1);

  // 4) Recluta: invocable y booleana (cuartel mediante si hay recursos).
  const rec = await call<boolean>(page, 'recruit');
  expect(typeof rec).toBe('boolean');

  // 4b) Especialistas: train() respeta coste y tope; specs lo refleja.
  // (La despensa real manda: con pan 0 el geólogo debe fallar.)
  const trained = await page.evaluate(() => {
    const g = (window as unknown as { __game: { train: (t: string) => boolean; stock: () => Record<string, number> } }).__game;
    const s = g.stock();
    const canGeo = (s.herramienta ?? 0) >= 1 && (s.pan ?? 0) >= 1;
    const r = { geologo: g.train('geologo'), falso: g.train('dragon'), canGeo };
    return r;
  });
  expect(trained.geologo).toBe(trained.canGeo);
  expect(trained.falso).toBe(false);
  const specs = await call<{ geologo: number; pionero: number; ladron: number }>(page, 'specs');
  expect(specs.geologo).toBe(trained.canGeo ? 1 : 0);

  // 4c) Prioridad ajustable: se invierte, se aplica y se restaura.
  const orig = await call<string[]>(page, 'getPriority');
  expect(orig.length).toBe(16);
  const rev = [...orig].reverse();
  await call(page, 'setPriority', rev);
  expect((await call<string[]>(page, 'getPriority'))[0]).toBe(rev[0]);
  await call(page, 'setPriority', orig);
  expect((await call<string[]>(page, 'getPriority'))[0]).toBe(orig[0]);

  // 5) Oleada 1 vía hook QA (el reloj Phaser va en slow-motion headless;
  // en navegadores reales llega sola a los 75 s): la torre dispara y cae.
  expect(await call<number>(page, 'wave')).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'test-results/shot-oleada.png' });
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __game: { status: () => { kills: number; status: string } } }).__game.status();
      return s.kills > 0 || s.status !== 'playing';
    },
    null,
    { timeout: 180000 },
  );
  const st = await call<{ status: string; wave: number; kills: number; mines: number }>(page, 'status');
  expect(st.status, 'la colonia sobrevive a la oleada 1').toBe('playing');
  // La cadena del metal vive: la mina propia existe y consumió veta.
  // (Si la oleada la arrasó, se reconstruye y se reintenta una vez.)
  let myMine = (await call<{ id: string; tx: number; ty: number }[]>(page, 'buildings')).find((b) => b.id === 'minaCarbon');
  if (!myMine) {
    expect(await buildAt('minaCarbon'), 'reconstruir la mina').toBe(true);
    await page.waitForTimeout(60000);
    myMine = (await call<{ id: string; tx: number; ty: number }[]>(page, 'buildings')).find((b) => b.id === 'minaCarbon');
  }
  expect(myMine, 'la mina propia sigue en pie').toBeTruthy();
  const res = await call<Record<string, number>>(page, 'reserves');
  expect(res[`${myMine!.tx},${myMine!.ty}`] ?? 30, 'la mina trabajó').toBeLessThan(30);

  // 6) Guardado roundtrip.
  const at = await call<string | null>(page, 'save');
  expect(at).toBeTruthy();
  const n0 = await call<number>(page, 'counts');
  expect(await call<boolean>(page, 'load')).toBe(true);
  expect(await call<number>(page, 'counts')).toBe(n0);

  // 7) Cero errores de consola en toda la partida.
  expect(errors, errors.slice(0, 5).join('\n')).toEqual([]);
});
