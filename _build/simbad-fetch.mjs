/* PERIHELION — fetch authoritative J2000 (ICRS) positions from SIMBAD.
 * Polite: ~1.15 s between requests, retry once, resumable (skips ids already in output file).
 * Output: simbad-j2000.json  { "<id>": {ra, dec, q, bib} | null }
 */
import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const sleep = ms => new Promise(s => setTimeout(s, ms));

const out = fs.existsSync(B + 'simbad-j2000.json')
  ? JSON.parse(fs.readFileSync(B + 'simbad-j2000.json', 'utf8'))
  : {};

const ids = ['M 40', 'M 102'];
for (let i = 1; i <= 110; i++) ids.push('M ' + i);
const sel = JSON.parse(fs.readFileSync(B + 'dso2-bright.json', 'utf8'));
for (const list of [sel.bright, sel.faint]) {
  for (const r of list) if (!r.m) ids.push(r.id.replace(/^NGC 0+/i, 'NGC 0').replace(/^(NGC|IC)\s+(\d+)$/, (m, c, n) => c + ' ' + n.padStart(4, '0')));
}
const uniq = [...new Set(ids)];
const todo = uniq.filter(id => !(id in out));
console.log('total:', uniq.length, ' todo:', todo.length);

function parseSimbad(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return null;
  const seg = t.slice(i, i + 1600);
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return null;
  const ra = (+m[1]) * 15 + (+m[2]) / 4 + (+m[3]) / 240;
  const dec = (m[4] === '-' ? -1 : 1) * (+m[5] + (+m[6]) / 60 + (+m[7]) / 3600);
  const qm = seg.match(/quality flag \(A->E\)">\s*([A-G])\s*</);
  const bm = seg.match(/class="bibcode">\s*<A [^>]*>([^<]+)</);
  return { ra: +ra.toFixed(6), dec: +dec.toFixed(6), q: qm ? qm[1] : null, bib: bm ? bm[1].trim() : null };
}

let fails = 0;
for (let i = 0; i < todo.length; i++) {
  const id = todo[i];
  /* 'M 33' -> 'M+33' (a literal + in the query decodes to a space server-side);
     do NOT encodeURIComponent — it would turn '+' into '%2B' and break the id */
  const qid = id.replace(/^M (\d+)$/, 'M+$1').replace(/ /g, '+');
  let val = null, ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    try {
      const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
      const t = await r.text();
      if (t.length < 20000) { val = null; ok = true; }          // "no coordinates" page
      else { val = parseSimbad(t); ok = val !== null; }
    } catch (e) { /* network blip -> retry */ }
    if (!ok) await sleep(2500);
  }
  if (!ok) { fails++; val = null; }
  out[id] = val;
  if ((i + 1) % 20 === 0) {
    fs.writeFileSync(B + 'simbad-j2000.json', JSON.stringify(out, null, 0));
    const found = Object.values(out).filter(Boolean).length;
    console.log((i + 1) + '/' + todo.length, ' found-so-far:', found, ' last-fail-streak irrelevant');
  }
  await sleep(1150);
}
fs.writeFileSync(B + 'simbad-j2000.json', JSON.stringify(out, null, 0));
const found = Object.values(out).filter(Boolean).length;
console.log('DONE. total entries:', Object.keys(out).length, ' with coords:', found, ' hard-fails:', fails);
const nulls = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
console.log('null (no coordinate):', nulls.join(', ') || '(none)');
