// node tools/create-ali.js [email] [password]
// Creates (or reuses) the DEMO user for the hackathon — Ali Aslanov, Mercedes-Benz 190E Evo2 — and fills the account with illustrative sample rides.
// Everything goes through the normal public path: `account` Edge Function (sign-up), Supabase Auth login, row-level security. The password is stored by
// Supabase Auth only as a bcrypt hash. All personal details are made up (illustrative).
global.window = {}; require('../data.js');
const Samples = require('../samples.js');
const URL = 'https://qjakepgeqioqrmsufaty.supabase.co', KEY = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS';
const EMAIL = (process.argv[2] || 'ali.aslanov@boxdrive.demo').toLowerCase(), PASSWORD = process.argv[3] || '1234554321';
const j = async (r) => { const t = await r.text(); try { return { s: r.status, b: JSON.parse(t) }; } catch (e) { return { s: r.status, b: t }; } };
const CAR = { name: 'Mercedes-Benz 190E Evo2', plate: 'AL1990', make: 'Mercedes-Benz', model: '190E 2.5-16 Evolution II', year: 1991, fuel: 'petrol', engine_cc: 2463, power_kw: 173, odometer_km: 214380,
  vin: 'WDB2010361F418276', reg_cert_no: 'LV7342915', octa_valid_until: '2027-05-31', claims_3y: 1 };

(async () => {
  let r = await j(await fetch(`${URL}/functions/v1/account`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Ali Aslanov', consent: true }) }));
  console.log('sign-up:', r.s, r.b.error || (r.b.ok ? 'created' : JSON.stringify(r.b)));
  r = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }));
  if (!r.b.access_token) throw new Error('login failed: ' + JSON.stringify(r.b));
  const tok = r.b.access_token, uid = r.b.user.id, H = { apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  const g = async (q) => (await j(await fetch(`${URL}/rest/v1/${q}`, { headers: H }))).b;

  const drv = (await g('drivers?select=*&user_id=eq.' + uid))[0];
  await fetch(`${URL}/rest/v1/drivers?id=eq.${drv.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({
    name: 'Ali Aslanov', lic_years: 6, exp_hours: 850, exp_buckets: { city: 520, highway: 210, night: 60, badweather: 60 }, claims_3y: 1,
    note: { en: 'Classic Mercedes 190E Evo2 enthusiast (illustrative profile).', lv: 'Klasiskā Mercedes 190E Evo2 entuziasts (ilustratīvs profils).' } }) });

  let cars = await g('cars?select=*&created_by=eq.' + uid), car = cars.find((c) => c.plate === CAR.plate);
  if (!car) {
    const id = 'c-' + drv.id.replace(/^u-/, '') + '-evo2';
    const cr = await fetch(`${URL}/rest/v1/cars`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ id, ...CAR, is_demo: false, created_by: uid }) });
    if (!cr.ok) throw new Error('car: ' + (await cr.text()));
    await fetch(`${URL}/rest/v1/driver_cars`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ driver_id: drv.id, car_id: id }) });
    car = { id }; console.log('car created:', id);
  } else console.log('car exists:', car.id);

  const have = await g(`trips?select=id&driver_id=eq.${drv.id}&limit=1`);
  if (!have.length) { const s = await Samples.seed({ url: URL, key: KEY, token: tok, driver: drv, carId: car.id, demo: window.DEMO, sampleDriver: 'aivars' }); console.log('sample rides:', s); }
  else console.log('rides already present, no samples added');
  console.log('done. login:', EMAIL);
})().catch((e) => { console.error(e.message); process.exit(1); });
