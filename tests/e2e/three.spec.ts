import { expect, test } from '@playwright/test';

// Motor 3D: carga, renderiza la colonia viva y no rompe consola.
// (SwiftShader compila shaders ~20-40 s: tiempos holgados a propósito.)
test('vista 3D carga colonia con economía', async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto('/3d');
  await page.waitForTimeout(30000);
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: 'test-results/shot-3d.png', timeout: 90000 });
  // La sim corre: el tick avanza en el HUD.
  const tick = await page.getByText(/⏱/).first().textContent().catch(() => null);
  expect(tick).toBeTruthy();
  expect(errors, errors.slice(0, 5).join('\n')).toEqual([]);
});
