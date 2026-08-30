/* Definitive identity probe: query candidate moon CMDs, read 'Target body name' back */
async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
const RANGE = { START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00', STEP_SIZE: '0d' };
const cands = ['499.1', '599.1', '599.2', '699.1', '699.2', '699.3', '699.4', '799.1', '799.2', '799.3', '799.4', '799.5', '799.6', '799.7', '999.1', '951.1'];
for (const c of cands) {
  let t;
  try {
    t = await hz({ COMMAND: c, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:01', STEP_SIZE: '1m' });
    const m = t.match(/Target body name: ([^\n]+)/);
    const c2 = t.match(/Center body name: ([^\n]+)/);
    console.log(c.padEnd(7), '|', (m ? m[1] : t.slice(0, 80).replace(/\n/g, ' ')), '| center:', c2 ? c2[1] : '?');
  } catch (e) {
    console.log(c, 'ERR', e.message.slice(0, 60));
  }
  await new Promise(r => setTimeout(r, 250));
}
