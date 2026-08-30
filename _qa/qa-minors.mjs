import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /self-test|PERIHELION/.test(t)) logs.push(m.type() + ': ' + t); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

const info = await page.evaluate(() => {
  const d = P.app._dbg;
  const out = {
    minors: P.minors ? { planets: P.minors.planets.length, moons: P.minors.moons.length } : null,
    bodies: {},
    ceresDom: null,
    state: P.app.state.mode
  };
  // sky-mode check: minor-planet dome sprites sit on the dome (|p| ~ R-0.5)
  for (const n of ['Ceres', 'Vesta', 'Pluto', 'Eris']) {
    const rec = P.app._dbg.sky.bodyRecords[n];
    if (!rec) { out.bodies[n] = 'MISSING'; continue; }
    const p = rec.holder.position;
    out.bodies[n] = +p.length().toFixed(2);
  }
  return out;
});
console.log('SKY-MODE INFO:', JSON.stringify(info));

/* catalog fly-to Ceres (tests catalog + pointAt for a minor planet) */
await page.click('#tg-catalog');
await page.waitForTimeout(200);
await page.fill('#cat-search', 'Ceres');
await page.waitForTimeout(250);
const rows = await page.$$eval('.cat-row', rs => rs.slice(0, 3).map(r => r.textContent));
console.log('CAT ROWS:', JSON.stringify(rows));
await page.click('.cat-row');
await page.waitForTimeout(2500);
await page.screenshot({ path: R + '\\qa-ceres-sky.png' });

/* solar mode: Jupiter system with Galilean moons */
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(300);
/* make sure the catalog panel is open in solar mode */
const catOpen = await page.evaluate(() => document.getElementById('cat-search').offsetParent !== null);
if (!catOpen) { await page.click('#tg-catalog'); await page.waitForTimeout(250); }
await page.fill('#cat-search', 'Jupiter');
await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(1200);
const jup = await page.evaluate(() => {
  const d = P.app._dbg;
  const out = { follow: d.state.follow, dist: +d.camera.position.distanceTo(d.solar.meshes.Jupiter ? d.solar.meshes.Jupiter.position : new d.scene.children[0].position.constructor(0, 0, 0)).toFixed ? null : null };
  const pos = n => { const m = d.solar.meshes[n]; if (!m) return null; const p = m.position; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; };
  return {
    follow: d.state.follow,
    meshes: ['Jupiter', 'Io', 'Europa', 'Ganymede', 'Callisto', 'Phobos', 'Deimos', 'Titan', 'Rhea', 'Iapetus', 'Triton', 'Charon', 'Ceres', 'Pluto', 'Eris']
      .map(n => [n, pos(n)]),
    dist: d.state.follow
  };
});
console.log('SOLAR:', JSON.stringify(jup.meshes, null, 0));
await page.screenshot({ path: R + '\\qa-jupiter-moons.png' });

/* full solar system view (minors + orbits) */
await page.evaluate(() => { P.app._dbg; });
await page.evaluate(() => {
  // zoom out via camera distance: emulate wheel on canvas
});
await page.mouse.move(800, 450);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(60); }
await page.waitForTimeout(600);
await page.screenshot({ path: R + '\\qa-solar-full.png' });

console.log('LOGS:', JSON.stringify(logs, null, 1));
await browser.close();
