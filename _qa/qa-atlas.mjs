import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const r = await page.evaluate(() => {
  const d = window.__dbg;
  let gm = null;
  d.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.isInstancedBufferGeometry) gm = o; });
  const tex = gm.material.uniforms.uAtlas.value;
  const c = tex.image;
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const dta = g.getImageData(0, 0, W, H).data;
  /* per-tile alpha stats (2x2 tiles of 256) */
  const tiles = [];
  for (let t = 0; t < 4; t++) {
    const x0 = (t % 2) * 256, y0 = Math.floor(t / 2) * 256;
    let nz = 0, maxA = 0, sum = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = ((y0 + y) * W + (x0 + x)) * 4 + 3;
      const a = dta[i];
      if (a > 0) nz++;
      if (a > maxA) maxA = a;
      sum += a;
    }
    tiles.push({ nz, maxA, mean: (sum / (256 * 256)).toFixed(2) });
  }
  /* center pixel of tile 0 (core of the spiral) */
  const px = (x, y) => { const i = (y * W + x) * 4; return [dta[i], dta[i + 1], dta[i + 2], dta[i + 3]]; };
  return {
    canvas: [W, H],
    tiles,
    t0center: px(128, 128), t0off: px(64, 64), t1center: px(384, 128), t2center: px(128, 384), t3center: px(384, 384),
    flipY: tex.flipY,
    needsUpdate: tex.needsUpdate
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
