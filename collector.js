/*
 * Web collector (EXPERIMENTAL, foreground only): GPS speed + motion sensors -> events computed on the phone with engine.js -> summary to the ingest function.
 * No sign-in screen: a device-bound anonymous account is registered silently. GPS coordinates are never stored; the first fix is sent once, rounded,
 * only so the server can look up real weather.
 */
(function () {
  'use strict';
  const URL = 'https://qjakepgeqioqrmsufaty.supabase.co', KEY = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS';
  const $ = (id) => document.getElementById(id), rad = Math.PI / 180, HAND_RADS = 1.0;
  const LS = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let rec = null, timer = null, watch = null, wake = null;
  const M = { n: 0, lat: 0, tilt: 0, lin: 0 };

  $('carName').value = LS.get('carName', ''); $('carPlate').value = LS.get('carPlate', ''); $('expHours').value = LS.get('expHours', 100); $('consent').checked = LS.get('consentUi', false);
  const say = (t) => { $('status').textContent = t; };

  function dist(a, b) { const R = 6371000, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad, x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }

  function onMotion(e) {
    const g = e.accelerationIncludingGravity, r = e.rotationRate; if (!g || !r || !rec) return;
    const gm = Math.hypot(g.x, g.y, g.z) || 9.81, ux = g.x / gm, uy = g.y / gm, uz = g.z / gm;
    const wx = (r.beta || 0) * rad, wy = (r.gamma || 0) * rad, wz = (r.alpha || 0) * rad;
    const yaw = wx * ux + wy * uy + wz * uz;                                     // rotation about the vertical axis (steering), whatever the phone orientation
    const tilt = Math.hypot(wx - yaw * ux, wy - yaw * uy, wz - yaw * uz);        // rotation NOT about vertical = phone being handled / tilted
    M.lat += (rec.vmps || 0) * yaw; M.n++; M.tilt = Math.max(M.tilt, tilt);
    const a = e.acceleration; if (a) M.lin = Math.max(M.lin, Math.hypot(a.x || 0, a.y || 0, a.z || 0));
    $('mot').textContent = 'jā';
  }

  function onFix(p) {
    const c = p.coords, now = p.timestamp, fix = { lat: c.latitude, lon: c.longitude, t: now };
    let v = Number.isFinite(c.speed) && c.speed != null ? c.speed : null;
    if (v == null && rec.last) { const dt = (now - rec.last.t) / 1000; v = dt > 0 ? dist(rec.last, fix) / dt : 0; }
    rec.vmps = Math.max(0, v || 0); if (!rec.first) rec.first = { lat: fix.lat, lon: fix.lon }; rec.last = fix; $('acc').textContent = Math.round(c.accuracy || 0);
  }

  function tick() {
    if (!rec) return;
    const vk = rec.vmps * 3.6;
    rec.v.push(Math.round(vk * 10) / 10); rec.ay.push(M.n ? Math.max(-1.5, Math.min(1.5, (M.lat / M.n) / 9.81)) : 0);
    rec.phone.push(M.tilt > HAND_RADS && vk > 5 ? 1 : 0); rec.lim.push(rec.limit); rec.lin.push(M.lin);
    M.n = 0; M.lat = 0; M.tilt = 0; M.lin = 0;
    $('spd').textContent = Math.round(vk); $('cnt').textContent = rec.v.length;
  }

  async function start() {
    if (!$('consent').checked) { say('Vispirms atzīmē piekrišanu.'); return; }
    LS.set('consentUi', true); LS.set('carName', $('carName').value); LS.set('carPlate', $('carPlate').value); LS.set('expHours', $('expHours').value);
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { try { await DeviceMotionEvent.requestPermission(); } catch (e) {} }
    if (!navigator.geolocation) { say('Šī ierīce nedod atrašanās vietu.'); return; }
    rec = { startMs: Date.now(), v: [], ay: [], phone: [], lim: [], lin: [], vmps: 0, limit: +$('limit').value, first: null, last: null };
    window.addEventListener('devicemotion', onMotion);
    watch = navigator.geolocation.watchPosition(onFix, (e) => say('GPS kļūda: ' + e.message), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    try { wake = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }
    timer = setInterval(tick, 1000); $('start').disabled = true; $('stop').disabled = false; $('sim').disabled = true; say('Mēra… Turi ekrānu ieslēgtu un telefonu turētājā.');
  }

  function halt() {
    clearInterval(timer); window.removeEventListener('devicemotion', onMotion);
    if (watch != null) navigator.geolocation.clearWatch(watch); watch = null; if (wake) { try { wake.release(); } catch (e) {} wake = null; }
    $('start').disabled = false; $('stop').disabled = true; $('sim').disabled = false;
  }

  /* ---- build the trip, compute events ON THE PHONE, upload the summary ---- */
  async function finish() {
    const r = rec; rec = null; halt(); const n = r.v.length;
    if (n < 20) { say('Brauciens pārāk īss (jābūt vismaz 20 sekundēm).'); return; }
    // parking areas (heuristic: the slow phase at the start and end; real app: map polygons + speed)
    const lot = [], e1 = r.v.findIndex((x) => x >= 20); let s2 = -1; for (let i = n - 1; i >= 0; i--) if (r.v[i] >= 20) { s2 = i; break; }
    if (e1 >= 3 && e1 <= 150) lot.push([0, e1]);
    if (s2 >= 0 && n - s2 - 1 >= 3 && n - s2 - 1 <= 150) lot.push([s2 + 1, n]);
    const bump = []; for (const [a, b] of lot) for (let i = a; i < b; i++) if (r.v[i] < 10 && r.lin[i] > 3.5) bump.push({ i, g: Math.round(r.lin[i] / 9.81 * 100) / 100 });
    let wx = null; say('Meklēju īstos laikapstākļus…');
    if (r.first) { try { wx = await Weather.fetchWeather(r.first.lat, r.first.lon, r.startMs, r.startMs + n * 1000); } catch (e) { wx = null; } }
    const asDriver = $('asDriver').checked;
    const trip = { id: 'web-' + r.startMs, startISO: new Date(r.startMs).toISOString(), hz: 1, mode: 'car', roleConf: asDriver ? 1 : 0.3, confirmed: asDriver ? true : false, weather: wx ? wx.cls : 'dry', traffic: 'free', roadType: 'mixed', v: r.v, ay: r.ay, lim: r.lim, phone: r.phone, lot, bump };
    const s = Engine.analyzeTrip(trip);
    show(s, wx);
    await upload(s, r, wx, lot, n);
  }

  const snake = (s) => ({ id: s.id, start_at: s.startISO, mode: s.mode, mode_conf: s.modeConf, role_conf: s.roleConf, confirmed: s.confirmed, weather: s.weather, traffic: s.traffic, road_type: s.roadType, counted: s.counted, reason: s.reason, duration_s: s.durationS, km: s.km, dark_km: s.darkKm, max_g: s.maxG, brake: s.brake, accel: s.accel, corner: s.corner, over_lim_s: s.overLimS, over_safe_s: s.overSafeS, severe_s: s.severeS, phone_ev: s.phoneEv, phone_s: s.phoneS, parkings: s.parkings, lot_cycles: s.lotCycles, lot_s: s.lotS, lot_over_s: s.lotOverS, lot_max: s.lotMax, surge: s.surge, bump: s.bump });
  const T = { brake: 'Strauja bremzēšana', accel: 'Strauja paātrināšana', corner: 'Straujš pagrieziens', phone: 'Telefons rokās', surge: 'Pēkšņa paātrināšanās no vietas', bump: 'Iespējams pieskāriens', lot: 'Stāvvieta' };

  function show(s, wx) {
    const ev = s.events.slice().sort((a, b) => a.i - b.i).map((e) => `<tr><td>${Math.floor(e.i / 60)}:${String(e.i % 60).padStart(2, '0')}</td><td>${T[e.type] || e.type}</td><td>${e.type === 'lot' ? `${e.cycles} virz. maiņas, ${e.dur} s` : e.g ? '≈ ' + e.g + ' g' : ''}</td></tr>`).join('');
    $('result').hidden = false;
    $('result').innerHTML = `<h3>Brauciens: ${s.km} km, ${Math.round(s.durationS / 60)} min ${s.counted ? '' : '<span class="pill mid">netiek vērtēts</span>'}</h3>
      <p class="note">Laikapstākļi: ${wx ? `<b>${wx.cls}</b> · ${wx.temp} °C · nokrišņi ${wx.precip} mm/h · redzamība ${wx.vis == null ? '–' : Math.round(wx.vis)} m${wx.ice ? ' · <b>ledus risks (aplēse)</b>' : ''} <small>(Open-Meteo)</small>` : 'nav pieejami (izmantoti “sausi”)'}</p>
      <table><tr><th>Laiks</th><th>Notikums</th><th></th></tr>${ev || '<tr><td colspan="3">Nekas īpašs nenotika.</td></tr>'}</table><p id="up" class="note">Sūta…</p>`;
  }

  /* ---- silent device account + upload ---- */
  async function jf(url, opt) { const r = await fetch(url, opt); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t; } return { s: r.status, b }; }
  async function token() {
    let c = LS.get('device', null);
    if (!c) { const r = await jf(`${URL}/functions/v1/device-register`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }); if (!r.b.email) throw new Error('reģistrācija: ' + JSON.stringify(r.b)); c = r.b; LS.set('device', c); }
    const l = await jf(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (!l.b.access_token) { LS.set('device', null); throw new Error('pieteikšanās: ' + JSON.stringify(l.b)); }
    return l.b.access_token;
  }
  async function upload(s, r, wx, lot, n) {
    const up = $('up');
    try {
      const H = { apikey: KEY, Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' };
      const runs = []; for (const x of r.lim) { if (runs.length && runs[runs.length - 1][0] === x) runs[runs.length - 1][1]++; else runs.push([x, 1]); }
      const ph = []; let st = -1; r.phone.forEach((p, i) => { if (p && st < 0) st = i; if (!p && st >= 0) { ph.push([st, i]); st = -1; } }); if (st >= 0) ph.push([st, r.phone.length]);
      const body = { driver_name: 'Ierīce', exp_hours: +$('expHours').value || 0, car: $('carName').value.trim() ? { name: $('carName').value.trim(), plate: $('carPlate').value.trim() || null } : undefined,
        location: r.first ? { lat: r.first.lat, lon: r.first.lon } : undefined, trip: snake(s),
        events: s.events.map(({ i, type, g, ...rest }) => ({ i, type, g, data: Object.keys(rest).length ? rest : undefined })),
        trace: { step: 1, v: r.v.map(Math.round), ay100: r.ay.map((a) => Math.round(a * 100)), lim_runs: runs, phone_ranges: ph } };
      const call = () => jf(`${URL}/functions/v1/ingest-trip`, { method: 'POST', headers: H, body: JSON.stringify(body) });
      let res = await call();
      if (res.s === 403 && res.b.driver_id) { await fetch(`${URL}/rest/v1/consents`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ driver_id: res.b.driver_id, purpose: 'collect', granted: true }) }); res = await call(); }
      up.innerHTML = res.s === 200 ? `✅ Nosūtīts uz datubāzi (${res.b.events} notikumi${res.b.car_id ? ', auto saistīts' : ''}${res.b.weather && res.b.weather.src === 'open-meteo' ? ', laikapstākļi no Open-Meteo' : ''}).` : `❌ ${res.s}: ${JSON.stringify(res.b)}`;
    } catch (e) { up.textContent = '❌ ' + e.message; }
    say('Gatavs.');
  }

  /* ---- simulated drive (desktop test, no car needed) ---- */
  function simulate() {
    const v = [], ay = [], ph = [], lin = [], rnd = (a, b) => a + Math.random() * (b - a);
    const seg = (to, secs) => { const from = v.length ? v[v.length - 1] : 0; for (let i = 1; i <= secs; i++) v.push(Math.round((from + (to - from) * i / secs) * 10) / 10); };
    seg(4, 4); seg(0, 3); seg(5, 4); seg(0, 2); seg(5, 3); seg(40, 8); seg(52, 30); seg(48, 20); seg(52, 25); seg(0, 3) /* hard brake */; seg(0, 6); seg(45, 10); seg(62, 25); seg(50, 20); seg(8, 12); seg(5, 4); seg(0, 2); seg(5, 3); seg(0, 3);
    for (let i = 0; i < v.length; i++) { ay.push(i > 70 && i < 74 ? 0.4 : Math.round(rnd(-0.04, 0.04) * 100) / 100); ph.push(i > 100 && i < 108 ? 1 : 0); lin.push(0.2); }
    lin[v.length - 3] = 4.2;                                                                    // a contact in the parking phase
    rec = { startMs: Date.now() - v.length * 1000, v, ay, phone: ph, lim: v.map(() => 50), lin, first: { lat: 56.9496, lon: 24.1052 }, limit: 50 };
    say('Simulēts brauciens (nav īsts mērījums).'); finish();
  }

  $('start').onclick = start; $('stop').onclick = () => { finish(); }; $('sim').onclick = () => { if (!$('consent').checked) { say('Vispirms atzīmē piekrišanu.'); return; } LS.set('consentUi', true); LS.set('carName', $('carName').value); simulate(); };
})();
