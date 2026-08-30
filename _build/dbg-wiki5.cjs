const fs = require('fs');
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const D = Math.PI / 180;
const cx = fs.readFileSync(B + 'corwin-vii239a.xml', 'utf8');
const t1 = cx.slice(cx.indexOf('<TABLEDATA>'), cx.indexOf('</TABLEDATA>'));
const corwin = {};
for (const m of t1.matchAll(/<TR><TD>([^<]*)<\/TD><TD>([NI])<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>(\d+)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><\/TR>/g)) {
  if (m[4].trim()) continue;
  const key = (m[2] === 'I' ? 'IC ' : 'NGC ') + m[3];
  if (corwin[key]) continue;
  const r = m[5].trim().split(/\s+/).map(Number);
  const raw = m[6].trim().split(/\s+/);
  const neg = raw[0].startsWith('-');
  const dec = (neg ? -1 : 1) * (Math.abs(parseFloat(raw[0])) + (parseFloat(raw[1]) || 0) / 60 + (parseFloat(raw[2]) || 0) / 3600);
  corwin[key] = { ra: r[0] * 15 + r[1] / 4 + r[2] / 240, dec };
}
const html = fs.readFileSync(B + 'messier.html', 'utf8');
function tmpls(seg) {
  const m = seg.match(/"params":\{"1":\{"wt":"([+-]?\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/);
  return m ? [m[1], m[2], m[3] || '0'] : null;
}
const bad = ['M2', 'M6', 'M17', 'M18', 'M20', 'M21', 'M23', 'M24', 'M25', 'M44', 'M50', 'M52', 'M78'];
for (const id of bad) {
  const blk = html.split(/<tr[ >]/).find(b => new RegExp('<th[^>]*>.*?<a[^>]*>' + id + '</a>', 's').test(b));
  const ri = blk.indexOf('"wt":"RA"'), di = blk.indexOf('"wt":"DEC"');
  const rp = tmpls(blk.slice(ri, ri + 800)), dp = tmpls(blk.slice(di, di + 800));
  const ra = (+rp[0] + (+rp[1]) / 60 + (+rp[2]) / 3600) * 15;
  const dec = (Math.abs(+dp[0]) + (+dp[1]) / 60 + (+dp[2]) / 3600) * (dp[0].startsWith('-') ? -1 : 1);
  const plain = blk.replace(/<[^>]+>/g, ' ');
  const xref = (plain.match(/(NGC \d+|IC \d+|Sh2 \d+|Circlet? \d+|Abell \d+)/) || [null])[0];
  const c = xref ? corwin[xref] : null;
  let line = id.padEnd(5) + ' wiki=(' + ra.toFixed(4) + ',' + dec.toFixed(4) + ') xref=' + (xref || 'none');
  if (c) {
    let dra = (c.ra - ra) % 360; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
    line += '  corwin=(' + c.ra.toFixed(4) + ',' + c.dec.toFixed(4) + ') Δ=' + (Math.hypot(dra * Math.cos(dec * D) * 60, (c.dec - dec) * 60)).toFixed(1) + "'";
  }
  console.log(line);
}
