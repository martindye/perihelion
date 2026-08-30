/* build-dso.mjs — emit js/dso.js (P.dso) from _build/dso-final.json
 * adds curated per-object metadata: position angle (PA), B-V colour index,
 * fun line. Values are standard published values for the famous objects;
 * everything else gets type-based defaults.
 */
import fs from 'node:fs';

const RAW = JSON.parse(fs.readFileSync(new URL('./dso-final.json', import.meta.url), 'utf8'));

/* M82 (Cigar) — its Wikipedia type code didn't match the list parser */
const M82 = {
  id: 'M82', name: 'Cigar Galaxy', ra: 148.8875, dec: 69.0664,
  mag: 8.4, type: 'SB(s)bc', major: 11, minor: 7, dist: 11.5
};

/* curated: id -> { pa (deg, N->E), bv, fun } */
const CUR = {
  M31:  { pa: 65,  bv: 0.99, fun: 'The Andromeda Galaxy — 2.5 million light-years away, the most distant object visible to the naked eye. It is on a collision course with the Milky Way, arriving in about 4.5 billion years.' },
  M32:  { pa: 35,  bv: 0.93, fun: 'A compact companion of M31 whose stellar density is around a hundred times that of our own galactic bulge.' },
  M33:  { pa: 62,  bv: 0.50, fun: 'The Triangulum Galaxy — a vast, thin disc of gas and stars, the third-nearest major galaxy to the Milky Way.' },
  M49:  { pa: 0,   bv: 0.98, fun: 'The brightest galaxy in the Virgo Cluster, home to a supermassive black hole that swallows a few million solar masses a year.' },
  M51:  { pa: 47,  bv: 0.80, fun: 'The Whirlpool Galaxy — the archetype of spiral structure, its arms stirred by an ongoing encounter with companion NGC 5195.' },
  M58:  { pa: 0,   bv: 0.90 }, M59: { pa: 0, bv: 0.95 }, M60: { pa: 0, bv: 0.95 },
  M61:  { pa: 0,   bv: 0.90 },
  M63:  { pa: 44,  bv: 0.85, fun: 'The Sunflower Galaxy — a face-on spiral with a rich, mottled disc of young stars.' },
  M64:  { pa: 140, bv: 0.95, fun: 'The Black Eye Galaxy — a dark band of dust crosses its disc like a smudge on an otherwise smooth face.' },
  M65:  { pa: 0,   bv: 0.80 }, M66: { pa: 0, bv: 0.75 },
  M74:  { pa: 170, bv: 0.70, fun: 'A near-perfect face-on spiral — one of the cleanest grand-design patterns in the sky.' },
  M77:  { pa: 0,   bv: 0.75, fun: 'Bode\u2019s Galaxy — one of the closest and brightest spiral galaxies, and a known active nucleus.' },
  M81:  { pa: 149, bv: 0.63, fun: 'The most luminous galaxy in the Ursa Major group; host of SN 1993J, the brightest supernova of the twentieth century.' },
  M83:  { pa: 75,  bv: 0.80 },
  M87:  { pa: 30,  bv: 0.98, fun: 'Home of M87*, the first black hole ever imaged by the Event Horizon Telescope in 2019.' },
  M88:  { pa: 0,   bv: 0.85 }, M89: { pa: 0, bv: 0.96 }, M90: { pa: 0, bv: 0.90 },
  M91:  { pa: 0,   bv: 0.85 },
  M94:  { pa: 0,   bv: 0.80, fun: "The Cow's Head Galaxy, with a dense yellowish core older than most of the universe." },
  M95:  { pa: 0,   bv: 0.85 }, M96: { pa: 0, bv: 0.85 }, M98: { pa: 0, bv: 0.90 },
  M99:  { pa: 0,   bv: 0.90 }, M100: { pa: 0, bv: 0.90 },
  M101: { pa: 214, bv: 0.52, fun: 'The Pinwheel Galaxy — a face-on disc 170,000 light-years across, lit by thousands of blue star clusters.' },
  M104: { pa: 134, bv: 0.95, fun: 'The Sombrero Galaxy — a brilliant bulge threaded by a razor-thin lane of dust.' },
  M105: { pa: 0,   bv: 0.95 },
  M106: { pa: 0,   bv: 0.70, fun: 'A Seyfert galaxy: its core is a supermassive black hole accreting gas and shining brightly in X-rays.' },
  M108: { pa: 0,   bv: 0.80 }, M109: { pa: 0, bv: 0.85 },
  M110: { pa: 60,  bv: 0.95, fun: 'The second of the two compact elliptical satellites that escort the Andromeda Galaxy.' },
  'NGC 253':  { pa: 46,  bv: 0.55, fun: 'The Sculptor Galaxy — second only to M31 among the nearest bright spirals, a starburst blowing a superwind of gas.' },
  'NGC 4565': { pa: 90,  bv: 0.70, fun: 'The classic edge-on spiral — a razor-thin disc split by a dark lane of dust.' },
  'NGC 4414': { pa: 95,  bv: 0.85, fun: 'Another razor-blade edge-on disc, one of the best in the sky for showing a galaxy\u2019s true thinness.' },
  'NGC 4631': { pa: 45,  bv: 0.70, fun: 'One of the Mice Galaxies — two galaxies pulling on each other, stretching long tidal tails between them.' },
  'NGC 4656': { pa: 45,  bv: 0.65, fun: 'The second of the Mice pair, its tail being pulled out by its neighbour NGC 4631.' },
  'NGC 4639': { pa: 0, bv: 0.90 }, 'NGC 4622': { pa: 0, bv: 0.90 }, 'NGC 4312': { pa: 0, bv: 0.95 },
  'NGC 3628': { pa: 60,  bv: 0.75, fun: 'A stretched spiral in the Leo Triplet, being tidally warped by M65 and M66.' },
  'NGC 5128': { pa: 48,  bv: 0.95, fun: 'Centaurus A — a giant elliptical with a dust lane and a relativistic jet, one of the strongest radio sources in the sky.' },
  'NGC 3310': { pa: 0,   bv: 0.70 }, 'NGC 2403': { pa: 0, bv: 0.65 }, 'NGC 300': { pa: 0, bv: 0.70 },
  'NGC 4945': { pa: 105, bv: 0.65, fun: 'A starburst galaxy viewed almost perfectly edge-on, its bright arm studded with young blue clusters.' },
  'NGC 55':   { pa: 0,   bv: 0.75 },
  'NGC 4490': { pa: 0,   bv: 0.85 }, 'NGC 2770': { pa: 0, bv: 0.75 },
  'NGC 1365': { pa: 44,  bv: 0.86, fun: 'A grand-design barred spiral, its arms swept out from the ends of a bright central bar.' },
  'NGC 1300': { pa: 15,  bv: 0.80, fun: 'The textbook barred spiral — the prototype for the whole SB class of galaxy.' },
  'NGC 2841': { pa: 0,   bv: 0.75 },
  'NGC 1316': { pa: 0,   bv: 0.98, fun: 'Fornax A — a giant elliptical that has stripped its neighbours of gas and stars through collisions.' },
  'NGC 3384': { pa: 0,   bv: 1.00 },
  M82:  { pa: 47,  bv: 0.50, fun: 'The Cigar Galaxy — a starburst furnace whose supernovae and stellar winds drive a superwind at millions of kilometres per second.' }
};

const cleanType = t => String(t || 'Galaxy')
  .replace(/\{\{.*$/, '')
  .replace(/</g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const all = [...RAW, M82];
const lines = all.map(g => {
  const c = CUR[g.id] || {};
  const bv = c.bv != null ? c.bv
    : /Elliptical|Dwarf elliptical|^E\d|S0/.test(g.type) ? 0.95
    : /Barred|^SB|SAB|\(R'\)SAB|\(R'\)SB/.test(g.type) ? 0.75
    : 0.78;
  const type = cleanType(g.type);
  const dist = (g.dist == null || g.dist === '') ? 'null' : String(+(+g.dist).toFixed(1));
  const fun = c.fun ? '"' + c.fun.replace(/"/g, '\\"') + '"' : 'null';
  return '  [' + JSON.stringify(g.id) + ', ' + (+g.ra).toFixed(4) + ', ' + (+g.dec).toFixed(4) +
    ', ' + (+g.mag) + ', ' + JSON.stringify(type) + ', ' + (+g.major) + ', ' + (+g.minor) +
    ', ' + dist + ', ' + (c.pa || 0) + ', ' + (+bv).toFixed(2) + ', ' + fun + '],';
});

const nM = all.filter(g => /^M\d+$/.test(g.id)).length;
const out = `/* ============================================================================
 * PERIHELION — extragalactic objects (real catalog data)
 * ${all.length} galaxies: all ${nM} Messier galaxies plus ${all.length - nM} famous NGC objects.
 * Coordinates J2000, angular sizes in arcminutes, distance in Mly.
 * Row: id, ra, dec, v, type, major', minor', distMly, posAngle, b-v, fun
 * ==========================================================================*/
'use strict';
P.dso = [
${lines.join('\n')}
];
`;
fs.writeFileSync(new URL('../js/dso.js', import.meta.url), out);
console.log('wrote js/dso.js —', all.length, 'galaxies,', (out.length / 1024).toFixed(1), 'KB');
