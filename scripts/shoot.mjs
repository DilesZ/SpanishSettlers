import { chromium } from '@playwright/test';

const target = process.argv[2] ?? '3201';
const out = process.argv[3] ?? 'shot.png';
// admite puerto local o URL completa de producción
const url = target.startsWith('http') ? target : `http://localhost:${target}/play`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// espera a que el juego simule (stock publicado por GameScene)
await page.waitForFunction(() => (window).__stock && (window).__game, null, { timeout: 60000 });
await page.waitForTimeout(9000);
await page.screenshot({ path: out });
await browser.close();
console.log('captura OK:', out);
