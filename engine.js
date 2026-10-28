/*
 * Driver Score engine — runs in the browser and in Node (same code for the demo, the tests and the generator).
 * Pipeline (workshop framework): raw samples -> trip summary (metrics) -> KPIs (rates with a base) -> score -> advice.
 * Every number marked "assumption" is a design choice of ours, not a published standard. Tune in P.
 */
(function (root) {
  'use strict';

  const P = {
    // harsh-braking threshold in g, per road condition (less grip -> lower absolute g is already "harsh") — assumption
    brakeG: { dry: 0.30, wet: 0.24, snow: 0.14, fog: 0.24 },
    denseTrafficBonusG: 0.05,        // stop-and-go: allow a bit more before calling it harsh
    accelG: 0.28,
    cornerG: 0.35,
    // share of the posted limit that is "safe" in this condition — assumption
    safeFactor: { dry: 1.0, wet: 0.9, snow: 0.7, fog: 0.75 },
    speedMarginKmh: 3,               // GPS / speedometer tolerance
    severeOverKmh: 20,
    minRoleConfidence: 0.6,          // below this a trip is stored but not scored
    fatigueMinutes: 120,             // continuous driving before a break counts as fatigue
    breakMinutes: 15,
    // "average driver" bases used for the comparisons (workshop slide: 1.0 harsh brake / 100 km) — illustrative
    AVG: { harshPer100: 1.0, overSafePct: 6, phonePerHour: 0.6, nightShare: 0.10 },
    weights: { speeding: 25, phone: 20, smooth: 20, claims: 15, nightfatigue: 10, experience: 10 },
    // KPI -> 0..100 mappings: value at which the KPI score hits 0
    zero: { overSafePct: 12, phonePerHour: 2.0, harshPer100: 5, claims: 3 },
    expTauHours: 200,                // experience saturates around a few hundred hours — assumption
    expBuckets: ['city', 'highway', 'night', 'badweather'],
    premiumBase: 300,                // illustrative yearly premium, EUR — NOT a Balcia pricing model
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r1 = (x) => Math.round(x * 10) / 10;

  // sunrise/sunset (NOAA simplified) -> minutes after 00:00 UTC. Riga by default.
  function sunTimes(date, lat, lon) {
    lat = lat == null ? 56.95 : lat; lon = lon == null ? 24.1 : lon;
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const n = Math.floor((date.getTime() - start) / 864e5);
    const g = (2 * Math.PI / 365) * (n - 1 + 0);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const la = lat * Math.PI / 180;
    const cosHa = Math.cos(90.833 * Math.PI / 180) / (Math.cos(la) * Math.cos(decl)) - Math.tan(la) * Math.tan(decl);
    const ha = Math.acos(clamp(cosHa, -1, 1)) * 180 / Math.PI;
    return { rise: 720 - 4 * (lon + ha) - eq, set: 720 - 4 * (lon - ha) - eq };
  }
  function isDark(ms, st) {
    const d = new Date(ms);
    const m = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    return m < st.rise || m > st.set;
  }

  /*
   * Trip (input):  { id, startISO, hz, mode:'car'|'train'|'bus'|'bike'|'walk', modeConf, roleConf, confirmed:true|false|null,
   *                  weather:'dry'|'wet'|'snow'|'fog', traffic:'free'|'dense', roadType, v:[km/h], ay:[g]?, lim:[km/h], phone:[0|1]? }
   * Trip (output): a summary with counts; raw arrays are dropped.
   */
  function analyzeTrip(t) {
    const hz = t.hz || 1, dt = 1 / hz, n = t.v.length;
    const weather = t.weather || 'dry';
    const brakeThr = P.brakeG[weather] + (t.traffic === 'dense' ? P.denseTrafficBonusG : 0);
    const safe = P.safeFactor[weather];
    const k = Math.max(1, Math.round(0.5 / dt));        // acceleration over ~0.5 s: robust to 10 Hz game jitter
    const t0 = Date.parse(t.startISO);
    const st = sunTimes(new Date(t0));
    let km = 0, darkKm = 0, brake = 0, accel = 0, corner = 0, overLim = 0, overSafe = 0, severe = 0, phoneS = 0, phoneEv = 0;
    let inB = false, inA = false, inC = false, prevPhone = 0, maxG = 0;
    const events = [];
    for (let i = 0; i < n; i++) {
      const v = t.v[i];
      const step = v / 3600 * dt;
      km += step;
      // "night exposure": deep night (23-05 local) counts fully, ordinary darkness (winter evenings) a quarter — a regular commute in the dark is not a habit to punish
      const ms = t0 + i * dt * 1000, lh = (new Date(ms).getUTCHours() + (ms >= Date.UTC(2026, 9, 25, 1) && ms < Date.UTC(2027, 2, 28) ? 2 : 3)) % 24;
      if (lh >= 23 || lh < 5) darkKm += step; else if (isDark(ms, st)) darkKm += step * 0.25;
      const lim = t.lim ? t.lim[i] : 50;
      if (v > lim + P.speedMarginKmh) overLim += dt;
      if (v > lim * safe + P.speedMarginKmh) overSafe += dt;
      if (v > lim + P.severeOverKmh) severe += dt;
      if (i >= k) {
        const a = (v - t.v[i - k]) / 3.6 / (k * dt) / 9.81;
        maxG = Math.max(maxG, Math.abs(a));
        if (a < -brakeThr && t.v[i - k] > 15) { if (!inB) { brake++; inB = true; events.push({ i, type: 'brake', g: r1(-a * 100) / 100 }); } } else if (a > -brakeThr / 2) inB = false;
        if (a > P.accelG && v > 5) { if (!inA) { accel++; inA = true; events.push({ i, type: 'accel', g: r1(a * 100) / 100 }); } } else if (a < P.accelG / 2) inA = false;
      }
      if (t.ay) {
        const y = Math.abs(t.ay[i]);
        if (y > P.cornerG && v > 15) { if (!inC) { corner++; inC = true; events.push({ i, type: 'corner', g: r1(y * 100) / 100 }); } } else if (y < P.cornerG / 2) inC = false;
      }
      if (t.phone) {
        const ph = t.phone[i] && v > 5;               // handling the phone at a red light is not counted
        if (ph) { phoneS += dt; if (!prevPhone) { phoneEv++; events.push({ i, type: 'phone' }); } }
        prevPhone = ph ? 1 : 0;
      }
    }
    const conf = t.confirmed === true ? 1 : t.confirmed === false ? 0 : (t.roleConf == null ? 1 : t.roleConf);
    let counted = true, reason = '';
    if (t.mode && t.mode !== 'car') { counted = false; reason = 'mode:' + t.mode; }
    else if (conf < P.minRoleConfidence) { counted = false; reason = t.confirmed === false ? 'passenger-confirmed' : 'passenger-likely'; }
    return {
      id: t.id, startISO: t.startISO, mode: t.mode || 'car', modeConf: t.modeConf == null ? 1 : t.modeConf, roleConf: conf,
      confirmed: t.confirmed == null ? null : t.confirmed, counted, reason, weather, traffic: t.traffic || 'free', roadType: t.roadType || 'mixed',
      durationS: n * dt, km: r1(km * 100) / 100, darkKm: r1(darkKm * 100) / 100,
      brake, accel, corner, overLimS: r1(overLim), overSafeS: r1(overSafe), severeS: r1(severe),
      phoneEv, phoneS: r1(phoneS), maxG: r1(maxG * 100) / 100, events,
    };
  }

  function weekKey(iso) { // Monday of that week, YYYY-MM-DD (UTC)
    const d = new Date(iso); const day = (d.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
  }

  function fatigueEvents(trips) {
    const s = trips.filter(t => t.counted).slice().sort((a, b) => Date.parse(a.startISO) - Date.parse(b.startISO));
    let count = 0, runStart = null, runEnd = null, runMin = 0;
    const flush = () => { if (runMin >= P.fatigueMinutes) count++; };
    for (const t of s) {
      const a = Date.parse(t.startISO), b = a + t.durationS * 1000;
      if (runEnd != null && (a - runEnd) / 60000 <= P.breakMinutes) { runMin += t.durationS / 60 + (a - runEnd) / 60000; runEnd = b; }
      else { if (runEnd != null) flush(); runStart = a; runEnd = b; runMin = t.durationS / 60; }
    }
    if (runEnd != null) flush();
    return count;
  }

  /* Aggregate a set of trip summaries into KPIs and a 0..100 score. profile = {claims3y, expHours, expBuckets:{city,highway,night,badweather}} */
  function scoreDriver(trips, profile) {
    const c = trips.filter(t => t.counted);
    const km = c.reduce((s, t) => s + t.km, 0), sec = c.reduce((s, t) => s + t.durationS, 0), hours = sec / 3600;
    const sum = (f) => c.reduce((s, t) => s + f(t), 0);
    const harsh = sum(t => t.brake + t.accel + t.corner);
    const k = {
      km: r1(km), hours: r1(hours * 10) / 10, trips: c.length, excluded: trips.length - c.length,
      brake: sum(t => t.brake), accel: sum(t => t.accel), corner: sum(t => t.corner),
      harshPer100: km > 0 ? harsh / km * 100 : 0,
      overSafePct: sec > 0 ? sum(t => t.overSafeS) / sec * 100 : 0,
      overLimPct: sec > 0 ? sum(t => t.overLimS) / sec * 100 : 0,
      severePct: sec > 0 ? sum(t => t.severeS) / sec * 100 : 0,
      phoneEv: sum(t => t.phoneEv), phonePerHour: hours > 0 ? sum(t => t.phoneEv) / hours : 0,
      nightShare: km > 0 ? sum(t => t.darkKm) / km : 0,
      fatigue: fatigueEvents(trips),
    };
    // per-condition breakdown (harsh events per 100 km in dry / wet / snow / fog)
    const byWeather = {};
    for (const w of ['dry', 'wet', 'snow', 'fog']) {
      const tw = c.filter(t => t.weather === w); const kmw = tw.reduce((s, t) => s + t.km, 0), secw = tw.reduce((s, t) => s + t.durationS, 0);
      byWeather[w] = { km: r1(kmw), trips: tw.length, harshPer100: kmw > 0 ? tw.reduce((s, t) => s + t.brake + t.accel + t.corner, 0) / kmw * 100 : null,
        overSafePct: secw > 0 ? tw.reduce((s, t) => s + t.overSafeS, 0) / secw * 100 : null };
    }
    const claims = profile && profile.claims3y != null ? profile.claims3y : 0;
    const eb = (profile && profile.expBuckets) || {};
    const diversity = P.expBuckets.filter(b => (eb[b] || 0) >= 10).length / P.expBuckets.length;
    const expHours = profile && profile.expHours != null ? profile.expHours : hours;
    const effHours = expHours * (0.6 + 0.4 * diversity);

    const s = {
      speeding: 100 * clamp(1 - k.overSafePct / P.zero.overSafePct, 0, 1),
      phone: 100 * clamp(1 - k.phonePerHour / P.zero.phonePerHour, 0, 1),
      smooth: 100 * clamp(1 - k.harshPer100 / P.zero.harshPer100, 0, 1),
      claims: 100 * clamp(1 - claims / P.zero.claims, 0, 1),
      nightfatigue: clamp(100 - 150 * k.nightShare - 20 * k.fatigue, 0, 100),
      experience: 100 * (1 - Math.exp(-effHours / P.expTauHours)),
    };
    let total = 0; const W = P.weights; let wsum = 0;
    for (const key in W) { total += W[key] * s[key]; wsum += W[key]; }
    total = total / wsum;
    // uncertainty: little measured driving and little experience -> wider band
    // assumption: an OBD2 adapter gives cleaner data and a certain car identity -> narrower band
    const sigma = (3 + 14 * Math.exp(-km / 500) + 6 * (1 - s.experience / 100)) * (profile && profile.obd ? 0.8 : 1);
    const band = total >= 80 ? 'low' : total >= 60 ? 'medium' : 'high';
    return { kpi: k, byWeather, scores: s, total: r1(total), sigma: r1(sigma), band, diversity, effHours: r1(effHours), expHours, claims };
  }

  function premiumPreview(total) { // illustrative only: 0 % off at 50 points, -25 % at 100 (voluntary telematics discount, never a surcharge)
    const pct = Math.round(clamp((total - 50) * 0.5, 0, 25));
    const eur = Math.round(P.premiumBase * (1 - pct / 100));
    return { base: P.premiumBase, eur, discountPct: pct, savings: P.premiumBase - eur, factor: r1((1 - pct / 100) * 100) / 100 };
  }

  /* Advice: the changeable KPI that costs the most weighted points; returns a key + parameters, the UI turns it into text. */
  function advice(res, trips) {
    const W = P.weights, s = res.scores;
    const cand = ['speeding', 'phone', 'smooth', 'nightfatigue'].map(key => ({ key, loss: W[key] * (100 - s[key]) / 100 }));
    cand.sort((a, b) => b.loss - a.loss);
    const top = cand[0];
    const p = { key: top.key, gain: Math.round(top.loss * 10) / 10, k: res.kpi };
    if (top.key === 'speeding' || top.key === 'smooth') {
      let worst = null;
      for (const w of ['wet', 'snow', 'fog', 'dry']) {
        const b = res.byWeather[w]; if (!b || b.trips === 0) continue;
        const val = top.key === 'speeding' ? b.overSafePct : b.harshPer100;
        if (val != null && (worst == null || val > worst.val)) worst = { w, val };
      }
      p.worst = worst;
    }
    if (top.key === 'nightfatigue') p.night = res.kpi.nightShare; // fatigue count in kpi
    return p;
  }

  const api = { P, analyzeTrip, scoreDriver, advice, premiumPreview, fatigueEvents, weekKey, sunTimes, isDark };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof self !== 'undefined' ? self : this);
