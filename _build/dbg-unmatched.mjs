import fs from 'node:fs';
import { PRECESSION_B1950_TO_J2000 as PR } from './precession.mjs';
const D = new URL('./', import.meta.url);
const read = f => fs.readFileSync(new URL(f, D), 'utf8');
const DEG = Math.PI / 180;
const eq2u = (ra, d) => { const a = ra * DEG, dc = d * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };
const u2eq = v => { let ra = Math.atan2(v[1], v[0]) / DEG; if (ra < 0) ra += 360; return [ra, Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG]; };
const rot = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const b1950toJ2000 = (ra, d) => u2eq(rot(PR, eq2u(ra, d)));
const angSepDeg = (ra1, d1, ra2, d2) => { const u1 = eq2u(ra1, d1), u2 = eq2u(ra2, d2); return Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2]))) / DEG; };
const parseRA = s => { if (!s) return NaN; const t = s.trim().split(/\s+/).map(Number); if (t.length === 3) return (t[0] + t[1] / 60 + t[2] / 3600) * 15; if (t.length === 2) return (t[0] + t[1] / 60) * 15; return NaN; };
const parseDEC = s => { if (!s) return NaN; const neg = s.trim().startsWith('-'); const n = s.trim().replace(/^[+-]?/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((n[0] || 0) + (n[1] || 0) / 60 + (n[2] || 0) / 3600); };

const dsoSrc = read('../js/dso.js');
const curated = new Function('return (' + dsoSrc.slice(dsoSrc.indexOf('['), dsoSrc.lastIndexOf(']') + 1) + ');')();

const cellsOf = tr => { const cells = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const c = tr.indexOf('</TD>', s); cells.push(tr.slice(s, c).replace(/<[^>]+>/g, '').trim()); } return cells; };
const ngcXml = read('ngc-vii118.xml');
const ngcic = [];
for (const tr of ngcXml.match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 12 || !/^G[xb]$/i.test(r[2])) continue;
  const recno = parseInt(r[0], 10), name = (r[1] || '').replace(/\s+/g, '');
  let id = null;
  if (recno <= 7840) id = 'NGC ' + String(recno - 1).padStart(4, '0');
  else if (/^I(\d{1,5})$/.test(name)) id = 'IC ' + name.slice(1);
  else if (/^\d{1,5}$/.test(name)) id = 'IC ' + name;
  const ra = parseRA(r[3]), dec = parseDEC(r[4]);
  if (Number.isNaN(ra) || Number.isNaN(dec)) continue;
  ngcic.push({ id, ra, dec });
}
const ugcXml = read('ugc-vii26d.xml');
const ugc = [];
for (const tr of ugcXml.match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 11) continue;
  const raB = parseRA(r[3]), decB = parseDEC(r[4]);
  if (Number.isNaN(raB) || Number.isNaN(decB)) continue;
  const [ra, dec] = b1950toJ2000(raB, decB);
  ugc.push({ id: /^\d+$/.test((r[1] || '').trim()) ? 'UGC ' + r[1].trim() : null, ra, dec });
}

for (const c of curated) {
  let best = null, bd = 0.15;
  for (const g of ngcic) { const d = angSepDeg(c[1], c[2], g.ra, g.dec); if (d < bd) { bd = d; best = g; } }
  let src = 'NGC/IC';
  if (!best) { src = 'UGC'; for (const u of ugc) { const d = angSepDeg(c[1], c[2], u.ra, u.dec); if (d < bd) { bd = d; best = u; } } }
  if (!best) {
    let cb = null, cbd = 1e9;
    for (const g of [...ngcic, ...ugc]) { const d = angSepDeg(c[1], c[2], g.ra, g.dec); if (d < cbd) { cbd = d; cb = g; } }
    console.log('UNMATCHED', c[0], 'curated pos:', c[1].toFixed(4), c[2].toFixed(4), ' closest:', cb && cb.id, cb && cb.ra.toFixed(3), cb && cb.dec.toFixed(3), ' d=', cbd.toFixed(3), 'deg =', (cbd * 60).toFixed(1), 'arcmin');
  } else if (src === 'UGC') {
    console.log('via-UGC ', c[0], '->', best.id, ' d=', (bd * 60).toFixed(1), 'arcmin');
  }
}
