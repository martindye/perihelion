/* fetch-dso4.mjs — final: Messier galaxies (Wikipedia list) + curated famous NGC
 * galaxies (individual infoboxes via the MediaWiki API). Emits dso-final.json
 */
import https from 'node:https';
import fs from 'node:fs';

const UA = { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch; contact: local)' };
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: UA }, r => {
    let d = '';
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location).then(res, rej); }
    r.on('data', c => d += c);
    r.on('end', () => res(d));
  }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const norm = s => (s || '').replace(/[\u2212\u2013\u2014]/g, '-');
function raToDeg(s) {
  const m = (s || '').match(/(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*([\d.]+)?\s*s/i);
  if (!m) return null;
  return +((+m[1] + (+m[2]) / 60 + (parseFloat(m[3] || 0)) / 3600) * 15).toFixed(4);
}
function decToDeg(s) {
  const m = norm(s || '').match(/([+\-])\s*(\d{1,2})\s*[°º]\s*(\d{1,2})\s*[′']?\s*([\d.]+)?/);
  if (!m) return null;
  const v = +m[2] + (+m[3] || 0) / 60 + (parseFloat(m[4] || 0)) / 3600;
  return +((m[1] === '-' ? -v : v)).toFixed(4);
}
function magOf(s) {
  const m = (s || '').match(/-?[\d.]+/);
  return m ? +parseFloat(m[0]).toFixed(2) : '';
}
function sizeArcmin(s) {
  if (!s) return null;
  const deg = /[°º]/.test(s);
  const parts = s.replace(/[°º]/g, ' ').replace(/,/g, ' ').split(/[x×~–\-]\s*/i).map(x => parseFloat(x)).filter(isFinite);
  if (!parts.length) return null;
  let a = Math.max(...parts), b = Math.min(...parts);
  if (deg || a < 0.6) { a *= 60; b *= 60; }
  return [a, b];
}

const out = new Map();

/* ---------------- 1) Messier galaxies from the list page ---------------- */
const mw = await get('https://en.wikipedia.org/wiki/List_of_Messier_objects');
const ti = mw.indexOf('id="mwuw"');
const tbl = mw.slice(mw.lastIndexOf('<table', ti), mw.indexOf('</table>', ti));
const GAL = { GS: 'Spiral galaxy', GSB: 'Barred spiral galaxy', GE: 'Elliptical galaxy', GED: 'Dwarf elliptical galaxy' };
const stripT = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
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
  const mag = magOf(stripT(cc[7]));
  if (ra == null || dec == null || mag === '') continue;
  const sz = sizeArcmin(stripT(cc[8]));
  const dm = (stripT(cc[5]).match(/[\d.]+/g) || []).map(Number);
  const dkly = dm.length ? dm.reduce((s, x) => s + x, 0) / dm.length : 0;
  out.set(idm[1], {
    id: idm[1], name: stripT(cc[2]) || idm[1],
    ra, dec, mag,
    type: GAL[code],
    major: sz ? +sz[0].toFixed(1) : 12,
    minor: sz ? +Math.max(sz[1], sz[0] * 0.4).toFixed(1) : 6,
    dist: dkly ? +(dkly / 1000).toFixed(1) : ''   // kly -> Mly
  });
  mm++;
}
console.log('messier galaxies:', mm);

/* ---------------- 2) curated famous NGC/IC via infobox wikitext ---------------- */
const EXTRA = [
  'NGC 253', 'NGC 4565', 'NGC 4414', 'NGC 4631', 'NGC 4656', 'NGC 4639',
  'NGC 4622', 'NGC 4312', 'NGC 2997', 'NGC 3628', 'NGC 4826', 'NGC 1300',
  'NGC 5128', 'NGC 1566', 'NGC 3310', 'NGC 2403', 'NGC 45', 'NGC 300',
  'NGC 4945', 'NGC 55', 'NGC 3627', 'NGC 3629', 'NGC 2841', 'NGC 1316',
  'NGC 3384', 'NGC 4490', 'NGC 2770', 'NGC 1365', 'NGC 4945', 'NGC 4594'
];
const wikiPage = async title => {
  /* resolve redirects, then pull the wikitext of the canonical page */
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2' +
    '&redirects=1&titles=' + encodeURIComponent(title) + '&prop=revisions&rvprop=content';
  for (let i = 0; i < 3; i++) {
    const d = await get(url);
    try {
      const j = JSON.parse(d);
      const p = j.query && j.query.pages && j.query.pages[0];
      if (p && p.revisions && p.revisions[0]) return p.revisions[0].content;
      return null;
    } catch { /* rate-limited or HTML — back off */ }
    await sleep(5000);
  }
  return null;
};
/* ---- infobox parsers (Wikipedia "Infobox galaxy" field names) ---- */
function raOf(w) {
  const m = (w.match(/\bra\s*=\s*\{\{\s*RA\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*([\d.]+)/i) || []);
  if (!m[1]) return null;
  return +((+m[1] + (+m[2]) / 60 + (+m[3] || 0) / 3600) * 15).toFixed(4);
}
function decOf(w) {
  const m = (w.match(/\bdec\s*=\s*\{\{\s*DEC?\s*\|\s*([+\-]?)\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*([\d.]+)?/i) || []);
  if (!m[2]) return null;
  const v = +m[2] + (+m[3]) / 60 + (parseFloat(m[4] || 0)) / 3600;
  return +(((m[1] || '+') === '-') ? -v : v).toFixed(4);
}
function sizeV(w) {
  const line = ((w.match(/\bsize_v\s*=[^\n]*/i) || [])[0]) || '';
  if (!line) return null;
  let a = '', b = '';
  const val = line.match(/\{\{Val\|([\d.]+)\|×\|([\d.]+)/i);
  if (val) { a = val[1]; b = val[2]; }
  else {
    const nums = [...line.matchAll(/([\d.]+)′(?:\.?([\d.]+))?/g)].map(m => +(m[1] + '.' + (m[2] || 0)));
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
  const clean = line.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
  m = clean.match(/([\d.]+)\s*(?:±\s*[\d.]+\s*)?(?:\]|M|K|k)?\s*(Mly|Mpc|kly|kpc|ly)\b/i);
  if (!m) return '';
  const n = +m[1], u = m[2].toLowerCase();
  if (u === 'mly') return n.toFixed(1);
  if (u === 'mpc') return (n * 3.262).toFixed(1);
  if (u === 'kly') return (n / 1000).toFixed(2);
  if (u === 'kpc') return (n * 3.262 / 1000).toFixed(2);
  return (n / 1e6).toFixed(3);
}
let ex = 0;
for (const title of [...new Set(EXTRA)]) {
  try {
    const w = await wikiPage(title);
    if (!w) { console.log('no wikitext:', title); continue; }
    const ra = raOf(w), dec = decOf(w);
    if (ra == null || dec == null) { console.log('no ra/dec:', title); continue; }
    const dupe = [...out.values()].some(o => Math.hypot(o.ra - ra, o.dec - dec) < 0.02);
    if (dupe) { console.log('dupe of existing:', title); continue; }
    const mag = (w.match(/\bappmag_v\s*=\s*([\d.]+)/i) || [])[1] || '';
    const typem = ((w.match(/\btype\s*=\s*([^\n<|]+)/i) || [])[1] || '').trim();
    const sz = sizeV(w) || sizeV(w.replace(/size_v/g, 'size'));
    out.set(title.toUpperCase(), {
      id: title.toUpperCase(), name: title, ra, dec,
      mag: mag ? +mag : '',
      type: typem || 'Galaxy',
      major: sz ? sz[0] : 10, minor: sz ? sz[1] : 5,
      dist: distMly(w)
    });
    ex++;
    console.log('+', title, ra, dec, 'm' + mag, typem, sz ? sz.join('×') : '', 'Mly:' + distMly(w));
    await sleep(1500);
  } catch (e) { console.log('skip', title, e.message); }
}
console.log('extra galaxies:', ex);

const all = [...out.values()];
fs.writeFileSync(new URL('./dso-final.json', import.meta.url), JSON.stringify(all, null, 1));
console.log('total:', all.length);
console.log('M31:', JSON.stringify(all.find(o => o.id === 'M31')));
console.log('M33:', JSON.stringify(all.find(o => o.id === 'M33')));
console.log('NGC 253:', JSON.stringify(all.find(o => o.id === 'NGC 253')));
