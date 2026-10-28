/*
 * Builds data.js: SYNTHETIC demo drivers + two Assetto-Corsa-format sample sessions.
 * Everything here is simulated (seeded, reproducible). Real data (organisers' dataset or an Assetto Corsa log) is imported in the UI.
 * Run: node gen.js
 */
const fs = require('fs');
const E = require('../engine.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const U = (r, a, b) => a + (b - a) * r();
const N = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/* parking phase (1 Hz): stop-go manoeuvres; Bp = {tries, speed, pSurge, pBump}. Own RNG stream so the rest of the simulation is unchanged. */
function lotPhase(rp, Bp) {
  const v = [], bump = [], cycles = Math.max(1, Math.round(Bp.tries * U(rp, 0.6, 1.5)));
  for (let c = 0; c < cycles; c++) {
    const top = Math.max(5, Bp.speed * U(rp, 0.6, 1.2));
    if (rp() < Bp.pSurge) v.push(0, top + 14, top + 14, top * 0.4, 0, 0);          // pedal mix-up: sudden jump from standstill
    else v.push(0, top * 0.5, top, top, top * 0.6, top * 0.2, 0, 0);
    if (rp() < Bp.pBump) { v.push(top * 0.3, 0); bump.push({ i: v.length - 1, g: Math.round(U(rp, 0.18, 0.5) * 100) / 100 }); v.push(0); }
  }
  return { v: v.map((x) => Math.round(x * 10) / 10), ay: v.map(() => Math.round(U(rp, -0.05, 0.05) * 100) / 100), lim: v.map(() => 15), phone: v.map(() => 0), bump };
}

/* kinematic trip simulator: segments with limits and (maybe) stops; behaviour parameters decide how "human" it is */
function simulate(cfg, r) {
  const dt = 1 / (cfg.hz || 1), B = cfg.beh, safeF = E.P.safeFactor[cfg.weather];
  const segs = []; let km = 0;
  const mk = (road) => road === 'city'
    ? { lim: [30, 50, 50, 50, 70][Math.floor(r() * 5)], len: U(r, 0.3, 1.1), stop: r() < 0.55 }
    : { lim: 90, len: U(r, 3, 10), stop: false };
  while (km < cfg.km) {
    const frac = km / cfg.km;
    const road = cfg.road === 'city' ? 'city' : cfg.road === 'highway' ? (frac < 0.06 || frac > 0.94 ? 'city' : 'highway') : (frac < 0.22 || frac > 0.78 ? 'city' : 'highway');
    const s = mk(road); segs.push(s); km += s.len;
  }
  segs[segs.length - 1].stop = true;
  const v = [], ay = [], lim = [], phone = [];
  let speed = 0, phoneLeft = 0, turnLeft = 0, turnA = 0;
  for (const seg of segs) {
    let pos = 0;
    const harshStop = r() < B.pHarsh, aPlan = harshStop ? U(r, 3.5, 4.8) : U(r, 1.0, 2.0);
    const hardAcc = r() < B.pHardAcc;
    let tgt = seg.lim * (r() < B.speedProb ? 1 + B.over * U(r, 0.6, 1.4) : 0.97);
    tgt *= 1 - B.care * (1 - safeF);
    if (cfg.traffic === 'dense' && seg.lim <= 70) tgt = Math.min(tgt, U(r, 28, 45));
    const aAcc = hardAcc ? U(r, 10.5, 13) : U(r, 3.5, 6);
    let guard = 0;
    while (pos < seg.len && guard++ < 20000) {
      const distM = (seg.len - pos) * 1000, vms = speed / 3.6;
      if (seg.stop && distM <= vms * vms / (2 * aPlan) * 1.15 + vms * dt + 2) {
        const aNeed = vms * vms / (2 * Math.max(distM - 0.5, 1)), dec = Math.min(aPlan, Math.max(aNeed, 0.8));
        speed = Math.max(0, (vms - dec * dt) * 3.6); if (speed < 2) { speed = 0; pos = seg.len; }
      }
      else if (speed < tgt) speed += Math.min(aAcc * dt, tgt - speed);
      else speed -= Math.min(4.5 * dt, speed - tgt);
      pos += speed / 3600 * dt;
      if (turnLeft <= 0 && speed > 12 && r() < dt / (seg.lim <= 50 ? 90 : 240)) { turnLeft = 4; turnA = r() < B.corner ? U(r, 0.38, 0.5) : U(r, 0.10, 0.22); if (r() < 0.5) turnA = -turnA; }
      const a = (turnLeft > 0 ? turnA * Math.sin(Math.PI * (1 - turnLeft / 4)) : 0) + 0.025 * N(r);
      if (turnLeft > 0) turnLeft -= dt;
      if (phoneLeft <= 0 && r() < B.phone / 3600 * dt) phoneLeft = U(r, 5, 12);
      v.push(Math.round(speed * 10) / 10); ay.push(Math.round(a * 100) / 100); lim.push(seg.lim); phone.push(phoneLeft > 0 ? 1 : 0);
      phoneLeft -= dt;
    }
    if (seg.stop) { const dwell = Math.round(U(r, 6, 22) / dt); for (let i = 0; i < dwell; i++) { v.push(0); ay.push(0); lim.push(seg.lim); phone.push(r() < 0.25 ? 1 : 0); } speed = 0; }
  }
  if (cfg.rp && B.park) {
    const L = lotPhase(cfg.rp, B.park), Pk = lotPhase(cfg.rp, B.park), n0 = v.length, off = L.v.length + n0;
    return { v: [...L.v, ...v, ...Pk.v], ay: [...L.ay, ...ay, ...Pk.ay], lim: [...L.lim, ...lim, ...Pk.lim], phone: [...L.phone, ...phone, ...Pk.phone],
      lot: [[0, L.v.length], [off, off + Pk.v.length]], bump: L.bump.concat(Pk.bump.map((b) => ({ i: b.i + off, g: b.g }))) };
  }
  return { v, ay, lim, phone };
}

/* train: smooth, long, regular stops; no phone/corner logic */
function simulateTrain(r) {
  const v = [], ay = [], lim = [], phone = []; let s = 0;
  for (let st = 0; st < 8; st++) {
    for (let i = 0; i < 90; i++) { s = Math.min(100, s + 1.1); v.push(Math.round(s)); } for (let i = 0; i < 150; i++) v.push(Math.round(100 + N(r) * 1.5));
    for (let i = 0; i < 80; i++) { s = Math.max(0, s - 1.25); v.push(Math.round(s)); } for (let i = 0; i < 40; i++) v.push(0); s = 0;
  }
  for (let i = 0; i < v.length; i++) { ay.push(Math.round(0.01 * N(r) * 100) / 100); lim.push(90); phone.push(r() < 0.5 ? 1 : 0); }
  return { v, ay, lim, phone };
}

/* compact storage: ints, run-length limits, phone ranges; long trips are thinned (step) */
function compact(rw) {
  const n = rw.v.length, step = Math.max(1, Math.ceil(n / 2500)), v = [], ay = [], runs = [], ph = []; let inp = false, ps = 0;
  for (let i = 0; i < n; i += step) {
    v.push(Math.round(rw.v[i])); ay.push(Math.round(rw.ay[i] * 100));
    const L = rw.lim[i]; if (runs.length && runs[runs.length - 1][0] === L) runs[runs.length - 1][1]++; else runs.push([L, 1]);
    const p = rw.phone[i], k = v.length - 1; if (p && !inp) { inp = true; ps = k; } if (!p && inp) { inp = false; ph.push([ps, k]); }
  }
  if (inp) ph.push([ps, v.length]);
  return { hz: 1, step, startISO: rw.startISO, weather: rw.weather, traffic: rw.traffic, v, ay100: ay, limRuns: runs, phoneRanges: ph };
}
const WEATHER_DAYS = {}; // same weather for everybody on a given day
function weatherOf(day) {
  if (!WEATHER_DAYS[day]) { const r = mulberry32(day * 7919 + 13)(); WEATHER_DAYS[day] = r < 0.55 ? 'dry' : r < 0.88 ? 'wet' : r < 0.95 ? 'fog' : 'snow'; }
  return WEATHER_DAYS[day];
}
const D0 = Date.UTC(2026, 8, 30);   // Wed 30 Sep 2026 .. Tue 27 Oct
function startISO(day, hLocal, mLocal) {
  const d = new Date(D0 + day * 864e5); const off = d.getTime() >= Date.UTC(2026, 9, 25) ? 2 : 3;
  return new Date(D0 + day * 864e5 + ((hLocal - off) * 60 + mLocal) * 60e3).toISOString();
}
const dow = (day) => (new Date(D0 + day * 864e5).getUTCDay() + 6) % 7; // 0 = Monday

const DRIVERS = [
  { id: 'martins', name: 'Mārtiņš K.', licYears: 5, expHours: 150, expBuckets: { city: 110, highway: 30, night: 5, badweather: 8 }, claims3y: 0, seed: 11,
    note: { en: 'Licensed 5 years, but drives mostly at weekends.', lv: 'Tiesības 5 gadus, bet brauc galvenokārt brīvdienās.' },
    beh: { over: 0.08, speedProb: 0.07, pHarsh: 0.03, pHardAcc: 0.015, phone: 1.0, corner: 0.02, care: 0.8 , park: { tries: 1.2, speed: 5, pSurge: 0.01, pBump: 0.01 } },
    plan(day) { const d = dow(day); const t = []; if (d === 5) t.push([11, 0, 'city', 8, 'free']); if (d === 6) t.push([16, 0, 'mixed', 25, 'free']); if (d === 2) t.push([18, 30, 'city', 6, 'dense']); return t; } },
  { id: 'elina', name: 'Elīna B.', licYears: 2, expHours: 800, expBuckets: { city: 420, highway: 260, night: 60, badweather: 90 }, claims3y: 0, seed: 22,
    note: { en: 'Licensed only 2 years, but drives to work every day.', lv: 'Tiesības tikai 2 gadus, bet katru dienu brauc uz darbu.' },
    beh: { over: 0.0, speedProb: 0.0, pHarsh: 0.004, pHardAcc: 0.002, phone: 0.0, corner: 0.004, care: 0.95 , park: { tries: 1.0, speed: 4, pSurge: 0.0, pBump: 0.002 } },
    plan(day) { const d = dow(day); const t = []; if (d < 5) { t.push([7, 40, 'mixed', 18, 'dense']); t.push([17, 20, 'mixed', 18, 'dense']); } if (d === 5 && day % 2 === 0) t.push([12, 0, 'highway', 30, 'free']); return t; } },
  { id: 'davis', name: 'Dāvis R.', licYears: 0.33, expHours: 25, expBuckets: { city: 20, highway: 3, night: 2, badweather: 0 }, claims3y: 0, seed: 33,
    note: { en: 'New driver (4 months), drives fast, often at night.', lv: 'Jauns braucējs (4 mēneši), brauc ātri, bieži naktīs.' },
    beh: { over: 0.25, speedProb: 0.65, pHarsh: 0.14, pHardAcc: 0.07, phone: 3.0, corner: 0.10, care: 0.0 , park: { tries: 3.2, speed: 9, pSurge: 0.05, pBump: 0.03 } },
    plan(day) { const d = dow(day); const t = []; if (d === 4 || d === 5) t.push([23, 20, 'city', 12, 'free']); if (d === 0 || d === 2 || d === 3) t.push([8, 10, 'city', 9, 'dense']); return t; } },
  { id: 'aivars', name: 'Aivars S.', licYears: 20, expHours: 12000, expBuckets: { city: 5000, highway: 5000, night: 1200, badweather: 800 }, claims3y: 1, seed: 44,
    note: { en: 'Licensed 20 years, night shifts — experience is no guarantee of safe habits.', lv: 'Tiesības 20 gadus, nakts maiņas — pieredze negarantē drošus ieradumus.' },
    beh: { over: 0.12, speedProb: 0.12, pHarsh: 0.05, pHardAcc: 0.03, phone: 2.0, corner: 0.03, care: 0.5 , park: { tries: 2.0, speed: 7, pSurge: 0.02, pBump: 0.012 } },
    plan(day) { const d = dow(day); const t = []; if (d < 5) { t.push([4, 40, 'highway', 40, 'free']); t.push([15, 30, 'mixed', 40, 'free']); } if (d === 5 && day < 7) t.push([10, 0, 'highway', 170, 'free']); return t; } },
];

const out = { synthetic: true, generated: new Date().toISOString(), drivers: [], ac: {},
  cars: [
    { id: 'golf', name: 'VW GOLF', plate: 'EB 4821', claims3y: 0 }, { id: 'fiesta', name: 'FORD FIESTA', plate: 'FD 3307', claims3y: 1 },
    { id: 'corolla', name: 'TOYOTA COROLLA', plate: 'MK 2093', claims3y: 0 }, { id: 'bmw', name: 'BMW 320D', plate: 'DR 7710', claims3y: 0 }, { id: 'volvo', name: 'VOLVO V90', plate: 'AS 1450', claims3y: 1 } ] };
for (const dr of DRIVERS) {
  const r = mulberry32(dr.seed); const trips = []; let n = 0; const rawKeep = {};
  const add = (day, h, m, road, km, traffic, extra) => {
    const weather = weatherOf(day);
    const sim = simulate({ road, km, weather, traffic, hz: 1, beh: dr.beh, rp: mulberry32(dr.seed * 1000 + n) }, r);
    const raw = Object.assign({ id: dr.id + '-' + (++n), startISO: startISO(day, h, m), hz: 1, mode: 'car', modeConf: 0.97, roleConf: 0.95, confirmed: true, weather, traffic, roadType: road }, sim, extra || {});
    const s = E.analyzeTrip(raw); trips.push(s); rawKeep[s.id] = raw;
  };
  for (let day = 0; day < 28; day++) for (const [h, m, road, km, traffic] of dr.plan(day)) add(day, h, m, road, km, traffic);
  if (dr.id === 'martins') {
    // a train trip and a trip where a friend drove: both detected and excluded, shown as such
    const tr = simulateTrain(r);
    const rawT = Object.assign({ id: 'martins-train', startISO: startISO(5, 9, 15), hz: 1, mode: 'train', modeConf: 0.93, roleConf: 0.2, confirmed: null, weather: 'dry', traffic: 'free', roadType: 'rail' }, tr);
    trips.push(E.analyzeTrip(rawT)); rawKeep['martins-train'] = rawT;
    add(11, 21, 40, 'city', 10, 'free', { id: 'martins-passenger', roleConf: 0.35, confirmed: null, modeConf: 0.9 });
    trips[trips.length - 1].id = 'martins-passenger';
  }
  trips.sort((a, b) => Date.parse(a.startISO) - Date.parse(b.startISO));
  // OCTA is insured per CAR: assign each trip to a car (Elīna and Mārtiņš share the Fiesta)
  const carFor = { martins: (t, i) => (t.mode !== 'car' ? null : i % 2 === 1 ? 'fiesta' : 'corolla'), elina: (t, i) => (t.roadType === 'highway' || i % 6 === 5 ? 'fiesta' : 'golf'), davis: () => 'bmw', aivars: () => 'volvo' }[dr.id];
  trips.forEach((t, i) => { t.carId = carFor(t, i); });
  // keep ONE interesting raw trip per driver for the chart
  let best = null; for (const t of trips) if (t.counted && (!best || (t.brake + t.accel + t.corner + t.phoneEv * 1.5) > (best.brake + best.accel + best.corner + best.phoneEv * 1.5))) best = t;
  const raws = {};
  for (const t of trips) { const rw = rawKeep[t.id]; if (rw) raws[t.id] = compact(rw); }
  out.drivers.push({ id: dr.id, name: dr.name, licYears: dr.licYears, expHours: dr.expHours, expBuckets: dr.expBuckets, claims3y: dr.claims3y, note: dr.note, trips, raws });
}

/* Assetto-Corsa-format sessions (10 Hz), SYNTHETIC placeholders until a real session is logged with ac_logger.py */
function acSession(name, beh, seed) {
  const r = mulberry32(seed);
  const sim = simulate({ road: 'city', km: 5, weather: 'dry', traffic: 'free', hz: 10, beh }, r);
  const ranges = []; let s = -1; sim.phone.forEach((p, i) => { if (p && s < 0) s = i; if (!p && s >= 0) { ranges.push([s, i]); s = -1; } });
  return { name, hz: 10, startISO: '2026-10-28T09:00:00Z', weather: 'dry', limit: 50, v: sim.v, ay: sim.ay, lim: sim.lim, phoneRanges: ranges, synthetic: true };
}
out.ac.calm = acSession('calm', { over: 0.0, speedProb: 0.0, pHarsh: 0.02, pHardAcc: 0.0, phone: 0, corner: 0.0, care: 0.5 }, 901);
out.ac.aggressive = acSession('aggressive', { over: 0.28, speedProb: 0.7, pHarsh: 0.9, pHardAcc: 0.8, phone: 18, corner: 0.9, care: 0.0 }, 902);

fs.writeFileSync(__dirname + '/../data.js', '/* SYNTHETIC demo data — generated by gen.js */\nwindow.DEMO = ' + JSON.stringify(out) + ';\n');
for (const d of out.drivers) {
  const res = E.scoreDriver(d.trips, d);
  console.log(d.name.padEnd(12), 'trips', String(d.trips.length).padStart(3), 'km', String(res.kpi.km).padStart(6), 'score', res.total, '±' + res.sigma, res.band,
    '| over%', res.kpi.overSafePct.toFixed(1), 'harsh/100km', res.kpi.harshPer100.toFixed(2), 'phone/h', res.kpi.phonePerHour.toFixed(2), 'night', (res.kpi.nightShare * 100).toFixed(0) + '%', 'fatigue', res.kpi.fatigue, 'exp', res.scores.experience.toFixed(0));
}
console.log('data.js bytes:', fs.statSync(__dirname + '/../data.js').size);
