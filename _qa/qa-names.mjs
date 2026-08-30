import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.click('#tg-catalog');

async function search(q) {
  await page.fill('#cat-search', q);
  await page.waitForTimeout(300);
  return page.evaluate(() =>
    [...document.querySelectorAll('.cat-row')].slice(0, 4).map(r => r.textContent));
}

const out = {};
out.andromeda = await search('andromeda');
out.andromedaGalaxy = await search('andromeda galaxy');
out.whirlpool = await search('whirlpool');
out.needle = await search('needle');
out.sombrero = await search('sombrero');
out.m31 = await search('m31');
out.ngc0253 = await search('ngc 0253');

/* panel title for M31 after clicking it */
await page.fill('#cat-search', 'andromeda');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(1800);
out.panel = await page.evaluate(() => ({
  title: document.getElementById('ip-title') ? document.getElementById('ip-title').textContent : null,
  rows: [...document.querySelectorAll('#ip-rows .ip-row')].map(r => r.textContent)
}));

/* tooltip text on hover over M31 */
await page.mouse.move(800, 450);
await page.waitForTimeout(400);
out.tip = await page.evaluate(() => {
  const t = document.getElementById('tooltip');
  return t && t.style.display !== 'none' ? t.textContent : null;
});

console.log(JSON.stringify(out, null, 1));
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
