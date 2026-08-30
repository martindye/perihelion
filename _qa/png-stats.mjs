// Decode a PNG (RGB/RGBA, 8-bit) and report brightness statistics.
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const buf = fs.readFileSync(file);
let p = 8; // skip signature
let width = 0, height = 0, bitDepth = 0, colorType = 0;
const idat = [];
while (p < buf.length) {
  const len = buf.readUInt32BE(p);
  const type = buf.toString('ascii', p + 4, p + 8);
  const data = buf.subarray(p + 8, p + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0); height = data.readUInt32BE(4);
    bitDepth = data[8]; colorType = data[9];
  } else if (type === 'IDAT') idat.push(data);
  p += 12 + len;
  if (type === 'IEND') break;
}
const raw = zlib.inflateSync(Buffer.concat(idat));
const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
const stride = width * ch;
const px = Buffer.alloc(width * height * ch);
let prev = Buffer.alloc(stride);
let o = 0;
for (let y = 0; y < height; y++) {
  const f = raw[o++];
  const line = Buffer.from(raw.subarray(o, o + stride)); o += stride;
  if (f === 1) for (let x = ch; x < stride; x++) line[x] = (line[x] + line[x - ch]) & 255;
  else if (f === 2) for (let x = 0; x < stride; x++) line[x] = (line[x] + prev[x]) & 255;
  else if (f === 3) for (let x = 0; x < stride; x++) line[x] = (line[x] + ((x >= ch ? line[x - ch] : 0) + prev[x]) >> 1) & 255;
  else if (f === 4) { const a = x => (x >= ch ? line[x - ch] : 0); for (let x = 0; x < stride; x++) { const pp = (x >= ch ? line[x - ch] : 0) + prev[x] - (x >= ch ? prev[x - ch] : 0); line[x] = (line[x] + (a(x) + prev[x] - pp) / 2 + 0.5 | 0) & 255; } }
  line.copy(px, y * stride);
  prev = line;
}
let lit = 0, sum = 0, max = 0;
const bright = [];
for (let i = 0; i < width * height; i++) {
  const l = px[i * ch] + px[i * ch + 1] + px[i * ch + 2];
  if (l > 30) lit++;
  sum += l;
  if (l > max) { max = l; if (bright.length < 12 || l > bright[bright.length - 1][2]) { bright.push([i % width, (i / width) | 0, l]); bright.sort((a, b) => b[2] - a[2]); bright.length = Math.min(bright.length, 12); } }
}
console.log(JSON.stringify({ file: file.split(/[\\/]/).pop(), width, height, colorType,
  litPct: (lit / (width * height) * 100).toFixed(3) + '%', litCount: lit,
  avgLum: (sum / (width * height)).toFixed(2), maxLum: max,
  brightest: bright.slice(0, 8) }, null, 1));
