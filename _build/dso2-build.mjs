/* PERIHELION — build DSO part 2: open clusters, globulars, nebulae, planetary nebulae.
 * Sources (all real data, offline):
 *  - Messier positions/names/sizes/types: Wikipedia "List of Messier objects"
 *    (messier.html, J2000.0 table).
 *  - Non-Messier positions: Corwin 2004 "Accurate Positions for NGC/IC Objects"
 *    (VizieR VII/239A, J2000).
 *  - Types/magnitudes/sizes: NGC 2000.0 (Sinnott 1988, VizieR VII/118).
 */
import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const D = Math.PI / 180;

/* ---------------- Corwin VII/239A (J2000 positions) ---------------- */
const cx = fs.readFileSync(B + 'corwin-vii239a.xml', 'utf8');
const t1 = cx.slice(cx.indexOf('<TABLEDATA>'), cx.indexOf('</TABLEDATA>'));
const corwin = {};
for (const m of t1.matchAll(/<TR><TD>([^<]*)<\/TD><TD>([NI])<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><\/TR>/g)) {
  if (m[4].trim()) continue; // component rows
  const key = (m[2] === 'I' ? 'IC ' : 'NGC ') + m[3];
  if (corwin[key]) continue;
  const r = m[5].trim().split(/\s+/).map(Number);
  const raw = m[6].trim().split(/\s+/);
  const neg = raw[0].startsWith('-');
  const dec = (neg ? -1 : 1) * (Math.abs(parseFloat(raw[0])) + (parseFloat(raw[1]) || 0) / 60 + (parseFloat(raw[2]) || 0) / 3600);
  corwin[key] = { ra: r[0] * 15 + r[1] / 4 + (r[2] || 0) / 240, dec, q: m[7].trim(), n: +m[8] };
}
console.log('Corwin rows:', Object.keys(corwin).length);

/* ---------------- Sinnott VII/118 (type/mag/size) ------------------ */
const nx = fs.readFileSync(B + 'ngc-vii118.xml', 'utf8');
const nt1 = nx.slice(nx.indexOf('<TABLEDATA>'), nx.indexOf('</TABLEDATA>'));
const sinnott = {};
for (const chunk of nt1.split('<TR>')) {
  const tds = [...chunk.matchAll(/<TD>([^<]*)<\/TD>/g)].map(x => x[1]);
  if (tds.length < 12) continue;
  let name = tds[1].trim();
  if (name.startsWith('I')) name = 'IC ' + name.slice(1).trim();
  else name = 'NGC ' + name.trim();
  if (sinnott[name]) continue;
  sinnott[name] = { name, type: tds[2].trim(), size: parseFloat(tds[8]) || 0, mag: parseFloat(tds[9]) || 99, desc: tds[11].trim() };
}
console.log('Sinnott rows:', Object.keys(sinnott).length);

/* ---------------- Wikipedia Messier table -------------------------- */
const html = fs.readFileSync(B + 'messier.html', 'utf8');
function tmpls(seg) {
  const m = seg.match(/"params":\{"1":\{"wt":"([+-]?\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/);
  return m ? [m[1], m[2], m[3] || '0'] : null;
}
const wiki = {};
const wikiProblems = [];
for (const blk of html.split(/<tr[ >]/).slice(1)) {
  const nm = blk.match(/<th[^>]*>.*?<a[^>]*>(M\d+)<\/a>/s);
  if (!nm) continue;
  const id = nm[1];
  /* split the row into cells */
  const cells = [...blk.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1]);
  if (cells.length < 11) { wikiProblems.push(id + ': only ' + cells.length + ' cells'); continue; }
  const raCell = cells[cells.length - 2], decCell = cells[cells.length - 1];
  const ri = raCell.indexOf('"wt":"RA"'), di = decCell.indexOf('"wt":"DEC"');
  if (ri < 0 || di < 0) { wikiProblems.push(id + ': no RA/DEC transclusion'); continue; }
  const rp = tmpls(raCell.slice(ri, ri + 800)), dp = tmpls(decCell.slice(di, di + 800));
  if (!rp || !dp) { wikiProblems.push(id + ': RA/DEC parse fail'); continue; }
  const ra = (+rp[0] + (+rp[1]) / 60 + (+rp[2]) / 3600) * 15;
  const dec = (Math.abs(+dp[0]) + (+dp[1]) / 60 + (+dp[2]) / 3600) * (dp[0].startsWith('-') ? -1 : 1);
  const plainCell = c => c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const xref = (plainCell(cells[1]) || '').match(/(NGC \d+|IC \d+)/);
  const nameC = plainCell(cells[2]);
  const typeC = plainCell(cells[4]);
  const mag = parseFloat(plainCell(cells[7]));
  const sizeM = plainCell(cells[8]).match(/^([\d.]+)′/);
  wiki[id] = { id, ra, dec, xref: xref ? xref[1] : null, name: nameC || null, type: typeC, mag: isNaN(mag) ? null : mag, size: sizeM ? +sizeM[1] : null };
}
console.log('wiki rows parsed:', Object.keys(wiki).length, ' problems:', wikiProblems.join('; ') || '(none)');

/* ---------------- type classification ------------------------------ */
function classify(t) {
  const s = String(t || '').toLowerCase();
  if (/galax/.test(s)) return null;                 // handled by the galaxy layer
  if (/binary|double star/.test(s)) return 'SKIP-BINARY';
  if (/globular/.test(s)) return 'Gb';
  if (/open cluster|open star cluster|double cluster/.test(s)) return 'OC';
  if (/planetary nebula/.test(s)) return 'Pl';
  if (/nebula|supernova remnant|remnant/.test(s)) return 'Nb';
  return 'UNKNOWN:' + t;
}
const typeBV = { OC: 0.55, Gb: 1.05, Nb: 1.45, Pl: 1.0 };
const typeColor = { OC: [0.66, 0.76, 1.0], Gb: [1.0, 0.87, 0.66], Nb: [1.0, 0.62, 0.5], Pl: [0.72, 1.0, 0.78] };

const placedM = new Set();
const bright = [], faint = [];
const seenNames = new Set();
let skipped = [];
for (const m of Object.values(wiki)) {
  const cls = classify(m.type);
  if (cls === null) continue;                        // galaxies
  if (cls === 'SKIP-BINARY') { skipped.push(m.id + ' (double star)'); continue; }
  if (cls.startsWith('UNKNOWN')) { skipped.push(m.id + ' (' + m.type + ')'); continue; }
  if (!m.size) m.size = 20;
  bright.push({
    id: m.id, ra: +m.ra.toFixed(4), dec: +m.dec.toFixed(4), mag: m.mag, type: cls,
    size: +m.size.toFixed(1),
    name: m.name ? (m.name + ' (' + m.id + ')') : (m.id + ' (Messier object)'),
    xref: m.xref, m: true
  });
  placedM.add(m.id);
  if (m.xref) seenNames.add(m.xref);
}
console.log('Messier DSOs placed:', placedM.size, ' skipped:', skipped.join(', '));

/* spot-check known J2000 positions (h m s, d m s) */
const SPOT = {
  M1: [19, 59, 28.4, 22, 43, 10], M31: [0, 42, 44.3, 41, 16, 9], M32: [9, 55, 40.2, 69, 40, 47],
  M33: [0, 43, 37.7, 41, 16, 12], M45: [3, 47, 9, 24, 23, 51], M51: [13, 29, 53, 47, 11, 43],
  M57: [18, 53, 23, 33, 1, 45], M8: [18, 3, 37, -24, 23, 12], M13: [16, 41, 41.2, 36, 27, 37],
  M82: [9, 55, 40.3, 69, 40, 59], M87: [12, 30, 49.4, 12, 23, 28], M101: [14, 3, 12.6, 54, 20, 29],
  M104: [12, 39, 58.9, -11, 37, 23], M81: [9, 55, 33, 69, 3, 55], M63: [9, 45, 30.3, 68, 41, 4],
};
console.log('--- spot-check wiki positions vs known J2000 (flag > 2\') ---');
for (const [id, c] of Object.entries(SPOT)) {
  const w = wiki[id];
  if (!w) { console.log(id, 'MISSING FROM WIKI PARSE'); continue; }
  const tra = (c[0] + c[1] / 60 + c[2] / 3600) * 15;
  const tdec = c[3] + c[4] / 60 + c[5] / 3600;
  let dra = (w.ra - tra) % 360; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
  const arc = Math.hypot(dra * Math.cos(tdec * D) * 60, (w.dec - tdec) * 60);
  console.log(id, arc < 2 ? 'ok' : '** MISMATCH **' + arc.toFixed(1) + "'");
}

/* distinct wiki type strings */
const types = [...new Set(Object.values(wiki).map(w => w.type))];
console.log('\nwiki type strings:', types.length);
for (const t of types) console.log('   ', JSON.stringify(t), '->', classify(t));

/* ---------------- non-Messier from Sinnott + Corwin ---------------- */
const nBright = [], nFaint = [];
for (const s of Object.values(sinnott)) {
  if (!['OC', 'Gb', 'Nb', 'Pl'].includes(s.type)) continue;
  const c = corwin[s.name];
  if (!c) continue;
  if (seenNames.has(s.name)) continue;               // already placed via Messier xref
  const row = {
    id: s.name, ra: +c.ra.toFixed(4), dec: +c.dec.toFixed(4), mag: s.mag, type: s.type,
    size: s.size > 0 ? s.size : 10, name: s.name, m: false
  };
  if (s.mag <= 9.5) nBright.push(row);
  else if (s.mag <= 12.5) nFaint.push(row);
}
console.log('\nnon-Messier bright:', nBright.length, ' faint:', nFaint.length);

const allBright = [...bright, ...nBright];
/* quality report for non-Messier (Corwin quality classes) */
const qcount = {};
for (const s of Object.values(sinnott)) {
  if (!['OC', 'Gb', 'Nb', 'Pl'].includes(s.type)) continue;
  const c = corwin[s.name];
  if (!c) continue;
  const k = c.q + (c.n >= 2 ? 'x' : '');
  qcount[k] = (qcount[k] || 0) + 1;
}
console.log('Corwin quality distribution (all candidates):', qcount);

fs.writeFileSync(B + 'dso2-bright.json', JSON.stringify({ bright: allBright, faint: nFaint }, null, 0));
console.log('\nwrote dso2-bright.json: bright=' + allBright.length + ' faint=' + nFaint.length);
