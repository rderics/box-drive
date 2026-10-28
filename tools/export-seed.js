// node tools/export-seed.js  -> writes ./seed-out/*.json (payloads for tables cars, drivers, driver_cars, trips, trip_events, trip_traces)
// Load them with a service-role context (Edge Function or psql/COPY); never ship the service-role key to a browser.
global.window = {}; require('../data.js');
const D = window.DEMO, fs = require('fs'), out = 'seed-out';
const cars = D.cars.map((c) => ({ id: c.id, name: c.name, plate: c.plate, claims_3y: c.claims3y, is_demo: true }));
const drivers = D.drivers.map((d) => ({ id: d.id, name: d.name, lic_years: d.licYears, exp_hours: d.expHours, exp_buckets: d.expBuckets, claims_3y: d.claims3y, note: d.note, is_demo: true }));
const trips = [], events = [], dc = new Set(), traces = [];
for (const d of D.drivers) {
  for (const t of d.trips) {
    if (t.carId) dc.add(d.id + '|' + t.carId);
    trips.push({ id: t.id, driver_id: d.id, car_id: t.carId || null, start_at: t.startISO, source: 'synthetic', mode: t.mode, mode_conf: t.modeConf, role_conf: t.roleConf, confirmed: t.confirmed, weather: t.weather, traffic: t.traffic, road_type: t.roadType, counted: t.counted, reason: t.reason || null, duration_s: t.durationS, km: t.km, dark_km: t.darkKm, brake: t.brake, accel: t.accel, corner: t.corner, over_lim_s: t.overLimS, over_safe_s: t.overSafeS, severe_s: t.severeS, phone_ev: t.phoneEv, phone_s: t.phoneS, max_g: t.maxG, parkings: t.parkings || 0, lot_cycles: t.lotCycles || 0, lot_s: t.lotS || 0, lot_over_s: t.lotOverS || 0, lot_max: t.lotMax || 0, surge: t.surge || 0, bump: t.bump || 0 });
    for (const e of t.events || []) { const { i, type, g, ...rest } = e; events.push({ trip_id: t.id, t_idx: i, type, g: g == null ? null : g, data: Object.keys(rest).length ? rest : null }); }
  }
  for (const [id, r] of Object.entries(d.raws || {})) traces.push({ trip_id: id, step: r.step || 1, v: r.v, ay100: r.ay100, lim_runs: r.limRuns, phone_ranges: r.phoneRanges || [] });
}
fs.mkdirSync(out, { recursive: true });
const put = (n, rows) => fs.writeFileSync(`${out}/${n}.json`, JSON.stringify(rows));
put('cars', cars); put('drivers', drivers); put('driver_cars', [...dc].map((x) => { const [a, b] = x.split('|'); return { driver_id: a, car_id: b }; })); put('trips', trips); put('trip_events', events); put('trip_traces', traces);
console.log({ cars: cars.length, drivers: drivers.length, trips: trips.length, events: events.length, traces: traces.length });
