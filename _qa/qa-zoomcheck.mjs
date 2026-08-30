import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'M42');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(2000);
await page.mouse.move(800, 450);
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(70); }
await page.waitForTimeout(1200);
await page.screenshot({ path: R + '\\qa2-orion-zoom.png' });
await browser.close();

/* decode + stat the PNGs in a fresh page */
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p2 = await b.newPage();
await p2.setContent('<html></html>');
const statFile = (file, cx, cy) => p2.evaluate(async ({ b64, cx, cy }) => {
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('load fail'); img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const boxStat = (x0, y0, w, h) => {
    let s = 0, n = 0, mx = 0, hot = 0;
    for (let y = y0; y < y0 + h && y < H; y++) for (let x = x0; x < x0 + w && x < W; x++) {
      const i = (y * W + x) * 4;
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      s += v; n++; if (v > mx) mx = v; if (v > 60) hot++;
    }
    return { mean: +(s / Math.max(1, n)).toFixed(3), max: mx, hotPct: +(100 * hot / Math.max(1, n)).toFixed(2) };
  };
  return {
    W, H,
    center80: boxStat(cx - 40, cy - 40, 80, 80),
    center200: boxStat(cx - 100, cy - 100, 200, 200),
    side: boxStat(cx + 300, cy - 100, 200, 200)
  };
}, { b64: fs.readFileSync(file).toString('base64'), cx, cy });

console.log('M42 zoomed:', JSON.stringify(await statFile(R + '\\qa2-orion-zoom.png', 800, 450)));
console.log('M31 deep (old control):', JSON.stringify(await statFile(R + '\\qa-7-m31-deep.png', 800, 450)));
await b.close();
console.log('ERRORS:', JSON.stringify(errors));
