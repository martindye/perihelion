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
await page.screenshot({ path: R + '\\qa-wash-a2.png' });
await page.click('#tg-wash');
await page.waitForTimeout(400);
await page.screenshot({ path: R + '\\qa-wash-b2.png' });
const st = await page.evaluate(() => P.app.state.galaxyWash);
console.log('wash after toggle:', st);
await browser.close();

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p2 = await b.newPage();
await p2.setContent('<html></html>');
const load = f => p2.evaluate(async ({ b64 }) => {
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('fail'); img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  return { w: c.width, h: c.height, d: Array.from(d.filter((_, i) => i % 4 < 3)) };
}, { b64: fs.readFileSync(f).toString('base64') });
const A = await load(R + '\\qa-wash-a2.png');
const B = await load(R + '\\qa-wash-b2.png');
const W = A.w, H = A.h;

/* galactic frame — same math as the app: NGP (192.85948, 27.12825), GC (266.4051, -28.9362) */
const galInfo = (ra, dec) => {
  const d = Math.PI / 180;
  const eq = (a, c) => { const x = Math.cos(c * d) * Math.cos(a * d), y = Math.cos(c * d) * Math.sin(a * d), z = Math.sin(c * d); return [x, y, z]; };
  const X = eq(266.4051, -28.9362), Z = eq(192.85948, 27.12825);
  let Y = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]];
  const L = Math.hypot(...Y); Y = Y.map(v => v / L);
  const v = eq(ra, dec);
  const gl = [X[0] * v[0] + X[1] * v[1] + X[2] * v[2], Y[0] * v[0] + Y[1] * v[1] + Y[2] * v[2], Z[0] * v[0] + Z[1] * v[1] + Z[2] * v[2]];
  return { l: (Math.atan2(gl[1], gl[0]) * 180 / Math.PI + 360) % 360, b: Math.asin(gl[2]) * 180 / Math.PI };
};

/* camera view directions for a 12x8 screen grid — camera yaw/pitch from app state?
   Instead: reconstruct from the known fly target. Simpler: use the app's camera via a fresh page run. */
/* We didn't keep the app page — recompute: the fly aims the view center at M8 (RA 270.92, dec -24.38).
   Assume view axis = M8 direction; camera up = world +Y rotated by yaw... For a rough grid, use:
   view center (ra0,dec0) = M8; horizontal axis = east (RA+), vertical = dec. Good enough for a 2-3 deg accuracy map. */
const ra0 = 270.92, dec0 = -24.38;
const FOV = 55;                 // vertical
const ASPECT = W / H;
const hFov = 2 * Math.atan(Math.tan(FOV / 2 * Math.PI / 180) * ASPECT) * 180 / Math.PI;
const diffGrid = (rows, cols) => {
  const out = [];
  for (let gy = 0; gy < rows; gy++) {
    const line = [];
    for (let gx = 0; gx < cols; gx++) {
      const px = ((gx + 0.5) / cols) * W | 0;
      const py = ((gy + 0.5) / rows) * H | 0;
      // view direction: naive tangent-plane approx
      const dx = ((px / W) * 2 - 1) * Math.tan(hFov / 2 * Math.PI / 180);
      const dy = (1 - (py / H) * 2) * Math.tan(FOV / 2 * Math.PI / 180);
      // screen +x = east-ish, +y = north-ish (around the center)
      const ra = ra0 + dx / (Math.cos(dec0 * Math.PI / 180) * Math.PI / 180) * -1; // east = increasing RA? (screen x increases westward in the sky!)
      const dec = dec0 + dy * 180 / Math.PI;
      const g = galInfo(((ra % 360) + 360) % 360, Math.max(-89, Math.min(89, dec)));
      const sA = (A.d[(py * W + px) * 3] + A.d[(py * W + px) * 3 + 1] + A.d[(py * W + px) * 3 + 2]) / 3;
      const sB = (B.d[(py * W + px) * 3] + B.d[(py * W + px) * 3 + 1] + B.d[(py * W + px) * 3 + 2]) / 3;
      line.push({ b: +g.b.toFixed(1), d: +(sA - sB).toFixed(2) });
    }
    out.push(line);
  }
  return out;
};
const grid = diffGrid(9, 13);
console.log('Wash diff (A-B) per grid cell, with approximate galactic b:');
for (const line of grid) {
  console.log(line.map(c => `b${c.b >= 0 ? '+' : ''}${String(c.b).padStart(5)}:${c.d >= 0 ? '+' : ''}${c.d}`).join('  '));
}
await b.close();
console.log('ERRORS:', JSON.stringify(errors));
