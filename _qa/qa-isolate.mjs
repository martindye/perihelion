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
  const { gm } = d;
  const gl = renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const out = {};

  const px = new Uint8Array(W * H * 4);
  const m42 = (() => { let i = -1; for (let k = 0; k < P.dso.length; k++) if (P.dso[k][0] === 'M42') { i = k; break; } return i; })();
  const off = d.ggeo.getAttribute('iOff').array;
  const wp = new T.Vector3(off[m42 * 3], off[m42 * 3 + 1], off[m42 * 3 + 2]);
  const mv = wp.clone().applyMatrix4(camera.matrixWorldInverse);
  const ndc = mv.clone().project(camera);
  const sx = Math.round((ndc.x * 0.5 + 0.5) * W);
  const sy = Math.round((0.5 - ndc.y * 0.5) * H);

  const readBox = () => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = 0, n = 0, mx = 0, mxr = 0, mxg = 0, mxb = 0;
    for (let y = sy - 40; y < sy + 40; y++) for (let x = sx - 40; x < sx + 40; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
      s += v; n++;
      if (v > mx) { mx = v; mxr = px[i]; mxg = px[i + 1]; mxb = px[i + 2]; }
    }
    return { mean: +(s / n).toFixed(2), max: mx, maxRgb: [mxr, mxg, mxb] };
  };

  out.sx = [sx, sy];

  /* 1) render as-is (full scene) */
  renderer.info.reset();
  renderer.render(scene, camera);
  out.triangles_full = renderer.info.render.triangles;
  out.calls_full = renderer.info.render.calls;
  out.full = readBox();

  /* 2) hide everything except the DSO quad mesh */
  const keep = new Set([gm]);
  const hidden = [];
  scene.traverse(o => { if (!keep.has(o)) { if (o.visible) { o.__wasVis = true; o.visible = false; hidden.push(o); } } });
  // gm's parents must stay visible
  for (let p = gm.parent; p; p = p.parent) p.visible = true;
  renderer.info.reset();
  renderer.render(scene, camera);
  out.triangles_onlyDso = renderer.info.render.triangles;
  out.onlyDso = readBox();
  // restore
  for (const o of hidden) o.visible = o.__wasVis;
  scene.traverse(o => { if (o.__wasVis !== undefined) delete o.__wasVis; });

  /* 3) same but ALSO remove the texture dependency: use a fresh material with a 1x1 white DataTexture */
  const white = new Uint8Array([255, 255, 255, 255]);
  const dtex = new THREE.DataTexture(white, 1, 1);
  dtex.needsUpdate = true;
  const mat2 = gm.material.clone();
  mat2.uniforms = { uAtlas: { value: dtex } };
  gm.material = mat2;
  renderer.info.reset();
  renderer.render(scene, camera);
  out.whiteTex = readBox();
  out.triangles_white = renderer.info.render.triangles;

  /* 4) and a completely independent quad at the same spot (fresh geometry, default material-ish shader) */
  const q = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
  );
  q.position.copy(wp);
  q.lookAt(new T.Vector3(0, 0, 0)); // face camera at origin
  q.frustumCulled = false;
  scene.add(q);
  renderer.info.reset();
  renderer.render(scene, camera);
  out.redQuad = readBox();
  scene.remove(q);
  q.geometry.dispose(); q.material.dispose();

  /* mesh/material sanity */
  out.mesh = {
    visible: gm.visible,
    frustumCulled: gm.frustumCulled,
    matrixWorld: gm.matrixWorld.elements.map(x => +x.toFixed(3)),
    worldPos: (() => { const v = new T.Vector3(); gm.getWorldPosition(v); return v.toArray().map(x => +x.toFixed(2)); })()
  };
  out.mat2diff = !!d.atlasTex;
  out.uniformAtlasIsAtlasTex = gm.material.uniforms.uAtlas.value === d.atlasTex;
  out.texImg = [d.atlasTex.image.width, d.atlasTex.image.height];
  out.texVersion = d.atlasTex.version;
  out.texImageIsCanvas = d.atlasTex.image.tagName === 'CANVAS';
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
