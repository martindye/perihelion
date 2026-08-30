const fs = require('fs');
const cx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/corwin-vii239a.xml', 'utf8');
const t1s = cx.indexOf('<TABLEDATA>'), t1e = cx.indexOf('</TABLEDATA>', t1s);
const t1 = cx.slice(t1s, t1e);

// 1) find rows whose RA/Dec are near the Pleiades true position (03h47m09s, +24°23')
const rows = [...t1.matchAll(/<TR><TD>([^<]*)<\/TD><TD>([NI])<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><\/TR>/g)];
console.log('total corwin rows:', rows.length);
function pos(m) {
  const r = m[5].trim().split(/\s+/).map(Number);
  const d = m[6].trim().split(/\s+/).map(s => s.startsWith('-') ? -Math.abs(parseFloat(s)) : parseFloat(s));
  return [(r[0] * 15 + r[1] / 4 + r[2] / 240), d[0] + d[1] / 60 + d[2] / 3600];
}
const plei = rows.filter(m => {
  const [ra, dec] = pos(m);
  return Math.abs(ra - 56.7875) < 0.5 && Math.abs(dec - 24.39) < 0.5;
});
console.log('rows near Pleiades (03h47m +24°23):');
for (const m of plei) console.log('  ', m[2], m[3], m[4], m[5], m[6]);

// 2) what does the wiki M45 row say (xref + coords)?
const html = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/messier.html', 'utf8');
const blk = html.split(/<tr[ >]/).find(b => /<th[^>]*>.*?<a[^>]*>M45<\/a>/s.test(b));
const plain = blk.replace(/<[^>]+>/g, ' ');
console.log('\nM45 row plain text:', JSON.stringify(plain.slice(0, 400)));
