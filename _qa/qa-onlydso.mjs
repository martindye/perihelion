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
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  const T = THREE;
  const dbg = P.app._dbg;
  const { scene, camera, renderer, sky } = dbg;
  const gl = renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const px = new Uint8Array(W * H * 4);
  const out = {};

  const brightMap = (thr) => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0; const xs = [], ys = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (v > thr) { n++; if (n < 4000) { xs.push(x); ys.push(y); } }
    }
    return n;
  };

  // M42 screen position from the mesh data, using matrices AFTER a render
  const d = sky.dsoDebug;
  let m42 = -1;
  for (let i = 0; i < P.dso.length; i++) if (P.dso[i][0] === 'M42') { m42 = i; break; }
  const off = d.ggeo.getAttribute('iOff').array;

  /* onlyDso mode: hide everything except the DSO mesh */
  const hidden = [];
  scene.traverse(o => { if (o !== d.gm && o.visible) { o.__wv = true; o.visible = false; hidden.push(o); } });
  for (let p = d.gm.parent; p; p = p.parent) p.visible = true;

  renderer.render(scene, camera);
  out.bright5_full = brightMap(5);
  out.bright20_full = brightMap(20);
  out.bright60_full = brightMap(60);

  // where is M42 in this frame?
  const wp = new T.Vector3(off[m42 * 3], off[m42 * 3 + 1], off[m42 * 3 + 2]);
  const v = wp.clone().project(camera);
  const sx = Math.round((v.x * 0.5 + 0.5) * W);
  const sy = Math.round((0.5 - v.y * 0.5) * H);
  out.m42Screen = [sx, sy];

  // sample a 60x60 box around M42 (and the frame center for reference)
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const box = (cx, cy, r) => {
    let s = 0, n = 0, mx = 0, mr = 0, mg = 0, mb = 0;
    for (let y = cy - r; y < cy + r; y++) for (let x = cx - r; x < cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = ((H - 1 - y) * W + x) * 4;
      const val = (px[i] + px[i + 1] + px[i + 2]) / 3;
      s += val; n++;
      if (val > mx) { mx = val; mr = px[i]; mg = px[i + 1]; mb = px[i + 2]; }
    }
    return { mean: +(s / n).toFixed(2), max: +mx.toFixed(1), maxRgb: [mr, mg, mb] };
  };
  out.m42box = box(sx, sy, 60);
  out.centerBox = box(W / 2 | 0, H / 2 | 0, 60);

  // restore
  for (const o of hidden) { o.visible = o.__wv; }
  scene.traverse(o => { if (o.__wv) { o.visible = true; delete o.__wv; } });
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
