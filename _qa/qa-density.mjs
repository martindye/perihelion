import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => new Promise(resolve => {
  const r0 = __dbg && __dbg.renderer;
  const gl = r0 ? r0.getContext() : null;
  if (!gl) { resolve({ error: 'no renderer handle (dbg removed)' }); return; }
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const orig = r0.render.bind(r0);
  let done = false;
  r0.render = (s, c) => {
    const out = orig(s, c);
    if (!done) {
      done = true;
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let lit = 0, sum = 0, max = 0;
      const bright = [];
      for (let i = 0; i < W * H; i++) {
        const l = buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2];
        if (l > 30) lit++;               /* well above the (2,3,8) background */
        sum += l;
        if (l > max) max = l;
      }
      /* brightest 8 points */
      const idx = new Array(Math.min(4000, W * H / 40));
      for (let i = 0; i < idx.length; i++) idx[i] = (Math.random() * W * H) | 0;
      idx.sort((a, b) => (buf[b * 4] + buf[b * 4 + 1] + buf[b * 4 + 2]) - (buf[a * 4] + buf[a * 4 + 1] + buf[a * 4 + 2]));
      resolve({
        W, H,
        litFraction: (lit / (W * H) * 100).toFixed(2) + '%',
        litCount: lit,
        maxLum: max,
        avgLum: (sum / (W * H)).toFixed(2),
        brightest: idx.slice(0, 8).map(i => [i % W, (i / W) | 0, buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]])
      });
    }
    return out;
  };
  setTimeout(() => resolve({ timeout: true }), 5000);
}));
console.log(JSON.stringify(r, null, 1));
await browser.close();
