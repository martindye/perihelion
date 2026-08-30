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
    if (gl && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && !gl.__hooked) {
      gl.__hooked = true;
      const origTex = gl.texImage2D.bind(gl);
      gl.texImage2D = function () {
        const src = arguments[arguments.length - 1];
        const r = origTex.apply(null, arguments);
        const isCanvas = !!(src && src.tagName === 'CANVAS');
        if (isCanvas) {
          const tex = gl.getParameter(gl.TEXTURE_BINDING_2D);
          window.__captured.push({ tex, w: src.width, h: src.height, args: arguments.length, minFilter: gl.getParameter(gl.TEXTURE_MIN_FILTER) });
        }
        return r;
      };
    }
    return gl;
  };
});
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const result = await page.evaluate(() => {
  const out = {
    captured: (window.__captured || []).map(c => ({ w: c.w, h: c.h, args: c.args, minFilterAtUpload: c.minFilter })),
    reads: []
  };
  const canvas = document.querySelector('canvas');
  if (!canvas) return { ...out, error: 'no canvas' };
  const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
  if (!gl) return { ...out, error: 'no gl' };
  for (const c of (window.__captured || [])) {
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    try {
      const px = gl.getTexImage(0, gl.RGBA, gl.UNSIGNED_BYTE);
      if (!px) { out.reads.push({ w: c.w, h: c.h, got: null }); continue; }
      let sum = 0, mx = 0, nz = 0;
      for (let i = 0; i < px.data.length; i += 4) {
        sum += px.data[i]; if (px.data[i] > mx) mx = px.data[i];
        if (px.data[i] > 8) nz++;
      }
      out.reads.push({ w: c.w, h: c.h, got: [px.width, px.height],
        mean: +(sum / (px.width * px.height)).toFixed(2), max: mx, nonzero: nz,
        minFilter: gl.getParameter(gl.TEXTURE_MIN_FILTER), magFilter: gl.getParameter(gl.TEXTURE_MAG_FILTER) });
    } catch (e) { out.reads.push({ w: c.w, h: c.h, err: String(e) }); }
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
