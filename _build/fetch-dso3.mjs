/* fetch-dso3.mjs — final DSO fetch: Messier galaxies + nearest-galaxies extras
 * emits dso-raw.tsv: id \t name \t ra \t dec \t mag \t type \t major' \t minor' \t dist_kly
 */
import https from 'node:https';
import fs from 'node:fs';

const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => res(d));
  }).on('error', rej);
});

const stripTags = h => h
  .replace(/data-mw='[^']*'/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&deg;/g, '°').replace(/&prime;/g, '′').replace(/&Prime;/g, '″')
  .replace(/&times;/g, '×').replace(/&plusmn;/g, '±')
  .replace(/\s+/g, ' ').trim();

function raToDeg(s) {
  const m = (s || '').match(/(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*([\d.]+)?\s*s/i);
  if (!m) return null;
  return (+m[1] + (+m[2]) / 60 + (parseFloat(m[3] || 0)) / 3600) * 15;
}
function decToDeg(s) {
  const m = (s || '').match(/([+\-])\s*(\d{1,2})\s*[°º]\s*(\d{1,2})\s*′?\s*([\d.]+)?/);
  if (!m) return null;
  const v = +m[2] + (+m[3] || 0) / 60 + (parseFloat(m[4] || 0)) / 3600;
  return m[1] === '-' ? -v : v;
}
function sizeToArcmin(s) {
  const t = (s || '').replace(/[°º]/g, ' ').replace(/,/g, ' ');
  const parts = t.split(/[x×~–-]\s*/i).map(x => parseFloat(x)).filter(x => isFinite(x));
  if (!parts.length) return null;
  let a = Math.max(...parts), b = Math.min(...parts);
  if (a < 0.6) { a *= 60; b *= 60; }
  return [a, b];
}
function distKly(s) {
  if (!s) return '';
  const m = String(s).replace(/,/g, '').match(/([\d.]+)\s*(kly|mly|kpc|ly|lyr)/i);
  if (!m) return '';
  const n = +m[1], u = m[2].toLowerCase();
  if (u === 'kly' || u === 'ly' || u === 'lyr') return String(n);
  if (u === 'mly') return String(Math.round(n * 1000));
  if (u === 'kpc') return String(Math.round(n * 3.26));
  return '';
}
function cellsOf(r) {
  const re = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const cc = [];
  while ((m = re.exec(r))) cc.push(m[2]);
  return cc;
}

/* ---------- Messier ---------- */
const mw = await get('https://en.wikipedia.org/wiki/List_of_Messier_objects');
const ti = mw.indexOf('id="mwuw"');
const tbl = mw.slice(mw.lastIndexOf('<table', ti), mw.indexOf('</table>', ti));
const GAL = new Set(['GS', 'GSB', 'GE', 'GED']);
const out = [];
for (const r of tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
  const idm = r.match(/>(M\d{1,3})</);
  if (!idm) continue;
  const cc = cellsOf(r);
  if (cc.length < 11) continue;
  const code = (cc[4].match(/data-sort-value=\\"([A-Z]+)\\"/) || [])[1];
  if (!GAL.has(code || '')) continue;
  const ra = raToDeg(stripTags(cc[9]));
  const dec = decToDeg(stripTags(cc[10]));
  const mag = parseFloat(stripTags(cc[7]));
  if (ra == null || dec == null || !isFinite(mag)) continue;
  const sz = sizeToArcmin(stripTags(cc[8]));
  out.push({
    id: idm[1], name: stripTags(cc[2]) || idm[1], ra: +ra.toFixed(4), dec: +dec.toFixed(4),
    mag: +mag.toFixed(2), type: stripTags(cc[4]), major: sz ? +sz[0].toFixed(1) : 12,
    minor: sz ? +Math.max(sz[1], sz[0] * 0.4).toFixed(1) : 6,
    dist: distKly(stripTags(cc[5]))
  });
}
console.log('messier galaxies:', out.length);

/* ---------- nearest galaxies (extras) ---------- */
try {
  const ng = await get('https://en.wikipedia.org/wiki/List_of_nearest_galaxies_to_Earth');
  const t2 = ng.indexOf('<table');
  const block = ng.slice(t2, ng.indexOf('</table>', t2));
  const have = new Set(out.map(o => o.id.toUpperCase()));
  let extra = 0;
  for (const r of block.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cc = cellsOf(r).map(stripTags);
    if (cc.length < 4) continue;
    const idm = cc[0].match(/^(NGC|IC|UGC)\s*(\d+)/i);
    if (!idm) continue;
    const id = (idm[1] + ' ' + idm[2]).toUpperCase();
    if (have.has(id)) continue;
    const raC = cc.find(x => /\d{1,2}\s*h\s*\d{1,2}/.test(x));
    const decC = cc.find(x => /^[+\-]/.test(x) && /[°º′]/.test(x));
    const ra = raToDeg(raC || ''), dec = decToDeg(decC || '');
    if (ra == null || dec == null) continue;
    const magC = cc.find(x => /^[\d.]+$/.test(x) && +x > 0.5 && +x < 16);
    const dC = cc.find(x => /(kly|mly|kpc|\bly\b|lyr|million)/i.test(x));
    out.push({
      id, name: cc[0].trim(), ra: +ra.toFixed(4), dec: +dec.toFixed(4),
      mag: magC ? parseFloat(magC) : '', type: '',
      major: 8, minor: 5, dist: distKly(dC || '')
    });
    have.add(id); extra++;
  }
  console.log('extra galaxies:', extra);
} catch (e) { console.log('nearest-galaxies failed:', e.message); }

fs.writeFileSync(new URL('./dso-raw.tsv', import.meta.url),
  out.map(o => [o.id, o.name, o.ra, o.dec, o.mag, o.type, o.major, o.minor, o.dist].join('\t')).join('\n'));
console.log('total:', out.length);
console.log('M31:', JSON.stringify(out.find(o => o.id === 'M31')));
console.log('M33:', JSON.stringify(out.find(o => o.id === 'M33')));
console.log('M51:', JSON.stringify(out.find(o => o.id === 'M51')));
console.log('extras:', out.filter(o => o.id !== o.id.replace(/M\d+/,'') || !/^M\d+$/.test(o.id)).slice(0,5).map(o=>o.id+' m'+o.mag).join(' | '));
