import { chromium } from '@playwright/test';

const target = process.argv[2] ?? '3201';
const out = process.argv[3] ?? 'shot.png';
// admite puerto local o URL completa de producción
const url = target.startsWith('http') ? target : `http://localhost:${target}/play`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) { const u = r.url(); if (!u.includes('google') && !u.includes('analytics')) { bad.push(`${r.status()} ${u.slice(0, 120)}`); console.log('[http]', r.status(), u.slice(0, 140)); } } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// espera a que el juego simule (stock publicado por GameScene)
try {
  await page.waitForFunction(() => (window).__stock && (window).__game, null, { timeout: 90000 });
} catch {
  console.log('[warn] sin __stock; estado:',
    await page.evaluate(() => ({
      hasGame: !!(window).__game,
      hasStock: !!(window).__stock,
      canvases: document.querySelectorAll('canvas').length,
      phaserErr: (window).__phaserError || null,
    })).then((o) => JSON.stringify(o)).catch((e) => String(e)));
}
await page.waitForTimeout(9000);
await page.screenshot({ path: out });
await browser.close();
console.log('captura OK:', out);
