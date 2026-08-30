import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'M8');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(5000);           // long settle — camera fully at rest
await page.screenshot({ path: R + '\\qa-wash-a.png' });
await page.keyboard.press('w');            // wash OFF
await page.waitForTimeout(600);
await page.screenshot({ path: R + '\\qa-wash-b.png' });
await page.keyboard.press('w');            // wash ON again
await page.waitForTimeout(600);
await page.screenshot({ path: R + '\\qa-wash-c.png' });
const st = await page.evaluate(() => ({ wash: P.app.state.galaxyWash, btn: document.getElementById('tg-wash').className }));
await browser.close();

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p2 = await b.newPage();
await p2.setContent('<html></html>');
const load = async f => p2.evaluate(async ({ b64 }) => {
  const img = new Image();
  await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err('fail'); img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return { w: c.width, h: c.height, data: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 4 < 3)) };
}, { b64: fs.readFileSync(f).toString('base64') });

const A = await load(R + '\\qa-wash-a.png');
const B = await load(R + '\\qa-wash-b.png');
const C = await load(R + '\\qa-wash-c.png');
const { w, h } = A;
// band = 4 strips: b≈-5..-1, -1..+3 (core), +3..+7, and controls at ±18°..-26°
const bandStat = (D) => {
  const px = (x, y) => { const i = (y * w + x) * 3; return (D[i] + D[i + 1] + D[i + 2]) / 3; };
  const strip = (y0, hgt) => {
    let s = 0, n = 0;
    for (let y = y0; y < y0 + hgt; y++) for (let x = 0; x < w; x += 2) { s += px(x, y); n++; }
    return s / n;
  };
  const cy = h / 2;
  return {
    core: strip(cy - 60, 120),        // on the plane
    edge: (strip(cy - 150, 60) + strip(cy + 90, 60)) / 2,
    ctrlN: strip(cy - 330, 80),
    ctrlS: strip(cy + 250, 80)
  };
};
const aS = bandStat(A.data), bS = bandStat(B.data), cS = bandStat(C.data);
const diff = (x, y) => ({ core: +(x.core - y.core).toFixed(2), edge: +(x.edge - y.edge).toFixed(2), ctrlN: +(x.ctrlN - y.ctrlN).toFixed(2), ctrlS: +(x.ctrlS - y.ctrlS).toFixed(2) });
console.log('A(ON) :', JSON.stringify(aS));
console.log('B(OFF):', JSON.stringify(bS));
console.log('C(ON) :', JSON.stringify(cS));
console.log('A-C (stability):', JSON.stringify(diff(aS, cS)));
console.log('A-B (wash on-off):', JSON.stringify(diff(aS, bS)));
console.log('state:', JSON.stringify(st));
console.log('ERRORS:', JSON.stringify(errors));
await b.close();
