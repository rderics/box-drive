/* Speed limit for a GPS position, from OpenStreetMap roads of central Riga (riga-limits.json, built by tools/build_limits.py from the OSMnx graph).
 * Limits.load().then(() => Limits.at(lat, lon)) -> { limit, tagged, hw, dist } | null   (null = outside the mapped area or > 30 m from any mapped road)
 * tagged = true: the limit is the OSM `maxspeed` tag; false: assumed from the road type (50 km/h, living street 20). Nearest-road matching only:
 * no heading / map-matching, so at junctions and parallel roads it can pick the wrong street (stated limitation). */
(function (root) {
  'use strict';
  const MAXD = 30, CELL = 0.002;                       // metres, grid cell in degrees (~220 m)
  let M = null, grid = null;
  const kx = (lat) => 111320 * Math.cos(lat * Math.PI / 180), ky = 110540;

  function index(data) {
    M = data; grid = new Map();
    data.segs.forEach((s, si) => {
      const c = s[3];
      for (let i = 0; i + 3 < c.length; i += 2) {
        const a = [c[i], c[i + 1]], b = [c[i + 2], c[i + 3]];
        const x0 = Math.floor((Math.min(a[1], b[1]) - 0.0005) / CELL), x1 = Math.floor((Math.max(a[1], b[1]) + 0.0005) / CELL);
        const y0 = Math.floor((Math.min(a[0], b[0]) - 0.0005) / CELL), y1 = Math.floor((Math.max(a[0], b[0]) + 0.0005) / CELL);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; (grid.get(k) || grid.set(k, []).get(k)).push([si, i]); }
      }
    });
  }
  function load(url) {
    if (M) return Promise.resolve(M);
    return fetch(url || 'riga-limits.json').then((r) => r.json()).then((d) => { index(d); return d; });
  }
  function dseg(lat, lon, c, i) {                      // distance from the point to one polyline piece, metres (local flat approximation)
    const sx = kx(lat), ax = (c[i + 1] - lon) * sx, ay = (c[i] - lat) * ky, bx = (c[i + 3] - lon) * sx, by = (c[i + 2] - lat) * ky;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    return Math.hypot(ax + t * dx, ay + t * dy);
  }
  function at(lat, lon) {
    if (!M) return null;
    const b = M.bbox; if (lat < b[0] - 0.001 || lat > b[2] + 0.001 || lon < b[1] - 0.001 || lon > b[3] + 0.001) return null;
    const cell = grid.get(Math.floor(lon / CELL) + ',' + Math.floor(lat / CELL)); if (!cell) return null;
    let best = null;
    for (const [si, i] of cell) { const d = dseg(lat, lon, M.segs[si][3], i); if (d <= MAXD && (!best || d < best.dist)) best = { dist: d, si }; }
    if (!best) return null;
    const s = M.segs[best.si];
    return { limit: s[0], tagged: s[1] === 1, hw: s[2], dist: Math.round(best.dist) };
  }
  const api = { load, index, at };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Limits = api;
})(typeof self !== 'undefined' ? self : this);
