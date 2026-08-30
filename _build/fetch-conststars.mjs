/* Fetch authoritative J2000 positions for constellation-figure stars from SIMBAD.
 * Reuses the simbad-fetch.mjs protocol (sim-id endpoint, ' '->'+', parse ep=J2000 block). */
import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const sleep = ms => new Promise(s => setTimeout(s, ms));

const stars = [
  ['Merga', 'theta Tau'], ['Tianguan', 'zeta Tau'], ['Zosma', 'delta Leo'],
  ['Chertan', 'epsilon Leo'], ['Adhafera', 'zeta Leo'], ['Larawag', 'epsilon Sco'],
  ['Lesath', 'eta Sco'], ['Sargas', 'gamma Sco'], ['Shaula', 'lambda Sco'],
  ['Dschubba', 'beta Sco'], ['Hamal', 'alpha Ari'], ['Sheratan', 'beta Ari'],
  ['Mesarthim', 'gamma Ari'], ['Wasat', 'mu Gem'], ['Heze', 'gamma Vir'],
  ['Vindemiatrix', 'beta Vir'], ['Spica', 'alpha Vir'], ['Castor', 'alpha Gem'],
  ['Pollux', 'beta Gem'], ['Alhena', 'gamma Gem']
];

function parseSimbad(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return null;
  const seg = t.slice(i, i + 1600);
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return null;
  const ra = (+m[1]) * 15 + (+m[2]) / 4 + (+m[3]) / 240;
  const dec = (m[4] === '-' ? -1 : 1) * (+m[5] + (+m[6]) / 60 + (+m[7]) / 3600);
  const qm = seg.match(/quality flag \(A->E\)">\s*([A-G])\s*</);
  const vm = seg.match(/V\s*=\s*([-\d.]+)/);
  return { ra: +ra.toFixed(5), dec: +dec.toFixed(5), q: qm ? qm[1] : null, v: vm ? +vm[1] : null };
}

const out = {};
for (const [name, bayer] of stars) {
  let val = null;
  for (const qidRaw of [name, bayer.replace(/ /g, '+')]) {
    const qid = qidRaw.replace(/ /g, '+');
    for (let attempt = 0; attempt < 2 && !val; attempt++) {
      try {
        const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
        const t = await r.text();
        if (t.length >= 20000) val = parseSimbad(t);
      } catch (e) { /* retry */ }
      if (!val) await sleep(1200);
    }
    if (val) { val.via = qid; break; }
  }
  out[name] = val;
  console.log(name.padEnd(12), val ? `RA ${val.ra.toFixed(4)} Dec ${val.dec.toFixed(4)} V ${val.v ?? '?'} q=${val.q} via=${val.via}` : 'NULL');
  await sleep(1150);
}
fs.writeFileSync(B + 'const-stars.json', JSON.stringify(out, null, 1));
console.log('saved const-stars.json');
