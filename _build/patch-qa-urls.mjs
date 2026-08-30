import fs from 'node:fs';
import path from 'node:path';
const dir = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa/';
let n = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.mjs')) continue;
  const fp = path.join(dir, f);
  const s = fs.readFileSync(fp, 'utf8');
  if (/index\.html\?dbg=1/.test(s)) continue;
  const t = s.replace(/(planetarium\/index\.html)'/g, "$1?dbg=1'");
  if (t !== s) { fs.writeFileSync(fp, t); n++; console.log('patched', f); }
}
console.log('done', n);
