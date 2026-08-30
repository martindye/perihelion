/* PERIHELION — DSO selection: Corwin (J2000 pos) + Sinnott (type/mag/size) + Wikipedia (Messier) */
const fs = require('fs');
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const D = Math.PI / 180;

function parsePos(ra, dec) {
  const r = ra.trim().split(/[\s:]+/).map(Number);
  const raDeg = (r[0] || 0) * 15 + (r[1] || 0) / 4 + (r[2] || 0) / 240;
  const raw = dec.trim().split(/[°: ]+/).filter(s => s !== '');
  const neg = raw[0].startsWith('-');
  const decDeg = (neg ? -1 : 1) * (Math.abs(parseFloat(raw[0])) + (parseFloat(raw[1]) || 0) / 60 + (parseFloat(raw[2]) || 0) / 3600);
  return [raDeg, decDeg];
}

/* ---- Corwin VII/239A positions (J2000) ---- */
const cx = fs.readFileSync(B + 'corwin-vii239a.xml', 'utf8');
const t1s = cx.indexOf('<TABLEDATA>'), t1e = cx.indexOf('</TABLEDATA>', t1s);
const t1 = cx.slice(t1s, t1e);
const corwin = {};
for (const m of t1.matchAll(/<TR><TD>([^<]*)<\/TD><TD>([NI])<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><\/TR>/g)) {
  const key = m[2] === 'I' ? 'IC ' + m[3] : 'NGC ' + m[3];
  const comp = m[4].trim();
  if (comp) continue; // component rows; keep only the mean (empty) row
  if (corwin[key]) continue;
  const [ra, dec] = parsePos(m[5], m[6]);
  corwin[key] = { key, ra, dec, q: m[7].trim(), npos: +m[8], era: m[9] === '' ? null : +m[9], ede: m[10] === '' ? null : +m[10] };
}
console.log('Corwin primary rows:', Object.keys(corwin).length);

/* ---- Sinnott VII/118 (types, mags, sizes) ---- */
const nx = fs.readFileSync(B + 'ngc-vii118.xml', 'utf8');
const nt1s = nx.indexOf('<TABLEDATA>'), nt1e = nx.indexOf('</TABLEDATA>', nt1s);
const nt1 = nx.slice(nt1s, nt1e);
const sinnott = {};
for (const chunk of nt1.split('<TR>')) {
  const tds = [...chunk.matchAll(/<TD>([^<]*)<\/TD>/g)].map(x => x[1]);
  if (tds.length < 12) continue;
  let name = tds[1].trim();
  if (name.startsWith('I')) name = 'IC ' + name.slice(1).trim();
  else name = 'NGC ' + name.trim();
  if (sinnott[name]) continue;
  sinnott[name] = {
    name, type: tds[2].trim(), cons: tds[6].trim(),
    size: parseFloat(tds[8]) || 0, mag: parseFloat(tds[9]) || 99,
    desc: tds[11].trim()
  };
}
console.log('Sinnott rows:', Object.keys(sinnott).length);

/* ---- Wikipedia Messier table (J2000 + names + sizes) ---- */
const html = fs.readFileSync(B + 'messier.html', 'utf8');
const wiki = {};
function tmpls(seg) {
  const m = seg.match(/"params":\{"1":\{"wt":"([+-]?\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/);
  return m ? [m[1], m[2], m[3] || '0'] : null;
}
for (const blk of html.split(/<tr[ >]/).slice(1)) {
  const nm = blk.match(/<th[^>]*>.*?<a[^>]*>(M\d+)<\/a>/s);
  if (!nm) continue;
  const ri = blk.indexOf('"wt":"RA"'), di = blk.indexOf('"wt":"DEC"');
  if (ri < 0 || di < 0) continue;
  const rp = tmpls(blk.slice(ri, ri + 800)), dp = tmpls(blk.slice(di, di + 800));
  if (!rp || !dp) continue;
  const ra = (+rp[0] + (+rp[1]) / 60 + (+rp[2]) / 3600) * 15;
  const sign = +dp[0] < 0 ? -1 : 1;
  const dec = sign * (Math.abs(+dp[0]) + (+dp[1]) / 60 + (+dp[2]) / 3600);
  const plain = blk.replace(/<[^>]+>/g, ' ');
  const ngcM = plain.match(/(NGC \d+|IC \d+|Sh2 \d+|Circlet? \d+|Abell \d+)/);
  const nameM = blk.match(/<i[^>]*>([^<]+)<\/i>/);
  const sizeM = blk.match(/>(\d+(?:\.\d+)?)′\s*(?:×\s*(\d+(?:\.\d+)?)′)?</);
  let ngc = ngcM ? ngcM[1].trim() : null;
  if (ngc && !/^(NGC|IC) /.test(ngc)) ngc = null; // only catalog cross-refs used as keys
  wiki[nm[1]] = { id: nm[1], ra, dec, ngc, name: nameM ? nameM[1].trim() : null, size: sizeM ? +sizeM[1] : null };
}
console.log('wiki Messier rows:', Object.keys(wiki).length);

/* ---- cross-check Corwin vs wiki J2000 (all rows) ---- */
let ok = 0, bad = 0; const big = [];
for (const m of Object.values(wiki)) {
  if (!m.ngc || !corwin[m.ngc]) continue;
  const c = corwin[m.ngc];
  let dra = (c.ra - m.ra) % 360; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
  const arc = Math.hypot(dra * Math.cos(m.dec * D) * 60, (c.dec - m.dec) * 60);
  if (arc < 2.0) ok++;
  else { bad++; big.push(m.id + ' Δ=' + arc.toFixed(1) + "'"); }
}
console.log('Corwin vs wiki-Messier: ok(<2\') =', ok, ' bad =', bad, big.join(' '));
for (const nm of ['NGC 1435', 'NGC 2505', 'NGC 6205']) {
  const c = corwin[nm];
  console.log(nm, c ? c.ra.toFixed(4) + '° ' + c.dec.toFixed(4) + '°  q=' + c.q + ' e=(' + (c.era ?? '-') + ',' + (c.ede ?? '-') + '")' : 'MISSING');
}

/* ---- selection ---- */
const messierOf = {};
for (const m of Object.values(wiki)) if (m.ngc) messierOf[m.ngc] = m.id;
const bright = [], faint = [];
const typeCount = {};
for (const s of Object.values(sinnott)) {
  if (!['OC', 'Gb', 'Nb', 'Pl'].includes(s.type)) continue;
  const c = corwin[s.name];
  if (!c) continue;
  typeCount[s.type] = (typeCount[s.type] || 0) + 1;
  const isM = messierOf[s.name] || null;
  const row = { ...s, ra: c.ra, dec: c.dec, q: c.q, era: c.era, ede: c.ede, m: isM, name: wiki[isM] && wiki[isM].name ? wiki[isM].name : s.name, size: s.size || (wiki[isM] && wiki[isM].size ? wiki[isM].size : 0) };
  if (s.mag <= 9.5 || isM) bright.push(row);
  else if (s.mag <= 12.5) faint.push(row);
}
console.log('\ntype counts (with Corwin position):', typeCount);
console.log('bright:', bright.length, ' faint:', faint.length);
const bc = {}, fc = {};
for (const s of bright) bc[s.type] = (bc[s.type] || 0) + 1;
for (const s of faint) fc[s.type] = (fc[s.type] || 0) + 1;
console.log('bright by type:', bc, ' faint by type:', fc);
const mplaced = bright.filter(s => s.m).length;
const mtotal = Object.keys(messierOf).length;
console.log('Messier DSOs placed:', mplaced, 'of', mtotal, 'catalog xrefs');
const missing = Object.entries(wiki).filter(([, m]) => m.ngc && !sinnott[m.ngc]).map(([k]) => k);
console.log('Messier without Sinnott type row:', missing.join(',') || '(none)');
const sizes = bright.map(s => s.size).filter(v => v > 0);
console.log('bright size range (arcmin):', Math.min(...sizes).toFixed(1), '-', Math.max(...sizes).toFixed(1), ' without size:', bright.filter(s => !(s.size > 0)).length);
fs.writeFileSync(B + 'dso2-bright.json', JSON.stringify(bright, null, 0));
fs.writeFileSync(B + 'dso2-faint.json', JSON.stringify(faint, null, 0));
console.log('\nsample bright rows:');
for (const s of bright.slice(0, 10)) console.log(' ', s.name.padEnd(22), s.type, 'mag=' + s.mag, 'size=' + s.size, s.ra.toFixed(3) + '° ' + s.dec.toFixed(3) + '°', s.m || '');
