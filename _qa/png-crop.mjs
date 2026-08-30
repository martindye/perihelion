// Density stats for a sub-rectangle of a PNG (sky area only, no HUD).
import fs from 'node:fs';
import zlib from 'node:zlib';

const [file, x0, y0, x1, y1] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6]];
const buf = fs.readFileSync(file);
let p = 8;
let width = 0, height = 0, colorType = 0;
const idat = [];
while (p < buf.length) {
  const len = buf.readUInt32BE(p);
  const type = buf.toString('ascii', p + 4, p + 8);
  const data = buf.subarray(p + 8, p + 8 + len);
  if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
  else if (type === 'IDAT') idat.push(data);
  p += 12 + len;
  if (type === 'IEND') break;
}
const raw = zlib.inflateSync(Buffer.concat(idat));
const ch = colorType === 6 ? 4 : 3;
const stride = width * ch;
const px = Buffer.alloc(width * height * ch);
let prev = Buffer.alloc(stride), o = 0;
for (let y = 0; y < height; y++) {
  const f = raw[o++];
  const line = Buffer.from(raw.subarray(o, o + stride)); o += stride;
  if (f === 1) for (let x = ch; x < stride; x++) line[x] = (line[x] + line[x - ch]) & 255;
  else if (f === 2) for (let x = 0; x < stride; x++) line[x] = (line[x] + prev[x]) & 255;
  else if (f === 3) for (let x = 0; x < stride; x++) line[x] = (line[x] + ((x >= ch ? line[x - ch] : 0) + prev[x]) >> 1) & 255;
  else if (f === 4) for (let x = 0; x < stride; x++) { const a = x >= ch ? line[x - ch] : 0; line[x] = (line[x] + (a + prev[x] - (x >= ch ? prev[x - ch] : 0) + 1) >> 1) & 255; }
  line.copy(px, y * stride);
  prev = line;
}
let lit = 0, sum = 0, max = 0, mx = -1, my = -1;
const top = [];
for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
  for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
    const i = (y * width + x) * ch;
    const l = px[i] + px[i + 1] + px[i + 2];
    if (l > 30) lit++;
    sum += l;
    if (l > max) { max = l; mx = x; my = y; }
    if (l > 200) top.push([x, y, l]);
  }
}
const W = Math.min(width, x1) - Math.max(0, x0), H = Math.min(height, y1) - Math.max(0, y0);
top.sort((a, b) => b[2] - a[2]);
console.log(JSON.stringify({ file, region: [x0, y0, x1, y1], size: W + 'x' + H,
  litPct: (lit / (W * H) * 100).toFixed(3) + '%', lit, avgLum: (sum / (W * H)).toFixed(2),
  maxLum: max, at: [mx, my], bright200plus: top.length, top10: top.slice(0, 10) }, null, 1));
