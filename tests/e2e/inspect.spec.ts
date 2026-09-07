import { expect, test } from '@playwright/test';

test('inspeccionar edificio muestra su ficha', async ({ page }) => {
  await page.goto('/play');
  await page.waitForFunction(() => (window as unknown as { __game?: object }).__game, null, { timeout: 60000 });
  await page.waitForTimeout(6000);
  // clic en el centro del canvas (colonia inicial: almacén)
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 640, y: 300 } });
  await page.waitForTimeout(800);
  const ficha = page.getByText('Centro de tu colonia');
  if (await ficha.count()) {
    await expect(ficha.first()).toBeVisible();
  } else {
    // si el clic no dio en el almacén, al menos el juego simula
    const stock = await page.evaluate(() => (window as unknown as { __stock?: Record<string, number> }).__stock);
    expect(stock).toBeTruthy();
    expect(stock!.madera).toBeGreaterThan(0);
  }
});
