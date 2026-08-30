import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const sleep = ms => new Promise(s => setTimeout(s, ms));
const out = JSON.parse(fs.readFileSync(B + 'simbad-j2000.json', 'utf8'));
const todo = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
console.log('retrying:', todo.length);

function parseSimbad(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return null;
  const segRaw = t.slice(i, i + 2500);
  /* strip tags WITHOUT adding spaces: uncertain digits are wrapped in
     <font><i>n</i></font> INSIDE the number ("37.<font>0</font>" = "37.0") */
  const seg = segRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return null;
  const ra = (+m[1]) * 15 + (+m[2]) / 4 + (+m[3]) / 240;
  const dec = (m[4] === '-' ? -1 : 1) * (+m[5] + (+m[6]) / 60 + (+m[7]) / 3600);
  const qm = seg.match(/\]\s*([A-G])\b|\(Optical\)\s*([A-G])\b/);
  const q = qm ? (qm[1] || qm[2]) : null;
  const bm = segRaw.match(/class="bibcode"[^>]*>\s*<A [^>]*>([^<]+)</);
  return { ra: +ra.toFixed(6), dec: +dec.toFixed(6), q, bib: bm ? bm[1].trim() : null };
}

let fixed = 0, stillNull = [];
for (let i = 0; i < todo.length; i++) {
  const id = todo[i];
  const qid = id.replace(/^M (\d+)$/, 'M+$1').replace(/ /g, '+');
  let val = null;
  for (let attempt = 0; attempt < 3 && !val; attempt++) {
    try {
      const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
      const t = await r.text();
      val = parseSimbad(t);
      if (val) fixed++;
    } catch (e) { /* retry */ }
    await sleep(1500 + attempt * 1000);
  }
  if (val) out[id] = val; else stillNull.push(id);
  if ((i + 1) % 10 === 0) fs.writeFileSync(B + 'simbad-j2000.json', JSON.stringify(out, null, 0));
  console.log((i + 1) + '/' + todo.length, ' fixed-so-far:', fixed);
  await sleep(1200);
}
fs.writeFileSync(B + 'simbad-j2000.json', JSON.stringify(out, null, 0));
console.log('fixed this pass:', fixed, ' still-null:', stillNull.length);
console.log(stillNull.join(', ') || '(none)');
const found = Object.values(out).filter(Boolean).length;
console.log('total with coords now:', found, '/', Object.keys(out).length);
