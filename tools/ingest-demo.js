// node tools/ingest-demo.js <email> <password> [tripId]
// Signs in (Supabase Auth, public key) and uploads ONE demo trip to the ingest-trip Edge Function as if it came from a phone.
// First call on a new user creates the driver profile and answers 403 until a 'collect' consent exists; this script records it.
global.window = {}; require('../data.js');
const [email, password, want] = process.argv.slice(2);
const URL = 'https://qjakepgeqioqrmsufaty.supabase.co', KEY = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS';
const j = async (r) => { const t = await r.text(); try { return { s: r.status, b: JSON.parse(t) }; } catch (e) { return { s: r.status, b: t }; } };
(async () => {
  const lg = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }));
  if (!lg.b.access_token) throw new Error('sign-in failed: ' + JSON.stringify(lg.b));
  const H = { apikey: KEY, Authorization: 'Bearer ' + lg.b.access_token, 'Content-Type': 'application/json' };
  const drv = window.DEMO.drivers.find((d) => d.id === 'davis'), t = drv.trips.find((x) => x.id === (want || 'davis-4')) || drv.trips.find((x) => x.events.length);
  const raw = drv.raws[t.id];
  const body = { driver_name: 'Ingest test', exp_hours: 25, trip: { id: 'phone-' + Date.now(), start_at: t.startISO, mode: t.mode, mode_conf: t.modeConf, role_conf: t.roleConf, confirmed: true, weather: t.weather, traffic: t.traffic, road_type: t.roadType, counted: true,
      duration_s: t.durationS, km: t.km, dark_km: t.darkKm, max_g: t.maxG, brake: t.brake, accel: t.accel, corner: t.corner, over_lim_s: t.overLimS, over_safe_s: t.overSafeS, severe_s: t.severeS, phone_ev: t.phoneEv, phone_s: t.phoneS,
      parkings: t.parkings, lot_cycles: t.lotCycles, lot_s: t.lotS, lot_over_s: t.lotOverS, lot_max: t.lotMax, surge: t.surge, bump: t.bump,
      source: 'synthetic' /* ignored by the function: uploads are always source=phone */ },
    events: t.events.map(({ i, type, g, ...rest }) => ({ i, type, g, data: Object.keys(rest).length ? rest : undefined })),
    trace: { step: raw.step, v: raw.v, ay100: raw.ay100, lim_runs: raw.limRuns, phone_ranges: raw.phoneRanges } };
  const call = () => fetch(`${URL}/functions/v1/ingest-trip`, { method: 'POST', headers: H, body: JSON.stringify(body) }).then(j);
  let r = await call(); console.log('1st call:', r.s, JSON.stringify(r.b).slice(0, 160));
  if (r.s === 403) {
    const c = await fetch(`${URL}/rest/v1/consents`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ driver_id: r.b.driver_id, purpose: 'collect', granted: true }) });
    console.log('consent recorded:', c.status);
    r = await call(); console.log('2nd call:', r.s, JSON.stringify(r.b));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
