import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

const info = await page.evaluate(() => {
  const a = P.app._dbg.sky.asterisms;
  return {
    stars: P.stars.length,
    asterismLines: P.asterisms.length,
    lineVerts: a ? a.geometry.getAttribute('position').count : null,
    visible: a ? a.visible : null,
    stateAst: P.app.state.asterisms,
    btn: document.getElementById('tg-asterisms') ? document.getElementById('tg-asterisms').className : null,
    washBtn: document.getElementById('tg-wash').className
  };
});
console.log('INFO:', JSON.stringify(info));

/* fly to the Teapot (Kaus Australis), light zoom */
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'Kaus Australis');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(3000);
await page.mouse.move(800, 450);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(80); }
await page.waitForTimeout(800);
await page.screenshot({ path: R + '\\qa-teapot.png' });

/* toggle asterisms off, screenshot again */
await page.keyboard.press('a');
await page.waitForTimeout(300);
const off = await page.evaluate(() => ({ state: P.app.state.asterisms, vis: P.app._dbg.sky.asterisms.visible }));
await page.screenshot({ path: R + '\\qa-teapot-off.png' });
console.log('AFTER TOGGLE:', JSON.stringify(off));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 8)));
await browser.close();
