import { chromium } from 'playwright-core';
import fs from 'node:fs';
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

const boot = await page.evaluate(() => ({
  title: document.title,
  canvas: !!document.querySelector('canvas'),
  state: window.P.app.state ? { mode: P.app.state.mode, wash: P.app.state.galaxyWash } : null,
  washBtn: !!document.getElementById('tg-wash'),
  washOn: document.getElementById('tg-wash') ? document.getElementById('tg-wash').className : null
}));
console.log('BOOT:', JSON.stringify(boot));

/* fly to M8 (Lagoon Nebula, right on the galactic plane) */
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'M8');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(3000);
await page.screenshot({ path: R + '\\qa-wash-on.png' });

/* toggle off via the HUD button, then screenshot */
await page.click('#tg-wash');
await page.waitForTimeout(400);
const afterToggle = await page.evaluate(() => ({
  wash: P.app.state.galaxyWash,
  btnClass: document.getElementById('tg-wash').className
}));
await page.screenshot({ path: R + '\\qa-wash-off.png' });
console.log('AFTER TOGGLE:', JSON.stringify(afterToggle));

/* pixel compare: band = horizontal strip through center (galactic plane), control = 250px above */
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p2 = await b.newPage();
await p2.setContent('<html></html>');
const stats = async f => p2.evaluate(async ({ b64 }) => {
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('fail'); img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const strip = (y0, hgt) => {
    let s = 0, n = 0;
    for (let y = y0; y < y0 + hgt; y++) for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * 4;
      s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++;
    }
    return +(s / n).toFixed(2);
  };
  return {
    band: strip(H / 2 - 60, 120),     // galactic plane through the view center
    above: strip(H / 2 - 360, 120),   // ~250px off the plane (control)
    below: strip(H / 2 + 240, 120)
  };
}, { b64: fs.readFileSync(f).toString('base64') });

const on = await stats(R + '\\qa-wash-on.png');
const off = await stats(R + '\\qa-wash-off.png');
console.log('ON :', JSON.stringify(on));
console.log('OFF:', JSON.stringify(off));
console.log('DIFF band:', +(on.band - off.band).toFixed(2), ' control:', +((on.above - off.above) + (on.below - off.below)).toFixed(2) / 2);
console.log('ERRORS:', JSON.stringify(errors.slice(0, 8)));
await b.close();
await browser.close();
