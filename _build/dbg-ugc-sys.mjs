import fs from 'node:fs';
import { PRECESSION_B1950_TO_J2000 as PR } from './precession.mjs';
const D = new URL('./', import.meta.url);
const read = f => fs.readFileSync(new URL(f, D), 'utf8');
const DEG = Math.PI / 180;
const eq2u = (ra, d) => { const a = ra * DEG, dc = d * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };
const u2eq = v => { let ra = Math.atan2(v[1], v[0]) / DEG; if (ra < 0) ra += 360; return [ra, Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG]; };
const rot = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const b1950toJ2000 = (ra, d) => u2eq(rot(PR, eq2u(ra, d)));
const angSep = (ra1, d1, ra2, d2) => { const u1 = eq2u(ra1, d1), u2 = eq2u(ra2, d2); return Math.acos(Math.max(-1, Math.min(1, u1[0]*u2[0] + u1[1]*u2[1] + u1[2]*u2[2]))) / DEG; };
const cellsOf = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const parseRA = s => { const t = s.split(/\s+/).map(Number); return t.length === 2 ? (t[0] + t[1] / 60) * 15 : (t[0] + t[1] / 60 + t[2] / 3600) * 15; };
const parseDEC = s => { const neg = s.startsWith('-'); const t = s.replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };

const ngcXml = read('ngc-vii118.xml');
const ngcic = [];
for (const tr of ngcXml.match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 12) continue;
  const name = (r[1] || '').replace(/\s+/g, '');
  if (!/^(I\d{1,5}|\d{1,4})$/.test(name)) continue;
  const ra = parseRA(r[3]), dec = parseDEC(r[4]);
  if (Number.isNaN(ra) || Number.isNaN(dec)) continue;
  ngcic.push([ra, dec]);
}
const ugcXml = read('ugc-vii26d.xml');
const ugc = [];
for (const tr of ugcXml.match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 11) continue;
  const raB = parseRA(r[3]), dB = parseDEC(r[4]);
  if (Number.isNaN(raB) || Number.isNaN(dB)) continue;
  ugc.push(b1950toJ2000(raB, dB));
}
/* all UGC -> nearest NGC/IC, collect offset sign distribution for pairs < 60" */
let n = 0, sRA = 0, sDE = 0, nRApos = 0, nDEpos = 0;
const step = 1;
for (let i = 0; i < ugc.length; i += step) {
  const [ra, dec] = ugc[i];
  let best = 1e9, bj = -1;
  for (let j = 0; j < ngcic.length; j++) {
    const [ra2, dec2] = ngcic[j];
    if (Math.abs(ra2 - ra) > 0.5 || Math.abs(dec2 - dec) > 0.5) continue;
    const d = angSep(ra, dec, ra2, dec2);
    if (d < best) { best = d; bj = j; }
  }
  if (best >= 60 / 3600) continue; // only pairs < 60"
  n++;
  const [ra2, dec2] = ngcic[bj];
  let dra = (ra2 - ra) * 3600 * Math.cos(dec * DEG);
  const dde = (dec2 - dec) * 3600;
  sRA += dra; sDE += dde;
  if (dra > 0) nRApos++; if (dde > 0) nDEpos++;
}
console.log('pairs < 60":', n);
console.log('mean dRA =', (sRA / n).toFixed(2), '"  (pos', nRApos, '/', n, ')');
console.log('mean dDE =', (sDE / n).toFixed(2), '"  (pos', nDEpos, '/', n, ')');
