// node tools/ingest-device.js — no sign-in screen: registers a device-bound anonymous account, records consent, uploads one demo trip
// with a car and a coarse location (real weather is looked up server-side from Open-Meteo).
global.window = {}; require('../data.js');
const URL = 'https://qjakepgeqioqrmsufaty.supabase.co', KEY = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS';
const j = async (r) => { const t = await r.text(); try { return { s: r.status, b: JSON.parse(t) }; } catch (e) { return { s: r.status, b: t }; } };
(async () => {
  const reg = await j(await fetch(`${URL}/functions/v1/device-register`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }));
  console.log('register:', reg.s, reg.b.email ? 'device account created' : JSON.stringify(reg.b));
  const lg = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(reg.b) }));
  const H = { apikey: KEY, Authorization: 'Bearer ' + lg.b.access_token, 'Content-Type': 'application/json' };
  const drv = window.DEMO.drivers.find((d) => d.id === 'davis'), t = drv.trips.find((x) => x.id === 'davis-4'), raw = drv.raws[t.id];
  const body = { driver_name: 'Device test', exp_hours: 25, car: { name: 'Test Golf', plate: 'te-1234' }, location: { lat: 56.9496, lon: 24.1052 },
    trip: { id: 'dev-' + Date.now(), start_at: new Date(Date.now() - 90 * 60e3).toISOString(), mode: 'car', role_conf: 1, confirmed: true, weather: 'dry', traffic: 'free', counted: true, source: 'synthetic',
      duration_s: t.durationS, km: t.km, dark_km: t.darkKm, max_g: t.maxG, brake: t.brake, accel: t.accel, corner: t.corner, over_lim_s: t.overLimS, over_safe_s: t.overSafeS, severe_s: t.severeS, phone_ev: t.phoneEv, phone_s: t.phoneS, parkings: t.parkings, lot_cycles: t.lotCycles, lot_s: t.lotS, lot_over_s: t.lotOverS, lot_max: t.lotMax, surge: t.surge, bump: t.bump },
    events: t.events.map(({ i, type, g, ...rest }) => ({ i, type, g, data: Object.keys(rest).length ? rest : undefined })),
    trace: { step: raw.step, v: raw.v, ay100: raw.ay100, lim_runs: raw.limRuns, phone_ranges: raw.phoneRanges } };
  const call = () => fetch(`${URL}/functions/v1/ingest-trip`, { method: 'POST', headers: H, body: JSON.stringify(body) }).then(j);
  let r = await call(); console.log('1st:', r.s, JSON.stringify(r.b).slice(0, 120));
  if (r.s === 403) { const c = await fetch(`${URL}/rest/v1/consents`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ driver_id: r.b.driver_id, purpose: 'collect', granted: true }) }); console.log('consent:', c.status); r = await call(); console.log('2nd:', r.s, JSON.stringify(r.b)); }
})().catch((e) => { console.error(e.message); process.exit(1); });
