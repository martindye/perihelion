import fs from 'node:fs';
const d = fs.readFileSync(new URL('./messier.html', import.meta.url), 'utf8');
const ti = d.indexOf('id="mwuw"');
const tbl = d.slice(d.lastIndexOf('<table', ti), d.indexOf('</table>', ti));
const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
for (const rid of ['M31', 'M33', 'M82', 'M87']) {
  const r = rows.find(r => { const m = r.match(/>(M\d{1,3})</); return m && m[1] === rid; });
  const re = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const cc = [];
  while ((m = re.exec(r))) cc.push(m[2]);
  console.log('===', rid);
  console.log('dist RAW :', JSON.stringify(cc[5].slice(0, 300)));
  console.log('dist sort:', (cc[5].match(/data-sort-value=\\"([^"\\]*)/) || [])[1]);
  console.log('vis text :', JSON.stringify(cc[5].replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
}
