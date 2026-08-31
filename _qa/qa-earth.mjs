import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('#tg-catalog'); await page.waitForTimeout(250);

/* SKY mode: "earth" must now return a row, and clicking it jumps to solar mode */
await page.fill('#cat-search', 'earth'); await page.waitForTimeout(300);
let rows = await page.$$eval('.cat-row', r => r.map(x => x.textContent));
ok(rows.some(t => /^Earth/.test(t)), `sky: "earth" search shows the Earth row (${JSON.stringify(rows.slice(0, 3))})`);
await page.evaluate(() => {
  const r = [...document.querySelectorAll('.cat-row')].find(x => /^Earth/.test(x.textContent));
  r.click();
});
await page.waitForTimeout(500);
let st = await page.evaluate(() => ({ mode: P.app.state.mode, follow: P.app.state.follow, sel: P.app.state.selected }));
ok(st.mode === 'solar' && st.follow === 'Earth' && st.sel === 'body:Earth',
  `sky pick → solar mode, following Earth (${JSON.stringify(st)})`);

/* SOLAR mode: info card + follow + label */
st = await page.evaluate(() => ({
  title: document.getElementById('ip-title').textContent,
  vis: document.getElementById('infopanel').style.display !== 'none',
  follow: P.app.state.follow
}));
ok(st.vis && /earth/i.test(st.title), `solar: Earth info card open (${st.title})`);
await page.waitForTimeout(400);
const label = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')].filter(d =>
    d.children.length === 0 && /^earth$/i.test((d.textContent || '').trim()));
  return els.length;
});
ok(label >= 1, `solar: EARTH label present in scene (${label})`);

/* camera actually chases Earth (offset ~0) */
const ch = await page.evaluate(() => {
  const d = P.app._dbg;
  const p = d.solar.meshes['Earth'].position, c = d.cam.target;
  return Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y), Math.abs(p.z - c.z));
});
ok(ch < 0.5, `camera chases Earth (offset ${ch.toFixed(3)})`);

/* other planets still fine */
for (const q of ['venus', 'neptune']) {
  await page.fill('#cat-search', q); await page.waitForTimeout(250);
  const r = await page.$$('.cat-row');
  ok(r.length > 0, `catalog still finds "${q}"`);
  if (r.length) { await r[0].click(); await page.waitForTimeout(250); }
}
const fin = await page.evaluate(() => P.app.state.selected);
ok(/body:Neptune/.test(fin), `neptune selectable (${fin})`);

/* no page errors */
ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
