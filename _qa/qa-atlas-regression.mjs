// Old-vs-new atlas regression probe: run BOTH the old 512x512 4-tile atlas and the
// new 512x1024 8-tile atlas in the same headless env, upload each as a WebGL texture,
// and read back. If old fails too -> environment regression, not a code bug.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const result = await page.evaluate(() => {
  const TAU = Math.PI * 2;
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function makeAtlas(S, W, H, tiles) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const glow = (x, y, r, a) => {
      if (r <= 0 || a <= 0) return;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      gr.addColorStop(0.55, 'rgba(255,255,255,' + (a * 0.45) + ')');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (let t = 0; t < tiles; t++) {
      g.save();
      g.translate((t % 2) * S, Math.floor(t / 2) * S);
      const cx = S / 2, cy = S / 2;
      if (t === 0) {
        glow(cx, cy, S * 0.49, 0.28); glow(cx, cy, S * 0.20, 0.32);
        glow(cx, cy, 40, 0.95); glow(cx, cy, 16, 1.0);
      } else if (t === 1) {
        glow(cx, cy, S * 0.47, 0.30); glow(cx, cy, 88, 0.85); glow(cx, cy, 26, 1.0);
      } else if (t === 2) {
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.49);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
      } else {
        glow(cx, cy, S * 0.3, 0.5); glow(cx, cy, 34, 0.95);
      }
      g.restore();
    }
    return c;
  }

  const cOld = makeAtlas(256, 512, 512, 4);   /* old layout */
  const cNew = makeAtlas(256, 512, 1024, 8);  /* new layout */

  const out = {};
  const stats2d = (c, tag) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
    out[tag + '_2d'] = +(s / (c.width * c.height)).toFixed(2);
  };
  stats2d(cOld, 'old'); stats2d(cNew, 'new');

  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const gl = c.getContext('webgl');
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; varying vec2 vUv; void main(){ vUv=p*0.5+0.5; gl_Position=vec4(p,0.,1.); }');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, 'precision mediump float; uniform sampler2D uT; varying vec2 vUv; void main(){ gl_FragColor=vec4(texture2D(uT,vUv).rgb,1.0); }');
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const lp = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uT'), 0);
  gl.activeTexture(gl.TEXTURE0);

  const test = (tag, canvas) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    out[tag + '_uplErr'] = gl.getError();
    gl.viewport(0, 0, 128, 128);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const px = new Uint8Array(128 * 128 * 4);
    gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = 0, mx = 0;
    for (let i = 0; i < px.length; i += 4) { s += px[i]; if (px[i] > mx) mx = px[i]; }
    out[tag + '_gl'] = { mean: +(s / 16384).toFixed(2), max: mx };
  };
  test('old', cOld);
  test('new', cNew);
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
