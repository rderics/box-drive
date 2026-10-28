/*
 * Reads the demo data from the database (Supabase, EU) and swaps it into window.DEMO. data.js stays as the offline fallback:
 * the app renders instantly from data.js, then calls DB.load(DEMO); if anything fails the data.js data simply stays.
 * Uses only the PUBLIC (publishable) key — row level security allows read-only access to synthetic demo rows.
 * Never put the service-role key in this file.
 */
(function (root) {
  'use strict';
  const URL = 'https://qjakepgeqioqrmsufaty.supabase.co', KEY = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS';
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  async function get(table, order) {
    let out = [], off = 0;
    for (;;) {
      const r = await fetch(`${URL}/rest/v1/${table}?select=*&order=${order}&limit=500&offset=${off}`, { headers: H });
      if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
      const j = await r.json(); out = out.concat(j);
      if (j.length < 500) return out;
      off += 500;
    }
  }

  const PHOTOS = { HA3787: 'volvo.jpg' };      // car photos by plate (spaces and dashes ignored)
  const photoOf = (plate) => PHOTOS[String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || null;
  function convert(rows) {
    const cars = rows.cars.map((c) => ({ id: c.id, name: c.name, plate: c.plate, claims3y: c.claims_3y, make: c.make, model: c.model, year: c.year, fuel: c.fuel, octa: c.octa_valid_until, mine: rows.mine === true, photo: photoOf(c.plate) }));
    const evBy = {};
    for (const e of rows.events) { const o = { i: e.t_idx, type: e.type }; if (e.g != null) o.g = e.g; if (e.data) Object.assign(o, e.data); (evBy[e.trip_id] = evBy[e.trip_id] || []).push(o); }
    const tripBy = {};
    for (const t of rows.trips) {
      (tripBy[t.driver_id] = tripBy[t.driver_id] || []).push({
        id: t.id, startISO: new Date(t.start_at).toISOString(), mode: t.mode, modeConf: t.mode_conf, roleConf: t.role_conf, confirmed: t.confirmed, counted: t.counted, reason: t.reason || '',
        weather: t.weather, traffic: t.traffic, roadType: t.road_type, durationS: t.duration_s, km: t.km, darkKm: t.dark_km, brake: t.brake, accel: t.accel, corner: t.corner,
        overLimS: t.over_lim_s, overSafeS: t.over_safe_s, severeS: t.severe_s, phoneEv: t.phone_ev, phoneS: t.phone_s, maxG: t.max_g, events: evBy[t.id] || [],
        parkings: t.parkings, lotCycles: t.lot_cycles, lotS: t.lot_s, lotOverS: t.lot_over_s, lotMax: t.lot_max, surge: t.surge, bump: t.bump, carId: t.car_id,
      });
    }
    const tripMeta = {}; for (const t of rows.trips) tripMeta[t.id] = t;
    const rawBy = {};
    for (const r of rows.traces) { const m = tripMeta[r.trip_id]; if (!m) continue; (rawBy[m.driver_id] = rawBy[m.driver_id] || {})[r.trip_id] = { hz: 1, step: r.step, startISO: new Date(m.start_at).toISOString(), weather: m.weather, traffic: m.traffic, v: r.v, ay100: r.ay100, limRuns: r.lim_runs, phoneRanges: r.phone_ranges }; }
    /* experience = the larger of the declared profile and what the rides themselves measured (hours behind the wheel, by road / night / bad weather) */
    function measured(trips) {
      const b = { city: 0, highway: 0, night: 0, badweather: 0 }; let h = 0;
      for (const t of trips) {
        if (!t.counted || t.mode !== 'car') continue; const x = (t.durationS || 0) / 3600; h += x;
        if (t.roadType === 'city') b.city += x; else if (t.roadType === 'highway') b.highway += x; else { b.city += x / 2; b.highway += x / 2; }
        if (t.km > 0 && t.darkKm > 0) b.night += x * Math.min(1, t.darkKm / t.km);
        if (t.weather && t.weather !== 'dry') b.badweather += x;
      }
      return { h, b };
    }
    const drivers = rows.drivers.map((d) => {
      const trips = (tripBy[d.id] || []).sort((a, b) => Date.parse(a.startISO) - Date.parse(b.startISO)), m = measured(trips), eb = d.exp_buckets || {};
      return {
        id: d.id, name: d.name, licYears: d.lic_years == null ? null : Number(d.lic_years), expHours: Math.max(Number(d.exp_hours) || 0, m.h),
        expBuckets: Object.fromEntries(Object.keys(m.b).map((k) => [k, Math.max(Number(eb[k]) || 0, m.b[k])])), claims3y: d.claims_3y, note: d.note,
        trips, raws: rawBy[d.id] || {},
      };
    });
    return { cars, drivers };
  }

  /* Loads everything, then mutates `demo` in place (cars + drivers). Resolves with a small status object for the UI. */
  async function load(demo) {
    const t0 = Date.now();
    const [drivers, cars, trips, events, traces] = await Promise.all([get('drivers', 'id'), get('cars', 'id'), get('trips', 'id'), get('trip_events', 'id'), get('trip_traces', 'trip_id')]);
    const out = convert({ drivers, cars, trips, events, traces });
    if (!out.drivers.length || !trips.length) throw new Error('database returned no demo data');
    demo.cars = out.cars; demo.drivers = out.drivers;
    return { source: 'supabase', trips: trips.length, events: events.length, ms: Date.now() - t0 };
  }

  /* The logged-in user's OWN data (row-level security): driver profile, cars, trips, events, traces. An empty account gets illustrative samples (Samples.seed). */
  async function loadMine(demo) {
    const t0 = Date.now(), A = root.Auth, tok = A && await A.token(), u = A && A.user();
    if (!tok || !u) throw new Error('login required');
    const HH = { apikey: KEY, Authorization: 'Bearer ' + tok };
    const q = async (path, order) => { let out = [], off = 0; for (;;) { const r = await fetch(`${URL}/rest/v1/${path}${path.includes('?') ? '&' : '?'}order=${order}&limit=500&offset=${off}`, { headers: HH }); if (!r.ok) throw new Error(`${path.split('?')[0]}: HTTP ${r.status}`); const j = await r.json(); out = out.concat(j); if (j.length < 500) return out; off += 500; } };
    const fetchAll = async () => {
      const drv = (await q('drivers?select=*&user_id=eq.' + u.uid, 'id'))[0]; if (!drv) throw new Error('profile missing');
      const pre = encodeURIComponent(drv.id + '-') + '*';
      const [cars, trips, events, traces] = await Promise.all([q('cars?select=*&created_by=eq.' + u.uid, 'id'), q('trips?select=*&driver_id=eq.' + drv.id, 'start_at'), q('trip_events?select=*&trip_id=like.' + pre, 'id'), q('trip_traces?select=*&trip_id=like.' + pre, 'trip_id')]);
      return { drv, cars, trips, events, traces };
    };
    let r = await fetchAll(), seeded = false;
    if (!r.trips.length && root.Samples) { await root.Samples.seed({ url: URL, key: KEY, token: tok, driver: r.drv, cars: r.cars, demo, sampleDriver: 'martins' }); r = await fetchAll(); seeded = true; }
    const out = convert({ drivers: [r.drv], cars: r.cars, trips: r.trips, events: r.events, traces: r.traces, mine: true });
    demo.cars = out.cars; demo.drivers = out.drivers;
    return { source: 'supabase', mine: true, sample: r.trips.length > 0 && r.trips.every((t) => t.source === 'sample'), sampleCount: r.trips.filter((t) => t.source === 'sample').length, seeded, trips: r.trips.length, events: r.events.length, ms: Date.now() - t0 };
  }

  const api = { load, loadMine, convert, get };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DB = api;
})(typeof self !== 'undefined' ? self : this);
