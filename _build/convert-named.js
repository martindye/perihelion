/* Build script: hip_main.csv + IAU WGSN named stars -> js/stars-named.js
 * Emits:
 *   P.starIds    = { count, hip: b64 Int32Array, hd: b64 Int32Array }  (per buffer star)
 *   P.starNamed  = { count, data: [[bufIdx, "Name", "refs"], ...] }     (WGSN names on buffer stars)
 *   P.starNamed83= ["refs", ...] aligned with P.stars in data.js
 * The buffer order must match js/stars-hip.js exactly (same filter, same 83 exclusions).
 */
'use strict';
const fs = require('fs');
const path = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';

/* ---------- 1. catalog rows (identical filter to convert.js) ---------- */
const csv = fs.readFileSync(path + '_build/hip_main.csv', 'utf8');
const lines = csv.split('\n');
const header = lines[0].split(',');
const col = n => header.indexOf(n);
const I_RA = col('RA_Deg'), I_DEC = col('Dec_Deg'), I_V = col('Vmag'),
      I_BV = col('BV_Color'), I_VM2 = col('Hip_Mag'),
      I_HIP = col('HIP_Number'), I_HD = col('HD_ID');
console.log('columns:', { I_RA, I_DEC, I_V, I_BV, I_VM2, I_HIP, I_HD });

const rows = [];
let skipped = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line || line.charCodeAt(0) === 13) continue;
  const c = line.split(',');
  const ra = parseFloat(c[I_RA]), dec = parseFloat(c[I_DEC]);
  let v = parseFloat(c[I_V]);
  if (!isFinite(v)) v = parseFloat(c[I_VM2]);
  if (!isFinite(ra) || !isFinite(dec) || !isFinite(v) || v > 11.5) { skipped++; continue; }
  let bv = parseFloat(c[I_BV]);
  if (!isFinite(bv)) bv = 0.9;
  const hip = parseInt(c[I_HIP], 10) || 0;
  const hdv = c[I_HD] ? parseInt(String(c[I_HD]).trim(), 10) : NaN;
  rows.push({ ra, dec, v, bv, hip, hd: isFinite(hdv) && hdv > 0 ? hdv : 0 });
}
console.log(`catalog rows: ${rows.length} (skipped ${skipped})`);

/* ---------- 2. curated 83 (data.js) — exclusions + their HIP/HD ---------- */
const dataJs = fs.readFileSync(path + 'js/data.js', 'utf8');
const namedRe = /\[\s*'([^']+)',\s*([\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*([\d.]+|null)\s*\]/g;
const curated = [];
let m;
while ((m = namedRe.exec(dataJs)) !== null) {
  curated.push({ name: m[1], ra: +m[2], dec: +m[3] });
}
console.log('curated named:', curated.length);

/* coarse 10-degree grid for nearest-neighbour */
const NCELL_R = 36, NCELL_D = 18;
const cells = Array.from({ length: NCELL_R * NCELL_D }, () => []);
const cellOf = (ra, dec) => {
  const ir = ((Math.floor(ra / 10) % 36) + 36) % 36;
  const id = Math.max(0, Math.min(17, Math.floor((dec + 90) / 10)));
  return ir * NCELL_D + id;
};
const D2R = Math.PI / 180;
rows.forEach((r, i) => cells[cellOf(r.ra, r.dec)].push(i));
function nearest2(ra, dec) {
  const qd = dec * D2R, qa = ra * D2R;
  const qx = Math.cos(qd) * Math.cos(qa), qy = Math.sin(qd), qz = -Math.cos(qd) * Math.sin(qa);
  const ir0 = ((Math.floor(ra / 10) % 36) + 36) % 36;
  const id0 = Math.max(0, Math.min(17, Math.floor((dec + 90) / 10)));
  let best = -1, bestDot = -2;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dd = -1; dd <= 1; dd++) {
      const id = id0 + dd;
      if (id < 0 || id >= 18) continue;
      for (const i of cells[(ir0 + dr + 36) % 36 * 18 + id]) {
        const r = rows[i];
        const d = r.dec * D2R, a = r.ra * D2R, cd = Math.cos(d);
        const dot = qx * cd * Math.cos(a) + qy * Math.sin(d) + qz * (-cd * Math.sin(a));
        if (dot > bestDot) { bestDot = dot; best = i; }
      }
    }
  }
  return { i: best, ang: Math.acos(Math.min(1, bestDot)) / D2R };
}

const excluded = new Set();
const curatedRow = new Array(curated.length);
const curatedRefs = new Array(curated.length);
const rowToCur = new Map();   // row index -> curated index
for (let k = 0; k < curated.length; k++) {
  const n = curated[k];
  const { i, ang } = nearest2(n.ra, n.dec);
  if (i >= 0 && ang < 1.0) {
    excluded.add(i);
    curatedRow[k] = i;
    rowToCur.set(i, k);
    const r = rows[i];
    let refs = 'HIP ' + r.hip;
    if (r.hd) refs += ' · HD ' + r.hd;
    curatedRefs[k] = refs;
    if (ang > 0.05) console.log(`  curated ${n.name}: offset ${ang.toFixed(3)} deg`);
  } else {
    console.warn(`  curated ${n.name}: NO MATCH (best ${ang && ang.toFixed(2)} deg)`);
  }
}
console.log('excluded (curated):', excluded.size);

/* buffer = rows minus exclusions, in row order (matches stars-hip.js) */
const bufRows = [];
const rowToBuf = new Map();
rows.forEach((r, i) => {
  if (!excluded.has(i)) { bufRows.push(r); rowToBuf.set(i, bufRows.length - 1); }
});
console.log('buffer stars:', bufRows.length);

const hipToBuf = new Map();
bufRows.forEach((r, b) => { if (r.hip && !hipToBuf.has(r.hip)) hipToBuf.set(r.hip, b); });
const hipToCurated = new Map();
curated.forEach((c, k) => { if (curatedRow[k] != null) hipToCurated.set(rows[curatedRow[k]].hip, k); });

/* ---------- 3. WGSN named stars ---------- */
function parseWGSN() {
  const raw = fs.readFileSync(path + '_build/wgsn.csv', 'utf8');
  const outL = raw.split(/\r?\n/);
  const recs = [];
  const issues = [];
  for (let li = 1; li < outL.length; li++) {
    const line = outL[li];
    if (!line.trim()) continue;
    /* quote-aware split */
    const f = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { f.push(cur); cur = ''; }
      else cur += ch;
    }
    f.push(cur);
    if (f.length < 10) { issues.push(li + ': too few fields'); continue; }
    const name = f[0].trim();
    /* RA: HH.MM.SS... (may be mangled: dots dropped) */
    const rp = f[1].trim().split('.');
    const h = +rp[0];
    const mi = rp[1] !== undefined ? +rp[1] : 0;
    let sec = 0;
    if (rp.length >= 3) {
      const s = rp.slice(2).join('.');
      if (s.length <= 2) sec = +s;
      else if (s.length === 3) sec = +s / 10;
      else if (s.length === 4) sec = +s.slice(0, 2) + (+s.slice(2)) / 100;
      else sec = +s.slice(0, 2) + +s.slice(2) / Math.pow(10, s.length - 2);
    }
    if (h > 24 || mi > 60 || sec > 60) issues.push(li + ': bad RA ' + f[1]);
    const ra = (h + mi / 60 + sec / 3600) * 15;
    /* Dec: DD.MMM... sign-prefixed */
    let ds = f[2].trim();
    let neg = false;
    if (ds[0] === '-') { neg = true; ds = ds.slice(1); }
    else if (ds[0] === '+') ds = ds.slice(1);
    const dp = ds.split('.');
    const dd = +dp[0];
    let mins = 0;
    if (dp.length > 1) {
      const rs = dp.slice(1).join('');
      if (rs.length <= 2) mins = +rs;
      else mins = +rs.slice(0, 2) + (+rs.slice(2)) / Math.pow(10, rs.length - 2);
    }
    const dec = (neg ? -1 : 1) * (dd + mins / 60);
    if (Math.abs(dec) > 90) issues.push(li + ': bad Dec ' + f[2]);
    recs.push({ li, name, ra, dec, v: parseFloat(f[3]) || null, alt: f[8] || '' });
  }
  return { recs, issues };
}
const { recs: wgsn, issues: wgsnIssues } = parseWGSN();
console.log('WGSN recs:', wgsn.length, wgsnIssues.length ? 'issues: ' + wgsnIssues.join(' | ') : '(no parse issues)');
/* spot-check known values */
for (const w of wgsn) {
  if (['Acamar', 'Sirius', 'Vega'].includes(w.name))
    console.log(`  check ${w.name}: ra=${w.ra.toFixed(4)} dec=${w.dec.toFixed(4)} v=${w.v}`);
}

/* ---------- 4. match WGSN -> catalog ---------- */
const namedBuf = [];      // [bufIdx, name, refs]
let nBuf = 0, nCur = 0, nMiss = 0;
const missed = [];
for (const w of wgsn) {
  const alt = w.alt;
  let target = null;     // {type:'buf'|'cur', idx}
  const hipM = /HIP\s+(\d+)/i.exec(alt);
  let via = '';
  if (hipM) {
    const hip = +hipM[1];
    if (hipToCurated.has(hip)) { target = { type: 'cur', idx: hipToCurated.get(hip) }; via = 'HIP->curated'; }
    else if (hipToBuf.has(hip)) { target = { type: 'buf', idx: hipToBuf.get(hip) }; via = 'HIP'; }
  }
  if (!target) {
    const { i, ang } = nearest2(w.ra, w.dec);
    if (i >= 0 && ang < 0.2) {
      if (rowToCur.has(i)) {
        target = { type: 'cur', idx: rowToCur.get(i) };
        via = 'pos->curated(' + ang.toFixed(3) + '°)';
      } else if (rowToBuf.has(i)) {
        target = { type: 'buf', idx: rowToBuf.get(i) };
        via = 'pos(' + ang.toFixed(3) + '°)';
      }
    }
  }
  if (!target) { nMiss++; missed.push(w.name); continue; }

  const row = target.type === 'buf' ? bufRows[target.idx] : rows[curatedRow[target.idx]];
  if (!row) {
    console.log('  DEBUG unmatched row for:', w.name, JSON.stringify(target), 'via', via);
    nMiss++; missed.push(w.name); continue;
  }
  let refs = 'HIP ' + row.hip + (row.hd ? ' · HD ' + row.hd : '');
  /* extra references from the WGSN alternative-name list */
  const extras = alt.split(',')
    .map(s => s.trim())
    .filter(s => s && !/^(HIP\s+\d+|HD\s*\d+)$/i.test(s) && s.toLowerCase() !== w.name.toLowerCase())
    .slice(0, 4);
  if (extras.length) refs += ' · ' + extras.join(' · ');

  if (target.type === 'cur') {
    nCur++;
    if (extras.length) {
      const k = target.idx;
      if (curatedRefs[k] && !curatedRefs[k].includes(extras.join(' · ')))
        curatedRefs[k] = (curatedRefs[k] || '') + ' · ' + extras.join(' · ');
    }
  } else {
    namedBuf.push([target.idx, w.name, refs.slice(0, 110)]);
    nBuf++;
  }
}
console.log(`matched: buffer=${nBuf} curated=${nCur} missed=${nMiss}`);
if (missed.length) console.log('missed (fainter than catalog / unmatched):', missed.join(', '));

/* ---------- 4.5 Bayer + Flamsteed designations (HYG 4.2, CC BY-SA 4.0) ----
   System-wide name search: every star with a classical designation becomes
   findable by name, not just the 458 IAU names.
     - star has no name yet        -> new entry "Tau Ceti" / "52 Ceti"
     - star has an IAU name        -> designations merged into its refs
     - curated (data.js) star      -> designations appended to starNamed83 */
const GREEK = { Alp: ['α', 'alpha'], Bet: ['β', 'beta'], Gam: ['γ', 'gamma'],
  Del: ['δ', 'delta'], Eps: ['ε', 'epsilon'], Zet: ['ζ', 'zeta'], Eta: ['η', 'eta'],
  The: ['θ', 'theta'], Iot: ['ι', 'iota'], Kap: ['κ', 'kappa'], Lam: ['λ', 'lambda'],
  Mu: ['μ', 'mu'], Nu: ['ν', 'nu'], Xi: ['ξ', 'xi'], Ome: ['ο', 'omicron'],
  Pi: ['π', 'pi'], Rho: ['ρ', 'rho'], Sig: ['σ', 'sigma'], Tau: ['τ', 'tau'],
  Ups: ['υ', 'upsilon'], Phi: ['φ', 'phi'], Chi: ['χ', 'chi'], Psi: ['ψ', 'psi'],
  Omi: ['ω', 'omega'] };
/* conventional (genitive) constellation names — the form people actually
   write in Bayer/Flamsteed designations: "tau Ceti", "61 Cygni",
   "52 Canis Majoris" — so that name searches match real usage */
const CON = { And: 'Andromedae', Ant: 'Antliae', Aps: 'Aps', Aql: 'Aquilae',
  Aqr: 'Aquarii', Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Bootis',
  Cae: 'Caeli', Cam: 'Camelopardalis', Cap: 'Capricorni', Car: 'Carinae',
  Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti',
  Cha: 'Chamaeleontis', Cir: 'Circini', CMa: 'Canis Majoris',
  CMi: 'Canis Minoris', Cnc: 'Canceri', Col: 'Columbae',
  Com: 'Comae Berenices', CrA: 'Coronae Australis', CrB: 'Coronae Borealis',
  Crt: 'Crateris', Cru: 'Crucis', Crv: 'Corvi', CVn: 'Cygni', Cyg: 'Cygni',
  Del: 'Delphini', Dor: 'Doradi', Dra: 'Draconis', Equ: 'Equulei',
  Eri: 'Eridani', For: 'Fornacis', Gem: 'Geminorum', Gru: 'Grus',
  Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydri', Hyi: 'Hydrae',
  Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis', Lep: 'Leporis',
  Lib: 'Librae', LMi: 'Lynx', Lyn: 'Lynx', Lup: 'Lupi', Lyr: 'Lyrae',
  Men: 'Mensae', Mic: 'Microscopii', Mon: 'Monocerotis', Mus: 'Muscae',
  Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Pav: 'Pavonis',
  Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris',
  PsA: 'Puppis', Pup: 'Puppis', Psc: 'Piscium', Pyx: 'Pyxidis',
  Ret: 'Reticuli', Scl: 'Sculptoris', Sco: 'Scorpii', Sct: 'Scuti',
  Ser: 'Serpentis', Sge: 'Sagittae', Sgr: 'Sagittarii', Tau: 'Tauri',
  Tel: 'Telescopii', TrA: 'Trianguli Australis', Tri: 'Trianguli',
  Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris',
  Vel: 'Velorum', Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae' };
const SUP = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵' };

/* refs tokens for one star's designations, plus the display name */
function designationParts(bayer, flam, con3) {
  const con = CON[con3] || con3;
  const parts = [];
  let name = '';
  if (bayer) {
    const m = /^([A-Za-z]+?)(?:-(\d+))?$/.exec(bayer.trim());
    if (m && GREEK[m[1]]) {
      const sup = m[2] || '';
      const greek = GREEK[m[1]][0] + (SUP[sup] || sup);
      parts.push(greek + '-' + con3);                       /* τ-Cet  */
      name = GREEK[m[1]][1].charAt(0).toUpperCase() + GREEK[m[1]][1].slice(1)
           + sup + ' ' + con;                                /* Tau Ceti */
      if (!parts.includes(name)) parts.push(name);
    }
  }
  if (flam) parts.push(+flam + ' ' + con);                  /* 52 Ceti */
  if (!name && flam) name = +flam + ' ' + con;
  return { name, parts };
}

const hygLines = fs.readFileSync(path + '_build/hyg-bayer-flam.csv', 'utf8')
  .split(/\r?\n/).filter(Boolean);
const bufIdxOf = new Map(namedBuf.map(e => [e[0], e]));
let nBayBuf = 0, nBayCur = 0, nBayMiss = 0;
for (let li = 1; li < hygLines.length; li++) {
  const f = hygLines[li].split(',');
  const hip = +f[0], bayer = f[2] || '', flam = f[3] || '', con3 = f[4] || '';
  if (!bayer && !flam) continue;
  const { name, parts } = designationParts(bayer, flam, con3);
  if (!name) { nBayMiss++; continue; }

  let target = null;
  if (hipToBuf.has(hip)) target = { type: 'buf', idx: hipToBuf.get(hip) };
  if (!target) {
    /* HIP not in buffer (faint / excluded) — try position via nearest */
    const src = rows.find(r => r.hip === hip);
    if (src) {
      const { i, ang } = nearest2(src.ra, src.dec);
      if (i >= 0 && ang < 0.2) {
        if (rowToCur.has(i)) target = { type: 'cur', idx: rowToCur.get(i) };
        else if (rowToBuf.has(i)) target = { type: 'buf', idx: rowToBuf.get(i) };
      }
    }
  }
  if (!target) { nBayMiss++; continue; }

  if (target.type === 'cur') {
    const k = target.idx;
    const missing = parts.filter(p => !curatedRefs[k] || !curatedRefs[k].includes(p));
    if (missing.length) curatedRefs[k] = (curatedRefs[k] || '') + ' · ' + missing.join(' · ');
    nBayCur++;
    continue;
  }
  const b = target.idx;
  const row = bufRows[b];
  const entry = bufIdxOf.get(b);
  if (entry) {
    /* already IAU-named — fold designations into the existing refs */
    const missing = parts.filter(p => !entry[2].includes(p));
    if (missing.length) entry[2] = (entry[2] + ' · ' + missing.join(' · ')).slice(0, 150);
  } else {
    let refs = 'HIP ' + row.hip + (row.hd ? ' · HD ' + row.hd : '');
    if (parts.length) refs += ' · ' + parts.join(' · ');
    const e = [b, name, refs.slice(0, 150)];
    namedBuf.push(e);
    bufIdxOf.set(b, e);
    nBayBuf++;
  }
}
console.log(`bayer/flamsteed: buffer=${nBayBuf} curated=${nBayCur} missed=${nBayMiss} (named entries now ${namedBuf.length})`);

/* ---------- 5. emit js/stars-named.js ---------- */
const N = bufRows.length;
const hipArr = new Int32Array(N), hdArr = new Int32Array(N);
bufRows.forEach((r, i) => { hipArr[i] = r.hip; hdArr[i] = r.hd; });
const b64 = a => Buffer.from(a.buffer).toString('base64');
const js = `/* AUTO-GENERATED by _build/convert-named.js — do not edit.
 * IDs + IAU WGSN names for the Hipparcos buffer in stars-hip.js.
 *   P.starIds.count   - number of stars (same order as stars-hip.js)
 *   P.starIds.hip/hd  - base64 Int32Array per star (hd = 0 when absent)
 *   P.starNamed.data  - [bufferIndex, "Name", "refs"] for IAU-named catalog stars
 *   P.starNamed83     - refs strings aligned with P.stars in data.js
 */
'use strict';
window.P = window.P || {};
P.starIds = { count: ${N}, hip: "${b64(hipArr)}", hd: "${b64(hdArr)}" };
P.starNamed = { count: ${namedBuf.length}, data: ${JSON.stringify(namedBuf)} };
P.starNamed83 = ${JSON.stringify(curatedRefs)};
`;
fs.writeFileSync(path + 'js/stars-named.js', js);
console.log(`done -> js/stars-named.js  (${(js.length / 1024).toFixed(0)} KB)`);
