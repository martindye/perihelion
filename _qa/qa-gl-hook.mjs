// Hook the app's WebGL context and log texture operations around the atlas upload.
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
    if (gl && (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2')) {
      if (gl.__hooked) return gl;
      gl.__hooked = true;
      const L = window.__gllog;
      const origCreate = gl.createTexture.bind(gl);
      gl.createTexture = function () {
        const t = origCreate();
        L.push(['createTexture', L.length]);
        return t;
      };
      const origBind = gl.bindTexture.bind(gl);
      gl.bindTexture = function (target, tex) {
        L.push(['bindTexture', tex ? 'tex#' + (tex.__tag || '?') : 'null']);
        if (tex && tex.__tag === undefined) {
        }
        return origBind(target, tex);
      };
      // tag textures at creation
      const prevCreate = gl.createTexture;
      gl.createTexture = function () {
        const t = prevCreate();
        t.__tag = 'tex' + (prevCreate.__n = (prevCreate.__n || 0) + 1);
        L.push(['createTexture', t.__tag]);
        return t;
      };
      const origTexImage = gl.texImage2D.bind(gl);
      gl.texImage2D = function (target, level, internalFormat, w, h, f, fmt, type, src) {
        let info = 'texImage2D';
        if (arguments.length >= 9) {
          const s = src;
          if (s && s.tagName === 'CANVAS') info += ' canvas ' + s.width + 'x' + s.height;
          else if (s && s.byteLength !== undefined) info += ' array ' + s.byteLength;
          else if (s && s.tagName === 'IMG') info += ' img';
          else info += ' src=' + (s && s.constructor && s.constructor.name);
        }
        L.push([info]);
        return origTexImage(target, level, internalFormat, w, h, f, fmt, type, src);
      };
      const origTexParam = gl.texParameteri.bind(gl);
      gl.texParameteri = function (target, p, v) {
        const names = { 10241: 'MIN_FILTER', 10240: 'MAG_FILTER', 10242: 'WRAP_S', 10243: 'WRAP_T' };
        const vals = { 9728: 'NEAREST', 9729: 'LINEAR', 9984: 'NEAREST_MIPMAP_NEAREST', 9985: 'NEAREST_MIPMAP_LINEAR', 9986: 'LINEAR_MIPMAP_NEAREST', 9987: 'LINEAR_MIPMAP_LINEAR', 33071: 'CLAMP_TO_EDGE', 33072: 'MIRRORED', 10497: 'REPEAT', 33070: 'MIRRORED_CLAMP' };
        L.push(['texParami', names[p] || p, vals[v] || v]);
        return origTexParam(target, p, v);
      };
      const origGenMip = gl.generateMipmap.bind(gl);
      gl.generateMipmap = function (t) { L.push(['generateMipmap']); return origGenMip(t); };
    }
    return gl;
  };
});

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(5000);
const log = await page.evaluate(() => window.__gllog);
console.log('ERRORS', JSON.stringify(errors));
console.log('GLLOG entries:', log.length);
// print first 60 + any texImage2D lines
for (let i = 0; i < log.length; i++) {
  const e = log[i];
  if (e[0] === 'createTexture' || e[0] === 'texImage2D' || e[0].startsWith('canvas') || i < 8) {
    console.log(i, JSON.stringify(e));
  }
}
// filter: texParami MIN/MAG + texImage2D + generateMipmap
const rel = log.map((e, i) => [i, ...e]).filter(e =>
  e[1] === 'createTexture' || e[1] === 'texImage2D' || (e[1] === 'texParami' && (e[2] === 'MIN_FILTER' || e[2] === 'MAG_FILTER')) || e[1] === 'generateMipmap' || (e[1] === 'bindTexture'));
console.log('--- relevant sequence ---');
rel.slice(0, 80).forEach(e => console.log(e.join(' ')));
await browser.close();
