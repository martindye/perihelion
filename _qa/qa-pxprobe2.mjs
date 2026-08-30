import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const probe = (file, cx, cy, box) => page.evaluate(async ({ b64, cx, cy, box }) => {
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
  return { W, H,
    center: boxStat(cx - box / 2, cy - box / 2, box, box),
    right200: boxStat(cx + 100, cy - 100, 200, 200),
    left200: boxStat(cx - 300, cy - 100, 200, 200),
    above: boxStat(cx - 100, Math.max(0, cy - 300), 200, 150),
    below: boxStat(cx - 100, Math.min(H - 150, cy + 150), 200, 150) };
}, { b64: fs.readFileSync(file).toString('base64'), cx, cy, box });

const a = await probe(R + '\\qa2-orion.png', 800, 450, 80);
const b = await probe(R + '\\qa-3-m31-zoom.png', 800, 450, 80);
const c = await probe(R + '\\qa2-herc.png', 800, 450, 120);
const d = await probe(R + '\\qa2-ring.png', 800, 450, 40);
console.log('qa2-orion (M42 center):', JSON.stringify(a));
console.log('qa-3-m31-zoom (control, M31):', JSON.stringify(b));
console.log('qa2-herc (M13 center):', JSON.stringify(c));
console.log('qa2-ring (M57 center):', JSON.stringify(d));
await browser.close();
