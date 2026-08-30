const fs = require('fs');
const cx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/corwin-vii239a.xml', 'utf8');
const t1 = cx.slice(cx.indexOf('<TABLEDATA>'), cx.indexOf('</TABLEDATA>'));
const nums = ['598', '545', '1952', '2323', '2068', '6121', '6405', '6613', '6514', '6531', '6494', '2632', '6717', '7654'];
for (const n of nums) {
  const re = new RegExp('<TR><TD>[^<]*</TD><TD>N</TD><TD>' + n + '</TD>.*?</TR>', 'g');
  const rows = [...t1.matchAll(re)];
  console.log('N ' + n + ': ' + (rows.length ? rows.map(m => m[0].replace(/>\s*</g, '><')).join(' | ') : 'NOT FOUND'));
}
// also: what NGC number does the wiki give for M33? and dump the M33 row's xref cell
const html = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/messier.html', 'utf8');
const b33 = html.split(/<tr[ >]/).find(b => /<th[^>]*>.*?<a[^>]*>M33<\/a>/s.test(b));
const cells33 = [...b33.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
console.log('\nM33 cells:', JSON.stringify(cells33.slice(0, 9)));
