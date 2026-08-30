async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
for (const [label, cmd] of [['Phobos', 'Phobos'], ['Titan', '606'], ['Iapetus', 'Iapetus'], ['Charon', '951.1'], ['Charon-name', 'Charon']]) {
  const t = await hz({ COMMAND: cmd, OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
  const i = t.indexOf('ORBIT');
  console.log('=== ' + label + ' (cmd=' + cmd + ') ===');
  console.log(t.slice(Math.max(0, i - 200), i + 350).replace(/\n/g, ' ⏎ '));
  console.log();
}
