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

  const redPx = () => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      if (px[i] > 120 && px[i + 1] < 100 && px[i + 2] < 100) {
        n++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    return n ? { n, w: maxx - minx + 1, h: maxy - miny + 1, cx: (minx + maxx) / 2 | 0, cy: (miny + maxy) / 2 | 0 } : { n: 0 };
  };

  const test = (tag, build) => {
    const before = scene.children.length;
    const objs = build(scene);
    renderer.render(scene, camera);
    const r = redPx();
    objs.forEach(o => scene.remove(o));
    out[tag] = r;
  };

  const V = (x, y, z) => new T.Vector3(x, y, z);
  const mat = () => new T.MeshBasicMaterial({ color: 0xff0000, side: T.DoubleSide });

  /* A: size sweep at z=-50, full scene, camera as-is */
  test('a2_z50', s => { const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q.position.set(0, 0, -50); s.add(q); return [q]; });
  test('a10_z50', s => { const q = new T.Mesh(new T.PlaneGeometry(10, 10), mat()); q.position.set(0, 0, -50); s.add(q); return [q]; });
  test('a50_z50', s => { const q = new T.Mesh(new T.PlaneGeometry(50, 50), mat()); q.position.set(0, 0, -50); s.add(q); return [q]; });

  /* B: size 2 at various distances */
  test('b2_z5', s => { const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q.position.set(0, 0, -5); s.add(q); return [q]; });
  test('b2_z10', s => { const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q.position.set(0, 0, -10); s.add(q); return [q]; });
  test('b2_z100', s => { const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q.position.set(0, 0, -100); s.add(q); return [q]; });

  /* C: canary (renderOrder -1, huge) + small quad */
  test('c_canary+2', s => {
    const c = new T.Mesh(new T.PlaneGeometry(3000, 3000), mat()); c.position.set(0, 0, -50); c.renderOrder = -1;
    const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q.position.set(0, 0, -50);
    s.add(c); s.add(q); return [c, q];
  });

  /* D: empty scene, single 2x2 at z=-50 (nothing else visible) */
  const saved = [];
  scene.traverse(o => { if (o.visible) { o.__wv = true; o.visible = false; } });
  test('d_empty_2x2', s => { const q = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q.position.set(0, 0, -50); s.add(q); return [q]; });
  test('d_empty_2000', s => { const q = new T.Mesh(new T.PlaneGeometry(2000, 2000), mat()); q.position.set(0, 0, -50); s.add(q); return [q]; });
  scene.traverse(o => { if (o.__wv) { o.visible = true; delete o.__wv; } });

  /* E: render the same quad TWICE in one frame (two meshes) */
  test('e_double2', s => {
    const q1 = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q1.position.set(0, 0, -50);
    const q2 = new T.Mesh(new T.PlaneGeometry(2, 2), mat()); q2.position.set(0, 0, -50);
    s.add(q1); s.add(q2); return [q1, q2];
  });

  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
