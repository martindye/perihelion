import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

/* inject a huge red quad into the app scene, force it to render, screenshot */
const handle = await page.evaluateHandle(() => {
  const dbg = P.app._dbg;
  const q = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, depthTest: false })
  );
  q.position.set(0, 0, -50);
  q.renderOrder = 999;
  dbg.scene.add(q);
  window.__redQuad = q;
  return q;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa/qa-redquad.png' });

const info = await page.evaluate(() => {
  const dbg = P.app._dbg;
  const gl = dbg.renderer.getContext();
  dbg.renderer.render(dbg.scene, dbg.camera);
  const px = new Uint8Array(16 * 16 * 4);
  gl.readPixels(50, 50, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  const n = 256;
  return { readCenter50: [+(r / n).toFixed(0), +(g / n).toFixed(0), +(b / n).toFixed(0)], quadVisible: !!window.__redQuad && window.__redQuad.visible };
});
console.log(JSON.stringify(info));
// remove quad
await page.evaluate(() => { const q = window.__redQuad; P.app._dbg.scene.remove(q); });
await browser.close();
