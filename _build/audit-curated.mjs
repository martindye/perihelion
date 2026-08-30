import fs from 'node:fs';
const D = new URL('./', import.meta.url);
const read = f => fs.readFileSync(new URL(f, D), 'utf8');

/* Corwin 2004 J2000 table (table 0 of VII/239A): key Cat|NGC/IC -> RAJ2000, DEJ2000 */
const d = read('corwin-vii239a.xml');
const tables = d.match(/<TABLE[\s\S]*?<\/TABLE>/g) || [];
const parseTable = tb => {
  const fields = [...tb.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  const idx = {}; fields.forEach((f, i) => { if (!(f in idx)) idx[f] = i; });
  const rows = (tb.match(/<TR>[\s\S]*?<\/TR>/g) || []).map(tr => {
    const cells = []; const re = /<TD([^>]*?)(\/>|>)/g; let m;
    while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); cells.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); }
    return cells;
  });
  return { idx, rows };
};
const T2000 = parseTable(tables[0]);
const get = (T, r, n) => { const i = T.idx[n]; return i == null ? '' : (r[i] ?? ''); };
const corwin = new Map();
for (const r of T2000.rows) {
  if (r.length < 6) continue;
  const key = get(T2000, r, 'Cat') + '|' + get(T2000, r, 'NGC/IC');
  if (!corwin.has(key)) corwin.set(key, [get(T2000, r, 'RAJ2000'), get(T2000, r, 'DEJ2000')]);
}
const RAdeg = s => { const m = s.trim().match(/^(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/); return m ? (+m[1] + +m[2] / 60 + +m[3] / 3600) * 15 : NaN; };
const DECdeg = s => { const m = s.trim().match(/^([+-])?(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + +m[3] / 60 + (+m[4] || 0) / 3600) : NaN; };
const keyOf = id => { const m = id.match(/^(NGC|IC)\s*(\d+)$/); if (!m) return null; const cat = m[1] === 'NGC' ? 'N' : 'I'; return cat + '|' + m[2].padStart(4, '0'); };

const dsoSrc = read('../js/dso.js');
const curated = new Function('return (' + dsoSrc.slice(dsoSrc.indexOf('['), dsoSrc.lastIndexOf(']') + 1) + ');')();

/* NGC 2000 file: id -> (ra,dec) J2000-ish, for Messier->catalog resolution */
const cellsOf = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const parseRA = s => { const t = s.trim().split(/\s+/).map(Number); return t.length === 2 ? (t[0] + t[1] / 60) * 15 : (t[0] + t[1] / 60 + (t[2] || 0) / 3600) * 15; };
const parseDEC = s => { const neg = s.trim().startsWith('-'); const t = s.trim().replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };
const DEG = Math.PI / 180;
const eq2u = (ra, dd) => { const a = ra * DEG, dc = dd * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };
const angSep = (ra1, d1, ra2, d2) => { const u1 = eq2u(ra1, d1), u2 = eq2u(ra2, d2); return Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2]))) / DEG; };
const fileByRaDec = new Map();
for (const tr of read('ngc-vii118.xml').match(/<TR>[\s\S]*?<\/TR>/g) || []) {
  const r = cellsOf(tr);
  if (r.length < 12) continue;
  const name = (r[1] || '').replace(/\s+/g, '');
  let id = null;
  if (/^I(\d{1,5})$/.test(name)) id = 'IC ' + name.slice(1);
  else if (/^\d{1,4}$/.test(name)) id = 'NGC ' + name.padStart(4, '0');
  const ra = parseRA(r[3]), dec = parseDEC(r[4]);
  if (id && !Number.isNaN(ra)) fileByRaDec.set(id, [ra, dec]);
}

for (const c of curated) {
  let id = null;
  const m = c[0].match(/^(NGC|IC)\s*(\d+)$/i);
  if (m) id = m[1].toUpperCase() + ' ' + String(m[2]).padStart(4, '0');
  if (!id) {
    // Messier: resolve via nearest file object
    let bd = 0.5, bb = null;
    for (const [k, v] of fileByRaDec) { const dd = angSep(c[1], c[2], v[0], v[1]); if (dd < bd) { bd = dd; bb = k; } }
    id = bb;
  }
  const k = id ? keyOf(id) : null;
  const cw = k ? corwin.get(k) : null;
  if (!cw) { console.log(c[0].padEnd(10), id || '(no id)', '-> no Corwin entry'); continue; }
  const raT = RAdeg(cw[0]), decT = DECdeg(cw[1]);
  const dra = angSep(c[1], c[2], raT, decT) * 60 * Math.sign((raT - c[1]) * Math.cos(c[2] * DEG));
  const dde = (decT - c[2]) * 60;
  const flag = Math.abs(dra) > 1 || Math.abs(dde) > 1 ? '  <<<<< CHECK' : '';
  console.log(c[0].padEnd(10), (id || '?').padEnd(10), `cur (${c[1].toFixed(4)}, ${c[2].toFixed(4)})`, `Corwin (${raT.toFixed(4)}, ${decT.toFixed(4)})`, `dRA ${dra >= 0 ? '+' : ''}${dra.toFixed(2)}' dDE ${dde >= 0 ? '+' : ''}${dde.toFixed(2)}'${flag}`);
}
