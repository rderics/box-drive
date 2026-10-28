/*
 * Real road-weather inputs from Open-Meteo (model/reanalysis data for the trip's place and time — NOT a road-surface sensor).
 * Used by the collector (browser) and mirrored in the ingest function (Deno). Only a coarse location (2 decimals ≈ 1 km) is ever sent.
 * Classes: dry | wet | snow (snow, freezing precipitation or ice risk) | fog. ice_risk is an ESTIMATE: temperature ≤ 1 °C with precipitation / freezing codes.
 */
(function (root) {
  'use strict';
  const FOG = [45, 48], FREEZING = [56, 57, 66, 67], SNOW = [71, 73, 75, 77, 85, 86], RAIN = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  const r2 = (x) => Math.round(x * 100) / 100;

  function classify(h) { // h = { temp, precip, snow, vis, code }
    const ice = h.temp != null && h.temp <= 1 && ((h.precip || 0) > 0 || (h.snow || 0) > 0 || FREEZING.includes(h.code));
    let cls = 'dry';
    if ((h.vis != null && h.vis < 1000) || FOG.includes(h.code)) cls = 'fog';
    else if ((h.snow || 0) > 0 || SNOW.includes(h.code) || FREEZING.includes(h.code) || ice) cls = 'snow';
    else if ((h.precip || 0) >= 0.1 || RAIN.includes(h.code)) cls = 'wet';
    return { cls, ice };
  }

  /* hourly rows covering [startMs, endMs] -> one summary (worst hour wins) */
  function summarize(rows) {
    if (!rows.length) return null;
    const h = { temp: Math.min(...rows.map((r) => r.temp)), precip: Math.max(...rows.map((r) => r.precip || 0)), snow: Math.max(...rows.map((r) => r.snow || 0)), vis: Math.min(...rows.map((r) => (r.vis == null ? 1e9 : r.vis))), code: rows.slice().sort((a, b) => (b.precip || 0) - (a.precip || 0))[0].code };
    if (h.vis === 1e9) h.vis = null;
    return Object.assign({}, h, classify(h), { src: 'open-meteo' });
  }

  async function fetchWeather(lat, lon, startMs, endMs, fetchFn) {
    const f = fetchFn || fetch, d = (ms) => new Date(ms).toISOString().slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${r2(lat)}&longitude=${r2(lon)}&hourly=temperature_2m,precipitation,snowfall,weather_code,visibility&start_date=${d(startMs)}&end_date=${d(endMs)}&timezone=UTC`;
    const r = await f(url); if (!r.ok) throw new Error('open-meteo ' + r.status);
    const j = await r.json(), H = j.hourly, rows = [];
    for (let i = 0; i < H.time.length; i++) {
      const t = Date.parse(H.time[i] + 'Z');
      if (t + 3600e3 > startMs && t <= endMs) rows.push({ temp: H.temperature_2m[i], precip: H.precipitation[i], snow: H.snowfall[i], vis: H.visibility[i], code: H.weather_code[i] });
    }
    return summarize(rows);
  }

  const api = { classify, summarize, fetchWeather };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Weather = api;
})(typeof self !== 'undefined' ? self : this);
