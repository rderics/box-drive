/* Illustrative SAMPLE data for an empty account (hackathon: "if the database is empty, add samples").
 * Samples.seed({ url, key, token, driver, cars, demo, sampleDriver }) copies the trips of one built-in demo driver (data.js) into the user's OWN
 * rows as source = 'sample' (visible only to the owner; the UI labels them as samples). Adds a sample car if the user has none.
 * Runs in the browser (app) and in Node (tools/create-ali.js). Uses only the user's own JWT and row-level security. */
(function (root) {
  'use strict';
  function rnd() { const a = new Uint8Array(4); (root.crypto || require('crypto').webcrypto).getRandomValues(a); return Array.prototype.map.call(a, (x) => ('0' + x.toString(16)).slice(-2)).join(''); }

  async function post(ctx, table, rows) {
    for (let i = 0; i < rows.length; i += 100) {
      const r = await fetch(`${ctx.url}/rest/v1/${table}`, { method: 'POST', headers: { apikey: ctx.key, Authorization: 'Bearer ' + ctx.token, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 100)) });
      if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
  }

  async function seed(ctx) {
    const demo = ctx.demo || root.DEMO, src = demo.drivers.find((d) => d.id === (ctx.sampleDriver || 'martins')) || demo.drivers[0];
    const uid = ctx.driver.user_id, did = ctx.driver.id;
    let carId = ctx.carId || (ctx.cars && ctx.cars[0] && ctx.cars[0].id);
    if (!carId) {
      carId = 'c-' + did.replace(/^u-/, '') + '-' + rnd();
      await post(ctx, 'cars', [{ id: carId, name: 'Paraug-auto (VW Golf)', plate: 'PARAUGS', make: 'Volkswagen', model: 'Golf', year: 2015, fuel: 'petrol', engine_cc: 1395, power_kw: 90, odometer_km: 142000, claims_3y: 0, is_demo: false, created_by: uid, data_source: 'sample' }]);
      await post(ctx, 'driver_cars', [{ driver_id: did, car_id: carId }]);
    } else {
      // make sure the driver is linked to the car (idempotent insert is not possible without upsert headers; ignore a duplicate error)
      try { await post(ctx, 'driver_cars', [{ driver_id: did, car_id: carId }]); } catch (e) { /* already linked */ }
    }
    // shift the dates so the newest sample trip is "an hour ago"
    const last = Math.max(...src.trips.map((t) => Date.parse(t.startISO))), shift = Date.now() - 3600e3 - last;
    const idOf = (t) => `${did}-s-${t.id}`.slice(0, 60);
    const trips = [], events = [], traces = [];
    for (const t of src.trips) {
      trips.push({ id: idOf(t), driver_id: did, car_id: carId, start_at: new Date(Date.parse(t.startISO) + shift).toISOString(), source: 'sample', mode: t.mode, mode_conf: t.modeConf, role_conf: t.roleConf, confirmed: t.confirmed,
        weather: t.weather, traffic: t.traffic, road_type: t.roadType, counted: t.counted, reason: t.reason || null, duration_s: t.durationS, km: t.km, dark_km: t.darkKm, max_g: t.maxG,
        brake: t.brake, accel: t.accel, corner: t.corner, over_lim_s: t.overLimS, over_safe_s: t.overSafeS, severe_s: t.severeS, phone_ev: t.phoneEv, phone_s: t.phoneS,
        parkings: t.parkings || 0, lot_cycles: t.lotCycles || 0, lot_s: t.lotS || 0, lot_over_s: t.lotOverS || 0, lot_max: t.lotMax || 0, surge: t.surge || 0, bump: t.bump || 0, weather_src: 'sample' });
      for (const e of t.events || []) { const { i, type, g, ...rest } = e; events.push({ trip_id: idOf(t), t_idx: i, type, g: g == null ? null : g, data: Object.keys(rest).length ? rest : null }); }
      const r = (src.raws || {})[t.id]; if (r) traces.push({ trip_id: idOf(t), step: r.step || 1, v: r.v, ay100: r.ay100, lim_runs: r.limRuns, phone_ranges: r.phoneRanges || [] });
    }
    await post(ctx, 'trips', trips); await post(ctx, 'trip_events', events); await post(ctx, 'trip_traces', traces);
    return { trips: trips.length, events: events.length, carId };
  }

  const api = { seed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Samples = api;
})(typeof self !== 'undefined' ? self : this);
