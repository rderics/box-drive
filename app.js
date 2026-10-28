(function () {
  'use strict';
  const E = Engine, P = E.P, D = DEMO;
  const ORIG = { drivers: (DEMO.drivers || []).slice(), cars: (DEMO.cars || []).slice() };   // built-in data.js drivers/cars, captured before DB.loadMine overwrites DEMO
  const AI_ON = false;   // hackathon: no AI-agent processing for now (accounting + ready UI only); flip to true to bring the advice card back
  let lang = 'lv'; try { lang = localStorage.getItem('lang') || lang; } catch (e) {}
  const t = (k) => (I18N[lang][k] != null ? I18N[lang][k] : I18N.en[k] != null ? I18N.en[k] : k);
  const S = { demoOpen: false, tab: 'app', driver: 'elina', trip: null, session: 'calm', weather: 'dry', limit: 50, imports: [], liveErr: '' };
  const $ = (s, el) => (el || document).querySelector(s);
  const fmt = (x, d) => (x == null || isNaN(x) ? '–' : Number(x).toFixed(d == null ? 1 : d).replace('.', lang === 'lv' ? ',' : '.'));
  const col = (s) => (s >= P.bandLow ? 'good' : s >= P.bandMid ? 'mid' : 'bad');
  const cvar = (c) => `var(--${c})`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- data prep ---------- */
  const PROFILE_DEMO = { claims3y: 0, expHours: 300, expBuckets: { city: 60, highway: 60, night: 60, badweather: 60 } };
  function allDrivers() { return D.drivers.concat(S.imports); }
  /* After a signed-in user's data loads: append FICTIONAL example drivers + their cars (marked fictional) so the user sees several cars with clearly different driver scores.
     The user's own driver stays D.drivers[0] and the user's real cars stay first in D.cars. Used by boot() and App.reloadMine(). */
  function addExamples() {
    const haveD = new Set(D.drivers.map((d) => d.id)), haveC = new Set((D.cars || []).map((c) => c.id)); D.cars = D.cars || [];
    for (const id of ['elina', 'davis', 'aivars']) { const d = ORIG.drivers.find((x) => x.id === id); if (d && !haveD.has(id)) D.drivers.push(Object.assign({}, d, { fictional: true })); }
    for (const id of ['golf', 'bmw', 'volvo']) { const c = ORIG.cars.find((x) => x.id === id); if (c && !haveC.has(id)) D.cars.push(Object.assign({}, c, { mine: true, fictional: true })); }
  }
  const cache = new Map();
  function carsOf(d) { const ids = new Set(d.trips.filter((x) => x.carId).map((x) => x.carId)); return (D.cars || []).filter((c) => ids.has(c.id) || c.mine); }
  /* car score: all trips on the car by ALL drivers + the car's own claims history; experience = km-weighted mean of its drivers */
  function carRes(car) {
    const own = new Map(), trips = [], by = {};
    for (const d of D.drivers) for (const t of d.trips) if (t.carId === car.id) { trips.push(t); own.set(t, d.id); if (t.counted) { by[d.id] = by[d.id] || { d, km: 0 }; by[d.id].km += t.km; } }
    const tot = Object.values(by).reduce((s, x) => s + x.km, 0) || 1, wm = (f) => Object.values(by).reduce((s, x) => s + f(x.d) * x.km / tot, 0);
    const profile = { claims3y: car.claims3y, expHours: wm((d) => d.expHours), expBuckets: Object.fromEntries(P.expBuckets.map((k) => [k, wm((d) => (d.expBuckets || {})[k] || 0)])) };
    const res = E.scoreDriver(trips, profile);
    const drivers = Object.values(by).map((x) => { const rest = trips.filter((t) => own.get(t) !== x.d.id); const w = E.scoreDriver(rest, profile); return { d: x.d, km: x.km, share: x.km / tot, impact: res.total - w.total, res: resOf(x.d) }; }).sort((a, b) => b.km - a.km);
    return { car, res, trips, drivers, profile };
  }
  function resOf(d) { const k = d.id + ':' + d.trips.length; if (!cache.has(k)) cache.set(k, E.scoreDriver(d.trips, d)); return cache.get(k); }
  function weekly(d) {
    const g = {}; for (const tr of d.trips) { (g[E.weekKey(tr.startISO)] = g[E.weekKey(tr.startISO)] || []).push(tr); }
    return Object.keys(g).sort().map((w) => { const r = E.scoreDriver(g[w], d); return { w, score: r.total, km: r.kpi.km, ok: r.kpi.km > 1 }; }).filter((x) => x.ok);
  }
  function rawToTrip(raw, extra) {
    const ph = raw.phone || (raw.phoneRanges ? (() => { const a = new Array(raw.v.length).fill(0); for (const [s, e] of raw.phoneRanges) for (let i = s; i < e; i++) a[i] = 1; return a; })() : null);
    const lim = raw.lim || (raw.limRuns ? raw.limRuns.flatMap(([l, c]) => Array(c).fill(l)) : raw.v.map(() => raw.limit || 50));
    const ay = raw.ay100 ? raw.ay100.map((x) => x / 100) : raw.ay;
    return Object.assign({ id: raw.id || 'x', startISO: raw.startISO, hz: raw.step ? raw.hz / raw.step : raw.hz, mode: 'car', roleConf: 1, confirmed: true, weather: raw.weather || 'dry', traffic: raw.traffic || 'free', roadType: 'mixed', v: raw.v, ay, lim, phone: ph }, extra || {});
  }

  /* ---------- svg helpers ---------- */
  function ring(score, c) {
    const R = 70, C = 2 * Math.PI * R, off = C * (1 - Math.max(0, Math.min(100, score)) / 100);
    return `<svg viewBox="0 0 170 170" width="100%" height="100%" role="img" aria-label="${fmt(score, 0)}/100"><circle cx="85" cy="85" r="${R}" fill="none" stroke="var(--line)" stroke-width="14"/><circle cx="85" cy="85" r="${R}" fill="none" stroke="${cvar(c)}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 85 85)" class="rgc" style="--c:${C}"/></svg>`;
  }
  function trendSvg(pts) {
    if (!pts.length) return '';
    const W = 520, H = 150, pl = 30, pr = 10, pt = 10, pb = 24, n = pts.length;
    const x = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1)), y = (v) => pt + (H - pt - pb) * (1 - v / 100);
    let g = [0, 50, 100].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="4" y="${y(v) + 4}">${v}</text>`).join('');
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join(' ');
    const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="4.5" fill="${cvar(col(p.score))}"/><text x="${x(i)}" y="${y(p.score) - 9}" text-anchor="middle" style="fill:var(--ink)">${fmt(p.score, 0)}</text><text x="${x(i)}" y="${H - 6}" text-anchor="middle">${p.w.slice(5)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}<path d="${path}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>${dots}</svg>`;
  }
  function speedChart(trip, events) {
    const n = trip.v.length, hz = trip.hz || 1, W = 720, H = 230, pl = 36, pr = 10, pt = 10, pb = 26;
    const maxV = Math.max(40, ...trip.v, ...(trip.lim || [0])) + 10, dur = n / hz;
    const X = (i) => pl + ((W - pl - pr) * i) / Math.max(1, n - 1), Y = (v) => pt + (H - pt - pb) * (1 - v / maxV);
    const step = Math.max(1, Math.floor(n / 700));
    let pv = '', pl2 = '', ps = ''; const safe = P.safeFactor[trip.weather || 'dry'];
    for (let i = 0; i < n; i += step) { pv += `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(trip.v[i]).toFixed(1)}`; pl2 += `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(trip.lim[i]).toFixed(1)}`; ps += `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(trip.lim[i] * safe).toFixed(1)}`; }
    const grid = [0, 30, 60, 90, 120].filter((v) => v < maxV).map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="4" y="${Y(v) + 4}">${v}</text>`).join('');
    const mins = Math.round(dur / 60); const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${pl + (W - pl - pr) * f}" y="${H - 6}" text-anchor="middle">${Math.round(mins * f)} min</text>`).join('');
    const color = { brake: 'var(--bad)', accel: 'var(--mid)', corner: 'var(--brand)', phone: 'var(--info)' };
    const ev = events.map((e) => `<circle cx="${X(e.i)}" cy="${Y(trip.v[e.i] || 0)}" r="5.5" fill="${color[e.type]}" stroke="var(--card)" stroke-width="1.5"><title>${t('ev_' + e.type)}</title></circle>`).join('');
    const safeLine = safe < 1 ? `<path d="${ps}" fill="none" stroke="var(--mid)" stroke-width="1.4" stroke-dasharray="4 3"/>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${t('speed')}">${grid}<path d="${pl2}" fill="none" stroke="var(--mute)" stroke-width="1.4"/>${safeLine}<path d="${pv}" fill="none" stroke="var(--ink)" stroke-width="1.8"/>${ev}${xt}</svg>
      <div class="legend"><span><i style="background:var(--ink)"></i>${t('speed')} (km/h)</span><span><i style="background:var(--mute)"></i>${t('limit')}</span>${safe < 1 ? `<span><i style="background:var(--mid)"></i>${t('safe')}</span>` : ''}${['brake', 'accel', 'corner', 'phone'].map((k) => `<span><i style="background:${color[k]}"></i>${t('ev_' + k)} (${events.filter((e) => e.type === k).length})</span>`).join('')}</div>`;
  }
  const bar = (v, c) => `<div class="bar"><i style="width:${Math.max(2, Math.min(100, v))}%;background:${cvar(c || col(v))}"></i></div>`;

  /* ---------- advice ---------- */
  function adviceText(res, d) {
    const a = E.advice(res, d.trips), k = res.kpi, A = P.AVG;
    if (a.gain < 1.5) return { txt: t(res.total < 80 ? 'adv_ok_low' : 'adv_ok'), gain: 0 };
    if (a.worst && a.worst.w === 'dry') a.worst = null;   // "worst in dry" says nothing
    const wl = a.worst ? t(a.worst.w) : '';
    const p = { cyc: fmt(k.cyclesPer), lotover: fmt(k.lotOverPct, 0), surge: k.surge, pct: fmt(k.overSafePct, 0), worst: a.worst, wl: wl.toLowerCase(), worstv: a.worst ? fmt(a.worst.val, 0) : '', ev: k.phoneEv, rate: a.key === 'phone' ? fmt(k.phonePerHour) : fmt(k.harshPer100), avg: fmt(A.harshPer100), fat: k.fatigue, night: fmt(k.nightShare * 100, 0) };
    return { txt: t('adv_' + a.key)(p), gain: a.gain };
  }

  /* ---------- views ---------- */
  let curW = null;
  function kpiCard(key, value, base, ctx, score) {
    return `<div class="card kpi"><div class="row" style="justify-content:space-between;align-items:center"><b>${t('k_' + key)}</b><span class="w">${fmt((curW || P.weights)[key], 0)}% ${t('weight')}</span></div>
      <div class="v" style="color:${cvar(col(score))}">${value}</div><div class="base">${base}</div>${bar(score)}<small class="note">${ctx}</small></div>`;
  }
  function driverView() {
    const ds = allDrivers(), d = ds.find((x) => x.id === S.driver) || ds[0], r = resOf(d), k = r.kpi, c = col(r.total), A = P.AVG;
    const ratio = (v, a) => (a > 0 ? `${t('times')}${fmt(v / a)} ${t('avg')}` : '');
    const conf = r.sigma <= 7 ? 'conf_high' : r.sigma <= 12 ? 'conf_mid' : 'conf_low';
    const adv = adviceText(r, d);
    curW = r.weights;
    const cards = [
      kpiCard('speeding', fmt(k.overSafePct) + '%', `${t('avg')}: ${A.overSafePct}% · ${ratio(k.overSafePct, A.overSafePct)}`, t('c_speeding'), r.scores.speeding),
      kpiCard('phone', fmt(k.phonePerHour) + ' ' + t('perh'), `${t('avg')}: ${A.phonePerHour} · ${ratio(k.phonePerHour, A.phonePerHour)}`, t('c_phone'), r.scores.phone),
      kpiCard('smooth', fmt(k.harshPer100) + ' ' + t('per100'), `${t('avg')}: ${A.harshPer100} · ${ratio(k.harshPer100, A.harshPer100)}`, t('c_smooth'), r.scores.smooth),
      kpiCard('nightfatigue', fmt(k.nightShare * 100, 0) + '% night · ' + k.fatigue + ' long', `${t('avg')}: ${A.nightShare * 100}%`, t('c_nightfatigue'), r.scores.nightfatigue),
      kpiCard('claims', r.claims + ' / 3 ' + t('yr'), 'LTAB / insurer', t('c_claims'), r.scores.claims),
      kpiCard('experience', fmt(r.effHours, 0) + ' ' + t('hours'), `${d.licYears != null ? fmt(d.licYears, d.licYears < 1 ? 1 : 0) + ' ' + t('years_lic') : ''}`, t('c_experience'), r.scores.experience),
    ].join('');
    const bw = ['dry', 'wet', 'snow', 'fog'].map((w) => { const b = r.byWeather[w]; return `<tr><td>${t(w)}</td><td class="num">${b.trips ? fmt(b.km, 0) : '–'}</td><td class="num">${fmt(b.harshPer100)}</td><td class="num">${fmt(b.overSafePct)}%</td></tr>`; }).join('');
    const tw = weekly(d);
    const trips = d.trips.slice().sort((a, b) => Date.parse(b.startISO) - Date.parse(a.startISO));
    const rows = trips.map((tr) => `<tr class="click" data-trip="${tr.id}"><td>${new Date(tr.startISO).toISOString().slice(5, 16).replace('T', ' ')}</td><td>${t('m_' + tr.mode)} <small>${fmt(tr.modeConf * 100, 0)}%</small></td><td class="num">${fmt(tr.km)}</td><td>${t(tr.weather)}</td><td class="num">${tr.counted ? tr.brake + tr.accel + tr.corner : '–'}</td><td>${tr.counted ? `<span class="badge b-good">${t('counted')}</span>` : `<span class="badge b-mute">${t('not_counted')}</span>`}</td></tr>`).join('');
    return `
    <div class="pills" role="tablist">${ds.map((x) => `<button class="chip ${x.id === d.id ? 'on' : ''}" data-driver="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="card hero"><div class="ring">${ring(r.total, c)}<div class="n"><div><b>${fmt(r.total, 0)}</b><small>± ${fmt(r.sigma, 0)} · ${t('of100')}</small></div></div></div>
      <div style="flex:1;min-width:240px"><h2>${esc(d.name)} <span class="badge b-${c}">${t('band_' + r.band)}</span></h2>
      <p class="mute" style="margin:.2em 0">${d.note ? esc(d.note[lang]) : ''}</p>
      <div class="row" style="gap:8px;margin-top:8px"><span class="badge b-info">${t('exp_level')}: ${fmt(d.expHours, 0)} ${t('hours')} (${t('est')})</span><span class="badge b-mute">${t('conf')}: ${t(conf)}</span><span class="badge b-mute">${fmt(k.km, 0)} ${t('measured_km')}</span><span class="badge b-mute">${k.trips} ${t('trips_scored')} · ${k.excluded} ${t('trips_excl')}</span></div></div></div>
    <div class="card advice a-${c}" style="margin-top:14px"><b>${t('advice_t')}</b><p>${esc(adv.txt)}</p>${adv.gain ? `<small class="note">${t('gain')} +${fmt(adv.gain, 0)} ${t('pts')}</small>` : ''}</div>
    ${AI_ON ? `<div class="card" style="margin-top:14px" id="aiadv" data-subj="${d.id}"><b>${t('ai_t')}</b><p class="note">${t('ai_load')}</p></div>` : ''}
    <h2 style="margin-top:20px">KPI</h2><div class="grid g3">${cards}</div>
    <div class="grid g2" style="margin-top:14px"><div class="card"><h3>${t('trend')}</h3>${trendSvg(tw)}</div>
      <div class="card"><h3>${t('by_cond')}</h3><table><thead><tr><th></th><th class="num">km</th><th class="num">${t('harsh_per100')}</th><th class="num">${t('over_safe')}</th></tr></thead><tbody>${bw}</tbody></table></div></div>
    <div class="card" style="margin-top:14px" id="tripdetail">${tripDetail(d)}</div>
    <div class="card" style="margin-top:14px"><h3>${t('trips')}</h3><div style="overflow-x:auto;max-height:340px"><table><thead><tr><th></th><th>${t('mode')}</th><th class="num">km</th><th></th><th class="num">${t('events')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  function tripDetail(d) {
    const sel = S.trip && d.trips.find((x) => x.id === S.trip);
    const first = sel || d.trips.find((x) => d.raws && d.raws[x.id] && x.counted) || null;
    if (!first) return `<h3>${t('trip_detail')}</h3><p class="note">${t('click_trip')}</p>`;
    const raw = d.raws && d.raws[first.id];
    let body;
    if (!raw) body = `<p class="note">${t('no_trace')}</p>`;
    else {
      const trip = rawToTrip(raw, { id: first.id, mode: first.mode, modeConf: first.modeConf, roleConf: first.roleConf, confirmed: first.confirmed });
      const a = E.analyzeTrip(trip);
      body = speedChart(trip, a.events);
    }
    const why = !first.counted ? `<div class="warn" style="margin:8px 0">${first.reason.startsWith('mode') ? t('r_train') : first.reason === 'passenger-confirmed' ? t('r_pconfirm') : t('r_passenger')} (${fmt(first.roleConf * 100, 0)}%)</div>` : '';
    return `<h3>${t('trip_detail')} · ${new Date(first.startISO).toISOString().slice(0, 16).replace('T', ' ')} · ${fmt(first.km)} km · ${t(first.weather)}</h3>${why}${body}`;
  }

  function insurerView() {
    const cs = (D.cars || []).map((c) => ({ c, x: carRes(c) })).sort((a, b) => b.x.res.total - a.x.res.total);
    const rows = cs.map(({ c, x }) => {
      const r = x.res, bw = ['speeding', 'phone', 'smooth', 'nightfatigue'], beh = bw.reduce((s, k) => s + r.weights[k] * r.scores[k], 0) / bw.reduce((s, k) => s + r.weights[k], 0), pr = E.premiumPreview(r.total), cc = col(r.total);
      return `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.plate)}</td><td class="num">${x.drivers.length}</td><td class="num">${fmt(r.kpi.km, 0)}</td>
        <td><b style="color:${cvar(cc)}">${fmt(r.total, 0)}</b> <small>± ${fmt(r.sigma, 0)}</small></td><td><span class="badge b-${cc}">${t('band_' + r.band)}</span></td>
        <td style="min-width:110px">${bar(beh)}</td><td style="min-width:90px">${bar(r.scores.claims)}</td><td class="num">${pr.eur} € <small>−${pr.discountPct}%</small></td></tr>`;
    }).join('');
    return `<h2>${t('ins_title')}</h2><p class="mute">${t('ins_sub')}</p>
    <div class="card"><div style="overflow-x:auto"><table><thead><tr><th>${t('col_car')}</th><th>${t('col_plate')}</th><th class="num">${t('col_drivers')}</th><th class="num">${t('col_km')}</th><th>${t('col_score')}</th><th>${t('col_band')}</th><th>${t('col_beh')}</th><th>${t('col_claims')}</th><th class="num">${t('col_prem')} (${t('ill')}, ${t('per_year')})</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="grid g3" style="margin-top:14px">${['t1', 't2', 't3'].map((k, i) => `<div class="card flat"><b style="color:var(--brand)">${i + 1}</b> ${t(k)}</div>`).join('')}</div>`;
  }

  function expView() {
    const ds = allDrivers().filter((d) => d.licYears != null).map((d) => ({ d, r: resOf(d) }));
    const maxY = Math.max(...ds.map((x) => x.d.licYears)), maxH = Math.max(...ds.map((x) => x.d.expHours));
    const byY = ds.slice().sort((a, b) => b.d.licYears - a.d.licYears), byH = ds.slice().sort((a, b) => b.d.expHours - a.d.expHours);
    const list = (arr, f, max, unit) => arr.map((x, i) => `<div style="margin:10px 0"><div class="row" style="justify-content:space-between"><span>${i + 1}. ${esc(x.d.name)}</span><b>${fmt(f(x), f(x) < 10 ? 1 : 0)} ${unit}</b></div>${bar((f(x) / max) * 100, 'brand')}</div>`).join('');
    const W = 560, H = 200, pl = 34, pr = 14, pt = 10, pb = 26, xmax = 1500, X = (h) => pl + ((W - pl - pr) * Math.min(h, xmax)) / xmax, Y = (v) => pt + (H - pt - pb) * (1 - v / 100);
    let path = ''; for (let h = 0; h <= xmax; h += 15) path += `${h ? 'L' : 'M'}${X(h)},${Y(100 * (1 - Math.exp(-h / P.expTauHours)))}`;
    const dots = ds.map((x) => { const h = Math.min(x.r.effHours, xmax); return `<circle cx="${X(h)}" cy="${Y(x.r.scores.experience)}" r="5" fill="var(--brand)"/><text x="${X(h) + 7}" y="${Y(x.r.scores.experience) + (x.d.id === 'elina' ? 14 : 4)}" style="fill:var(--ink)">${esc(x.d.name.split(' ')[0])}</text>`; }).join('');
    const grid = [0, 50, 100].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="4" y="${Y(v) + 4}">${v}</text>`).join('') + [0, 500, 1000, 1500].map((h) => `<text x="${X(h)}" y="${H - 6}" text-anchor="middle">${h} h</text>`).join('');
    const mix = ds.map((x) => { const b = x.d.expBuckets || {}, tot = P.expBuckets.reduce((s, k) => s + (b[k] || 0), 0) || 1; const colr = { city: 'var(--brand)', highway: 'var(--info)', night: 'var(--ink)', badweather: 'var(--mid)' };
      return `<div style="margin:10px 0"><span>${esc(x.d.name)}</span><div style="display:flex;height:12px;border-radius:99px;overflow:hidden;margin-top:4px">${P.expBuckets.map((k) => `<i style="width:${((b[k] || 0) / tot) * 100}%;background:${colr[k]}" title="${t('b_' + k)}: ${b[k] || 0} h"></i>`).join('')}</div></div>`; }).join('');
    return `<h2>${t('exp_title')}</h2><p class="mute">${t('exp_sub')}</p>
    <div class="grid g2"><div class="card"><h3>${t('exp_today')}</h3>${list(byY, (x) => x.d.licYears, maxY, t('yr'))}</div><div class="card"><h3>${t('exp_new')}</h3>${list(byH, (x) => x.d.expHours, maxH, t('hours'))}</div></div>
    <div class="grid g2" style="margin-top:14px"><div class="card"><h3>${t('exp_curve')}</h3><svg viewBox="0 0 ${W} ${H}" width="100%">${grid}<path d="${path}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>${dots}</svg></div>
    <div class="card"><h3>${t('buckets')}</h3>${mix}<div class="legend">${P.expBuckets.map((k, i) => `<span><i style="background:${['var(--brand)', 'var(--info)', 'var(--ink)', 'var(--mid)'][i]}"></i>${t('b_' + k)}</span>`).join('')}</div></div></div>
    <div class="grid g3" style="margin-top:14px"><div class="card flat note">${t('exp_lit')}</div><div class="card flat note">${t('exp_prior')}</div><div class="card flat note">${t('exp_cold')}</div></div>`;
  }

  function sessionTrip(key) {
    const imp = S.imports.find((x) => x.id === key);
    if (imp) return { name: imp.name, trip: imp.trip, synthetic: false };
    const a = D.ac[key];
    return { name: key === 'calm' ? t('sess_calm') : t('sess_aggr'), trip: rawToTrip(a, { id: key, weather: S.weather === 'dry' ? a.weather : S.weather }), synthetic: true };
  }
  function liveView() {
    const keys = ['calm', 'aggressive'].concat(S.imports.map((x) => x.id));
    const cards = [S.session, ...keys.filter((k) => k !== S.session)].slice(0, 2).map((k) => {
      const s = sessionTrip(k), sm = E.analyzeTrip(s.trip), res = E.scoreDriver([sm], PROFILE_DEMO), c = col(res.total), adv = adviceText(res, { trips: [sm] });
      return `<div class="card"><div class="row" style="justify-content:space-between"><h3>${esc(s.name)}</h3>${s.synthetic ? '<span class="badge b-mid">synthetic placeholder</span>' : `<span class="badge b-good">${t('imported')}</span>`}</div>
      <div class="hero" style="gap:14px"><div class="ring" style="width:110px;height:110px">${ring(res.total, c)}<div class="n"><div><b style="font-size:1.8rem">${fmt(res.total, 0)}</b></div></div></div>
      <div><div>${fmt(sm.km, 1)} km · ${fmt(sm.durationS / 60, 0)} min · ${t(s.trip.weather)}</div><div class="note">${t('ev_brake')}: ${sm.brake} · ${t('ev_accel')}: ${sm.accel} · ${t('ev_corner')}: ${sm.corner} · ${t('ev_phone')}: ${sm.phoneEv}</div><div class="note">${t('over_safe')}: ${fmt(res.kpi.overSafePct, 0)}%</div></div></div>
      ${speedChart(s.trip, sm.events)}<div class="advice card flat" style="margin-top:10px">${esc(adv.txt)}</div></div>`;
    }).join('');
    return `<h2>${t('live_title')}</h2><p class="mute">${t('live_sub')}</p><div class="warn">${t('live_ph')}</div>
    <div class="card flat row" style="margin:12px 0;align-items:center"><label>${t('session')} <select id="sess">${keys.map((k) => `<option value="${k}" ${k === S.session ? 'selected' : ''}>${esc(sessionTrip(k).name)}</option>`).join('')}</select></label>
      <label>${t('weather')} <select id="wx">${['dry', 'wet', 'fog', 'snow'].map((w) => `<option value="${w}" ${S.weather === w ? 'selected' : ''}>${t(w)}</option>`).join('')}</select></label>
      <label>${t('lim_assume')} <input id="lim" type="number" min="20" max="130" value="${S.limit}" style="width:70px"></label>
      <label class="btn sec" style="padding:9px 14px;border-radius:10px;cursor:pointer;background:var(--brand-soft);color:var(--brand);font-weight:600">${t('import')}<input id="file" type="file" accept=".json,.csv,.txt" style="display:none"></label></div>
    ${S.liveErr ? `<div class="warn">${esc(S.liveErr)}</div>` : ''}<div class="grid g2">${cards}</div><p class="note" style="margin-top:10px">${t('single_note')}</p>`;
  }

  function howView() {
    const W = P.weights, tot = Object.values(W).reduce((a, b) => a + b, 0);
    const flow = [['f_data', 'f_data2'], ['f_metric', 'f_metric2'], ['f_kpi', 'f_kpi2'], ['f_score', 'f_score2'], ['f_dec', 'f_dec2']].map((x) => `<div><b>${t(x[0])}</b>${t(x[1])}</div>`).join('<div class="arr">→</div>');
    const wl = Object.keys(W).map((k) => `<div style="margin:8px 0"><div class="row" style="justify-content:space-between"><span>${t('k_' + k)}</span><b>${W[k]}%</b></div>${bar((W[k] / tot) * 100 * 3, 'brand')}</div>`).join('');
    return `<h2>${t('how_title')}</h2><p class="mute">${t('how_sub')}</p><div class="flow">${flow}</div>
    <div class="grid g2" style="margin-top:14px"><div class="card"><h3>${t('weights')}</h3>${wl}<p class="note">${t('w_dyn')}</p></div>
      <div class="card"><h3>${t('track_yes')}</h3><ul>${t('yes_list').map((x) => `<li>${x}</li>`).join('')}</ul><h3 style="margin-top:14px">${t('track_no')}</h3><ul>${t('no_list').map((x) => `<li>${x}</li>`).join('')}</ul></div></div>
    <div class="grid g3" style="margin-top:14px"><div class="card flat"><b>${t('reqs')}</b><ul><li>${t('req1')}</li><li>${t('req2')}</li><li>${t('req3')}</li></ul></div>
      <div class="card flat"><b>${t('roadmap')}</b><ul>${t('rm').map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="card flat"><b>${t('assumptions')}</b><ul>${t('as').map((x) => `<li>${x}</li>`).join('')}</ul></div></div>
    <div class="card" style="margin-top:14px"><h3>${t('evid_t')}</h3><p class="note">${t('evid_cav')}</p><div style="overflow-x:auto"><table><thead><tr><th>${t('weights')}</th><th></th><th>CSDD / BTA</th></tr></thead><tbody>${t('evid').map((e) => `<tr><td style="white-space:nowrap"><b>${t('k_' + e[0])}</b><br><small>${fmt(P.weights[e[0]], 0)}${e[0] === 'experience' ? '–35' : ''}%</small></td><td><span class="badge ${e[1] === 's' ? 'b-good' : e[1] === 'm' ? 'b-mid' : e[1] === 'w' ? 'b-bad' : 'b-mute'}">${t('evid_str')[e[1]]}</span></td><td style="font-size:.84rem">${e[2]}</td></tr>`).join('')}</tbody></table></div><p class="note" style="margin-top:8px">${t('evid_unm')}</p></div>
    <div class="card" style="margin-top:14px"><h3>${t('ts_t')}</h3><ul><li>${t('ts_1')}</li><li>${t('ts_2')}</li><li>${t('ts_3')}</li></ul></div>
    <h3 style="margin-top:18px">${t('addon')}</h3><div class="phone"><div class="screen"><b>LTAB OCTA</b>
      <div class="card flat"><small>${t('score')}</small><div style="font-size:2rem;font-weight:700;color:var(--good)">86</div></div>
      <div class="card flat" style="border-color:var(--bad)"><b style="color:var(--bad)">⚠ ${t('crash')}</b><div class="note">${t('crash2')}</div><div style="margin-top:6px"><span class="badge b-info">${t('confirm')}</span></div></div></div></div>
    <p class="note" style="text-align:center">${t('mock')}</p>`;
  }

  /* ---------- import ---------- */
  function parseCSV(txt) {
    const lines = txt.trim().split(/\r?\n/), head = lines[0].split(/[;,]/).map((s) => s.trim().toLowerCase()), idx = (names) => head.findIndex((h) => names.includes(h));
    const it = idx(['t', 'time', 'time_s']), iv = idx(['v', 'speed', 'speed_kmh', 'speedkmh']), ia = idx(['ay', 'lat_g', 'latg', 'lateral_g']), il = idx(['lim', 'limit', 'limit_kmh']), ip = idx(['phone']);
    if (iv < 0) throw new Error('CSV needs a speed column (speed_kmh)');
    const rows = lines.slice(1).map((l) => l.split(/[;,]/).map(Number));
    return { t: it >= 0 ? rows.map((r) => r[it]) : null, v: rows.map((r) => r[iv]), ay: ia >= 0 ? rows.map((r) => r[ia]) : null, lim: il >= 0 ? rows.map((r) => r[il]) : null, phone: ip >= 0 ? rows.map((r) => r[ip] ? 1 : 0) : null, meta: {} };
  }
  function parseLog(txt, name) {
    let o;
    if (txt.trim().startsWith('{')) {
      const j = JSON.parse(txt);
      if (j.samples) o = { t: j.samples.map((s) => s.t), v: j.samples.map((s) => s.v), ay: j.samples.map((s) => s.ay || 0), phone: j.samples.map((s) => (s.phone ? 1 : 0)), lim: j.samples[0].lim != null ? j.samples.map((s) => s.lim) : null, meta: j.meta || {} };
      else if (j.v) o = { t: null, v: j.v, ay: j.ay, phone: j.phone || null, lim: j.lim || null, meta: { hz: j.hz, weather: j.weather, limit: j.limit } };
      else throw new Error('Unknown JSON format');
    } else o = parseCSV(txt);
    let hz = o.meta.hz;
    if (!hz && o.t) { const d = []; for (let i = 1; i < o.t.length; i++) d.push(o.t[i] - o.t[i - 1]); d.sort((a, b) => a - b); hz = Math.round(1 / (d[Math.floor(d.length / 2)] || 1)); }
    hz = hz || 1;
    const trip = { id: 'imp' + (S.imports.length + 1), startISO: o.meta.startISO || new Date().toISOString(), hz, mode: 'car', roleConf: 1, confirmed: true, weather: S.weather, traffic: 'free', roadType: 'mixed', v: o.v, ay: o.ay || undefined, lim: o.lim || o.v.map(() => o.meta.limit || S.limit), phone: o.phone || undefined };
    return { id: trip.id, name: (o.meta.name || name.replace(/\.[^.]+$/, '')) , trip };
  }

  /* ---------- wiring ---------- */
  function dbLine() {
    const lv = lang === 'lv', i = S.dbInfo;
    if (!i) return `◌ ${lv ? 'Datu avots: ielādē no datubāzes…' : 'Data source: loading from the database…'}`;
    if (i.source === 'supabase' && i.sample) return `◐ ${lv ? 'Tavi dati no datubāzes (Supabase) — PARAUGA dati, kamēr nav īstu braucienu' : 'Your data from the database (Supabase) — SAMPLE data until there are real rides'} · ${i.trips} ${lv ? 'braucieni' : 'trips'}`;
    if (i.source === 'supabase' && i.sampleCount > 0) return `◐ ${lv ? 'Tavi dati no datubāzes (Supabase): ' : 'Your data from the database (Supabase): '}${i.trips - i.sampleCount} ${lv ? 'īsti braucieni + ' : 'real rides + '}${i.sampleCount} ${lv ? 'PARAUGA braucieni (ilustratīvi)' : 'SAMPLE rides (illustrative)'}`;
    if (i.source === 'supabase') return `● ${lv ? 'Datu avots' : 'Data source'}: Supabase (EU) · ${i.trips} ${lv ? 'braucieni' : 'trips'} · ${i.events} ${lv ? 'notikumi' : 'events'} · ${i.ms} ms`;
    return `○ ${lv ? 'Šie ir SINTĒTISKI demo scenāriji (iebūvēti lapā). Īstie dati glabājas datubāzē un ir redzami tikai kontā.' : 'These are SYNTHETIC demo scenarios (built into the page). Real data lives in the database and is visible only in your account.'}`;
  }
  /* the app renders instantly from data.js, then swaps in the database copy; on any failure data.js stays */
  function loadDb() {
    if (!window.DB) { S.dbInfo = { source: 'data.js' }; return Promise.resolve(); }
    return DB.load(D).then((info) => { S.dbInfo = info; cache.clear(); render(); }).catch((e) => { S.dbInfo = { source: 'data.js', error: String(e && e.message || e) }; render(); });
  }
  function appView() {
    const L = Phone.L[lang], ds = allDrivers().filter((d) => !String(d.id).startsWith('imp'));
    const views = [['driver', 'tab_driver'], ['insurer', 'tab_insurer'], ['exp', 'tab_exp'], ['live', 'tab_live'], ['how', 'tab_how']];
    const panel = S.demoOpen ? `<div class="demo-panel card"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Demo</h3><button class="chip" data-demo="toggle" aria-label="Close">✕</button></div>
      <p class="note" style="margin:8px 0 0">${dbLine()}</p>
      <h3 style="margin-top:12px">${L.persona}</h3><div class="pills">${ds.map((x) => `<button class="chip ${x.id === S.driver ? 'on' : ''}" data-persona="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <div class="pills"><a class="chip" href="login.html" style="text-decoration:none">${lang === 'lv' ? '🔑 Pieteikties / reģistrēties' : '🔑 Log in / sign up'}</a><a class="chip" href="account.html" style="text-decoration:none">${lang === 'lv' ? '👤 Mans konts' : '👤 My account'}</a>
      <a class="chip" href="collect.html" style="text-decoration:none">${lang === 'lv' ? '📡 Braucienu vācējs' : '📡 Trip collector'}</a><a class="chip" href="insurer.html" style="text-decoration:none">${lang === 'lv' ? '🏢 Apdrošinātāja skats' : '🏢 Insurer view'}</a></div>
      <div class="pills"><button class="chip" data-demo="onboard">${L.onboard_btn}</button><button class="chip" data-demo="lang">${lang === 'lv' ? 'EN' : 'LV'}</button></div>
      <h3>${L.views_t}</h3><div class="pills">${views.map(([k, lk]) => `<button class="chip" data-tab="${k}">${t(lk)}</button>`).join('')}</div>
      <h3>${L.what_t}</h3><ul style="margin:.3em 0 0;padding-left:1.1em;font-size:.88rem">${L.what.map((x) => `<li>${x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>`).join('')}</ul></div>` : '';
    return `<div id="phone-root"></div><button class="demo-fab" data-demo="toggle" aria-label="Demo">⋯</button>${panel}`;
  }
  const TABS = [['app', appView], ['driver', driverView], ['insurer', insurerView], ['exp', expView], ['live', liveView], ['how', howView]];
  /* Driver recommendation: the engine computes the numbers, the `recommend` Edge Function (Gemini, or a template when no key) writes the advice. */
  const SB = 'https://qjakepgeqioqrmsufaty.supabase.co/functions/v1/recommend', SBK = 'sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS';
  S.ai = S.ai || {};
  function aiHtml(r) {
    const mx = Math.max(1, ...r.actions.map((a) => a.gainPoints));
    const bars = r.actions.map((a) => `<div style="margin:8px 0"><div class="row" style="justify-content:space-between;gap:8px"><span><b>${esc(a.title)}</b></span><span class="note">+${fmt(a.gainPoints, 1)} ${t('pts')}${a.savingEur > 0 ? ` · −${a.savingEur} €` : ''}</span></div><div class="bar"><i style="width:${Math.round(a.gainPoints / mx * 100)}%;background:var(--info)"></i></div><p class="note" style="margin:4px 0 0">${esc(a.tip)}</p></div>`).join('');
    const best = r.eur_now - r.eur_best;
    return `<b>${t('ai_t')}</b> <span class="badge b-mute">${r.source === 'gemini' ? 'Gemini' : t('ai_tmpl')}</span><p>${esc(r.summary)}</p>${bars}
      ${best > 0 ? `<p><b>${t('ai_best')}: ${r.eur_now} € → ${r.eur_best} € ${t('per_year')}</b> <small class="note">(${t('ill')})</small></p>` : ''}<p class="note">${esc(r.encouragement)} · ${t('ai_foot')}</p>`;
  }
  function loadAdvice(el) {
    const id = el.dataset.subj, key = id + lang;
    if (S.ai[key]) { el.innerHTML = aiHtml(S.ai[key]); return; }
    fetch(SB, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SBK }, body: JSON.stringify({ subject_type: 'driver', id, lang }) })
      .then((r) => r.json()).then((r) => {
        if (!r.actions && !r.summary) throw new Error(r.error || 'no data');
        S.ai[key] = r; const cur = $('#aiadv'); if (cur && cur.dataset.subj === id) cur.innerHTML = aiHtml(r);
      }).catch(() => { const cur = $('#aiadv'); if (cur && cur.dataset.subj === id) cur.innerHTML = `<b>${t('ai_t')}</b><p class="note">${t('ai_err')}</p>`; });
  }
  /* motion: numbers count up, bars grow, cards rise in (skipped when the visitor prefers reduced motion) */
  function animateIn(root) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-count]'), function (el) {
      var to = +el.dataset.count, t0 = performance.now(), dur = 1100;
      (function step(now) { var f = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - f, 3); el.textContent = Math.round(to * e); if (f < 1) requestAnimationFrame(step); })(t0);
    });
  }
  function render() {
    document.documentElement.lang = lang;
    $('#lang').textContent = lang === 'en' ? 'LV' : 'EN';
    document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = t(el.dataset.i); });
    $('#tabs').innerHTML = TABS.map(([k]) => `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${t('tab_' + k)}</button>`).join('');
    $('#main').innerHTML = TABS.find(([k]) => k === S.tab)[1]();
    document.body.classList.toggle('app-mode', S.tab === 'app');
    const pr = $('#phone-root'); if (pr) Phone.mount(pr);
    animateIn(document);
    const ai = $('#aiadv'); if (ai) loadAdvice(ai);
    const f = $('#file'); if (f) f.addEventListener('change', onFile);
    const s = $('#sess'); if (s) s.addEventListener('change', (e) => { S.session = e.target.value; render(); });
    const w = $('#wx'); if (w) w.addEventListener('change', (e) => { S.weather = e.target.value; render(); });
    const l = $('#lim'); if (l) l.addEventListener('change', (e) => { S.limit = +e.target.value || 50; });
  }
  function onFile(e) {
    const file = e.target.files[0]; if (!file) return;
    file.text().then((txt) => {
      try {
        const imp = parseLog(txt, file.name); S.liveErr = '';
        const sm = E.analyzeTrip(imp.trip);
        S.imports.push({ id: imp.id, name: imp.name, licYears: null, expHours: PROFILE_DEMO.expHours, expBuckets: PROFILE_DEMO.expBuckets, claims3y: 0, trips: [sm], raws: {}, trip: imp.trip, note: { en: 'Imported session.', lv: 'Importēta sesija.' } });
        S.session = imp.id;
      } catch (err) { S.liveErr = 'Import failed: ' + err.message; }
      render();
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab],[data-driver],[data-trip],[data-persona],[data-demo]'); if (!b) return;
    if (b.dataset.demo) {
      if (b.dataset.demo === 'toggle') S.demoOpen = !S.demoOpen;
      else if (b.dataset.demo === 'lang') { lang = lang === 'en' ? 'lv' : 'en'; try { localStorage.setItem('lang', lang); } catch (er) {} }
      else if (b.dataset.demo === 'onboard') { S.demoOpen = false; Phone.onboard(); return; }
      render(); return;
    }
    if (b.dataset.persona) { S.driver = b.dataset.persona; Phone.reset(); }
    else if (b.dataset.tab && b.dataset.tab !== 'app') { S.demoOpen = false; S.tab = b.dataset.tab; S.trip = null; }
    else if (b.dataset.tab) { S.tab = b.dataset.tab; S.trip = null; }
    else if (b.dataset.driver) { S.driver = b.dataset.driver; S.tab = 'driver'; S.trip = null; }
    else if (b.dataset.trip) { S.trip = b.dataset.trip; }
    render(); if (b.dataset.trip) { const el = $('#tripdetail'); if (el) el.scrollIntoView({ block: 'nearest' }); }
  });
  $('#lang').addEventListener('click', () => { lang = lang === 'en' ? 'lv' : 'en'; try { localStorage.setItem('lang', lang); } catch (e) {} render(); });
  window.App = { E, D, carsOf, carRes, allDrivers, resOf, weekly, adviceText, ring, trendSvg, speedChart, rawToTrip, t, fmt, col, P, analyze: E.analyzeTrip,
    animateIn, loadDb, reloadMine: () => DB.loadMine(D).then((info) => { addExamples(); S.dbInfo = info; S.driver = D.drivers[0].id; cache.clear(); render(); return info; }), lang: () => lang, state: () => S, invalidate: () => cache.clear(),
    setLang: (l) => { lang = l; try { localStorage.setItem('lang', lang); } catch (e) {} render(); } };
  /* After login the app shows ONLY the user's own data from the database (empty account -> illustrative samples). Nothing is recorded or calculated by the site itself:
     the rides come from the database (Assetto Corsa via live.py / sample seed), the site only calculates the rating from the last rides and displays it. */
  function boot() {
    const u = window.Auth && Auth.user();
    if (!u || !window.DB || !DB.loadMine) { render(); loadDb(); return; }
    const lv = lang === 'lv';
    $('#main').innerHTML = `<p class="note" style="padding:28px 16px">${lv ? 'Ielādē tavus datus no datubāzes…' : 'Loading your data from the database…'}</p>`;
    DB.loadMine(D).then((info) => { addExamples(); S.dbInfo = info; S.driver = D.drivers[0].id; cache.clear(); render(); })
      .catch((e) => { $('#main').innerHTML = `<div class="card" style="margin:20px"><b>${lv ? 'Neizdevās ielādēt datus' : 'Could not load your data'}</b><p class="note">${esc(String(e && e.message || e))}</p><button class="chip" id="retry">${lv ? 'Mēģināt vēlreiz' : 'Retry'}</button> <a class="chip" href="login.html" style="text-decoration:none">${lv ? 'Pieteikties' : 'Log in'}</a></div>`; const b = $('#retry'); if (b) b.onclick = boot; });
  }
  boot();
})();
