const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-coo?Coordinate=73.5+21.6&radius=2.0&CoordUnits=deg&formathtml=1');
const t = await r.text();
const rows = t.split(/\n/).filter(l => /Tauri/i.test(l) && /<a/i.test(l)).slice(0, 40);
for (const l of rows) {
  const cells = l.split('<td').map(c => c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()).join(' | ');
  if (cells.length > 10) console.log(cells.slice(0, 300));
}
