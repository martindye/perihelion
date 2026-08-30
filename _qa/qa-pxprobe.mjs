import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const probe = (file, cx, cy, box) => new Promise(res => page.evaluate(async ({ file, cx, cy, box }) => {
  const img = new Image();
  const url = 'file:///' + file.replace(/\\/g, '/');
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('load fail'); img.src = url; });
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
    file: file.split('\\').pop(), W, H,
    center: boxStat(cx - box / 2, cy - box / 2, box, box),
    right300: boxStat(cx + 150, cy - 100, 200, 200),
    left300: boxStat(cx - 350, cy - 100, 200, 200),
    top: boxStat(cx - 100, 60, 200, 120),
    bottom: boxStat(cx - 100, cy + 200, 200, 150)
  };
}, { file, cx, cy, box })).catch(e => ({ err: String(e) }));

const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
// M42 should be centered in qa2-orion.png; M31 centered in old qa-3-m31-zoom.png (control)
const a = await probe(R + '\\qa2-orion.png', 800, 450, 80);
const b = await probe(R + '\\qa-3-m31-zoom.png', 800, 450, 80);
const c = await probe(R + '\\qa2-herc.png', 800, 450, 120);
console.log(JSON.stringify({ a, b, c }, null, 1));
await browser.close();
