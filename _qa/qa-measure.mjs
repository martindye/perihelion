import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
  const { scene, camera, renderer } = dbg;
  const gl = renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const px = new Uint8Array(W * H * 4);
  const out = { W, H, viewport: [gl.getParameter(gl.VIEWPORT)[0], gl.getParameter(gl.VIEWPORT)[1], gl.getParameter(gl.VIEWPORT)[2], gl.getParameter(gl.VIEWPORT)[3]] };

  // hide everything else so only our quad + nothing shows
  const hidden = [];
  scene.traverse(o => { if (o.visible) { o.__wv = true; o.visible = false; } });
  scene.background = new T.Color(0x000000);

  const redBox = (size, pos) => {
    const q = new T.Mesh(new T.PlaneGeometry(size, size),
      new T.MeshBasicMaterial({ color: 0xff0000, side: T.DoubleSide }));
    q.position.copy(pos);
    scene.add(q);
    renderer.render(scene, camera);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      if (px[i] > 120 && px[i + 1] < 100 && px[i + 2] < 100) {
        n++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    scene.remove(q);
    return n ? { redPx: n, x0: minx, x1: maxx, y0: miny, y1: maxy, w: maxx - minx + 1, h: maxy - miny + 1 } : { redPx: 0 };
  };

  const c = new T.Vector3(0, 0, -50);
  out.s2 = redBox(2, c);
  out.s4 = redBox(4, c);
  out.s8 = redBox(8, c);
  out.s16 = redBox(16, c);
  out.s200 = redBox(200, c);

  // restore scene
  scene.traverse(o => { if (o.__wv) { o.visible = true; delete o.__wv; } });
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
