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

  // M42 dome position + screen pos
  let m42 = -1;
  for (let i = 0; i < P.dso.length; i++) if (P.dso[i][0] === 'M42') { m42 = i; break; }
  const off = dbg.sky.dsoDebug.ggeo.getAttribute('iOff').array;
  const wp = new T.Vector3(off[m42 * 3], off[m42 * 3 + 1], off[m42 * 3 + 2]);
  const ndc = wp.clone().project(camera);
  const sx = Math.round((ndc.x * 0.5 + 0.5) * W);
  const sy = Math.round((0.5 - ndc.y * 0.5) * H);

  const readBox = (cx, cy, r = 40) => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sr = 0, sg = 0, sb = 0, n = 0, mr = 0, mg = 0, mb = 0, m = 0;
    for (let y = cy - r; y < cy + r; y++) for (let x = cx - r; x < cx + r; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (v > m) { m = v; mr = px[i]; mg = px[i + 1]; mb = px[i + 2]; }
      sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n += 3;
    }
    return { mean: [+(sr / n).toFixed(1), +(sg / n).toFixed(1), +(sb / n).toFixed(1)], max: [mr, mg, mb], maxV: +m.toFixed(1) };
  };

  const mkQuad = (size, pos, opts = {}) => {
    const q = new T.Mesh(
      new T.PlaneGeometry(size, size),
      new T.MeshBasicMaterial({ color: 0xff0000, side: T.DoubleSide, depthTest: false, depthWrite: false, ...opts })
    );
    q.position.copy(pos);
    if (opts.lookAt) q.lookAt(new T.Vector3(0, 0, 0));
    if (opts.renderOrder !== undefined) q.renderOrder = opts.renderOrder;
    scene.add(q);
    renderer.render(scene, camera);
    const res = readBox(sx, sy);
    scene.remove(q);
    return res;
  };

  const out = { sx: [sx, sy] };
  out.small_center = mkQuad(2, new T.Vector3(0, 0, -50));              // 2x2 dead center, no lookAt
  out.small_m42 = mkQuad(2, wp.clone());                              // 2x2 at M42, default facing
  out.small_m42_look = mkQuad(2, wp.clone(), { lookAt: true });       // 2x2 at M42, lookAt origin
  out.small_m42_ro999 = mkQuad(2, wp.clone(), { renderOrder: 999 });  // 2x2 at M42, renderOrder 999
  out.big_m42 = mkQuad(200, wp.clone());                              // 200x200 at M42
  out.tiny_m42 = mkQuad(0.5, wp.clone());                             // 0.5x0.5 (~4px) at M42
  out.huge_1 = mkQuad(2000, new T.Vector3(0, 0, -50));                // control: works
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
