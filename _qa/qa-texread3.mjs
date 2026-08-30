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
        if (src && src.tagName === 'CANVAS') {
          const tex = gl.getParameter(gl.TEXTURE_BINDING_2D);
          window.__captured.push({ tex, w: src.width, h: src.height });
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
  const out = { captured: (window.__captured || []).map(c => ({ w: c.w, h: c.h })), reads: [] };
  const canvas = document.querySelector('canvas');
  if (!canvas) return { ...out, error: 'no canvas' };
  const gl = canvas.getContext('webgl');
  if (!gl) return { ...out, error: 'no gl' };
  /* one-shot sampler program (fresh program, doesn't disturb the app's) */
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; varying vec2 vUv; void main(){ vUv=p*0.5+0.5; gl_Position=vec4(p,0.,1.); }');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, 'precision mediump float; uniform sampler2D uT; varying vec2 vUv; void main(){ gl_FragColor=vec4(texture2D(uT,vUv).rgb,1.0); }');
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return { ...out, error: 'link fail' };
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const lp = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  const locT = gl.getUniformLocation(prog, 'uT');
  gl.uniform1i(locT, 0);
  gl.activeTexture(gl.TEXTURE0);

  for (const c of (window.__captured || [])) {
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    /* sample 4 corners + center of the texture into a 4x4 target */
    const rc = document.createElement('canvas'); rc.width = 64; rc.height = 64;
    const gl2 = rc.getContext('webgl');
    /* draw in the APP's context (share nothing; just render here) — use a separate 64x64 FBO-less pass:
       we render on the app canvas's GL into a small FBO */
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const rt = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rt);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, 64, 64);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rt);
    gl.viewport(0, 0, 64, 64);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const px = new Uint8Array(64 * 64 * 4);
    gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, mx = 0, nz = 0;
    for (let i = 0; i < px.length; i += 4) { sum += px[i]; if (px[i] > mx) mx = px[i]; if (px[i] > 8) nz++; }
    out.reads.push({ w: c.w, h: c.h, mean: +(sum / 4096).toFixed(2), max: mx, nonzero: nz,
      minFilter: gl.getParameter(gl.TEXTURE_MIN_FILTER), magFilter: gl.getParameter(gl.TEXTURE_MAG_FILTER) });
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
