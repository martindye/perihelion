/* Fetch equirectangular 2K planet textures (Solar System Scope set — derived
 * from NASA/JPL/USGS public-domain imagery) into textures/. Validates JPEG
 * magic + minimum size. Run: node _build/fetch-textures.mjs */
import fs from 'node:fs';
const DIR = new URL('../textures/', import.meta.url);
fs.mkdirSync(DIR, { recursive: true });
const FILES = [
  ['sun',     'https://www.solarsystemscope.com/textures/download/2k_sun.jpg'],
  ['earth',   'https://www.solarsystemscope.com/textures/download/2k_earth.jpg'],
  ['moon',    'https://www.solarsystemscope.com/textures/download/2k_moon.jpg'],
  ['mercury', 'https://www.solarsystemscope.com/textures/download/2k_mercury.jpg'],
  ['venus',   'https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg'],
  ['mars',    'https://www.solarsystemscope.com/textures/download/2k_mars.jpg'],
  ['jupiter', 'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg'],
  ['saturn',  'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg'],
  ['uranus',  'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg'],
  ['neptune', 'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg']
];
let fails = 0;
for (const [name, url] of FILES) {
  const f = new URL(name + '.jpg', DIR);
  if (fs.existsSync(f) && fs.statSync(f).size > 100000) { console.log('cache  ', name); continue; }
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'perihelion-planetarium/1.0 (educational use)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
      // JPEG dimensions: scan for SOF0/SOF2
      let w = 0, h = 0;
      for (let i = 2; i < buf.length - 9; i++) {
        if (buf[i] !== 0xff) continue;
        const m = buf[i + 1];
        if (m === 0xc0 || m === 0xc2) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
        if (m >= 0xd0 && m <= 0xd9) continue;
        i += buf.readUInt16BE(i + 2);
      }
      if (!isJpeg || buf.length < 100000 || !w || !h) throw new Error('bad jpeg (' + buf.length + ' bytes, ' + w + 'x' + h + ')');
      fs.writeFileSync(f, buf);
      console.log('fetched', name, w + 'x' + h, (buf.length / 1048576).toFixed(2) + ' MB');
      break;
    } catch (e) {
      console.log('retry', name, t, e.message);
      if (t === 2) { fails++; console.log('FAILED', name); }
      await new Promise(s => setTimeout(s, 1500));
    }
  }
}
process.exit(fails ? 1 : 0);
