import { expect, test } from '@playwright/test';

test('landing carga y permite ir a jugar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('SpanishSettlers')).toBeVisible();
  await page.getByRole('link', { name: /Jugar ahora/i }).click();
  await expect(page).toHaveURL(/\/play/);
  await expect(page.getByText('Construir')).toBeVisible();
});
