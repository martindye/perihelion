/* fetch-dso2.mjs — parse the Messier table (correct column layout) + nearest galaxies */
import https from 'node:https';
import fs from 'node:fs';

const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => res(d));
  }).on('error', rej);
});

const strip = h => h
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&deg;|°/g, '°').replace(/&prime;/g, '′').replace(/&Prime;/g, '″')
  .replace(/&times;|×/g, '×').replace(/&plusmn;/g, '±').replace(/&frac12;/g, '½')
  .replace(/[ \t]+/g, ' ').trim();

function cellRe() { return /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g; }

function raToDeg(s) {
  const m = s.match(/(\d{1,2})\s*h(?:ours?)?\s*(\d{1,2})\s*m(?:in)?:?\s*([\d.]+)?\s*s?/i);
  if (!m) return null;
  return (+m[1] + (+m[2]) / 60 + (parseFloat(m[3] || 0)) / 3600) * 15;
}
function decToDeg(s) {
  const m = s.match(/([+\-])\s*(\d{1,2})\s*[°º]\s*(\d{1,2})\s*′?\s*([\d.]+)?/);
  if (!m) return null;
  const v = +m[2] + (+m[3] || 0) / 60 + (parseFloat(m[4] || 0)) / 3600;
  return m[1] === '-' ? -v : v;
}
function sizeToArcmin(s) {
  const t = (s || '').replace(/[°º]/g, ' ').replace(/,/g, ' ');
  const parts = t.split(/[x×~–-]\s*/i).map(x => parseFloat(x)).filter(x => isFinite(x));
  if (!parts.length) return null;
  let a = Math.max(...parts), b = Math.min(...parts);
  if (a < 0.5) { a *= 60; b *= 60; } // given in degrees
  return [a, b];
}
function distToKly(s) {
  if (!s) return '';
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*(mly|million|kly|kpc|ly|lyr)/i);
  if (!m) return '';
  const n = +m[1]; const u = m[2].toLowerCase();
  if (u.startsWith('mly') || u.startsWith('million')) return (n * 1000).toFixed(0);
  if (u === 'kly') return n.toFixed(0);
  if (u === 'kpc') return (n * 3.26).toFixed(0);
  return '';
}
function isGalaxy(type) {
  const t = (type || '').trim().toUpperCase();
  if (!t) return false;
  if (/^(IRR|SGP)/.test(t)) return true;
  if (/^G(A|A\()?$/.test(t)) return true;                       // GA, G
  if (/^G[A-Z]*\(/.test(t)) return true;                        // GA(,
  if (/^E\d{0,2}([S-]?\d?)?$/.test(t)) return true;             // E, E0-E7
  if (/^S0/.test(t)) return true;                               // S0
  if (/^S(B|A|C|G|GP)?\s*\(?/.test(t) && !/^SN/.test(t)) return true;
  if (/^SB?A?[cbsabc]\(/.test(t)) return true;
  return false;
}

const mw = await get('https://en.wikipedia.org/wiki/List_of_Messier_objects');
const ti = mw.indexOf('id="mwuw"');
const t0 = mw.lastIndexOf('<table', ti);
const t1 = mw.indexOf('</table>', ti);
const tbl = mw.slice(t0, t1);
const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

const out = [];
for (const r of rows) {
  const cc = [];
  const re = cellRe(); let m;
  while ((m = re.exec(r))) cc.push(strip(m[2]));
  if (cc.length < 10) continue;
  const idm = cc[0].match(/M\s*(\d{1,3})/);
  if (!idm) continue;
  const id = 'M' + idm[1];
  const type = cc[4] || '';
  if (!isGalaxy(type)) continue;
  const ra = raToDeg(cc[9] || '');
  const dec = decToDeg(cc[10] || '');
  const mag = parseFloat(cc[7]);
  if (ra == null || dec == null || !isFinite(mag)) continue;
  const sz = sizeToArcmin(cc[8] || '');
  out.push({
    id, name: cc[2] || id, ra: +ra.toFixed(4), dec: +dec.toFixed(4),
    mag: +mag.toFixed(2), type: type.trim(),
    major: sz ? +sz[0].toFixed(1) : 12, minor: sz ? +Math.max(sz[1], sz[0] * 0.4).toFixed(1) : 6,
    dist: distToKly(cc[5]), notes: ''
  });
}
console.log('messier galaxies:', out.length);

/* nearest-galaxies list: extra non-Messier */
try {
  const ng = await get('https://en.wikipedia.org/wiki/List_of_nearest_galaxies_to_Earth');
  const t2 = ng.indexOf('<table');
  const t3 = ng.indexOf('</table>', t2);
  if (t2 > 0 && t3 > 0) {
    const rows2 = ng.slice(t2, t3).match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    let extra = 0;
    const have = new Set(out.map(o => o.id));
    for (const r of rows2) {
      const cc = [];
      const re = cellRe(); let m;
      while ((m = re.exec(r))) cc.push(strip(m[2]));
      if (cc.length < 4) continue;
      const nm = cc[0].replace(/\s+/g, ' ').trim();
      const idm = nm.match(/^(NGC|IC|UGC)\s*(\d+)/);
      if (!idm) continue;
      const id = idm[1] + ' ' + idm[2];
      if (have.has(id)) continue;
      const raCell = cc.find(x => /\d{1,2}\s*h/.test(x));
      const decCell = cc.find(x => /^[+\-]/.test(x.trim()) && /[°º]/.test(x));
      if (!raCell || !decCell) continue;
      const ra = raToDeg(raCell), dec = decToDeg(decCell);
      if (ra == null || dec == null) continue;
      const magCell = cc.find(x => /^[+\-]?\d{1,2}(\.\d+)?$/.test(x.trim()) && +x > 0.5 && +x < 15);
      const dCell = cc.find(x => /(kly|mly|kpc|million|ly\b|lyr)/i.test(x));
      out.push({
        id, name: id, ra: +ra.toFixed(4), dec: +dec.toFixed(4),
        mag: magCell ? parseFloat(magCell) : '', type: '', major: 10, minor: 6,
        dist: distToKly(dCell || ''), notes: ''
      });
      have.add(id); extra++;
    }
    console.log('extra galaxies:', extra);
  }
} catch (e) { console.log('nearest-galaxies failed:', e.message); }

fs.writeFileSync(new URL('./dso-raw.tsv', import.meta.url),
  out.map(o => [o.id, o.name, o.ra, o.dec, o.mag, o.type, o.major, o.minor, o.dist].join('\t')).join('\n'));
console.log('total:', out.length);
console.log('sample:', out.slice(0, 3).map(o => `${o.id} ${o.ra.toFixed(2)},${o.dec.toFixed(2)} m${o.mag} [${o.type}] ${o.major}'`).join(' | '));
console.log('M31:', JSON.stringify(out.find(o => o.id === 'M31')));
console.log('M33:', JSON.stringify(out.find(o => o.id === 'M33')));
console.log('M51:', JSON.stringify(out.find(o => o.id === 'M51')));
