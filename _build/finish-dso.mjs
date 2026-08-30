/* finish-dso.mjs — assemble dso-final.json
 *  1) 35 Messier galaxies re-parsed locally (dist from data-sort-value, in kly)
 *  2) previously-fetched NGC/IC extras kept, with invalid distances sanitized
 *  3) any still-missing wanted NGC objects re-fetched (slow, dual infobox style)
 */
import https from 'node:https';
import fs from 'node:fs';

const UA = { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' };
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: UA }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const raToDeg = s => {
  const m = (s || '').match(/(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*([\d.]+)?\s*s/i);
  return m ? +((+m[1] + (+m[2]) / 60 + (parseFloat(m[3] || 0)) / 3600) * 15).toFixed(4) : null;
};
const decToDeg = s => {
  const m = (s || '').replace(/[\u2212]/g, '-').match(/([+\-])\s*(\d{1,2})\s*[°º]\s*(\d{1,2})\s*[′']?\s*([\d.]+)?/);
  if (!m) return null;
  const v = +m[2] + (+m[3] || 0) / 60 + (parseFloat(m[4] || 0)) / 3600;
  return +((m[1] === '-' ? -1 : 1) * v).toFixed(4);
};
const sizeArcmin = s => {
  if (!s) return null;
  const deg = /[°º]/.test(s);
  const parts = s.replace(/[°º]/g, ' ').replace(/,/g, ' ').split(/[x×~–-]\s*/i).map(x => parseFloat(x)).filter(isFinite);
  if (!parts.length) return null;
  let a = Math.max(...parts), b = Math.min(...parts);
  if (deg || a < 0.6) { a *= 60; b *= 60; }
  return [a, b];
};

/* ---------------- 1) Messier, local html ---------------- */
const d = fs.readFileSync(new URL('./messier.html', import.meta.url), 'utf8');
const ti = d.indexOf('id="mwuw"');
const tbl = d.slice(d.lastIndexOf('<table', ti), d.indexOf('</table>', ti));
const GAL = { GS: 'Spiral galaxy', GSB: 'Barred spiral galaxy', GE: 'Elliptical galaxy', GED: 'Dwarf elliptical galaxy' };
const stripT = h => h.replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
const out = new Map();
let mm = 0;
for (const r of tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
  const idm = r.match(/>(M\d{1,3})</);
  if (!idm) continue;
  const re = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const cc = [];
  while ((m = re.exec(r))) cc.push(m[2]);
  if (cc.length < 11) continue;
  const code = (cc[4].match(/data-sort-value=\\"([A-Z]+)\\"/) || [])[1];
  if (!GAL[code]) continue;
  const ra = raToDeg(stripT(cc[9]));
  const dec = decToDeg(stripT(cc[10]));
  const mag = parseFloat(stripT(cc[7]));
  if (ra == null || dec == null || !isFinite(mag)) continue;
  const sz = sizeArcmin(stripT(cc[8]));
  const dkly = parseInt((cc[5].replace(/\\/g, '').match(/data-sort-value="(\d+)"/) || [])[1] || '0', 10);
  out.set(idm[1], {
    id: idm[1], name: stripT(cc[2]) || idm[1],
    ra, dec, mag: +mag.toFixed(2), type: GAL[code],
    major: sz ? +sz[0].toFixed(1) : 12,
    minor: sz ? +Math.max(sz[1], sz[0] * 0.4).toFixed(1) : 6,
    dist: dkly ? +(dkly / 1000).toFixed(1) : ''
  });
  mm++;
}
console.log('messier galaxies:', mm);

/* ---------------- 2) keep prior extras, sanitize invalid distances ---------------- */
const WANTED = ['NGC 253', 'NGC 4565', 'NGC 4414', 'NGC 4631', 'NGC 4656', 'NGC 4639',
  'NGC 4622', 'NGC 4312', 'NGC 2997', 'NGC 3628', 'NGC 4826', 'NGC 1300',
  'NGC 5128', 'NGC 1566', 'NGC 3310', 'NGC 2403', 'NGC 45', 'NGC 300',
  'NGC 4945', 'NGC 55', 'NGC 3627', 'NGC 3629', 'NGC 2841', 'NGC 1316',
  'NGC 3384', 'NGC 4490', 'NGC 2770', 'NGC 1365'];
let prev = [];
try { prev = JSON.parse(fs.readFileSync(new URL('./dso-final.json', import.meta.url), 'utf8')); } catch { prev = []; }
const badDist = v => v === '' || v == null || (typeof v === 'string' && /^0(\.0+)?$/.test(v));
for (const o of prev) {
  if (!o.id || o.id.startsWith('M')) continue;
  if (out.has(o.id)) continue;
  out.set(o.id, { ...o, dist: badDist(o.dist) ? '' : o.dist });
}

/* ---------------- 3) fetch anything still missing ---------------- */
function raOf(w) {
  let m = w.match(/\bra\s*=\s*\{\{\s*RA\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*([\d.]+)/i);
  if (m) return +((+m[1] + (+m[2]) / 60 + (+m[3]) / 3600) * 15).toFixed(4);
  m = w.match(/\b(?:ra|right[_ ]?ascension)\s*=\s*(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*([\d.]+)?\s*s/i);
  return m ? +((+m[1] + (+m[2]) / 60 + (parseFloat(m[3] || 0)) / 3600) * 15).toFixed(4) : null;
}
function decOf(w) {
  let m = w.match(/\bdec\s*=\s*\{\{\s*DEC?\s*\|\s*([+\-]?)\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*([\d.]+)?/i);
  if (m) { const v = +m[2] + (+m[3]) / 60 + (parseFloat(m[4] || 0)) / 3600; return +(((m[1] || '+') === '-') ? -v : v).toFixed(4); }
  const m2 = w.match(/\bdec\s*=\s*([+\-])\s*(\d{1,2})\s*[°º]\s*(\d{1,2})\s*[′']?\s*([\d.]+)?/i);
  return m2 ? decToDeg(m2[0]) : null;
}
function sizeV(w) {
  const line = ((w.match(/\bsize_v\s*=[^\n]*/i) || [])[0]) || '';
  if (!line) return null;
  let a = '', b = '';
  const val = line.match(/\{\{Val\|([\d.]+)\|×\|([\d.]+)/i);
  if (val) { a = val[1]; b = val[2]; }
  else {
    const nums = [...line.matchAll(/([\d.]+)′(?:\.?([\d.]+))?/g)].map(x => +(x[1] + '.' + (x[2] || 0)));
    if (nums.length >= 2) { a = nums[0]; b = nums[1]; }
  }
  if (!a) return null;
  return [+parseFloat(a).toFixed(1), +parseFloat(b || (+a * 0.4)).toFixed(1)];
}
function distMly(w) {
  const line = ((w.match(/\bdist_ly\s*=[^\n]*/i) || [])[0]) || '';
  if (!line) return '';
  let m = line.match(/\{\{convert\|\s*([\d.]+)/i);
  if (m) {
    const n = +m[1];
    const u = (line.match(/\{\{convert\|[^\n|]*\|([A-Za-z]+)/i) || [])[1] || '';
    if (/^Mpc/i.test(u)) return (n * 3.262).toFixed(1);
    if (/^Mly/i.test(u)) return n.toFixed(1);
    if (/^kpc/i.test(u)) return (n * 3.262 / 1000).toFixed(2);
  }
  const clean = line
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ');
  m = clean.match(/([\d.]+)\s*(?:±\s*[\d.]+\s*)?(Mly|Mpc|kly|kpc|ly)\b/i);
  if (!m) return '';
  const n = +m[1], u = m[2].toLowerCase();
  if (u === 'mly') return n.toFixed(1);
  if (u === 'mpc') return (n * 3.262).toFixed(1);
  if (u === 'kly') return (n / 1000).toFixed(2);
  if (u === 'kpc') return (n * 3.262 / 1000).toFixed(2);
  return (n / 1e6).toFixed(3);
}
const wikiPage = async title => {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=' +
    encodeURIComponent(title) + '&prop=revisions&rvprop=content';
  for (let i = 0; i < 3; i++) {
    const s = await get(url);
    try {
      const j = JSON.parse(s);
      const p = j.query && j.query.pages && j.query.pages[0];
      if (p && p.revisions && p.revisions[0]) return p.revisions[0].content;
      return null;
    } catch { await sleep(6000); }
  }
  return null;
};

const missing = WANTED.filter(t => !out.has(t.toUpperCase()));
let ok = 0;
for (const t of missing) {
  try {
    const w = await wikiPage(t);
    if (!w) { console.log('no wikitext:', t); continue; }
    const ra = raOf(w), dec = decOf(w);
    if (ra == null || dec == null) { console.log('no ra/dec:', t); continue; }
    if ([...out.values()].some(o => Math.hypot(o.ra - ra, o.dec - dec) < 0.02)) { console.log('dupe (Messier eq):', t); continue; }
    const mag = (w.match(/\bappmag_v\s*=\s*([\d.]+)/i) || [])[1] ||
      (w.match(/\bmagnitude\s*=\s*([\d.]+)/i) || [])[1] || '';
    const typem = ((w.match(/\btype\s*=\s*([^\n<|{]+)/i) || [])[1] || '').trim();
    const sz = sizeV(w);
    out.set(t.toUpperCase(), {
      id: t.toUpperCase(), name: t, ra, dec,
      mag: mag ? +mag : '', type: typem || 'Galaxy',
      major: sz ? sz[0] : 10, minor: sz ? sz[1] : 5,
      dist: distMly(w)
    });
    ok++;
    console.log('+', t, ra, dec, 'm' + mag, typem, sz ? sz.join('×') : '', 'Mly:' + distMly(w));
    await sleep(4000);
  } catch (e) { console.log('skip', t, e.message); }
}
console.log('recovered extras:', ok, 'of', missing.length, 'missing');

const all = [...out.values()];
fs.writeFileSync(new URL('./dso-final.json', import.meta.url), JSON.stringify(all, null, 1));
console.log('TOTAL:', all.length);
console.log('M31:', JSON.stringify(all.find(o => o.id === 'M31')));
console.log('NGC 253:', JSON.stringify(all.find(o => o.id === 'NGC 253')));
console.log('NGC 4565:', JSON.stringify(all.find(o => o.id === 'NGC 4565')));
