/* One-off: embed textures/saturn-rings.png into js/planets-textures.js
 * (surgical — does not re-encode the nine planet maps). Idempotent. */
import fs from 'node:fs';
const f = new URL('../js/planets-textures.js', import.meta.url);
let js = fs.readFileSync(f, 'utf8');
if (js.includes('saturnRings:')) { console.log('already embedded'); process.exit(0); }
const b64 = fs.readFileSync(new URL('../textures/saturn-rings.png', import.meta.url)).toString('base64');
const i = js.lastIndexOf('};');
if (i < 0) throw new Error('no closing brace');
js = js.slice(0, i) + '  saturnRings: "data:image/png;base64,' + b64 + '",\n' + js.slice(i);
js = js.replace(
  ' * Equirectangular 2048x1024 JPEG data-URLs (q0.72). Imagery: Solar System\n' +
  ' * Scope texture set (mosaics of NASA/JPL/USGS public-domain data), fetched\n' +
  ' * via _build/fetch-textures.mjs, re-encoded + embedded by _qa/embed-textures.mjs.\n',
  ' * Equirectangular 2048x1024 JPEG data-URLs (q0.72). Imagery: Solar System\n' +
  ' * Scope texture set (mosaics of NASA/JPL/USGS public-domain data), fetched\n' +
  ' * via _build/fetch-textures.mjs, re-encoded + embedded by _qa/embed-textures.mjs.\n' +
  ' * saturnRings: the SST 2k_saturn_ring_alpha strip (2048x125, CC-BY-4.0 SST,\n' +
  ' * NASA/JPL-derived) embedded VERBATIM as PNG — its alpha carries the ring\n' +
  ' * structure (Cassini division etc), so it must not be re-encoded to JPEG.\n'
);
fs.writeFileSync(f, js);
console.log('embedded saturnRings; file now', (fs.statSync(f).size / 1024).toFixed(0), 'KB');
