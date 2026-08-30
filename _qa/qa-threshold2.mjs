import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

const result = await page.evaluate(() => {
  const T = THREE;
  const dbg = P.app._dbg;
  const { scene, camera, renderer } = dbg;
  const gl = renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const px = new Uint8Array(W * H * 4);
  const out = {};
  const count = () => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      if (px[i] > 120 && px[i + 1] < 100 && px[i + 2] > 120) {
        n++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    return n ? { n, w: maxx - minx + 1, h: maxy - miny + 1 } : { n: 0 };
  };
  for (const size of [2, 2.5, 3, 3.5, 4]) {
    const q = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ color: 0xff00ff, side: T.DoubleSide }));
    q.position.set(0, 0, -50);
    scene.add(q);
    renderer.render(scene, camera);
    out['u' + size] = count();
    scene.remove(q);
    q.geometry.dispose(); q.material.dispose();
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
