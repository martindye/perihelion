import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__gllog = [];
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const gl = origGet.call(this, type, ...a);
    if (gl && (type === 'webgl' || type === 'webgl2')) {
      if (gl.__hooked) return gl;
      gl.__hooked = true;
      const L = window.__gllog;
      const P = { 10241: 'MIN_FILTER', 10240: 'MAG_FILTER', 10242: 'WRAP_S', 10243: 'WRAP_T' };
      const V = { 9728: 'NEAREST', 9729: 'LINEAR', 9987: 'LINEAR_MIPMAP_LINEAR', 33071: 'CLAMP_TO_EDGE', 10497: 'REPEAT' };
      let boundTag = 'none';
      const origBind = gl.bindTexture.bind(gl);
      gl.bindTexture = function (target, tex) { boundTag = tex ? 'tex' + tex.__n : 'null'; return origBind(target, tex); };
      const origCreate = gl.createTexture.bind(gl);
      gl.createTexture = function () { const t = origCreate(); t.__n = ++gl.__cnt; boundTag = 'tex' + t.__n; L.push([L.length, 'createTexture', 'tex' + t.__n]); return t; };
      const origParam = gl.texParameteri.bind(gl);
      gl.texParameteri = function (target, p, v) { L.push([L.length, 'param', boundTag, P[p] || p, V[v] || v]); return origParam(target, p, v); };
      const origTex = gl.texImage2D.bind(gl);
      gl.texImage2D = function (target, level, ifmt, fmt, type, src) {
        let s = 'src?';
        if (src && src.tagName === 'CANVAS') s = 'canvas ' + src.width + 'x' + src.height;
        else if (src && src.byteLength !== undefined) s = 'array ' + src.byteLength;
        L.push([L.length, 'texImage2D', boundTag, '6arg=' + (arguments.length <= 6), s]);
        return origTex(target, level, ifmt, fmt, type, src);
      };
      const origGen = gl.generateMipmap.bind(gl);
      gl.generateMipmap = function (t) { L.push([L.length, 'generateMipmap', boundTag]); return origGen(t); };
    }
    return gl;
  };
});
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(5000);
const log = await page.evaluate(() => window.__gllog);
console.log('total:', log.length);
log.slice(0, 120).forEach(e => console.log(e.join(' ')));
await browser.close();
