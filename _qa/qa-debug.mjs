import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type().toUpperCase() + ' ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const r = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {
    skyDso: d.sky.dso.length,
    scene: d.listChildren(),
    info: { calls: d.info.render.calls, triangles: d.info.render.triangles, points: d.info.render.points, lines: d.info.render.lines }
  };
  // find the galaxy instanced mesh and dump a few attributes
  let gm = null;
  d.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.isInstancedBufferGeometry) gm = o; });
  if (gm) {
    const g = gm.geometry;
    const get = n => { const a = g.getAttribute(n); return a ? [a.array[0], a.array[1], a.array[2]] : null; };
    out.galaxyMesh = {
      found: true,
      instanceCount: g.instanceCount,
      visible: gm.visible && gm.parent.visible,
      frustumCulled: gm.frustumCulled,
      matBlending: gm.material.blending,
      iOff0: get('iOff'), iSize0: get('iSize'), iAlpha0: [g.getAttribute('iAlpha').array[0]],
      iUV0: get('iUV'), iCol0: get('iCol'),
      hasAtlas: !!gm.material.uniforms.uAtlas.value,
      atlasSize: gm.material.uniforms.uAtlas.value && [gm.material.uniforms.uAtlas.value.image.width, gm.material.uniforms.uAtlas.value.image.height]
    };
  } else out.galaxyMesh = { found: false };
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('LOGS', JSON.stringify(logs));
await browser.close();
