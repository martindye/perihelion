const urls = [
  'https://simbad.u-strasbg.fr/simbad/sim-coo?Coordinate=04%2053%2050%20%2B21%2023&radius=1.5&CoordUnits=arcmin&formathtml=1',
  'https://simbad.u-strasbg.fr/simbad/sim-coo?Coordinate=73.5d%2021.6d&radius=1.5&CoordUnits=deg&formathtml=1'
];
for (const u of urls) {
  const r = await fetch(u);
  const t = await r.text();
  console.log('=== URL:', u.slice(-60), 'LEN', t.length, t.includes('No Coord') ? '(no-coord error)' : '');
  if (!t.includes('No Coord')) {
    const lines = t.split('\n').map(s => s.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/&nbsp;/g, ' ').trim()).filter(s => /Tauri|Merga|theta|\b0?4 h|04 5/.test(s));
    for (const l of lines.slice(0, 25)) console.log('  ', l.slice(0, 200));
  }
}
