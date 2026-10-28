/* Presentation panels for the in-app view on a wide screen (projector): the phone stays exactly as it is in the middle.
 * Left:  the game, live. live.py --upload writes the user's live_state row about twice a second; this panel polls it and shows speed,
 *        limit, g-forces and events while Ali drives in Assetto Corsa. When the ride is saved the app reloads and the coach runs.
 * Right: the AI coach in action: scoring engine -> Jev ranks the habits -> Gemini writes the advice (the real `recommend` function).
 * P toggles the panels. Nothing here records or calculates rides; it only reads the signed-in user's own rows. */
(function () {
  'use strict';
  var T = {
    lv: { live: 'Assetto Corsa · tiešraide', idle: 'Gaida braucienu', driving: 'Tiešraidē', done: 'Brauciens saglabāts', start: 'Palaid spēli un šo komandu:', last: 'Pēdējais brauciens', none: 'Vēl nav braucienu.',
      kmh: 'km/h', limit: 'limits', lat: 'Sānu g', lon: 'Garenvirz. g', km: 'km', time: 'laiks', brake: 'bremz.', accel: 'paātr.', corner: 'pagr.', speed: 'ātrums', events: 'Notikumi', noev: 'Pagaidām nekas — brauc mierīgi.',
      ai: 'AI treneris', aisub: 'Dzinējs rēķina skaitļus, Jev izlemj, ar ko sākt, Gemini paskaidro.', run: 'Analizēt', running: 'Analizē…', ride: 'Brauciens', engine: 'Dzinējs', you: 'Tu',
      jev: 'Jev · izlemj', jevsub: 'Lēmumu modelis: sarindo ieradumus un pasaka, cik ir pārliecināts.', conf: 'pārliecība', risk: 'riska profils', gem: 'Gemini · paskaidro',
      gemoff: 'Gemini šobrīd nav pieejams (limits) — standarta teksts', low: 'zem 60 % — paliek dzinēja secība (lielākais ieguvums pirmais)', tips: 'Ko darīt', pts: 'punkti', yr: 'gadā', newride: 'Jauns brauciens no Assetto Corsa saglabāts', hint: 'P — paslēpt vai rādīt paneļus', err: 'Neizdevās iegūt analīzi.',
      f: { speeding: 'Ātrums apstākļiem', smooth: 'Plūdena braukšana', phone: 'Telefons', nightfatigue: 'Nakts un nogurums' } },
    en: { live: 'Assetto Corsa · live', idle: 'Waiting for a drive', driving: 'Live', done: 'Ride saved', start: 'Start the game and run:', last: 'Last ride', none: 'No rides yet.',
      kmh: 'km/h', limit: 'limit', lat: 'Lateral g', lon: 'Long. g', km: 'km', time: 'time', brake: 'brake', accel: 'accel', corner: 'corner', speed: 'speed', events: 'Events', noev: 'Nothing yet — calm driving.',
      ai: 'AI coach', aisub: 'The engine calculates the numbers, Jev decides where to start, Gemini explains.', run: 'Analyse', running: 'Analysing…', ride: 'Ride', engine: 'Engine', you: 'You',
      jev: 'Jev · decides', jevsub: 'A decision model: ranks the habits and says how sure it is.', conf: 'confidence', risk: 'risk profile', gem: 'Gemini · explains',
      gemoff: 'Gemini is not available right now (limit) — standard text', low: 'below 60% — the engine order stays (biggest gain first)', tips: 'What to do', pts: 'points', yr: 'a year', newride: 'New ride from Assetto Corsa saved', hint: 'P — hide or show the panels', err: 'Could not get the analysis.',
      f: { speeding: 'Speed for conditions', smooth: 'Smooth driving', phone: 'Phone use', nightfatigue: 'Night and fatigue' } },
  };
  var st = { on: true, row: null, lastTrip: undefined, spark: [], seen: {}, busy: false, aiDone: false, shown: false, ai: null };
  try { st.on = localStorage.getItem('pv_off') !== '1'; } catch (e) {}
  var t = function (k) { var l = window.App ? App.lang() : 'lv'; return (T[l] || T.lv)[k]; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (x, d) { return x == null || isNaN(x) ? '–' : Number(x).toFixed(d == null ? 0 : d); };
  var mmss = function (s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); };

  var left = document.createElement('aside'), right = document.createElement('aside');
  left.className = 'pv pv-left'; right.className = 'pv pv-right'; left.hidden = right.hidden = true;
  left.setAttribute('aria-label', 'Live game feed'); right.setAttribute('aria-label', 'AI coach');
  document.body.appendChild(left); document.body.appendChild(right);

  function ready() { var a = window.App; return !!(a && a.state && a.state().dbInfo && a.state().dbInfo.mine && window.Auth && Auth.user()); }
  function visible() { return st.on && ready() && document.body.classList.contains('app-mode') && window.innerWidth >= 1180; }
  function toast(msg) { var d = document.createElement('div'); d.className = 'pv-toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200); }

  /* ---------- left: the game, live ---------- */
  function lastRide() {
    var d = App.D.drivers[0]; if (!d || !d.trips.length) return null;
    var tr = d.trips.slice().sort(function (a, b) { return Date.parse(b.startISO) - Date.parse(a.startISO); })[0], car = (App.D.cars || []).filter(function (c) { return c.id === tr.carId; })[0];
    return { tr: tr, plate: car ? car.plate : '' };
  }
  function spark() {
    var v = st.spark; if (v.length < 2) return '';
    var max = Math.max(130, Math.max.apply(null, v)), w = 300, h = 56;
    var pts = v.map(function (x, i) { return (i / (v.length - 1) * w).toFixed(1) + ',' + (h - 4 - x / max * (h - 8)).toFixed(1); }).join(' ');
    return '<svg class="pv-spark" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function renderLeft() {
    var r = st.row, fresh = r && (Date.now() - Date.parse(r.updated_at)) < 8000, mode = r && r.status === 'driving' && fresh ? 'driving' : r && r.status === 'done' && fresh ? 'done' : 'idle';
    var pill = '<span class="pv-pill ' + (mode === 'driving' ? 'live' : mode === 'done' ? 'done' : '') + '"><span class="pv-dot"></span>' + t(mode) + '</span>';
    var h = '<div class="pv-card"><div class="pv-head"><span class="pv-title">' + t('live') + '</span>' + pill + '</div>';
    if (mode === 'idle') {
      var lr = lastRide();
      h += '<p class="pv-sub" style="margin-top:8px">' + t('start') + '</p><div class="pv-code">python live.py ac --zones "0-1500:60,1500-:90" --upload</div></div>';
      h += '<div class="pv-card"><div class="pv-title">' + t('last') + '</div>' + (lr ? '<p class="pv-sub" style="margin-top:6px">' + new Date(lr.tr.startISO).toLocaleString(App.lang() === 'lv' ? 'lv-LV' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + (lr.plate ? ' · ' + esc(lr.plate) : '') + '</p><div class="pv-stats"><div><b>' + fmt(lr.tr.km, 1) + '</b><span>' + t('km') + '</span></div><div><b>' + lr.tr.brake + '</b><span>' + t('brake') + '</span></div><div><b>' + lr.tr.accel + '</b><span>' + t('accel') + '</span></div><div><b>' + lr.tr.corner + '</b><span>' + t('corner') + '</span></div></div>' : '<p class="pv-sub" style="margin-top:6px">' + t('none') + '</p>') + '</div>';
    } else {
      var c = r.counts || {}, over = r.lim && r.v > r.lim + 3, gl = r.g_lat, go = r.g_lon;
      var bar = function (g) { if (g == null) return '<i style="width:0"></i>'; var w = Math.min(50, Math.abs(g) / 0.8 * 50); return '<i style="width:' + w + '%;left:' + (g < 0 ? 50 - w : 50) + '%"></i>'; };
      h += '<div class="pv-speed"><div><b>' + fmt(r.v) + '</b><small>' + t('kmh') + ' · ' + (r.car_plate ? esc(r.car_plate) : '') + '</small></div><div class="pv-sign' + (over ? ' over' : '') + '" title="' + t('limit') + '">' + fmt(r.lim) + '</div></div>';
      h += '<div class="pv-g"><div><span>' + t('lat') + '</span><span class="pv-track">' + bar(gl) + '</span><span class="pv-num">' + fmt(gl == null ? null : Math.abs(gl), 2) + '</span></div><div><span>' + t('lon') + '</span><span class="pv-track">' + bar(go) + '</span><span class="pv-num">' + fmt(go == null ? null : Math.abs(go), 2) + '</span></div></div>';
      h += spark();
      h += '<div class="pv-stats"><div><b>' + fmt(r.km, 2) + '</b><span>' + t('km') + '</span></div><div><b>' + mmss(r.t) + '</b><span>' + t('time') + '</span></div><div><b>' + ((c.brake || 0) + (c.accel || 0) + (c.corner || 0)) + '</b><span>' + t('brake') + '/' + t('corner') + '</span></div><div><b>' + (c.speeding || 0) + '</b><span>' + t('speed') + '</span></div></div></div>';
      var ev = r.events || [];
      h += '<div class="pv-card"><div class="pv-title">' + t('events') + '</div><div class="pv-ev">' + (ev.length ? ev.map(function (e) { var k = e.t + e.kind, isNew = !st.seen[k]; st.seen[k] = 1; return '<div' + (isNew ? '' : ' style="animation:none"') + '><em>' + esc(e.label) + '</em>' + esc(e.value) + '<span>' + mmss(e.t) + '</span></div>'; }).join('') : '<p class="pv-sub">' + t('noev') + '</p>') + '</div>';
    }
    h += '</div><p class="pv-hint">' + t('hint') + '</p>';
    left.innerHTML = h;
  }

  /* ---------- right: the AI coach ---------- */
  function renderRightShell() {
    right.innerHTML = '<div class="pv-card"><div class="pv-head"><span class="pv-title">' + t('ai') + '</span><button class="pv-btn" id="pvRun" type="button">' + t('run') + '</button></div><p class="pv-sub" style="margin-top:6px">' + t('aisub') + '</p>' +
      '<div class="pv-pipe" id="pvPipe">' + [t('ride'), t('engine'), 'Jev', 'Gemini', t('you')].map(function (n, i) { return (i ? '<span class="pv-arr">→</span>' : '') + '<span class="pv-node" data-n="' + i + '">' + n + '</span>'; }).join('') + '</div>' +
      '<div class="pv-sec"><h4>' + t('jev') + '<span class="pv-pill" id="pvJms">–</span></h4><p class="pv-sub" style="margin-top:4px">' + t('jevsub') + '</p><div class="pv-bars" id="pvBars"></div><p class="pv-sub" id="pvJsum" style="margin-top:8px"></p></div>' +
      '<div class="pv-sec"><h4>' + t('gem') + '<span class="pv-pill" id="pvGsrc">–</span></h4><div class="pv-gem" id="pvGem"></div></div>' +
      '<div class="pv-sec"><h4>' + t('tips') + '</h4><div id="pvTips"></div></div></div>';
    document.getElementById('pvRun').onclick = function () { runAI(); };
  }
  function node(i) { Array.prototype.forEach.call(right.querySelectorAll('.pv-node'), function (n) { var k = +n.dataset.n; n.className = 'pv-node' + (k < i ? ' ok' : k === i ? ' on' : ''); }); }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function runAI() {
    if (st.busy || !ready()) return; st.busy = true; renderRightShell();
    var btn = document.getElementById('pvRun'); btn.disabled = true; btn.textContent = t('running');
    var d = App.D.drivers[0], F = t('f');
    if (!d || !d.trips.length) { document.getElementById('pvGem').textContent = t('none'); st.busy = false; btn.disabled = false; btn.textContent = t('run'); return; }
    node(0);
    var req = Auth.token().then(function (tok) { return fetch(Auth.URL + '/functions/v1/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: Auth.KEY, Authorization: 'Bearer ' + tok }, body: JSON.stringify({ subject_type: 'driver', id: d.id, lang: App.lang() }) }); }).then(function (r) { return r.json(); });
    wait(500).then(function () { node(1); return Promise.all([req, wait(700)]); }).then(function (res) {
      var a = res[0]; if (!a || !a.actions) throw new Error(a && a.error || 'no data');
      node(2);
      var jv = a.jev, keys = a.actions.map(function (x) { return x.factor; }), probs = {};
      if (jv && jv.probs) keys.forEach(function (k) { probs[k] = jv.probs[k] || 0; });
      else { var g = a.actions.reduce(function (s, x) { return s + x.gainPoints; }, 0) || 1; keys.forEach(function (k, i) { probs[k] = a.actions[i].gainPoints / g; }); }
      var order = keys.slice().sort(function (x, y) { return probs[y] - probs[x]; });
      document.getElementById('pvBars').innerHTML = order.map(function (k, i) { return '<div class="pv-bar' + (i === 0 ? ' top' : '') + '"><span>' + esc(F[k] || k) + '</span><span class="pv-track"><i data-w="' + Math.round(probs[k] * 100) + '"></i></span><span class="pv-num">' + Math.round(probs[k] * 100) + '%</span></div>'; }).join('');
      setTimeout(function () { Array.prototype.forEach.call(right.querySelectorAll('.pv-bar i'), function (i) { i.style.width = i.dataset.w + '%'; }); }, 50);
      document.getElementById('pvJms').textContent = jv && jv.ms ? jv.ms + ' ms' : (jv ? 'Jev' : '–');
      document.getElementById('pvJsum').innerHTML = jv ? '→ <b>' + esc(F[jv.start_here] || jv.start_here) + '</b> · ' + t('conf') + ' <b>' + Math.round(jv.start_conf * 100) + '%</b>' + (jv.risk_score != null ? ' · ' + t('risk') + ' <b>' + fmt(jv.risk_score, 1) + ' / 2</b>' : '') + (jv.start_conf < 0.6 ? '<br>' + t('low') : '') : '';
      st.ai = a; return wait(1100);
    }).then(function () {
      var a = st.ai; node(3);
      var src = document.getElementById('pvGsrc'); src.textContent = a.source === 'gemini' ? (a.model || 'Gemini') : t('gemoff'); if (a.source !== 'gemini') src.className = 'pv-pill';
      var txt = a.summary + ' ' + (a.actions[0] ? a.actions[0].tip : ''), el = document.getElementById('pvGem'), i = 0;
      return new Promise(function (done) { var iv = setInterval(function () { i += 3; el.innerHTML = esc(txt.slice(0, i)) + (i < txt.length ? '<span class="pv-cur"></span>' : ''); if (i >= txt.length) { clearInterval(iv); done(); } }, 18); });
    }).then(function () {
      var a = st.ai; node(4); Array.prototype.forEach.call(right.querySelectorAll('.pv-node'), function (n) { if (+n.dataset.n < 4) n.className = 'pv-node ok'; });
      document.getElementById('pvTips').innerHTML = a.actions.slice(0, 3).map(function (x, i) { return '<div class="pv-tip"><i>' + (i + 1) + '</i><div><b>' + esc(x.title) + '</b></div><div class="pv-gain">+' + fmt(x.gainPoints, 1) + ' ' + t('pts') + (x.savingEur > 0 ? '<br>−' + x.savingEur + ' € ' + t('yr') : '') + '</div></div>'; }).join('');
    }).catch(function (e) { var el = document.getElementById('pvGem'); if (el) el.textContent = t('err') + ' ' + (e && e.message || ''); })
      .then(function () { st.busy = false; st.aiDone = true; var b = document.getElementById('pvRun'); if (b) { b.disabled = false; b.textContent = t('run'); } });
  }

  /* ---------- polling and visibility ---------- */
  function poll() {
    var vis = visible();
    left.hidden = right.hidden = !vis;
    if (!vis) { st.shown = false; return setTimeout(poll, 1500); }
    if (!st.shown) { st.shown = true; renderLeft(); if (!st.aiDone && !st.busy) runAI(); else if (!right.innerHTML) renderRightShell(); }
    Auth.token().then(function (tok) {
      if (!tok) return null;
      return fetch(Auth.URL + '/rest/v1/live_state?select=*&user_id=eq.' + Auth.user().uid, { headers: { apikey: Auth.KEY, Authorization: 'Bearer ' + tok } }).then(function (r) { return r.ok ? r.json() : []; });
    }).then(function (rows) {
      var r = rows && rows[0] || null;
      if (r && r.status === 'driving') { if (!st.row || st.row.status !== 'driving') { st.spark = []; st.seen = {}; } st.spark.push(r.v || 0); if (st.spark.length > 120) st.spark.shift(); }
      st.row = r; renderLeft();
      if (st.lastTrip === undefined) st.lastTrip = r ? r.trip_id : null;          // first look: remember, do not react
      else if (r && r.status === 'done' && r.trip_id && r.trip_id !== st.lastTrip) {
        st.lastTrip = r.trip_id; toast(t('newride'));
        App.reloadMine().then(function () { st.aiDone = false; runAI(); });
      }
    }).catch(function () {}).then(function () { setTimeout(poll, st.row && st.row.status === 'driving' ? 700 : 2000); });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'p' || e.key === 'P') && !/input|textarea|select/i.test((e.target && e.target.tagName) || '') && !e.ctrlKey && !e.metaKey) {
      st.on = !st.on; try { localStorage.setItem('pv_off', st.on ? '0' : '1'); } catch (x) {} left.hidden = right.hidden = !visible();
    }
  });
  setTimeout(poll, 1200);
})();
