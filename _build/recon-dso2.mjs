/* PERIHELION — DSO recon: parse NGC B2000 file + Wikipedia J2000, verify precession */
import fs from 'node:fs';
const D = Math.PI / 180;
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';

/* ---------- IAU 1976 exact precession (1900.0 -> 2000.0) ---------------- */
function precess(a1, d1) { // radians in, radians out
  const t = 0.2; // centuries from 1900 to 2000
  const zeta = (2306.2638 * t + 0.30188 * t * t + 0.017998 * t ** 3) * D;
  const z = (2306.2638 * t + 1.094688 * t * t + 0.018203 * t ** 3) * D;
  const th = (2004.3127 * t + 0.556814 * t * t + 0.018263 * t ** 3) * D;
  const X1 = Math.cos(zeta) * Math.cos(th) * Math.cos(z) - Math.sin(zeta) * Math.sin(th) * Math.sin(z);
  const Y1 = Math.sin(zeta) * Math.cos(th) * Math.cos(z) + Math.cos(zeta) * Math.sin(th) * Math.sin(z);
  const Z1 = -Math.sin(th) * Math.cos(z);
  const X2 = -Math.cos(zeta) * Math.sin(z) - Math.sin(zeta) * Math.sin(th) * Math.cos(z);
  const Y2 = -Math.sin(zeta) * Math.sin(z) + Math.cos(zeta) * Math.sin(th) * Math.cos(z);
  const Z2 = Math.sin(th) * Math.sin(z);
  const X3 = Math.cos(zeta) * Math.sin(th) * Math.sin(z) - Math.sin(zeta) * Math.cos(th) * Math.cos(z);
  const Y3 = Math.sin(zeta) * Math.sin(th) * Math.sin(z) + Math.cos(zeta) * Math.cos(th) * Math.cos(z);
  const Z3 = Math.cos(th) * Math.cos(z);
  const s1 = Math.sin(a1), c1 = Math.cos(a1);
  const sd2 = Z3 * Math.sin(d1) + (Z1 * s1 + Z2 * c1) * Math.cos(d1);
  const a2 = Math.atan2(X2 * s1 + Y2 * c1, X1 * s1 + Y1 * c1);
  return [a2, Math.asin(Math.max(-1, Math.min(1, sd2)))];
}
const hmsToDeg = (h, m, s) => (h + (m || 0) / 60 + (s || 0) / 3600) * 15;
const dmsToDeg = (dd, mm, ss, neg) => (neg ? -1 : 1) * (Math.abs(dd) + (mm || 0) / 60 + (ss || 0) / 3600);

/* ---------- 1) validate precession on Vega & Arcturus (B2000 FK4 -> J2000 ICRS) */
const tests = [
  ['Vega', hmsToDeg(18, 36, 46.7), dmsToDeg(38, 45, 16, false), hmsToDeg(18, 36, 56.3), dmsToDeg(38, 47, 1, false)],
  ['Arcturus', hmsToDeg(14, 16, 18.6), dmsToDeg(19, 12, 13, false), hmsToDeg(14, 15, 40.5), dmsToDeg(19, 10, 57, false)],
];
console.log('--- precession validation (B2000 -> J2000) ---');
for (const [name, ra1, d1, ra2, d2] of tests) {
  const [pra, pd] = precess(ra1 * D, d1 * D);
  const dra = ((pra / D - ra2) + 540) % 360 - 180;
  const pdd = pd / D - d2;
  console.log(name, 'err RA=' + (dra * 3600).toFixed(1) + '"  err Dec=' + (pdd * 3600).toFixed(1) + '"');
}

/* ---------- 2) parse NGC file ------------------------------------------- */
const xml = fs.readFileSync(B + 'ngc-vii118.xml', 'utf8');
const rows = [];
const trRe = /<TR>([\s\S]*?)<\/TR>/g;
let m;
while ((m = trRe.exec(xml)) !== null) {
  const tds = [...m[1].matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/g)].map(x => x[1].replace(/<[^>]+>/g, '').trim());
  if (tds.length < 12) continue;
  const [recno, name, type, ra, dec, source, cons, lsize, size, mag, nmag, desc] = tds;
  rows.push({ name, type, ra, dec, size: parseFloat(size), mag: parseFloat(mag), desc, cons });
}
console.log('\nNGC rows parsed:', rows.length);
const byName = {};
for (const r of rows) byName[r.name] = r;

/* ---------- 3) parse Wikipedia Messier table (J2000) ---------------------- */
const html = fs.readFileSync(B + 'messier.html', 'utf8');
const wiki = {};
const trBlocks = html.split(/<tr[ >]/).slice(1);
for (const blk of trBlocks) {
  const nm = blk.match(/^id="mwB[A-Za-z0-9]+"[^>]*>\s*<th[^>]*>.*?<a[^>]*>(M\d+)</s/) || blk.match(/<th[^>]*>.*?<a[^>]*>(M\d+)</s);
  if (!nm) continue;
  const id = nm[1];
  const raM = blk.match(/Template:RA[^}]*?"params":\{"1":\{"wt":"(\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/s);
  const decM = blk.match(/Template:DEC[^}]*?"params":\{"1":\{"wt":"(-?\d+)"\},"2":\{"wt":"(\d+)"\}(?:,"3":\{"wt":"(\d+)"\})?/s);
  if (!raM || !decM) continue;
  const rah = +raM[1], ram = +raM[2], ras = +((raM[3] || 0));
  const ddn = +decM[1], ddm = +decM[2], dds = +((decM[3] || 0));
  const raDeg = hmsToDeg(rah, ram, ras);
  const decDeg = ddn < 0 ? -(Math.abs(ddn) + ddm / 60 + dds / 3600) : ddn + ddm / 60 + dds / 3600;
  const ngcM = blk.match(/>(NGC \d+|IC \d+|none|Sh2 \d+|Abell \d+|Circlet? \d+|<[^>]+>)*</);
  wiki[id] = { ra: raDeg, dec: decDeg };
}
console.log('wiki Messier rows parsed:', Object.keys(wiki).length);

/* ---------- 4) compare: precessed NGC-file rows vs wiki J2000 ------------- */
console.log('\n--- NGC-file (B2000, precessed to J2000) vs Wikipedia J2000 ---');
const probes = [
  ['M42 Orion Nebula', 'NGC 1976', 'M42'], ['M45 Pleiades', 'NGC 2505', 'M45'],
  ['M13 Hercules', 'NGC 6205', 'M13'], ['M8 Lagoon', 'NGC 6523', 'M8'],
  ['M27 Ring', 'NGC 6853', 'M27'], ['M11 Wild Duck', 'NGC 6705', 'M11'],
  ['M3 globular', 'NGC 5272', 'M3'], ['Merope cluster', 'NGC 1435', null],
  ['Rosette', 'NGC 2422', null], ['Double Cluster N', 'NGC 869', null],
  ['M31 (galaxy control)', 'NGC 224', 'M31'],
];
for (const [label, nname, mid] of probes) {
  const r = byName[nname];
  if (!r) { console.log(label, nname, 'NOT IN FILE'); continue; }
  // parse B2000 RA "HHMMSS" style (xtype hms) and Dec dms
  const raM = r.ra.match(/^(\d{1,2})h(\d{2})m([\d.]+)s$/) || r.ra.match(/^(\d{1,2})(\d{2})([\d.]+)?$/);
  const dM = r.dec.match(/^([+-])(\d+)([°:]\s*\d+)?/);
  // robust: RA field like "004244" or "00h42m44s"; Dec like "+41 16"
  let raDeg = null, decDeg = null;
  const raAlt = r.ra.match(/^(\d{1,2})h(\d{2})m?([\d.]+)?s?$/);
  if (raAlt) raDeg = hmsToDeg(+raAlt[1], +raAlt[2], +(raAlt[3] || 0));
  else {
    const rr = r.ra.replace(/\D/g, '').padStart(6, '0');
    raDeg = hmsToDeg(+rr.slice(0, 2), +rr.slice(2, 4), +rr.slice(4, 6) / 100);
  }
  const dm = r.dec.match(/^([+-])(\d+)([°:]\s*\d+)?/);
  if (dm) {
    const rest = r.dec.slice(dm[0].length).replace(/[^0-9.+-]/g, '');
    const parts = r.dec.split(/[°: ]+/).filter(Boolean);
    decDeg = dmsToDeg(+parts[0], parts[1] ? +parts[1] : 0, parts[2] ? +parts[2] : 0, /-/.test(r.dec));
  }
  const [pra, pd] = precess(raDeg * D, decDeg * D);
  let out = 'file→J2000: RA ' + (pra / D).toFixed(4) + '° Dec ' + (pd / D).toFixed(4) + '°';
  if (mid && wiki[mid]) {
    const w = wiki[mid];
    const dra = ((pra / D - w.ra) % 360 + 540) % 360 - 180;
    const pdd = pd / D - w.dec;
    out += `   wiki: RA ${w.ra.toFixed(4)} Dec ${w.dec.toFixed(4)}  Δ=${(dra * 3600).toFixed(1)}"/${(pdd * 3600).toFixed(1)}"`;
  }
  console.log(label.padEnd(24), nname.padEnd(10), out);
}
