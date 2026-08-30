import fs from 'node:fs';
const html = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/sfdso200.html', 'utf8');
/* table rows: <tr ...><td>rank</td><td><a...>NAME</a></td><td>RA</td><td>Dec</td>...<td>V</td>...
   Strategy: strip tags per <tr>, keep the rows mentioning our target names. */
const rows = html.split(/<tr/i).map(r => {
  const cells = r.split(/<t[dh]/i).slice(1).map(c => c.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
  return cells;
});
const want = /zosma|chertan|denebola|regulus|algieba|merga|tianguan|adhafera|ras elased|larawag|lesath|dschubba|acrab|hamal|sheratan|mesarthim|wasat|heze|vindemiatrix|spica|castor|pollux|alhena|aldebaran|elmath|elnath|antares|sargas|shaula|sco|vir|leo|ari|gem|tau/i;
for (const r of rows) {
  const line = r.join(' | ');
  if (line.length < 10) continue;
  if (/zosma|chertan|denebola|merga|tianguan|adhafera|elased|larawag|lesath|dschubba|hamal|sheratan|mesarthim|wasat|heze|vindemiatrix|sargas|shaula|graffias|acrab|firkard/i.test(line)) {
    console.log(line.slice(0, 220));
  }
}
