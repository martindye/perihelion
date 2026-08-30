import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__captured = [];
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const gl = origGet.call(this, type, ...a);
    if (gl && (type === 'webgl' || type === 'webgl2') && !gl.__hooked) {
      gl.__hooked = true;
      const origTex = gl.texImage2D.bind(gl);
      gl.texImage2D = function (target, level, ifmt, fmt, type, src) {
        const isCanvas = src && src.tagName === 'CANVAS';
        const r = origTex(target, level, ifmt, fmt, type, src);
        if (arguments.length <= 6 && isCanvas) {
          const tex = gl.getParameter(gl.TEXTURE_BINDING_2D);
          window.__captured.push({ tex, w: src.width, h: src.height, at: Date.now() });
        }
        return r;
      };
    }
    return gl;
  };
});
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const errorsJson = JSON.stringify(errors);

const result = await page.evaluate(() => {
  const out = {
    captured: (window.__captured || []).map(c => ({ w: c.w, h: c.h })),
    reads: [],
    canvas: !!document.querySelector('canvas'),
    pDso: window.P && P.dso ? P.dso.length : null
  };
  const canvas = document.querySelector('.scene-canvas') || document.querySelector('canvas');
  if (!canvas) return out;
  const gl = canvas.getContext('webgl');
  if (!gl) return { ...out, error: 'no context' };
  for (const c of (window.__captured || [])) {
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    try {
      const px = gl.getTexImage(0, gl.RGBA, gl.UNSIGNED_BYTE);
      let sum = 0, mx = 0, nz = 0;
      if (px) {
        for (let i = 0; i < px.length; i += 4) {
          sum += px[i]; if (px[i] > mx) mx = px[i];
          if (px[i] > 8) nz++;
        }
      }
      out.reads.push({ w: c.w, h: c.h, got: px ? [px.width, px.height] : null,
        mean: px ? +(sum / (px.width * px.height)).toFixed(2) : -1, max: mx, nonzero: nz,
        minFilter: gl.getParameter(gl.TEXTURE_MIN_FILTER), magFilter: gl.getParameter(gl.TEXTURE_MAG_FILTER) });
    } catch (e) { out.reads.push({ w: c.w, h: c.h, err: String(e) }); }
  }
  out.errors = gl.getError();
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors).slice(0, 2000));
await browser.close();
