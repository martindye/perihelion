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
  const out = { hasDbg: !!dbg, hasSky: !!(dbg && dbg.sky) };
  if (!dbg || !dbg.sky) return out;
  const d = dbg.sky.dsoDebug;
  out.hasDsoDebug = !!d;
  if (!d) return out;
  const { gm, ggeo, atlasTex } = d;
  const cam = dbg.camera;

  /* find M42 instance index */
  let m42 = -1;
  for (let i = 0; i < P.dso.length; i++) if (P.dso[i][0] === 'M42') { m42 = i; break; }
  out.m42Index = m42;

  const attr = name => ggeo.getAttribute(name);
  const A = {
    iOff: attr('iOff') && ggeo.getAttribute('iOff').array,
    iUV: attr('iUV') && ggeo.getAttribute('iUV').array,
    iSize: attr('iSize') && ggeo.getAttribute('iSize').array,
    iAlpha: attr('iAlpha') && ggeo.getAttribute('iAlpha').array,
    iCol: attr('iCol') && ggeo.getAttribute('iCol').array
  };
  out.instanceCount = ggeo.instanceCount;
  out.meshVisible = gm.visible;
  out.parentChain = (() => { let n = gm, s = []; while (n) { s.push(n.isMesh ? 'Mesh' : n.type); n = n.parent; } return s.join('>'); })();
  out.material = { transparent: gm.material.transparent, depthTest: gm.material.depthTest, side: gm.material.side, blending: gm.material.blending };
  out.atlas = { img: [atlasTex.image.width, atlasTex.image.height], minFilter: atlasTex.minFilter, flipY: atlasTex.flipY, needsUpdate: atlasTex.needsUpdate, version: atlasTex.version };

  const dumpInst = i => {
    const o = { i,
      off: [A.iOff[i * 3], A.iOff[i * 3 + 1], A.iOff[i * 3 + 2]].map(x => +x.toFixed(3)),
      size: [+A.iSize[i * 2].toFixed(4), +A.iSize[i * 2 + 1].toFixed(4)],
      uv: [A.iUV[i * 4], A.iUV[i * 4 + 1], A.iUV[i * 4 + 2], A.iUV[i * 4 + 3]],
      alpha: A.iAlpha[i],
      col: [A.iCol[i * 3], A.iCol[i * 3 + 1], A.iCol[i * 3 + 2]]
    };
    const wp = new T.Vector3(o.off[0], o.off[1], o.off[2]);
    /* project with the app camera */
    const mv = wp.clone().applyMatrix4(cam.matrixWorldInverse);
    const pv = mv.project(cam);
    o.screenX = Math.round((pv.x * 0.5 + 0.5) * 1280);
    o.screenY = Math.round((0.5 - pv.y * 0.5) * 800);
    o.behind = mv.z > -0.05;
    return o;
  };
  out.inst0 = dumpInst(0);
  out.instM42 = dumpInst(m42);
  out.inst624 = dumpInst(624);

  /* camera state */
  out.cam = { fov: cam.fov, pos: cam.position.toArray(), matrix: cam.matrixWorldInverse.elements.map(x => +x.toFixed(3)).slice(0, 4) };

  /* where does the app put the selection marker? (sprite with renderOrder 30) */
  let marker = null;
  dbg.scene.traverse(o => { if (o.isSprite && o.renderOrder === 30) marker = o; });
  out.marker = marker ? { pos: marker.position.toArray().map(x => +x.toFixed(3)), visible: marker.visible, scale: marker.scale.toArray().map(x => +x.toFixed(2)) } : null;

  /* what's the camera looking at (RA/Dec of screen center)? */
  const center = new T.Vector3(0, 0, -1).unproject(cam).sub(cam.position).normalize();
  const R = dbg.sky.R || 100;
  out.viewCenter = { x: +center.x.toFixed(3), y: +center.y.toFixed(3), z: +center.z.toFixed(3) };
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
