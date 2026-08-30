// Build the merged galaxy dataset for PERIHELION.
// Sources (all real, provenance preserved):
//   * js/dso.js          — 58 curated entries (Messier + famous NGC), modern J2000, rich metadata
//   * ngc-vii118.xml     — NGC 2000.0 (Sinnott 1988, VizieR VII/118): J2000 coords, V mag, size
//   * ugc-vii26d.xml     — Uppsala General Catalogue (Nilson 1973, VizieR VII/26D): B1950 coords
//                          (precessed to J2000 with a matrix fitted to 11,879 B1950->J2000 pairs
//                          from Corwin 2004, mean residual 3.6"), Hubble type, size, phot mag
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
const parseDEC = s => { if (!s) return NaN; const neg = s.trim().startsWith('-'); const t = s.trim().replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };
const num = s => { if (s == null) return null; s = String(s).trim(); if (!s) return null; const v = parseFloat(s); return Number.isFinite(v) ? v : null; };
const cellsOf = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };

/* tile/bv from hubble string (tile: 0 spiral, 1 barred, 2 elliptical, 3 irregular) */
function hubbleToTileBv(h) {
  const s = (h || '').toUpperCase().replace(/[\s:-]/g, '');
  if (!s || s === '?' || s === 'UB') return [0, 0.78];
  if (s.startsWith('E')) return [2, 0.95];
  if (s.startsWith('SB0') || s.startsWith('S0')) return [2, 0.90];
  if (s.startsWith('SBA')) return [1, 0.80];
  if (s.startsWith('SBB')) return [1, 0.75];
  if (s.startsWith('SBC') || s.startsWith('SBD')) return [1, 0.68];
  if (s.startsWith('SB')) return [1, 0.72];
  if (s.startsWith('S')) return [0, 0.74];
  if (s.startsWith('IR') || s.startsWith('PE') || s.startsWith('LIN') || s.startsWith('DW') || s.startsWith('INT')) return [3, 0.65];
  if (s.startsWith('DBL')) return [3, 0.70];
  return [0, 0.78];
}
const hubbleTypeLabel = h => {
  const s = (h || '').toUpperCase().replace(/[\s:-]/g, '');
  if (!s || s === '?' || s === 'UB') return 'Galaxy';
  if (s.startsWith('E')) return 'Elliptical galaxy';
  if (s.startsWith('SB0') || s.startsWith('S0')) return 'Lenticular galaxy';
  if (s.startsWith('SB')) return 'Barred spiral galaxy';
  if (s.startsWith('S')) return 'Spiral galaxy';
  if (s.startsWith('IR') || s.startsWith('DW')) return 'Irregular galaxy';
  if (s.startsWith('DBL') || s.startsWith('INT')) return 'Interacting galaxies';
  if (s.startsWith('PE')) return 'Spiral galaxy';
  return 'Galaxy';
};

/* ---------- 1) curated 58 (curated-58.json: id, ra, dec, v, type, major, minor, dist, pa, bv, fun) ---------- */
const curated = JSON.parse(read('curated-58.json'));
console.log('curated:', curated.length);

/* ---------- 2) NGC 2000.0 (Sinnott 1988) — coordinates ARE J2000 (epoch 2000.0 edition) ---------- */
const GALAXY_TYPES = /^(G[xb]|-|\?|\*{3})$/i;
const ngcic = [];
for (const tr of read('ngc-vii118.xml').match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 12) continue;
  if (!GALAXY_TYPES.test(r[2])) continue;
  const name = (r[1] || '').replace(/\s+/g, '');
  let id = null;
  if (/^I(\d{1,5})$/.test(name)) id = 'IC ' + name.slice(1);
  else if (/^\d{1,4}$/.test(name)) id = 'NGC ' + name.padStart(4, '0');
  const ra = parseRA(r[3]), dec = parseDEC(r[4]);
  if (Number.isNaN(ra) || Number.isNaN(dec)) continue;
  ngcic.push({ id, ra, dec, mag: num(r[9]), size: num(r[8]), hubble: null, used: false, curated: false });
}
console.log('NGC/IC galaxies:', ngcic.length,
  '(NGC', ngcic.filter(g => g.id && g.id.startsWith('NGC')).length,
  ', IC', ngcic.filter(g => g.id && g.id.startsWith('IC')).length,
  ', name-less', ngcic.filter(g => !g.id).length + ')');
const byId = new Map();
for (const g of ngcic) if (g.id) byId.set(g.id, g);

/* ---------- 3) UGC (Nilson 1973) — B1950 -> J2000 ---------- */
const ugc = [];
for (const tr of read('ugc-vii26d.xml').match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 11) continue;
  const raB = parseRA(r[3]), decB = parseDEC(r[4]);
  if (Number.isNaN(raB) || Number.isNaN(decB)) continue;
  const [ra, dec] = b1950toJ2000(raB, decB);
  ugc.push({ id: /^\d+$/.test((r[1] || '').trim()) ? 'UGC ' + r[1].trim() : null, ra, dec, mag: num(r[9]), size: num(r[6]), hubble: (r[8] || '').trim(), used: false });
}
console.log('UGC galaxies:', ugc.length);

/* ---------- 4) enrich NGC/IC with UGC hubble types (1.2' cross-match) ---------- */
let typed = 0;
for (const g of ngcic) {
  let best = null, bestD = 1.2 / 60;
  for (const u of ugc) {
    if (u.used) continue;
    if (Math.abs(u.ra - g.ra) > 2 || Math.abs(u.dec - g.dec) > 2) continue;
    const d = angSepDeg(g.ra, g.dec, u.ra, u.dec);
    if (d < bestD) { bestD = d; best = u; }
  }
  if (best) { g.hubble = best.hubble; best.used = true; typed++; }
}
console.log('NGC/IC enriched with UGC hubble type:', typed);

/* ---------- 5) mark curated-covered catalog rows ---------- */
const xref = new Map();
let xrefN = 0;
for (let ci = 0; ci < curated.length; ci++) {
  const c = curated[ci];
  let match = null;
  const m = c[0].match(/^(NGC|IC)\s*(\d+)$/i);
  if (m) {
    const key = m[1].toUpperCase() + ' ' + String(m[2]).padStart(4, '0');
    if (byId.has(key)) match = byId.get(key);
  }
  if (!match) {
    // Messier id (or no catalog name): nearest catalog object within 0.35 deg (Sinnott positions may lag modern by ~10')
    let bd = 0.35;
    for (const g of ngcic) { const d = angSepDeg(c[1], c[2], g.ra, g.dec); if (d < bd) { bd = d; match = g; } }
    if (!match) for (const u of ugc) { if (u.used) continue; const d = angSepDeg(c[1], c[2], u.ra, u.dec); if (d < bd) { bd = d; match = u; } }
  }
  if (match) { match.curated = true; match.used = true; xref.set(ci, match.id || null); xrefN++; }
}
console.log('curated matched to catalog:', xrefN, '/', curated.length);

/* ---------- 6) assemble ----------
 * bright row (12 fields): [id, ra, dec, v, type, major, minor, distMly|null,
 *   posAngle, bv, fun|null, xref|null]
 * faint row (7 fields):   [id|null, ra, dec, v|null, size, bv, tile]      */
const bright = [], faint = [];
for (let ci = 0; ci < curated.length; ci++) {
  const c = curated[ci];
  const x = xref.get(ci) || null;
  bright.push([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], x]);
}
for (const g of ngcic) {
  if (g.curated) continue;
  const [tile, bv] = g.hubble ? hubbleToTileBv(g.hubble) : [0, 0.80];
  if (g.id && g.mag != null && g.mag < 11.5) {
    bright.push([g.id, g.ra, g.dec, g.mag, hubbleTypeLabel(g.hubble), g.size ?? 2, null, null, 0, bv, null, null]);
  } else {
    faint.push([g.id, g.ra, g.dec, g.mag, g.size ?? 2, bv, tile]);
  }
}
for (const u of ugc) {
  if (u.used) continue;
  const [tile, bv] = hubbleToTileBv(u.hubble);
  if (u.id && u.mag != null && u.mag < 11.5) {
    bright.push([u.id, u.ra, u.dec, u.mag, hubbleTypeLabel(u.hubble), u.size ?? 2, null, null, 0, bv, null, null]);
  } else {
    faint.push([u.id, u.ra, u.dec, u.mag, u.size ?? 2, bv, tile]);
  }
}
/* positional dedupe (1" grid), bright keeps priority */
const seen = new Set();
const dedupe = list => list.filter(o => {
  const k = o[1].toFixed(2) + ',' + o[2].toFixed(2);
  if (seen.has(k)) return false; seen.add(k); return true;
});
const brightOut = dedupe(bright);
const faintOut = dedupe(faint);

fs.writeFileSync(new URL('./galaxies-bright.json', D), JSON.stringify(brightOut));
fs.writeFileSync(new URL('./galaxies-faint.json', D), JSON.stringify({ data: faintOut, ids: faintOut.map(f => f[0]) }));
console.log('bright rows:', brightOut.length, 'faint:', faintOut.length, 'total:', brightOut.length + faintOut.length);
const hd = {};
for (const g of [...ngcic, ...ugc]) { const h = (g.hubble || '∅'); hd[h] = (hd[h] || 0) + 1; }
console.log('hubble dist (top 20):', Object.entries(hd).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => k + ':' + v).join(' '));
