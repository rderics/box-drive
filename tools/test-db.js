// node tools/test-db.js — the database copy must score exactly like data.js (needs network; read-only public key)
const assert = require('assert');
global.window = {}; require('../data.js');
const E = require('../engine.js'), DB = require('../db.js');
const base = JSON.parse(JSON.stringify(window.DEMO));
(async () => {
  const demo = JSON.parse(JSON.stringify(base));
  const info = await DB.load(demo);
  console.log('loaded from', info.source, info.trips, 'trips', info.events, 'events in', info.ms, 'ms');
  assert.strictEqual(demo.drivers.length, base.drivers.length); assert.strictEqual(demo.cars.length, base.cars.length);
  for (const d of base.drivers) {
    const o = E.scoreDriver(d.trips, d), n = demo.drivers.find((x) => x.id === d.id);
    const r = E.scoreDriver(n.trips, n);
    assert(Math.abs(o.total - r.total) < 0.05, `${d.id}: ${o.total} vs ${r.total}`);
    assert.strictEqual(n.trips.length, d.trips.length); assert.strictEqual(Object.keys(n.raws).length, Object.keys(d.raws).length);
    const ev = (t) => t.events.length; assert.strictEqual(n.trips.reduce((s, t) => s + ev(t), 0), d.trips.reduce((s, t) => s + ev(t), 0), d.id + ' events');
    console.log(d.id.padEnd(8), 'score data.js', o.total, '== database', r.total);
  }
  console.log('database data matches data.js');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
