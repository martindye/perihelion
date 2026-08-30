async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
const names = ['Io', 'Europa', 'Ganymede', 'Callisto', 'Phobos', 'Deimos', 'Titan', 'Rhea', 'Iapetus', 'Triton', 'Charon'];
for (const n of names) {
  try {
    const t = await hz({ COMMAND: n, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00', STEP_SIZE: '0d' });
    const m = t.match(/Target body name: ([^\n]+)/);
    const e = t.match(/error[^\n]*|Error[^\n]*/);
    console.log(n.padEnd(10), '->', m ? m[1].trim() : ('no-target-line: ' + t.slice(0, 100).replace(/\n/g, ' ')));
  } catch (err) {
    console.log(n, 'ERR', err.message.slice(0, 60));
  }
  await new Promise(r => setTimeout(r, 250));
}
