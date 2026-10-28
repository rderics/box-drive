"""
osm_limits.py — speed limit from OpenStreetMap roads of central Riga (riga-limits.json, built by tools/build_limits.py from the OSMnx graph).

  python live.py csv trip.csv --osm        uses the latitude/longitude columns of the CSV (real GPS) to find the road's limit

Nearest-road matching (<= 30 m, no map-matching): at junctions and parallel streets it can pick the wrong road. Outside the mapped area (or
> 30 m from a road) it falls back to `--limit` / 50 km/h. NOT usable for Assetto Corsa: the game's coordinates are not real.
"""
from __future__ import annotations

import json
import math
import os
from typing import Optional

from sources import SpeedLimitProvider

_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "riga-limits.json")
_CELL = 0.002
_MAXD = 30.0


class OsmLimits(SpeedLimitProvider):
    def __init__(self, fallback_kmh: float = 50.0, path: str = _FILE):
        with open(path, encoding="utf-8") as f:
            self.m = json.load(f)
        self.fallback = fallback_kmh
        self.grid: dict = {}
        for si, s in enumerate(self.m["segs"]):
            c = s[3]
            for i in range(0, len(c) - 3, 2):
                lat0, lat1 = sorted((c[i], c[i + 2]))
                lon0, lon1 = sorted((c[i + 1], c[i + 3]))
                for x in range(int((lon0 - 0.0005) // _CELL), int((lon1 + 0.0005) // _CELL) + 1):
                    for y in range(int((lat0 - 0.0005) // _CELL), int((lat1 + 0.0005) // _CELL) + 1):
                        self.grid.setdefault((x, y), []).append((si, i))
        self.hits = self.total = 0

    def at(self, lat: float, lon: float) -> Optional[float]:
        cell = self.grid.get((int(lon // _CELL), int(lat // _CELL)))
        if not cell:
            return None
        kx, ky, best = 111320.0 * math.cos(math.radians(lat)), 110540.0, None
        for si, i in cell:
            c = self.m["segs"][si][3]
            ax, ay, bx, by = (c[i + 1] - lon) * kx, (c[i] - lat) * ky, (c[i + 3] - lon) * kx, (c[i + 2] - lat) * ky
            dx, dy = bx - ax, by - ay
            l2 = dx * dx + dy * dy
            t = max(0.0, min(1.0, -(ax * dx + ay * dy) / l2)) if l2 else 0.0
            d = math.hypot(ax + t * dx, ay + t * dy)
            if d <= _MAXD and (best is None or d < best[0]):
                best = (d, self.m["segs"][si][0])
        return float(best[1]) if best else None

    def limit_at(self, dist_m, p):
        self.total += 1
        v = self.at(p.lat, p.lon) if p.lat is not None and p.lon is not None else None
        if v is not None:
            self.hits += 1
        return v if v is not None else self.fallback
