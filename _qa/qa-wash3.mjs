import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'M8');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(4000);

/* crank the wash 20x and screenshot */
await page.evaluate(() => {
  const w = P.app._dbg.sky.galaxyWash;
  w.material.uniforms.uWash.value = 0.09 * 20;
});
await page.waitForTimeout(300);
await page.screenshot({ path: R + '\\qa-wash-boost.png' });
console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
await browser.close();

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p2 = await b.newPage();
await p2.setContent('<html></html>');
const stats = f => p2.evaluate(async ({ b64 }) => {
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('fail'); img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const strip = (y0, hgt) => {
    let s = 0, n = 0, mx = 0;
    for (let y = y0; y < y0 + hgt; y++) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      s += v; n++; if (v > mx) mx = v;
    }
    return { mean: +(s / n).toFixed(2), max: +mx.toFixed(0) };
  };
  const cy = H / 2 | 0;
  return {
    core: strip(cy - 60, 120),
    ctrlN: strip(cy - 330, 80),
    ctrlS: strip(cy + 250, 80),
    corner: strip(10, 80)
  };
}, { b64: fs.readFileSync(f).toString('base64') });
console.log('BASE (qa-wash-a):', JSON.stringify(await stats(R + '\\qa-wash-a.png')));
console.log('BOOST20x:', JSON.stringify(await stats(R + '\\qa-wash-boost.png')));
await b.close();
