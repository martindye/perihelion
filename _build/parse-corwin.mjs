import fs from 'node:fs';
const d = fs.readFileSync(new URL('./corwin-vii239a.xml', import.meta.url), 'utf8');
const tables = d.match(/<TABLE[\s\S]*?<\/TABLE>/g) || [];
console.log('num tables:', tables.length);
for (const [i, tb] of tables.entries()) {
  const fields = [...tb.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  const rows = tb.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
  console.log('\n== TABLE', i, 'rows:', rows.length);
  console.log('   fields:', fields.join(', '));
  const r0 = rows[0];
  if (r0) console.log('   row0:', r0.replace(/<\/?TD>/g, ' | ').replace(/<\/?TR>/g, '').replace(/\| *\|/g, '|').slice(0, 220));
}
