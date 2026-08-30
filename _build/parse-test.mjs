import fs from 'node:fs';
const AU_KM = 1.495978707e8;
function parseSV(text) {
  const m = text.match(/X\s*=\s*([-+0-9.E]+)\s+Y\s*=\s*([-+0-9.E]+)\s+Z\s*=\s*([-+0-9.E]+)\s*\n\s*VX\s*=\s*([-+0-9.E]+)\s+VY\s*=\s*([-+0-9.E]+)\s+VZ\s*=\s*([-+0-9.E]+)/);
  if (m) return { x: +m[1] / AU_KM, y: +m[2] / AU_KM, z: +m[3] / AU_KM, vx: +m[4] / (AU_KM / 86400), vy: +m[5] / (AU_KM / 86400), vz: +m[6] / (AU_KM / 86400) };
  return null;
}
for (const f of ['debug-raw-Pallas.txt', 'debug-raw-Pluto.txt', 'debug-raw-Eris.txt']) {
  const t = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/' + f, 'utf8');
  console.log(f, '->', JSON.stringify(parseSV(t)));
}
