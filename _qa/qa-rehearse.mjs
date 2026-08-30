/* Rehearsal: run the #demo=galaxies timeline headless and collect console + errors */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html#demo=galaxies';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1920,1080', '--disable-features=CalculateNativeWinOcclusion'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
page.on('console', m => {
  const t = m.text();
  if (/WARN|WARN at|track|demo|probe:|vis\]/.test(t)) logs.push(m.type() + ' ' + t);
});
await page.goto(URL, { waitUntil: 'load' });
const t0 = Date.now();
let title = '';
while (Date.now() - t0 < 115000) {
  title = await page.title();
  if (title.indexOf('DONE') >= 0 || title.indexOf('ERROR') >= 0) break;
  await page.waitForTimeout(1000);
}
console.log('FINAL TITLE:', title);
console.log('WALL TIME:', ((Date.now() - t0) / 1000).toFixed(0) + 's');
/* final state */
const st = await page.evaluate(() => ({
  fov: P.app.state.fovSky,
  mode: P.app.state.mode,
  sel: P.app.state.selected,
  cat: P.app.state.catalogOpen
})).catch(e => ({ err: e.message }));
console.log('STATE:', JSON.stringify(st));
console.log('LOGS:');
for (const l of logs) console.log('  ' + l);
await browser.close();
