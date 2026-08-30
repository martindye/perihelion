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
  out.ver = gl.getParameter(gl.VERSION);
  out.renderer = gl.getParameter(gl.RENDERER);

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; varying vec2 vP; void main(){ vP=p; gl_Position=vec4(p,0.,1.); }');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, 'precision mediump float; uniform sampler2D uT; varying vec2 vP; void main(){ gl_FragColor=vec4(texture2D(uT, vP*0.5+0.5).rgb, 1.0); }');
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const locP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(locP);
  gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);
  const locT = gl.getUniformLocation(prog, 'uT');
  gl.uniform1i(locT, 0);
  gl.activeTexture(gl.TEXTURE0);

  const readback = (tag) => {
    gl.viewport(0, 0, 64, 64);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const px = new Uint8Array(64 * 64 * 4);
    gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, max = 0;
    for (let i = 0; i < px.length; i += 4) { sum += px[i]; if (px[i] > max) max = px[i]; }
    out[tag] = { mean: +(sum / 4096).toFixed(2), max, glErr: gl.getError() };
  };

  /* A: control — no texture bound at all (undefined sampler) */
  gl.bindTexture(gl.TEXTURE_2D, null);
  readback('noTexture');

  /* B: texture from raw RGBA array */
  const td = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < td.length; i += 4) { td[i] = td[i + 1] = td[i + 2] = 255; td[i + 3] = 255; }
  const texB = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, td);
  out.rawTexErr = gl.getError();
  readback('rawArray');

  /* C: texture from a 2D canvas, flipY true (three.js style) */
  const src = document.createElement('canvas');
  src.width = 64; src.height = 64;
  const g2 = src.getContext('2d');
  g2.fillStyle = '#000'; g2.fillRect(0, 0, 64, 64);
  g2.fillStyle = '#fff'; g2.fillRect(0, 0, 32, 64);
  const texC = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texC);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  out.canvasTexErr = gl.getError();
  readback('canvasFlipY');

  /* D: canvas again without flip */
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  out.canvasTexErr2 = gl.getError();
  readback('canvasNoFlip');

  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
