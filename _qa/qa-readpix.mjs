import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.click('#tg-catalog');
await page.fill('#cat-search', 'M31');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(2200);

const r = await page.evaluate(() => new Promise(resolve => {
  const r0 = __dbg.renderer;
  const gl = r0.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const cx = W >> 1, cy = H >> 1;
  const grab = (x, y) => {
    const p = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
    return [p[0], p[1], p[2], p[3]];
  };
  const orig = r0.render.bind(r0);
  let done = false;
  r0.render = (scene, cam) => {
    const out = orig(scene, cam);
    if (!done) {
      done = true;
      const px = (dx, dy) => grab(cx + dx, cy + dy);
      resolve({ W, H, samples: {
        center: px(0, 0),
        e6: px(6, 0), e12: px(12, 0), e18: px(18, 0), e24: px(24, 0), e29: px(29, 0),
        w6: px(-6, 0), w12: px(-12, 0), w18: px(-18, 0), w24: px(-24, 0), w29: px(-29, 0),
        n5: px(0, 5), n8: px(0, 8), n11: px(0, 11),
        s5: px(0, -5), s8: px(0, -8), s11: px(0, -11),
        d1: px(14, 6), d2: px(-14, -6),
        far_corner: px(500, 300)
      }});
    }
    return out;
  };
}));
console.log(JSON.stringify(r, null, 1));
await browser.close();
