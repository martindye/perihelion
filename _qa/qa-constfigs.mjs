import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + t); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

const info = await page.evaluate(() => ({
  stars: P.stars.length,
  constellations: P.constellations.length,
  constLines: P.constellations.reduce((a, c) => a + c[1].length, 0),
  asterismVerts: P.app._dbg.sky.asterisms ? P.app._dbg.sky.asterisms.geometry.getAttribute('position').count : null,
  dsoN: P.dso.length
}));
console.log('INFO:', JSON.stringify(info));

async function fly(name, file) {
  await page.click('#tg-catalog');
  await page.waitForTimeout(250);
  const open = await page.evaluate(() => document.getElementById('cat-search').offsetParent !== null);
  if (!open) { await page.click('#tg-catalog'); await page.waitForTimeout(250); }
  await page.fill('#cat-search', name);
  await page.waitForTimeout(300);
  const rows = await page.$$eval('.cat-row', rs => rs.slice(0, 2).map(r => r.textContent));
  console.log('CAT[' + name + ']:', JSON.stringify(rows));
  await page.click('.cat-row');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: R + '\\qa-' + file + '.png' });
}

await fly('Regulus', 'leo');
await fly('Antares', 'scorpius');

console.log('LOGS:', JSON.stringify(logs));
await browser.close();
