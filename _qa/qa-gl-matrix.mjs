import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const result = await page.evaluate(() => {
  const out = {};
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
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
  gl.enableVertexAttribArray(gl.getAttribLocation(prog, 'p'));
  gl.vertexAttribPointer(gl.getAttribLocation(prog, 'p'), 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uT'), 0);
  gl.activeTexture(gl.TEXTURE0);

  const mk = (w, h, kind) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w / 2, h);
    if (kind === 'grad') {
      const gr = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    return cv;
  };

  const upload = (tag, canvas, { minFilter, flip } = {}) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (minFilter) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    const e = gl.getError();
    gl.viewport(0, 0, 64, 64);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const px = new Uint8Array(64 * 64 * 4);
    gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = 0, mx = 0;
    for (let i = 0; i < px.length; i += 4) { s += px[i]; if (px[i] > mx) mx = px[i]; }
    out[tag] = { mean: +(s / 4096).toFixed(2), max: mx, uplErr: e };
  };

  /* plain 64x64 solid, default filters */
  upload('a_64_default', mk(64, 64, 'solid'));
  /* 64x64 solid, LINEAR min filter */
  upload('b_64_linear', mk(64, 64, 'solid'), { minFilter: true });
  /* 512x512 gradient, default filters */
  upload('c_512_default', mk(512, 512, 'grad'));
  /* 512x512 gradient, LINEAR */
  upload('d_512_linear', mk(512, 512, 'grad'), { minFilter: true });
  /* 64x64 grad default */
  upload('e_64grad_default', mk(64, 64, 'grad'));
  /* 64x64 grad LINEAR */
  upload('f_64grad_linear', mk(64, 64, 'grad'), { minFilter: true });
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
