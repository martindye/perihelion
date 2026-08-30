import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

async function flyTo(q) {
  await page.click('#tg-catalog');
  await page.waitForTimeout(200);
  await page.fill('#cat-search', q);
  await page.waitForTimeout(250);
  await page.click('.cat-row');
  await page.waitForTimeout(2000);
}

async function sampleFrame(tag) {
  return page.evaluate((tag) => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const W = canvas.width, H = canvas.height;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const bright = (x0, y0, w, h) => {
      let s = 0, n = 0, mx = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const i = ((H - 1 - y) * W + x) * 4;   // readPixels origin = bottom-left
        const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
        s += v; n++; if (v > mx) mx = v;
      }
      return { mean: +(s / n).toFixed(3), max: mx };
    };
    const cx = W / 2, cy = H / 2;
    const out = { tag, W, H };
    out.center80 = bright(cx - 40, cy - 40, 80, 80);
    out.center200 = bright(cx - 100, cy - 100, 200, 200);
    out.ring_far = bright(cx - 100, cy + 300, 200, 200);   // region offset from center
    out.corner = bright(50, 50, 100, 100);
    return out;
  }, tag);
}

const r1 = await sampleFrame('before');
await flyTo('M42');
const r2 = await sampleFrame('m42-center');
// zoom in 8 clicks and sample again
await page.mouse.move(640, 400);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
await page.waitForTimeout(800);
const r3 = await sampleFrame('m42-zoomed');
console.log(JSON.stringify({ r1, r2, r3 }, null, 1));
await browser.close();
