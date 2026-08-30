/* Epoch audit: compare NGC-file positions vs Wikipedia Messier J2000 positions */
import fs from 'node:fs';
const dir = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';

/* ---- NGC file ---- */
const xml = fs.readFileSync(dir + 'ngc-vii118.xml', 'utf8');
const rows = [...xml.matchAll(/<TR>(.*?)<\/TR>/gs)].map(m =>
  [...m[1].matchAll(/<TD>(.*?)<\/TD>/gs)].map(c => c[1].trim()));
const ngc = new Map();
for (const r of rows) {
  if (r.length < 6) continue;
  const name = r[1].replace(/^I\s+/, 'I');
  const ra = r[3], dec = r[4];
  const mRa = /(\d{1,2})\s+(\d{1,2}[.\d]?)/.exec(ra);
  const mDec = /([+-])\s*(\d{1,2})\s+(\d{1,2})/.exec(dec);
  if (!mRa || !mDec) continue;
  const raH = +mRa[1], raM = +mRa[2];
  const decD = (mDec[1] === '-' ? -1 : 1) * (+mDec[2] + +mDec[3] / 60);
  ngc.set(name, { ra: raH + raM / 60, dec: decD, type: r[2], size: r[8] || '', mag: r[9] || '', desc: r[11] || '' });
}
console.log('NGC map size:', ngc.size);

/* ---- Wikipedia Messier table ---- */
const wiki = fs.readFileSync(dir + 'messier.html', 'utf8');
const trs = [...wiki.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map(m => m[0])
  .filter(t => /<th[^>]*>(?:<a[^>]*>)?\s*M\d{1,3}\b/.test(t));
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&apos;/g, "'").replace(/&#8209;/g, '-').replace(/&minus;/g, '-').replace(/\s+/g, ' ').trim();
const mess = [];
for (const t of trs) {
  const cells = [...t.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => strip(c[1]));
  if (cells.length < 8) continue;
  const m = /M(\d{1,3})/.exec(cells[0]);
  if (!m) continue;
  /* find RA/Dec cells: "05 h 35 m 17.3 s" and "+22 ° 00 ′ 52.2 ″" */
  let ra = null, dec = null;
  for (const c of cells) {
    const mr = /(\d{1,2})\s*h\s+(\d{1,2})\s*m\s+(\d{1,2}(?:\.\d+)?)\s*s/.exec(c);
    if (mr && !ra) { ra = (+mr[1] + (+mr[2]) / 60 + (+mr[3]) / 3600) * 15; continue; }
    const md = /([+\-])\s*(\d{1,2})\s*°?\s*(\d{1,2})\s*′?\s*(\d{1,2}(?:\.\d+)?)?/.exec(c);
    if (md && /\d/.test(md[2]) && !dec && !/^\s*M\d/.test(c) && c.length < 40) {
      dec = (md[1] === '-' ? -1 : 1) * (+md[2] + (+md[3] || 0) / 60 + (+md[4] || 0) / 3600);
    }
  }
  /* NGC id from cell[1] (e.g. "NGC 1976" or "NGC 5194, 5195") */
  const ng = (cells[1] || '').match(/(?:NGC|IC)\s*([0-9]+(?:\s*[0-9,]+)?)/);
  mess.push({ m: 'M' + m[1], ngc: cells[1], ra, dec });
}
console.log('messier parsed:', mess.length, 'with ra/dec:', mess.filter(x => x.ra && x.dec).length);

/* ---- compare ---- */
const results = [];
for (const mo of mess) {
  if (!mo.ra || !mo.dec) { console.log('  no coords parsed for', mo.m, JSON.stringify(mo.ngc)); continue; }
  const names = (mo.ngc.match(/(?:NGC|IC)?\s*(\d{3,5})/g) || []).map(s => s.trim());
  let best = null;
  for (const n of names) {
    const k = n.replace(/^I/, '').trim();
    const g = ngc.get(k) || ngc.get('I' + k) || ngc.get(('0000' + k).slice(-4));
    if (!g) continue;
    const dra = ((mo.ra - g.ra * 15) % 360 + 540) % 360 - 180; /* deg */
    const ddec = mo.dec - g.dec;
    const d = Math.hypot(dra, ddec);
    if (!best || d < best.d) best = { n: k, type: g.type, d, dra, ddec };
  }
  if (best) results.push({ m: mo.m, type: best.type, arcmin: best.d * 60, arcsec: best.d * 3600 });
}
results.sort((a, b) => b.arcmin - a.arcmin);
console.log('\nM42-check | M | NGC type | offset(file vs wiki J2000)');
for (const r of results) console.log('  ' + r.m.padEnd(6) + (r.type || '?').padEnd(8) + (r.arcmin >= 60 ? (r.arcmin / 60).toFixed(1) + '°' : r.arcmin.toFixed(1) + '′') + '   (' + r.arcsec.toFixed(0) + '″)');
const by = {};
for (const r of results) { const k = (r.arcmin > 30) ? '>30′' : r.arcmin > 5 ? '5-30′' : '<5′'; (by[k] = by[k] || []).push(r.m); }
console.log('\noffset buckets:');
for (const [k, v] of Object.entries(by)) console.log('  ' + k + ': ' + v.length + (v.length < 12 ? '  [' + v.join(',') + ']' : ''));
