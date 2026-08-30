// Headless QA for the PERIHELION galaxy layer (playwright-core + system chromium)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--window-size=1600,900'
  ]
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], logs = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(t + ': ' + m.text()); });

const results = {};
try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  results.data = await page.evaluate(() => ({
    dso: P.dso ? P.dso.length : -1,
    faint: P.dsoFaint ? P.dsoFaint.n : -1,
    splashGone: !document.getElementById('splash'),
    canvas: !!document.querySelector('.scene-canvas'),
    title: document.title
  }));
  await page.screenshot({ path: 'qa-1-default.png' });

  /* --- fly to M31 through the real catalog path --- */
  await page.click('#tg-catalog');
  await page.fill('#cat-search', 'M31');
  await page.waitForTimeout(250);
  await page.click('.cat-row');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'qa-2-m31.png' });
  results.m31 = await page.evaluate(() => ({
    firstRows: [...document.querySelectorAll('.cat-row')].slice(0, 3).map(r => r.textContent),
    panel: document.getElementById('ip-title') ? document.getElementById('ip-title').textContent : null,
    info: [...document.querySelectorAll('#ip-rows .ip-row')].map(r => r.textContent),
    swatch: !!document.querySelector('#ip-rows .ip-sw'),
    fun: (document.getElementById('ip-fun') || {}).textContent || ''
  }));

  /* zoom in on M31 to see structure (6 clicks -> ~40 deg) */
  await page.mouse.move(800, 450);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa-3-m31-zoom.png' });

  /* deep zoom on M31 (-> 8 deg fov) — the "hero" view */
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa-7-m31-deep.png' });

  /* --- M33 --- */
  await page.fill('#cat-search', 'M33');
  await page.waitForTimeout(250);
  await page.click('.cat-row');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'qa-4-m33.png' });
  results.m33 = await page.evaluate(() => ({
    panel: document.getElementById('ip-title') ? document.getElementById('ip-title').textContent : null,
    info: [...document.querySelectorAll('#ip-rows .ip-row')].map(r => r.textContent)
  }));

  /* --- NGC 4565 (edge-on) --- */
  await page.fill('#cat-search', 'NGC 4565');
  await page.waitForTimeout(250);
  await page.click('.cat-row');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'qa-5-ngc4565.png' });
  results.ngc4565 = await page.evaluate(() => ({
    panel: document.getElementById('ip-title') ? document.getElementById('ip-title').textContent : null,
    info: [...document.querySelectorAll('#ip-rows .ip-row')].map(r => r.textContent)
  }));

  /* --- star colour row (swatch on a star) --- */
  await page.fill('#cat-search', 'Sirius');
  await page.waitForTimeout(250);
  await page.click('.cat-row');
  await page.waitForTimeout(1500);
  results.sirius = await page.evaluate(() => ({
    panel: document.getElementById('ip-title') ? document.getElementById('ip-title').textContent : null,
    info: [...document.querySelectorAll('#ip-rows .ip-row')].map(r => r.textContent),
    swatch: !!document.querySelector('#ip-rows .ip-sw')
  }));

  /* --- back to default-ish wide view for the faint-field shot --- */
  await page.evaluate(() => { P.app.select(null); });
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa-6-wide.png' });
} catch (e) {
  results.fatal = String(e && e.message || e);
  try { await page.screenshot({ path: 'qa-fatal.png' }); } catch (_) {}
}
console.log('RESULTS', JSON.stringify(results, null, 1));
console.log('ERRORS', JSON.stringify(errors));
console.log('CONSOLE', JSON.stringify(logs.slice(0, 12)));
await browser.close();
process.exit(errors.length ? 2 : 0);
