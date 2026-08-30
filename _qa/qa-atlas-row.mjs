import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const r = await page.evaluate(() => {
  const d = window.__dbg;
  let gm = null;
  d.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.isInstancedBufferGeometry) gm = o; });
  const c = gm.material.uniforms.uAtlas.value.image;
  const g = c.getContext('2d');
  const W = c.width;
  const dta = g.getImageData(0, 0, W, W).data;
  const px = (x, y) => { const i = (y * W + x) * 4; return [dta[i], dta[i + 1], dta[i + 2], dta[i + 3]]; };
  // tile 0 center = (128,128); walk east in 8px steps (screen px = tile px * 59/256)
  const row = [];
  for (let x = 128; x <= 250; x += 8) row.push({ x, px: (x - 128) * 59 / 256, a: px(x, 128)[3], rgb: px(x, 128).slice(0, 3) });
  // vertical walk (north) too
  const col = [];
  for (let y = 128; y >= 16; y -= 8) col.push({ y, px: (128 - y) * 59 / 256, a: px(128, y)[3] });
  return { row, col };
});
console.log('EAST (screen px from center -> canvas alpha):');
for (const p of r.row) console.log(`  +${p.px.toFixed(1)}px  alpha=${p.a}  rgb=${p.rgb.join(',')}`);
console.log('NORTH:');
for (const p of r.col) console.log(`  +${p.px.toFixed(1)}px  alpha=${p.a}`);
await browser.close();
