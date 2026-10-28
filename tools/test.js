// node test.js — sanity checks for the scoring engine
const assert = require('assert');
const E = require('../engine.js');
const base = { id: 't', startISO: '2026-10-20T09:00:00Z', hz: 1, mode: 'car', roleConf: 1, confirmed: true, weather: 'dry', traffic: 'free' };
const flat = (v, n) => Array(n).fill(v);

// 1. same count, different rate: 9 hard brakes on 50 km is 20x the rate of 9 on 1000 km (workshop slide)
const a = E.scoreDriver([{ counted: true, km: 50, durationS: 3600, brake: 9, accel: 0, corner: 0, overSafeS: 0, overLimS: 0, severeS: 0, phoneEv: 0, darkKm: 0, weather: 'dry', startISO: base.startISO }], { claims3y: 0, expHours: 300 });
const b = E.scoreDriver([{ counted: true, km: 1000, durationS: 36000, brake: 9, accel: 0, corner: 0, overSafeS: 0, overLimS: 0, severeS: 0, phoneEv: 0, darkKm: 0, weather: 'dry', startISO: base.startISO }], { claims3y: 0, expHours: 300 });
assert(Math.abs(a.kpi.harshPer100 / b.kpi.harshPer100 - 20) < 1e-9, 'rate per 100 km');
assert(a.total < b.total, 'higher rate -> lower score');

// 2. a hard brake is detected: 100 -> 40 km/h in 2 s (~0.85 g)
const v = [...flat(100, 20), 70, 40, ...flat(40, 20)];
const t1 = E.analyzeTrip(Object.assign({}, base, { v, lim: flat(130, v.length) }));
assert.strictEqual(t1.brake, 1, 'one hard brake');
// ...and a gentle one is not: 100 -> 40 over 20 s
const v2 = [...flat(100, 20)]; for (let s = 1; s <= 20; s++) v2.push(100 - 3 * s); v2.push(...flat(40, 10));
assert.strictEqual(E.analyzeTrip(Object.assign({}, base, { v: v2, lim: flat(130, v2.length) })).brake, 0, 'gentle brake not counted');

// 3. condition-adjusted speed: same 70 km/h under a 70 limit is safe when dry, over the safe speed in snow
const run = (w) => E.analyzeTrip(Object.assign({}, base, { weather: w, v: flat(70, 100), lim: flat(70, 100) })).overSafeS;
assert.strictEqual(run('dry'), 0); assert(run('snow') > 90, 'snow: over safe speed');

// 4. trains and likely passengers are not scored
assert.strictEqual(E.analyzeTrip(Object.assign({}, base, { mode: 'train', v: flat(100, 30), lim: flat(90, 30) })).counted, false);
assert.strictEqual(E.analyzeTrip(Object.assign({}, base, { roleConf: 0.35, confirmed: null, v: flat(50, 30), lim: flat(50, 30) })).counted, false);
assert.strictEqual(E.analyzeTrip(Object.assign({}, base, { roleConf: 0.35, confirmed: true, v: flat(50, 30), lim: flat(50, 30) })).counted, true, 'driver confirms -> counted');

// 5. phone at a red light is not counted
assert.strictEqual(E.analyzeTrip(Object.assign({}, base, { v: flat(0, 30), lim: flat(50, 30), phone: flat(1, 30) })).phoneEv, 0);

// 6. experience: more hours -> higher experience score; veteran with bad habits still scores low overall
const exp = (h) => E.scoreDriver([], { expHours: h, expBuckets: { city: 100, highway: 100, night: 100, badweather: 100 } }).scores.experience;
assert(exp(800) > exp(150) && exp(150) > exp(25));
const bad = { counted: true, km: 500, durationS: 36000, brake: 20, accel: 10, corner: 10, overSafeS: 9000, overLimS: 9000, severeS: 900, phoneEv: 40, darkKm: 100, weather: 'dry', startISO: base.startISO };
assert(E.scoreDriver([bad], { claims3y: 1, expHours: 12000, expBuckets: { city: 5000, highway: 5000, night: 1200, badweather: 800 } }).total < 50, 'experience is not a prize');

// 7. uncertainty shrinks with data
const few = E.scoreDriver([bad], { expHours: 100 }), many = E.scoreDriver(Array(20).fill(bad), { expHours: 100 });
assert(many.sigma < few.sigma, 'more km -> narrower band');
console.log('all engine tests passed');
// 8. premium preview: no surcharge, discount grows with score
const p50 = E.premiumPreview(50), p80 = E.premiumPreview(80), p100 = E.premiumPreview(100), p20 = E.premiumPreview(20);
assert.strictEqual(p20.eur, p50.eur); assert(p80.eur < p50.eur && p100.eur < p80.eur); assert.strictEqual(p100.discountPct, 25);
console.log('premium tests passed');

// 9. experience weight: bigger for a brand-new driver, fades with hours; all weights sum to 100
const rn = E.scoreDriver([], { expHours: 0 }), rv = E.scoreDriver([], { expHours: 5000, expBuckets: { city: 900, highway: 900, night: 900, badweather: 900 } });
assert(rn.weights.experience > 30 && rv.weights.experience < 12 && rn.weights.experience > rv.weights.experience);
for (const r of [rn, rv]) assert(Math.abs(Object.values(r.weights).reduce((a, b) => a + b, 0) - 100) < 1e-9, 'weights sum to 100');
console.log('experience weight tests passed');
