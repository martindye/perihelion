import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const result = await page.evaluate(() => {
  const out = { errors: [] };
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const gl = c.getContext('webgl');
  out.ver = gl.getParameter(gl.VERSION);
  const err = () => { const e = gl.getError(); if (e !== gl.NO_ERROR) out.errors.push([e, 'after ' + out.last]); };
  out.last = 'start';
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; varying vec2 vP; void main(){ vP=p; gl_Position=vec4(p,0.,1.); }');
  gl.compileShader(vs); out.last = 'compile vs';
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const locP = gl.getAttribLocation(vs, 'p');
  const runTest = (name, fsSrc, setup) => {
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { out[name] = 'FRAG FAIL: ' + gl.getShaderInfoLog(fs); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { out[name] = 'LINK FAIL'; return; }
    gl.useProgram(prog);
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);
    setup();
    gl.viewport(0, 0, 64, 64);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    out.last = name + ' draw';
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const px = new Uint8Array(64 * 64 * 4);
    gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, max = 0;
    for (let i = 0; i < px.length; i += 4) { sum += px[i]; if (px[i] > max) max = px[i]; }
    out[name] = { mean: +(sum / 4096).toFixed(2), max, errAfter: gl.getError() };
  };
  /* A: solid color, no texture */
  runTest('solid', 'precision mediump float; void main(){ gl_FragColor=vec4(1.,0.5,0.,1.); }', () => {});
  /* B: texture from raw pixel array (RGBA 64x64, left half white) */
  {
    const td = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (x < 32) { const o = (y * 64 + x) * 4; td[o] = 255; td[o + 1] = 255; td[o + 2] = 255; td[o + 3] = 255; }
    const tex = gl.createTexture();
    out.last = 'bind+texImage2D raw';
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, td);
    const locT = gl.getUniformLocation(null, 'uT');
    runTest('texRaw', 'precision mediump float; uniform sampler2D uT; varying vec2 vP; void main(){ vec4 t=texture2D(uT, vP*0.5+0.5); gl_FragColor=vec4(t.rgb,1.); }', () => {
      /* need uT location for this program */
    });
  }
  /* C: texture from a 2D canvas (white square on black) */
  {
    const src = document.createElement('canvas');
    src.width = 64; src.height = 64;
    const g2 = src.getContext('2d');
    g2.fillStyle = '#000'; g2.fillRect(0, 0, 64, 64);
    g2.fillStyle = '#fff'; g2.fillRect(0, 0, 32, 64);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    out.last = 'texImage2D canvas';
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const e1 = gl.getError();
    out.canvasTexErr = e1 === gl.NO_ERROR ? 'none' : 'GL ERROR ' + e1;
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
