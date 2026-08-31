/* QA — strafe camera (middle-drag / Ctrl+drag) in solar mode.
 * Run from the _qa dir:  node _qa/qa-strafe.mjs */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2500);

/* solar mode, follow Saturn, fixed framing */
await page.evaluate(() => {
  P.app.setMode('solar');
  P.app.state.follow = 'Saturn';
  const pl = P.planets.find(p => p.name === 'Saturn');
  P.app._dbg.cam.dist = pl.size * 5;
});
await page.waitForTimeout(600);

/* helper: Saturn's screen position + camera state, in one shot */
const probe = () => page.evaluate(() => {
  const d = P.app._dbg;
  const m = d.solar.meshes['Saturn'].position;
  const v = m.clone().project(d.camera);
  return {
    sx: (v.x * 0.5 + 0.5) * 1600, sy: (-v.y * 0.5 + 0.5) * 900,
    pan: [d.cam.pan.x, d.cam.pan.y, d.cam.pan.z].map(z => +z.toFixed(4)),
    yaw: +d.cam.yaw.toFixed(5), pitch: +d.cam.pitch.toFixed(5),
    camPos: d.camera.position.toArray().map(z => +z.toFixed(4))
  };
});

const p0 = await probe();

/* --- middle-drag right+down: content must follow the cursor ------------- */
await page.mouse.move(800, 450);
await page.mouse.down({ button: 'middle' });
for (let i = 1; i <= 5; i++) {
  await page.mouse.move(800 + i * 30, 450 + i * 20);  // +150px x, +100px y
  await page.waitForTimeout(30);
}
await page.mouse.up({ button: 'middle' });
await page.waitForTimeout(100);
const p1 = await probe();
ok(p1.sx > p0.sx + 40, `middle-drag: Saturn follows cursor right (sx ${p0.sx.toFixed(0)} -> ${p1.sx.toFixed(0)})`);
ok(p1.sy > p0.sy + 20, `middle-drag: Saturn follows cursor down (sy ${p0.sy.toFixed(0)} -> ${p1.sy.toFixed(0)})`);
ok(Math.hypot(p1.pan[0], p1.pan[1], p1.pan[2]) > 0.5, `middle-drag: cam.pan moved (len ${Math.hypot(...p1.pan).toFixed(3)})`);
ok(p1.yaw === p0.yaw && p1.pitch === p0.pitch, `middle-drag: no orbit rotation (yaw/pitch untouched)`);

/* --- Ctrl+left-drag: same strafe behaviour ------------------------------ */
const p2 = await probe();
await page.mouse.move(800, 450);
await page.keyboard.down('Control');
await page.mouse.down();
for (let i = 1; i <= 4; i++) {
  await page.mouse.move(800 - i * 35, 450);   // drag left
  await page.waitForTimeout(30);
}
await page.mouse.up();
await page.keyboard.up('Control');
await page.waitForTimeout(100);
const p3 = await probe();
ok(p3.sx < p2.sx - 20, `ctrl+drag: content follows left (sx ${p2.sx.toFixed(0)} -> ${p3.sx.toFixed(0)})`);
ok(p3.yaw === p2.yaw && p3.pitch === p2.pitch, 'ctrl+drag: no orbit rotation');

/* plain left-drag must still orbit (regression) */
const p4 = await probe();
await page.mouse.move(800, 450);
await page.mouse.down();
for (let i = 1; i <= 4; i++) { await page.mouse.move(800 + i * 40, 450); await page.waitForTimeout(20); }
await page.mouse.up();
await page.waitForTimeout(100);
const p5 = await probe();
ok(p5.yaw < p4.yaw, `left-drag still orbits (yaw ${p4.yaw.toFixed(3)} -> ${p5.yaw.toFixed(3)})`);

/* --- re-follow re-centres: pan offset must not carry over --------------- */
await page.evaluate(() => { P.app.state.follow = 'Jupiter'; });
await page.waitForTimeout(200);
const p6 = await probe();
ok(Math.hypot(p6.pan[0], p6.pan[1], p6.pan[2]) < 1e-6, `re-follow re-centres (pan reset, got [${p6.pan}])`);

/* --- sky mode: middle-drag orbits (no strafe target there) ------------- */
await page.evaluate(() => P.app.setMode('sky'));
await page.waitForTimeout(300);
const s0 = await page.evaluate(() => { const d = P.app._dbg; return { yaw: d.cam.yaw, pan: d.cam.pan.clone().length() }; });
await page.mouse.move(800, 450);
await page.mouse.down({ button: 'middle' });
for (let i = 1; i <= 4; i++) { await page.mouse.move(800 + i * 40, 450); await page.waitForTimeout(20); }
await page.mouse.up({ button: 'middle' });
await page.waitForTimeout(100);
const s1 = await page.evaluate(() => { const d = P.app._dbg; return { yaw: d.cam.yaw, pan: d.cam.pan.length() }; });
ok(Math.abs(s1.yaw - s0.yaw) > 0.01, `sky: middle-drag orbits (yaw ${s0.yaw.toFixed(3)} -> ${s1.yaw.toFixed(3)})`);
ok(s1.pan < 1e-9, `sky: no strafe offset accumulated (pan ${s1.pan})`);

console.log('errors:', JSON.stringify(errs.slice(0, 5)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
