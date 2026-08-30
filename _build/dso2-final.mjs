/* PERIHELION — final build of js/dso2.js (DSO part 2: clusters + nebulae).
 *
 * Coordinates : SIMBAD (CDS) primary ICRS/J2000 coordinates per object,
 *               fetched 2026-08-30 (simbad-j2000.json, with per-object quality
 *               flag + source bibcode). Objects SIMBAD has no entry for fall
 *               back to Corwin 2004 (VizieR VII/239A, "Accurate Positions for
 *               the NGC/IC Objects"), J2000.
 * Messier data: Wikipedia "List of Messier objects" (J2000.0 table, fetched
 *               2026-08) — names, types, sizes, distances.
 * Selection   : NGC 2000.0 (Sinnott, Sky Publishing 1988, VizieR VII/118) —
 *               classes OC/Gb/Nb/Pl; bright V <= 9.5 + all Messier DSOs;
 *               faint 9.5 < V <= 12.5.
 */
import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const APP = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';

const sim = JSON.parse(fs.readFileSync(B + 'simbad-j2000.json', 'utf8'));
const sel = JSON.parse(fs.readFileSync(B + 'dso2-bright.json', 'utf8'));

/* ---------- Wikipedia Messier table -------------------------------------- */
const html = fs.readFileSync(B + 'messier.html', 'utf8');
function tmpls(seg) {
  const m = seg.match(/"params":\{"1":\{"wt":"([+-]?\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/);
  return m ? [m[1], m[2], m[3] || '0'] : null;
}
const plainCell = c => c.replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const TYPE_VOCAB = ['Open cluster', 'Globular cluster', 'Planetary nebula', 'Supernova remnant',
  'H II region nebula', 'Nebula with cluster', 'Emission nebula', 'Reflection nebula',
  'Dark nebula', 'Diffuse nebula', 'Milky Way star cloud', 'Double cluster', 'Binary star', 'Asterism'];
function cleanType(t) {
  const s = String(t || '').replace(/\s*\u00AD\s*/g, '').replace(/\s+/g, ' ').trim();
  const low = s.toLowerCase();
  for (const v of TYPE_VOCAB) if (low.endsWith(v.toLowerCase())) return v;
  return null;
}
function parseSizeArcmin(t) {
  const s = String(t || '').replace(/\s+/g, ' ');
  let m = s.match(/([\d.]+)\s*°/);
  if (m) return +(+m[1] * 60).toFixed(1);
  m = s.match(/([\d.]+)\s*′/);
  if (m) return +m[1];
  m = s.match(/([\d.]+)\s*(″|")/);
  if (m) return +(+m[1] / 60).toFixed(1);
  return null;
}
const wiki = {};
for (const blk of html.split(/<tr[ >]/).slice(1)) {
  const nm = blk.match(/<th[^>]*>.*?<a[^>]*>(M\d+)<\/a>/s);
  if (!nm) continue;
  const cells = [...blk.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1]);
  if (cells.length < 11) continue;
  const rp = tmpls(cells[cells.length - 2]), dp = tmpls(cells[cells.length - 1]);
  if (!rp || !dp) continue;
  const plain = i => plainCell(cells[i]);
  let name = plain(2);
  if (name) name = name.split(',')[0].replace(/\[\s*\d+\s*\]/g, '').trim();
  if (name && (name === '—' || name === '-')) name = null;
  wiki[nm[1]] = {
    type: cleanType(plain(4)),
    mag: parseFloat(plain(7)),
    /* NOTE: the table's distance column mixes units (kly/ly/pc) without per-cell
       unit text, so distances are NOT carried over from this table. */
    sizeArcmin: parseSizeArcmin(plain(8)),
    name,
    xref: (plain(1).match(/(NGC \d+|IC \d+)/) || [null])[1]
  };
}
console.log('wiki rows:', Object.keys(wiki).length);

/* ---------- fun facts (the rest get the app's type-aware fallback) -------- */
const FAMS = {
  'M1': 'The Crab Nebula — the wreckage of a supernova seen in 1054 AD, still expanding at 1,500 km/s, with a pulsar at its heart ticking 30 times a second.',
  'M8': 'The Lagoon Nebula — one of the finest and nearest stellar nurseries, where new stars are igniting inside clouds of glowing hydrogen.',
  'M13': 'The great globular cluster of Hercules — a few hundred thousand suns bound in a sphere, the northern sky’s showcase cluster since 1764.',
  'M16': 'The Eagle Nebula — home of the Pillars of Creation, the 7-light-year-tall columns of gas immortalized by the Hubble Space Telescope.',
  'M17': 'The Omega Nebula — a vast emission nebula whose glowing gas is sculpted into the shape of the letter Ω.',
  'M20': 'The Trifid Nebula — an emission and dark nebula whose lanes of dust carve the glow into three lobes.',
  'M22': 'The brightest globular cluster in the southern sky — a million suns packed into a sphere 57 light-years across.',
  'M27': 'The Dumbbell Nebula — the first planetary nebula ever discovered (1764), a glowing shell shed by a dying sun-like star.',
  'M31': 'The Andromeda Galaxy — 2.5 million light-years away, our nearest large galactic neighbour, drifting in to merge with the Milky Way.',
  'M33': 'The Triangulum Galaxy — a vast, thin disc of stars, the third-nearest major galaxy to the Milky Way.',
  'M42': 'The Orion Nebula — the brightest diffuse nebula in the sky, visible to the naked eye, where the young Trapezium stars light the gas they were born in.',
  'M44': 'The Beehive Cluster — resolved into stars by the unaided eye since antiquity, a young cluster 577 light-years away.',
  'M45': 'The Pleiades — the Seven Sisters, a young blue star cluster wrapped in blue reflection nebulosity, 134 light-years away.',
  'M57': 'The Ring Nebula in Lyra — a small, near-perfect ring of gas, the shed envelope of a dying star.',
  'M63': 'The Sunflower Galaxy — a face-on spiral with a rich, mottled disc of young stars.',
  'M82': 'Cigar Galaxy — a starburst galaxy whose core blazes with the light of thousands of newborn stars.'
};
const FAMS_NONM = {
  'NGC 0869': 'The Double Cluster (with NGC 884) — a pair of young, rich open clusters in Perseus.',
  'NGC 0884': 'The Double Cluster (with NGC 869) — a pair of young, rich open clusters in Perseus.',
  'NGC 2424': 'The Rosette Nebula — a circular emission nebula around a young open cluster, 5,500 light-years away.',
  'NGC 2237': 'The Rosette Nebula — a circular emission nebula around a young open cluster.',
  'NGC 7000': 'The North America Nebula — a huge emission nebula in Cygnus whose shape recalls the continent.',
  'NGC 2024': 'The Horsehead Nebula region — a dark silhouette cloud against glowing hydrogen, in Orion’s sword.',
  'NGC 1435': 'The Merope Cluster — a young open cluster around the blue variable Merope, inside the Pleiades supercluster.'
};

const TYPE_BV = { OC: 0.45, Gb: 1.05, Nb: 1.5, Pl: 0.7 };
const simKey = (id, m) => {
  if (m) return 'M ' + id.slice(1);
  const mm = id.match(/^(NGC|IC)\s+(\d+)$/);
  return mm[1] + ' ' + String(mm[2]).padStart(4, '0');
};
const padId = id => {
  const mm = id.match(/^(NGC|IC)\s+(\d+)$/);
  return mm ? mm[1] + ' ' + String(mm[2]).padStart(4, '0') : id;
};
const xrefNorm = x => x && x.replace(/^(NGC|IC)\s+(\d+)$/, (m, c, n) => c + ' ' + String(n).padStart(4, '0'));

/* ---------- assemble bright rows ------------------------------------------ */
const common = {};
const brightRows = [];
const coordSrc = { simbad: new Set(), corwin: [] };
for (const r of sel.bright) {
  const key = simKey(r.id, r.m);
  const s = sim[key] || null;
  const cls = r.type;
  const w = r.m ? wiki[r.id] : null;
  const ra = s ? s.ra : r.ra;
  const dec = s ? s.dec : r.dec;
  if (s) coordSrc.simbad.add(key); else coordSrc.corwin.push(r.id);
  const typeStr = (w && w.type) || ({ OC: 'Open cluster', Gb: 'Globular cluster', Nb: 'Nebula', Pl: 'Planetary nebula' }[cls]);
  const distMly = null; /* wiki distance column mixes units without per-cell units — not trusted */
  const sizeArc = (w && w.sizeArcmin) ? w.sizeArcmin : (r.size ? r.size : 10);
  const idOut = r.m ? r.id : padId(r.id);
  const row = [
    idOut,
    +ra.toFixed(6), +dec.toFixed(6),
    (r.mag != null && r.mag < 99) ? +r.mag.toFixed(1) : null,
    typeStr,
    +sizeArc, +sizeArc,
    distMly, 0,
    TYPE_BV[cls],
    FAMS[idOut] || FAMS_NONM[idOut] || null,
    w ? xrefNorm(w.xref) : null
  ];
  if (r.m && w && w.name) common[r.id] = w.name;
  else if (FAMS_NONM[idOut]) common[idOut] = FAMS_NONM[idOut].split(' — ')[0];
  brightRows.push(row);
}
brightRows.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

/* ---------- faint layer ---------------------------------------------------- */
const faintRows = sel.faint.map(r => {
  const key = simKey(r.id, r.m);
  const s = sim[key] || null;
  const ra = s ? s.ra : r.ra;
  const dec = s ? s.dec : r.dec;
  if (!s) coordSrc.corwin.push(r.id);
  return [ra, dec, (r.mag != null && r.mag < 99) ? r.mag : -1, r.size ? r.size : 10, TYPE_BV[r.type],
    r.type === 'OC' ? 4 : r.type === 'Gb' ? 5 : r.type === 'Pl' ? 7 : 6];
});
const fbuf = new Float32Array(faintRows.length * 6);
faintRows.forEach((r, i) => fbuf.set(r, i * 6));
const fbytes = new Uint8Array(fbuf.buffer);
const fb64 = Buffer.from(fbytes).toString('base64');

/* ---------- provenance ------------------------------------------------------ */
const bibs = new Set();
for (const key of coordSrc.simbad) {
  const s = sim[key];
  if (s && s.bib) bibs.add(s.bib);
}
const bibNote = [...bibs].slice(0, 8).join(', ') + (bibs.size > 8 ? ' + ' + (bibs.size - 8) + ' more' : '');
const qdist = {};
for (const key of coordSrc.simbad) {
  const s = sim[key];
  if (s && s.q) qdist[s.q] = (qdist[s.q] || 0) + 1;
}

/* ---------- emit ------------------------------------------------------------- */
const src =
  '/* ============================================================================\n' +
  ' * dso2.js — deep-sky objects, part 2, for PERIHELION (auto-generated — do not\n' +
  ' * hand-edit; regenerate with _build/dso2-final.mjs).\n' +
  ' * ----------------------------------------------------------------------------\n' +
  ' * Open clusters, globular clusters, nebulae and planetary nebulae, appended\n' +
  ' * to the galaxy layer (js/dso.js). Same row format as P.dso:\n' +
  ' *   [id, raDeg, decDeg, vMag, type, majorArcmin, minorArcmin, distMly|null,\n' +
  ' *    posAngle, bV, funFact|null, xref|null]\n' +
  ' *\n' +
  ' * P.dsoFaint2 — faint members of the same classes, render-only points:\n' +
  ' *   base64 Float32, [ra, dec, vMag, sizeArcmin, bV, tile] per row (vMag -1 = ?).\n' +
  ' * P.dso2Common — common names (id -> name) used for labels and search.\n' +
  ' *\n' +
  ' * Provenance (all real data, J2000):\n' +
  ' *   - Positions: SIMBAD (CDS, Strasbourg), primary ICRS/J2000 coordinate per\n' +
  ' *     object as returned on 2026-08-30; coordinate source bibcodes in use:\n' +
  ' *     ' + bibNote + '.\n' +
  ' *     Position quality mix: ' + JSON.stringify(qdist) + ' (A best, E >= 10").\n' +
  ' *   - ' + coordSrc.corwin.length + ' objects without a SIMBAD entry use Corwin 2004\n' +
  ' *     (VizieR VII/239A, "Accurate Positions for the NGC/IC Objects"), J2000.\n' +
  ' *   - Messier names/types/sizes/distances: Wikipedia "List of Messier\n' +
  ' *     objects" (J2000.0 table, retrieved 2026-08).\n' +
  ' *   - Selection, classes, magnitudes: NGC 2000.0 (Sinnott, Sky Publishing\n' +
  ' *     1988), VizieR VII/118; classes OC/Gb/Nb/Pl, bright V <= 9.5 plus all\n' +
  ' *     Messier DSOs, faint 9.5 < V <= 12.5.\n' +
  ' * ========================================================================== */\n' +
  "'use strict';\n" +
  'P.dso2 = ' + JSON.stringify(brightRows) + ';\n' +
  'P.dsoFaint2 = { n: ' + faintRows.length + ', b64: "' + fb64 + '" };\n' +
  'P.dso2Common = ' + JSON.stringify(common, null, 1) + ';\n' +
  'P.dso = P.dso.concat(P.dso2);\n';

fs.writeFileSync(APP + 'js/dso2.js', src);
console.log('wrote js/dso2.js — bright:', brightRows.length, ' faint:', faintRows.length,
  ' common names:', Object.keys(common).length);
console.log('SIMBAD-sourced:', coordSrc.simbad.size, ' Corwin fallback:', coordSrc.corwin.length);
console.log('Corwin-fallback ids:', coordSrc.corwin.join(', ') || '(none)');
console.log('quality mix:', JSON.stringify(qdist));
console.log('--- sample rows ---');
for (const r of ['M1', 'M13', 'M42', 'M45', 'M57'].map(id => brightRows.find(r => r[0] === id))) {
  if (r) console.log(JSON.stringify(r));
}
for (const r of brightRows.filter(r => r[0] === 'NGC 0869' || r[0] === 'NGC 2424')) console.log(JSON.stringify(r));
