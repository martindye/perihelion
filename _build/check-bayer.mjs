/* Re-check suspicious SIMBAD name resolutions with unambiguous Bayer ids. */
const sleep = ms => new Promise(s => setTimeout(s, ms));
const stars = [
  ['Merga-thetaTau', 'Theta Tauri'],
  ['Zosma-deltaLeo', 'Delta Leonis'],
  ['Chertan-epsLeo', 'Epsilon Leonis'],
  ['Wasat-muGem', 'Mu Geminorum'],
  ['Heze-gammaVir', 'Gamma Virginis'],
  ['Sheratan-betaAri', 'Beta Arietis'],
  ['Mesarthim-gammaAri', 'Gamma Arietis'],
  ['Larawag-eSc-check', 'Epsilon Scorpii']
];
function parseSimbad(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return null;
  const seg = t.slice(i, i + 1600);
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return null;
  const ra = (+m[1]) * 15 + (+m[2]) / 4 + (+m[3]) / 240;
  const dec = (m[4] === '-' ? -1 : 1) * (+m[5] + (+m[6]) / 60 + (+m[7]) / 3600);
  return { ra: +ra.toFixed(5), dec: +dec.toFixed(5) };
}
for (const [label, ident] of stars) {
  const qid = ident.replace(/ /g, '+');
  let val = null;
  for (let a = 0; a < 2 && !val; a++) {
    try {
      const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
      const t = await r.text();
      if (t.length >= 20000) val = parseSimbad(t);
    } catch (e) {}
    if (!val) await sleep(1200);
  }
  console.log(label.padEnd(20), val ? `RA ${val.ra.toFixed(4)}  Dec ${val.dec.toFixed(4)}` : 'NULL');
  await sleep(1150);
}
