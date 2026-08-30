import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'M42');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(2500);

const result = await page.evaluate(() => {
  const T = THREE;
  const dbg = P.app._dbg;
  const { renderer, scene, camera } = dbg;
  const d = dbg.sky.dsoDebug;
  const ggeo = d.ggeo;
  const A = {
    off: ggeo.getAttribute('iOff').array,
    size: ggeo.getAttribute('iSize').array,
    alpha: ggeo.getAttribute('iAlpha').array
  };
  // M42 index
  let m42 = -1;
  for (let i = 0; i < P.dso.length; i++) if (P.dso[i][0] === 'M42') { m42 = i; break; }
  const wp = new T.Vector3(A.off[m42 * 3], A.off[m42 * 3 + 1], A.off[m42 * 3 + 2]);

  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;

  // screen position of M42
  const mv = wp.clone().applyMatrix4(camera.matrixWorldInverse);
  const ndc = mv.clone().project(camera);
  const sx = (ndc.x * 0.5 + 0.5) * W;
  const sy = (0.5 - ndc.y * 0.5) * H;

  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);

  const box = (x0, y0, w, h) => {
    let s = 0, n = 0, mx = 0, r = 0, gg = 0, b = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      s += px[i] + px[i + 1] + px[i + 2]; n += 3;
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (v > mx) { mx = v; r = px[i]; gg = px[i + 1]; b = px[i + 2]; }
    }
    return { mean: +(s / n).toFixed(2), max: mx, maxRgb: [r, gg, b] };
  };
  return {
    W, H,
    m42Screen: [Math.round(sx), Math.round(sy)],
    mvZ: +mv.z.toFixed(2),
    aroundM42: box(Math.round(sx - 40), Math.round(sy - 40), 80, 80),
    aroundM42Big: box(Math.round(sx - 120), Math.round(sy - 120), 240, 240),
    farCorner: box(20, 20, 120, 120),
    wholeMean: box(0, 0, W, H).mean
  };
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
