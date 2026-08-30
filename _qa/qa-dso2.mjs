// Headless QA for the PERIHELION DSO part-2 layer (clusters + nebulae)
import { chromium } from 'playwright-core';

const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const OUT = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900']
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], logs = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(t + ': ' + m.text()); });

const results = {};
const fly = async (q, n) => {
  await page.fill('#cat-search', q);
  await page.waitForTimeout(250);
  await page.click('.cat-row');
  await page.waitForTimeout(1900);
  await page.screenshot({ path: OUT + '/qa2-' + n + '.png' });
  return page.evaluate(() => ({
    panel: document.getElementById('ip-title') ? document.getElementById('ip-title').textContent : null,
    info: [...document.querySelectorAll('#ip-rows .ip-row')].map(r => r.textContent),
    fun: (document.getElementById('ip-fun') || {}).textContent || ''
  }));
};

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  results.data = await page.evaluate(() => ({
    dsoTotal: P.dso ? P.dso.length : -1,
    dso2: P.dso2 ? P.dso2.length : -1,
    faint2: P.dsoFaint2 ? P.dsoFaint2.n : -1,
    common: P.dso2Common ? Object.keys(P.dso2Common).length : -1,
    splashGone: !document.getElementById('splash'),
    canvas: !!document.querySelector('.scene-canvas')
  }));

  // open catalog once
  await page.click('#tg-catalog');
  await page.waitForTimeout(300);
  results.counter = await page.evaluate(() => {
    const el = document.querySelector('.cat-count, #cat-count');
    return el ? el.textContent : (document.querySelector('[class*=count]') || {}).textContent || null;
  });

  results.m42 = await fly('M42', 'orion');
  results.m45 = await fly('M45', 'pleiades');
  results.m13 = await fly('M13', 'herc');
  results.m57 = await fly('M57', 'ring');
  results.m1  = await fly('M1', 'crab');

  // common-name search (Pleiades) should surface M45
  await page.fill('#cat-search', 'Pleiades');
  await page.waitForTimeout(250);
  results.searchPleiades = await page.evaluate(() =>
    [...document.querySelectorAll('.cat-row')].slice(0, 3).map(r => r.textContent));
} catch (e) {
  results.fatal = String(e && e.message || e);
  try { await page.screenshot({ path: OUT + '/qa2-fatal.png' }); } catch (_) {}
}
console.log('RESULTS', JSON.stringify(results, null, 1));
console.log('ERRORS', JSON.stringify(errors));
console.log('CONSOLE', JSON.stringify(logs.slice(0, 12)));
await browser.close();
process.exit(errors.length ? 2 : 0);
