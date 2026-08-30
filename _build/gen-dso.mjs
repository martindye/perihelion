// Generate the app data file js/dso.js from the merged catalog build:
//   P.dso      = 624 bright galaxies (pickable/labelable), 12-field rows
//   P.dsoFaint = base64 Float32Array of ~18.3k background galaxies
//                (ra, dec, v, size, bv, tile) — render-only, no picking
import fs from 'node:fs';
const D = new URL('./', import.meta.url);
const read = f => fs.readFileSync(new URL(f, D), 'utf8');

const bright = JSON.parse(read('galaxies-bright.json'));
const faint = JSON.parse(read('galaxies-faint.json'));

/* faint: pack [ra, dec, v, size, bv, tile] x n as base64 */
const n = faint.data.length;
const f32 = new Float32Array(n * 6);
for (let i = 0; i < n; i++) {
  const [id, ra, dec, v, size, bv, tile] = faint.data[i];
  f32[i * 6 + 0] = ra;
  f32[i * 6 + 1] = dec;
  f32[i * 6 + 2] = v == null ? -1 : v;
  f32[i * 6 + 3] = size;
  f32[i * 6 + 4] = bv;
  f32[i * 6 + 5] = tile;
}
const bin = Buffer.from(f32.buffer);
const b64 = bin.toString('base64');

/* bright: one row per line, kept as valid JS (nulls, strings, numbers) */
const brightLines = bright.map(r => '  [' + r.map(x => {
  if (x === null) return 'null';
  if (typeof x === 'string') return JSON.stringify(x);
  return String(x);
}).join(',') + ']').join(',\n');

const header = `/* ============================================================================
 * dso.js — deep-sky objects for PERIHELION (auto-generated — do not hand-edit;
 * regenerate with _build/gen-dso.mjs after _build/build-galaxies.mjs)
 * ----------------------------------------------------------------------------
 * P.dso — ${bright.length} bright galaxies (V < 11.5), pickable + labelable.
 *   row: [id, raDeg, decDeg, vMag, type, majorArcmin, minorArcmin|null,
 *         distMly|null, posAngleDeg, bV, funFact|null, xrefId|null]
 *
 * P.dsoFaint — ${n} background galaxies, render-only (no picking/labels).
 *   base64 Float32Array of [raDeg, decDeg, vMag, sizeArcmin, bV, tile] per row
 *   (tile: 0 spiral, 1 barred, 2 elliptical, 3 irregular; vMag -1 = unknown)
 *
 * Provenance (all real data, offline):
 *   - 58 curated bright galaxies (Messier + famous NGC), hand-audited J2000.
 *   - NGC 2000.0 (R. G. A. Sinnott, Sky Publishing 1988), VizieR VII/118:
 *     J2000 positions, V magnitudes, angular sizes.
 *   - Uppsala General Catalogue of Galaxies (P. Nilson 1973), VizieR VII/26D:
 *     B1950 positions precessed to J2000 (matrix fitted to 11,879 B1950->J2000
 *     pairs from Corwin 2004, VII/239A; mean residual 3.6"), Hubble types,
 *     sizes, photographic magnitudes.
 *   Hubble types enrich NGC/IC rows cross-matched to UGC within 1.2'.
 * ========================================================================== */
`;

const out = header
  + "'use strict';\n"
  + 'P.dso = [\n' + brightLines + '\n];\n'
  + 'P.dsoFaint = {\n  b64: "' + b64 + '",\n  n: ' + n + ',\n};\n';

fs.writeFileSync(new URL('../js/dso.js', D), out);
console.log('wrote js/dso.js:', (out.length / 1024).toFixed(0) + ' KB',
  '(' + bright.length + ' bright, ' + n + ' faint, b64 ' + (b64.length / 1024).toFixed(0) + ' KB)');
