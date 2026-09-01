/* QA — render-on-demand (efficiency pass):
 *   paused + no input  -> the loop goes idle (no sim, no render passes)
 *   any input / play   -> renders resume immediately
 *   orbit lines merged -> draw-call count drops, orbits still visible
 * Run from the _qa dir:  node _qa/qa-perf-idle.mjs */
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

const snap = () => page.evaluate(() => {
  const p = P.app._dbg.perf;
  return { frames: p.frames, calls: p.last ? p.last.calls : 0, tris: p.last ? p.last.tris : 0 };
});

/* 1) playing: render passes accumulate (rate is machine-dependent —
   headless SwiftShader runs ~10 fps, real GPUs run 60) */
const a = await snap();
await page.waitForTimeout(2000);
const b = await snap();
const playingRate = (b.frames - a.frames) / 2;
ok(b.frames - a.frames > 3, `playing renders at rate (${b.frames - a.frames} passes / 2 s)`);

/* 2) pause + settle -> idle: NO further render passes, loop still alive */
await page.evaluate(() => { P.app.state.playing = false; P.app.state.selected = null; });
await page.waitForTimeout(1500);              /* let the last frames flush */
const c = await snap();
await page.waitForTimeout(2500);
const d = await snap();
ok(d.frames - c.frames <= 1, `idle: no render passes while static (${d.frames - c.frames} in 2.5 s)`);
const fpsBadge = await page.evaluate(() => document.querySelector('#fps')?.textContent || '');
ok(/^\d+$/.test(fpsBadge) && +fpsBadge > 30, `loop still alive while idle (fps badge "${fpsBadge}")`);

/* 3) a drag wakes it up (and actually moves the camera) */
const yawBefore = await page.evaluate(() => P.app._dbg.cam.yaw);
await page.mouse.move(800, 450);
await page.mouse.down();
await page.mouse.move(860, 470);
await page.mouse.up();
await page.waitForTimeout(700);
const e = await snap();
const yawAfter = await page.evaluate(() => P.app._dbg.cam.yaw);
ok(Math.abs(yawAfter - yawBefore) > 0.01, 'drag registered (camera yaw changed)');
ok(e.frames - d.frames > 1, `drag re-renders (${e.frames - d.frames} passes after wake)`);

/* 4) resume the clock -> steady renders again */
await page.evaluate(() => { P.app.state.playing = true; });
const f1 = await snap();
await page.waitForTimeout(1200);
const f2 = await snap();
ok(f2.frames - f1.frames > 3, `play resumes render passes (${f2.frames - f1.frames} / 1.2 s)`);

/* 5) solar mode: merged orbit lines — one draw per class, orbits visible */
await page.evaluate(() => {
  P.app.setMode('solar');
  P.app._dbg.cam.dist = 300;
});
await page.waitForTimeout(2500);
const g = await snap();
ok(g.calls < 115, `merged orbits: ${g.calls} draw calls (was ~126)`);
const lineInfo = await page.evaluate(() => {
  const lines = [];
  P.app._dbg.scene.traverse(o => { if (o.isLine || o.isLineSegments) lines.push(o.type + ':' + (o.geometry.attributes.position ? o.geometry.attributes.position.count : '?')); });
  return lines;
});
const merged = lineInfo.filter(t => t.startsWith('LineSegments'));
ok(merged.length >= 2, `orbit classes merged into LineSegments (${merged.length} line objects: ${lineInfo.length} total lines)`);

console.log('errors:', JSON.stringify(errs.slice(0, 5)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
