/* One-shot: embed the 20 minor-body maps into js/planets-textures.js as
 * data-URLs (surgical — everything else byte-identical). Idempotent: a
 * second run detects the keys and exits.
 *
 *   node _qa/embed-minor-textures.mjs
 */
import fs from 'node:fs';

const ROOT = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';
const BODIES = ['pluto', 'ceres', 'vesta', 'pallas', 'hygiea', 'ixion', 'eris', 'haumea', 'makemake',
  'io', 'europa', 'ganymede', 'callisto', 'titan', 'triton', 'iapetus', 'rhea',
  'phobos', 'deimos', 'charon'];

const file = ROOT + 'js/planets-textures.js';
let js = fs.readFileSync(file, 'utf8');
if (js.includes('\n  pluto: ')) { console.log('already embedded — nothing to do'); process.exit(0); }

let block = '';
for (const b of BODIES) {
  const img = fs.readFileSync(ROOT + '_qa/_minor_' + b + '_final.jpg');
  block += '  ' + b + ': "data:image/jpeg;base64,' + img.toString('base64') + '",\n';
}
const anchor = '  saturnRings: ';
const i = js.indexOf(anchor);
if (i < 0) throw new Error('anchor not found');
js = js.slice(0, i) + block + js.slice(i);
fs.writeFileSync(file, js);
console.log('embedded', BODIES.length, 'keys;', (fs.statSync(file).size / 1048576).toFixed(2), 'MB total');
