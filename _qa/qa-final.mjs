import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const sleep = ms => new Promise(s => setTimeout(s, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  return { page, logs };
}

/* ---- PHASE 1: sky mode ---- */
{
  const { page, logs } = await newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(4500);
  const r1 = await page.evaluate(() => ({
    stars: P.stars.length, cons: P.constellations.length, consLines: P.constellations.reduce((a, c) => a + c[1].length, 0),
    asterisms: P.asterisms.length, dso: P.dso.length, minors: P.minors.planets.length, moons: P.minors.moons.length,
    wash: P.app.state.galaxyWash, asterismsOn: P.app.state.asterisms, consOn: P.app.state.constellations
  }));
  console.log('BOOT:', JSON.stringify(r1));
  const r2 = await page.evaluate(() => {
    const press = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    press('a'); press('w');
    const off = { a: P.app.state.asterisms, w: P.app.state.galaxyWash };
    press('a'); press('w');
    return { off, on: { a: P.app.state.asterisms, w: P.app.state.galaxyWash } };
  });
  console.log('KEYS:', JSON.stringify(r2));
  const r4 = await page.evaluate(() => {
    const d = P.app._dbg;
    let bad = 0, n = 0;
    for (const s of d.sky.named) {
      const p = s.world || s.anchor; if (!p) continue;
      n++;
      if (isNaN(p.x) || isNaN(p.y) || isNaN(p.z)) bad++;
    }
    const pos = d.sky.asterisms.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) if (isNaN(pos.getX(i))) bad++;
    const sun = d.sky.sunPos;
    return { starAnchors: n, badAnchors: bad, sunFinite: sun && isFinite(sun.x) && isFinite(sun.y) && isFinite(sun.z) };
  });
  console.log('SKY:', JSON.stringify(r4));
  console.log('SKY LOGS:', JSON.stringify(logs.slice(0, 10)), 'total:', logs.length);
  await page.close();
}

/* ---- PHASE 2: solar mode (fresh page, straight in) ---- */
{
  const { page, logs } = await newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(4500);
  const r3 = await page.evaluate(() => new Promise(res => {
    P.app.setMode('solar');
    setTimeout(() => {
      const d = P.app._dbg;
      const meshes = d.solar.meshes;
      res({
        mode: P.app.state.mode, meshes: Object.keys(meshes).length,
        minors: ['Ceres', 'Vesta', 'Pallas', 'Pluto', 'Eris', 'Haumea', 'Makemake'].filter(n => meshes[n]).length,
        moons: ['Io', 'Europa', 'Ganymede', 'Titan', 'Triton', 'Charon'].filter(n => meshes[n]).length
      });
    }, 1500);
  }));
  console.log('SOLAR:', JSON.stringify(r3));
  console.log('SOLAR LOGS:', JSON.stringify(logs.slice(0, 10)), 'total:', logs.length);
  await page.close();
}

await browser.close();
console.log('DONE');
