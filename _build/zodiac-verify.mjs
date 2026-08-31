/* Verify the 14 zodiac-figure stars not confirmed by the atlas table (via SIMBAD). */
const sleep = ms => new Promise(s => setTimeout(s, ms));
const stars = [
  ['Algedi', ['Algedi', 'Alpha Capricorni']],
  ['DenebAlgedi', ['Deneb Algedi', 'Beta Capricorni']],
  ['ZetaCap', ['Zeta Capricorni']],
  ['DeltaCap', ['Delta Capricorni']],
  ['OmegaCap', ['Omega Capricorni']],
  ['Sadalsuud', ['Sadalsuud', 'Gamma Aquarii']],
  ['Sadachbia', ['Sadachbia', 'Beta Aquarii']],
  ['Skat', ['Skat', 'Delta Aquarii']],
  ['Ascella', ['Ascella', 'Eta Cancri']],
  ['AsellusBorealis', ['Asellus Borealis', 'Delta Cancri']],
  ['AsellusAustralis', ['Asellus Australis', 'Iota Cancri']],
  ['Acubens', ['Acubens', 'Gamma Cancri']],
  ['Alpherg', ['Alpherg', 'Beta Piscium']],
  ['GammaPsc', ['Gamma Piscium']],
  ['EpsilonPsc', ['Epsilon Piscium']]
];
function parse(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return null;
  const seg = t.slice(i, i + 1600);
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return null;
  const ra = (+m[1]) * 15 + (+m[2]) / 4 + (+m[3]) / 240;
  const dec = (m[4] === '-' ? -1 : 1) * (+m[5] + (+m[6]) / 60 + (+m[7]) / 3600);
  return { ra: +ra.toFixed(4), dec: +dec.toFixed(4) };
}
for (const [name, candidates] of stars) {
  let val = null, via = null;
  for (const c of candidates) {
    if (val) break;
    for (let a = 0; a < 2 && !val; a++) {
      try {
        const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + c.replace(/ /g, '+'));
        const t = await r.text();
        if (t.length >= 20000) val = parse(t);
      } catch (e) {}
      if (!val) await sleep(1100);
    }
    if (val) via = c;
  }
  console.log(name.padEnd(17), val ? `RA ${val.ra}  Dec ${val.dec}  via=${via}` : 'NULL');
  await sleep(1100);
}
