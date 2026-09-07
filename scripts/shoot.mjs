import { chromium } from '@playwright/test';

const port = process.argv[2] ?? '3201';
const out = process.argv[3] ?? 'shot.png';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', (e.stack || String(e)).slice(0, 800)));
await page.goto(`http://localhost:${port}/play`, { waitUntil: 'networkidle', timeout: 60000 });
// espera a que el juego simule (stock publicado por GameScene)
await page.waitForFunction(() => (window).__stock && (window).__game, null, { timeout: 60000 });
await page.waitForTimeout(9000);
await page.screenshot({ path: out });
await browser.close();
console.log('captura OK:', out);
