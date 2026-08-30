/* fetch-dso.mjs — pull the Messier table (Wikipedia) + nearest-galaxies list,
 * parse rows, keep galaxies only, emit dso-raw.tsv
 * columns: id, name, ra_deg, dec_deg, mag, type, major_arcmin, minor_arcmin, dist_mly, notes
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

const strip = h => h.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, m =>
  ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&deg;': '°', '&plusmn;': '±', '&micro;': 'µ', '&frac12;': '½' }[m] ?? ' '));
const cells = row => {
  const out = [];
  const re = /<(?:td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/td>|<\/th>)/g;
  let m;
  while ((m = re.exec(row))) out.push(strip(m[1]).trim());
  return out;
};

function raToDeg(s) {
  const m = s.match(/(\d{1,2})\s*h\s*(\d{1,2})\s*m?\s*([\d.]+)?\s*s?/);
  if (!m) return null;
  return (+m[1] + (+m[2] || 0) / 60 + (parseFloat(m[3] || 0)) / 3600) * 15;
}
function decToDeg(s) {
  const m = s.match(/([+\-])\s*(\d{1,2})\s*[°º]\s*(\d{1,2})\s*[′'’]?\s*([\d.]+)?/);
  if (!m) return null;
  const v = +m[2] + (+m[3] || 0) / 60 + (parseFloat(m[4] || 0)) / 3600;
  return m[1] === '-' ? -v : v;
}
function sizeToArcmin(s) {
  // "178 × 58", "1.7 × 1.1" (degrees when marked), "12"
  let t = s.replace(/[°ºdeg]+/gi, ' ').replace(/,/g, '').trim();
  const parts = t.split(/[x×~±]\s*/i).map(x => parseFloat(x.replace(/[°º]/g, ''))).filter(x => isFinite(x));
  if (!parts.length) return null;
  let a = Math.max(...parts), b = Math.min(...parts);
  const isDeg = /[°º]|degree/i.test(s);
  if (isDeg) { a *= 60; b *= 60; }
  if (a < 1) { a *= 60; b *= 60; } // given in degrees without the degree sign
  return [a, b];
}

function isGalaxy(type) {
  const t = (type || '').trim().toUpperCase();
  if (!t) return false;
  if (['OC', 'PN', 'DN', 'DSN', 'SN', 'SNR', 'GN', 'OCN', 'OB', 'HII', 'HII/OC', 'PN/GN', 'OC/PN'].includes(t)) return false;
  if (/^GN/.test(t) || /CLUSTER/i.test(t) || /^SN/.test(t)) return false;
  if (/^IRR/.test(t)) return true;
  if (/^G(A)?$/i.test(t)) return true;
  if (/^E\d{0,2}(-|S)?$/i.test(t)) return true;
  if (/^S(0|A|B|C|G|GP)/.test(t)) return true;
  if (/^SB?A?[cbsabc]/i.test(t)) return true;
  if (/^S\(/.test(t) || /^SB?\(/.test(t) || /^S0/.test(t)) return true;
  if (/S(C|B|A|G)/.test(t) && !/CLUSTER/i.test(t)) return true;
  return false;
}

/* ---- Messier table ---- */
const mw = await get('https://en.wikipedia.org/wiki/List_of_Messier_objects');
const rows = mw.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
const out = [];
for (const r of rows) {
  const c = cells(r);
  if (c.length < 7) continue;
  const name = c[0].replace(/\s+/g, ' ').trim();
  const m = name.match(/^M\s*(\d{1,3})\b/);
  if (!m) continue;
  const type = c[1] || '';
  const ra = raToDeg(c[2] || '');
  const dec = decToDeg(c[3] || '');
  const mag = parseFloat((c[4] || '').replace(/[^0-9.\-]/g, ''));
  const sz = sizeToArcmin(c[5] || '');
  if (ra == null || dec == null || !isFinite(mag)) continue;
  if (!isGalaxy(type)) continue;
  const id = 'M' + m[1];
  out.push({
    id, name: id, ra: +ra.toFixed(4), dec: +dec.toFixed(4),
    mag: +mag.toFixed(2), type: type.trim(),
    major: sz ? +sz[0].toFixed(1) : 10,
    minor: sz ? +Math.max(sz[1], sz[0] * 0.35).toFixed(1) : 10,
    dist: '', notes: c[7] || ''
  });
}
console.log('messier galaxies:', out.length);

/* ---- nearest-galaxies list (extra non-Messier, with distances) ---- */
try {
  const ng = await get('https://en.wikipedia.org/wiki/List_of_nearest_galaxies_to_Earth');
  const rows2 = ng.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const byName = new Map(out.map(o => [o.id, o]));
  let extra = 0;
  for (const r of rows2) {
    const c = cells(r);
    if (c.length < 5) continue;
    const nm = c[0].replace(/\s+/g, ' ').trim();
    const idm = nm.match(/^(NGC|IC|UGC|IC|IC)\s*(\d+)/) || nm.match(/^(NGC|IC)\s*(\d+)/);
    if (!idm) continue;
    const id = (idm[1] + ' ' + idm[2]).replace(/\s+/g, ' ');
    const ra = raToDec = raToDeg(c.find(x => /h\s*\d{1,2}m/.test(x)) || '');
    const dec = decToDeg(c.find(x => /^[+\-]/.test(x.trim()) && /[°º]/.test(x)) || '');
    if (ra == null || dec == null) continue;
    const magC = c.find(x => /^[\d.]+$/.test(x.trim()) && parseFloat(x) > 1 && parseFloat(x) < 15);
    const distC = c.find(x => /kpc|kly|mly|million|ly/.test(x.toLowerCase()));
    let dist = '';
    if (distC) {
      const km = distC.match(/([\d.]+)\s*(kpc|kly|mly|million light|parsecs)/i);
      if (km) dist = (+km[1] * (km[2].toLowerCase().startsWith('kpc') ? 3.26 : km[2].toLowerCase().includes('million') ? 1000 : km[2].toLowerCase().includes('kpc') ? 3.26 : 1)).toFixed(0);
    }
    const key = id;
    if (byName.has(key)) continue;
    const known = byName.get(id) || null;
    // distance from the list (light years)
    const dkm = (distC || '').match(/([\d,.]+)\s*(?:kly|mly|million light|ly|kpc|kpc)/i);
    let dly = '';
    if (dkm) {
      let n = parseFloat(dkm[1].replace(/,/g, ''));
      const u = dkm[2].toLowerCase();
      if (u.startsWith('kly')) dly = (n * 1000).toFixed(0);
      else if (u.startsWith('mly') || u.startsWith('million')) dly = (n * 1000000 / 1000).toFixed(0);
      else if (u === 'kpc' || u.includes('kpc')) dly = (n * 3.26 * 1000).toFixed(0);
      else dly = n.toFixed(0);
    }
    out.push({
      id, name: id, ra: +ra.toFixed(4), dec: +dec.toFixed(4),
      mag: magC ? parseFloat(magC) : '', type: '', major: 8, minor: 5,
      dist: dly, notes: ''
    });
    extra++;
  }
  console.log('extra galaxies:', extra);
} catch (e) { console.log('nearest-galaxies fetch failed:', e.message); }

/* ---- emit ---- */
fs.writeFileSync(new URL('./dso-raw.tsv', import.meta.url),
  out.map(o => [o.id, o.name, o.ra, o.dec, o.mag, o.type, o.major, o.minor, o.dist, o.notes.replace(/\t/g, ' ')].join('\t')).join('\n'));
console.log('total galaxies:', out.length);
console.log('sample:', out.slice(0, 5).map(o => `${o.id} ${o.ra.toFixed(2)},${o.dec.toFixed(2)} m${o.mag} ${o.type} ${o.major}'`));
const m31 = out.find(o => o.id === 'M31');
console.log('M31 check:', JSON.stringify(m31));
