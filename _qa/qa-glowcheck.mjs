import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'M42');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(3000);
await page.mouse.move(800, 450);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(80); }
await page.waitForTimeout(1200);
await page.screenshot({ path: R + '\\qa3-m42-zoom.png' });
await browser.close();

/* pixel probe: center vs control, from the PNG */
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p2 = await b.newPage();
await p2.setContent('<html></html>');
const r = await p2.evaluate(async ({ b64 }) => {
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('fail'); img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const box = (x0, y0, w, h) => {
    let s = 0, n = 0, mx = 0, mr = 0, mg = 0, mb = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 4;
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      s += v; n++;
      if (v > mx) { mx = v; mr = d[i]; mg = d[i + 1]; mb = d[i + 2]; }
    }
    return { mean: +(s / n).toFixed(2), max: +mx.toFixed(0), maxRgb: [mr, mg, mb] };
  };
  const cx = W / 2 | 0, cy = H / 2 | 0;
  return {
    W, H,
    center100: box(cx - 50, cy - 50, 100, 100),
    center260: box(cx - 130, cy - 130, 260, 260),
    ctrl_right: box(cx + 350, cy - 100, 200, 200),
    ctrl_left: box(cx - 550, cy - 100, 200, 200),
    ctrl_top: box(cx - 100, 40, 200, 120)
  };
}, { b64: fs.readFileSync(R + '\\qa3-m42-zoom.png').toString('base64') });
console.log(JSON.stringify(r, null, 1));
await b.close();
