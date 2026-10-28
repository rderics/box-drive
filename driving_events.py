"""
driving_events.py — core: telemetry -> dangerous driving events -> rating.

Unit Conventions
  t            seconds from trip start
  speed_kmh    speed, km/h
  g_lon        longitudinal acceleration, g:   > 0 acceleration, < 0 braking
  g_lat        lateral acceleration, g:      > 0 right, < 0 left
  g_force      full acceleration magnitude, g, WITHOUT gravity (1 g rest subtracted)
  heading      heading, clockwise degrees from north (GPS bearing)
  yaw_rate     turn rate, deg/s, > 0 right (gyroscope)

Only t, lat, lon, and speed_kmh are mandatory. Everything else (g_lon, g_lat, heading,
angular velocity, speed limit, wheel slip) is used if present; otherwise, g_lon and g_lat
are calculated from speed and heading/coordinates.
The origin of each signal is recorded in Trace.sources (visible in the report).

Detectors — separate functions detect_*(trace, cfg) -> list[Event].
Event classes inherit from Event.
"""
from __future__ import annotations

import math
from bisect import bisect_left, bisect_right
from dataclasses import asdict, dataclass, field
from statistics import median
from typing import ClassVar, Dict, List, Optional, Sequence, Tuple

G = 9.80665


# ─────────────────────────── input data ───────────────────────────

@dataclass
class TelemetryPoint:
    t: float
    lat: float
    lon: float
    speed_kmh: float
    g_force: Optional[float] = None
    g_lon: Optional[float] = None
    g_lat: Optional[float] = None
    heading: Optional[float] = None
    yaw_rate: Optional[float] = None
    speed_limit_kmh: Optional[float] = None
    wheel_slip: Optional[float] = None


# ─────────────────────────────── thresholds ───────────────────────────────

@dataclass
class Config:
    """All thresholds in one place. Values are for a passenger car, not a race car."""
    # preprocessing
    smooth_s: float = 0.3            # smoothing window
    min_speed_kmh: float = 10.0      # events below this speed are ignored
    merge_gap_s: float = 0.5         # pauses shorter than this merge segments

    # harsh braking / acceleration / turning
    brake_g: float = 0.30
    brake_min_s: float = 0.5
    accel_g: float = 0.30
    accel_min_s: float = 0.6
    turn_g: float = 0.35
    turn_min_s: float = 0.5

    # speeding: tolerance = max(abs, rel * limit)
    speed_tol_kmh: float = 5.0
    speed_tol_rel: float = 0.10
    speed_min_s: float = 3.0

    # weaving: a series of alternating lateral peaks
    weave_amp_g: float = 0.18
    weave_min_speed_kmh: float = 30.0
    weave_peak_spacing_s: float = 2.5
    weave_min_peaks: int = 4

    # loss of control (heuristic, see detect_loss_of_control)
    loc_combined_g: float = 0.75     # total acceleration near the grip limit
    loc_turn_lat_g: float = 0.45     # braking in a turn: lateral ...
    loc_turn_brake_g: float = 0.35   # ... and braking simultaneously
    loc_slip: float = 3.0            # wheel slip (if sensor available); tune as needed
    loc_min_lat_g: float = 0.25      # skid impossible without lateral g: straight-line wheelspin/acceleration ignored
    loc_min_s: float = 0.3
    loc_min_speed_kmh: float = 20.0

    # collision: g peak and sharp speed drop
    collision_g: float = 1.5
    collision_drop_kmh: float = 15.0

    # rating
    score_scale: float = 25.0        # penalty per 100 km at which score = 100/e ≈ 37
    min_distance_km: float = 10.0    # shorter trips are normalized to this value

    # online mode
    live_analyze_every_s: float = 0.5
    live_close_delay_s: float = 3.0  # display event when it finished this long ago


# ───────────────────────────────── events ─────────────────────────────

def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _sev(value: float, threshold: float) -> float:
    """0 at threshold, 1 at double the threshold."""
    return _clamp01((value - threshold) / threshold)


@dataclass
class Event:
    """Base event. Subclasses define kind/label/unit/weight/priority."""
    kind: ClassVar[str] = "event"
    label: ClassVar[str] = "Event"
    unit: ClassVar[str] = "g"
    weight: ClassVar[float] = 1.0      # contribution to rating penalty
    priority: ClassVar[int] = 1        # higher priority event absorbs overlapping ones
    absorbable: ClassVar[bool] = True

    t_start: float
    t_end: float
    peak: float            # peak value in units of unit
    speed_kmh: float       # speed at peak moment
    lat: float
    lon: float
    severity: float = 0.0  # 0..1
    meta: dict = field(default_factory=dict)

    @property
    def duration(self) -> float:
        return self.t_end - self.t_start

    def details(self) -> str:
        return ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d.update(kind=self.kind, label=self.label, unit=self.unit,
                 duration_s=round(self.duration, 2))
        return d


class HarshBraking(Event):
    kind = "harsh_braking"
    label = "Harsh braking"
    weight = 1.0

    def details(self) -> str:
        return f"{self.meta.get('from_kmh', '?')} -> {self.meta.get('to_kmh', '?')} km/h"


class HarshAcceleration(Event):
    kind = "harsh_acceleration"
    label = "Harsh acceleration"
    weight = 0.7

    def details(self) -> str:
        return f"{self.meta.get('from_kmh', '?')} -> {self.meta.get('to_kmh', '?')} km/h"


class HarshTurning(Event):
    kind = "harsh_turning"
    label = "Harsh turning"
    weight = 1.0


class LossOfControl(Event):
    kind = "loss_of_control"
    label = "Loss of control"
    weight = 3.0
    priority = 2

    _NAMES = {"slip": "wheel slip", "grip_limit": "grip limit",
              "braking_in_turn": "braking in turn"}

    def details(self) -> str:
        return ", ".join(self._NAMES.get(r, r) for r in self.meta.get("reasons", []))


class Weaving(Event):
    kind = "weaving"
    label = "Weaving"
    weight = 1.5

    def details(self) -> str:
        return f"{self.meta.get('peaks', '?')} oscillations"


class Speeding(Event):
    kind = "speeding"
    label = "Speeding"
    unit = "km/h"
    weight = 1.2
    priority = 0
    absorbable = False

    def details(self) -> str:
        return f"limit {self.meta.get('limit_kmh', '?')}, max {self.meta.get('max_kmh', '?')} km/h"


class Collision(Event):
    kind = "collision"
    label = "Collision / impact"
    weight = 6.0
    priority = 3

    def details(self) -> str:
        return f"speed dropped by {self.meta.get('drop_kmh', '?')} km/h"


EVENT_TYPES: Tuple[type, ...] = (HarshBraking, HarshAcceleration, HarshTurning,
                                 LossOfControl, Weaving, Speeding, Collision)


# ─────────────────────────── preprocessing ────────────────────────────

@dataclass
class Trace:
    """Cleaned and smoothed telemetry — input for detectors."""
    t: List[float]
    latitude: List[float]
    longitude: List[float]
    v_kmh: List[float]
    g_lon: List[float]              # smoothed
    g_lat: List[float]              # smoothed
    g_peak: List[float]             # unsmoothed peak (for collisions)
    slip: Optional[List[float]]
    limit: Optional[List[Optional[float]]]
    dist_m: List[float]
    dt: float
    sources: Dict[str, str]

    def __len__(self) -> int:
        return len(self.t)


def _finite(x) -> bool:
    return x is not None and math.isfinite(x)


def _smooth(vals: Sequence[float], k: int) -> List[float]:
    """Centered moving average without time shift."""
    if k <= 1:
        return list(vals)
    half = k // 2
    pre = [0.0]
    for x in vals:
        pre.append(pre[-1] + x)
    n = len(vals)
    out = []
    for i in range(n):
        a, b = max(0, i - half), min(n, i + half + 1)
        out.append((pre[b] - pre[a]) / (b - a))
    return out


def _deriv(vals: Sequence[float], t: Sequence[float]) -> List[float]:
    n = len(vals)
    out = []
    for i in range(n):
        a, b = max(0, i - 1), min(n - 1, i + 1)
        out.append((vals[b] - vals[a]) / (t[b] - t[a]))
    return out


def _unwrap(deg: Sequence[float]) -> List[float]:
    out = [deg[0]]
    for d in deg[1:]:
        out.append(out[-1] + (d - out[-1] + 180.0) % 360.0 - 180.0)
    return out


def _yaw_rate(pts: Sequence[TelemetryPoint], t: Sequence[float], k: int) -> Tuple[List[float], str]:
    if all(_finite(p.yaw_rate) for p in pts):
        return [p.yaw_rate for p in pts], "gyroscope"
    if all(_finite(p.heading) for p in pts):
        hd, src = _unwrap([p.heading for p in pts]), "GPS heading"
    else:
        lat0, lon0 = pts[0].lat, pts[0].lon
        kx = 111320.0 * math.cos(math.radians(lat0))
        x = [(p.lon - lon0) * kx for p in pts]
        y = [(p.lat - lat0) * 111320.0 for p in pts]
        raw, last = [], 0.0
        for i in range(len(pts)):
            a, b = max(0, i - 1), min(len(pts) - 1, i + 1)
            dx, dy = x[b] - x[a], y[b] - y[a]
            if math.hypot(dx, dy) >= 0.5:        # standing still — do not change heading
                last = math.degrees(math.atan2(dx, dy))
            raw.append(last)
        hd, src = _unwrap(raw), "coordinate change"
    return _smooth(_deriv(hd, t), k), src


def build_trace(points: Sequence[TelemetryPoint], cfg: Config) -> Trace:
    pts = sorted((p for p in points if _finite(p.t) and _finite(p.speed_kmh)), key=lambda p: p.t)
    uniq: List[TelemetryPoint] = []
    for p in pts:
        if uniq and p.t - uniq[-1].t < 1e-6:     # time duplicates
            continue
        uniq.append(p)
    pts = uniq
    n = len(pts)
    if n < 5:
        raise ValueError("too few telemetry points (minimum 5 required)")

    t = [p.t for p in pts]
    dt = median(t[i + 1] - t[i] for i in range(n - 1))
    k = max(1, int(round(cfg.smooth_s / dt)))
    v_ms = _smooth([p.speed_kmh / 3.6 for p in pts], k)
    sources: Dict[str, str] = {}

    if all(_finite(p.g_lon) for p in pts):
        lon_raw = [p.g_lon for p in pts]
        sources["g_lon"] = "data (accelerometer / game)"
    else:
        lon_raw = [a / G for a in _deriv(v_ms, t)]
        sources["g_lon"] = "speed derivative"

    if all(_finite(p.g_lat) for p in pts):
        lat_raw = [p.g_lat for p in pts]
        sources["g_lat"] = "data (accelerometer / game)"
    else:
        yaw, ysrc = _yaw_rate(pts, t, k)
        lat_raw = [v * math.radians(w) / G for v, w in zip(v_ms, yaw)]
        sources["g_lat"] = f"speed x angular velocity ({ysrc})"

    g_peak = [max(math.hypot(a, b), p.g_force if _finite(p.g_force) else 0.0)
              for a, b, p in zip(lon_raw, lat_raw, pts)]

    slip = None
    if any(_finite(p.wheel_slip) for p in pts):
        slip = [p.wheel_slip if _finite(p.wheel_slip) else 0.0 for p in pts]
        sources["slip"] = "wheel slip sensor"
    limit = None
    if any(_finite(p.speed_limit_kmh) for p in pts):
        limit = [p.speed_limit_kmh if _finite(p.speed_limit_kmh) else None for p in pts]
        sources["limit"] = "data / limit provider"

    dist = [0.0]
    for i in range(1, n):
        dist.append(dist[-1] + v_ms[i] * (t[i] - t[i - 1]))

    return Trace(
        t=t, latitude=[p.lat for p in pts], longitude=[p.lon for p in pts],
        v_kmh=[v * 3.6 for v in v_ms],
        g_lon=_smooth(lon_raw, k), g_lat=_smooth(lat_raw, k), g_peak=g_peak,
        slip=slip, limit=limit, dist_m=dist, dt=dt, sources=sources)


# ─────────────────────────── common helpers ──────────────────────────

def _segments(tr: Trace, cond: Sequence[bool], min_s: float, merge_s: float) -> List[Tuple[int, int]]:
    """Continuous intervals where cond is true (pauses <= merge_s are merged, short ones discarded)."""
    runs: List[List[int]] = []
    i, n = 0, len(cond)
    while i < n:
        if cond[i]:
            j = i
            while j + 1 < n and cond[j + 1]:
                j += 1
            if runs and tr.t[i] - tr.t[runs[-1][1]] <= merge_s:
                runs[-1][1] = j
            else:
                runs.append([i, j])
            i = j + 1
        else:
            i += 1
    return [(a, b) for a, b in runs if tr.t[b] - tr.t[a] + tr.dt >= min_s]


def _event(cls, tr: Trace, a: int, b: int, ip: int, peak: float, severity: float, **meta) -> Event:
    return cls(t_start=tr.t[a], t_end=tr.t[b] + tr.dt, peak=round(peak, 3),
               speed_kmh=round(tr.v_kmh[ip], 1), lat=tr.latitude[ip], lon=tr.longitude[ip],
               severity=round(severity, 2), meta=meta)


def _sign(x: float) -> int:
    return 1 if x > 0 else -1 if x < 0 else 0


# ───────────────────────────── detectors ──────────────────────────────

def detect_harsh_braking(tr: Trace, cfg: Config) -> List[Event]:
    cond = [g <= -cfg.brake_g and v >= cfg.min_speed_kmh for g, v in zip(tr.g_lon, tr.v_kmh)]
    out = []
    for a, b in _segments(tr, cond, cfg.brake_min_s, cfg.merge_gap_s):
        ip = min(range(a, b + 1), key=lambda i: tr.g_lon[i])
        peak = -tr.g_lon[ip]
        out.append(_event(HarshBraking, tr, a, b, ip, peak, _sev(peak, cfg.brake_g),
                          from_kmh=round(tr.v_kmh[a]), to_kmh=round(tr.v_kmh[b])))
    return out


def detect_harsh_acceleration(tr: Trace, cfg: Config) -> List[Event]:
    cond = [g >= cfg.accel_g and v >= cfg.min_speed_kmh for g, v in zip(tr.g_lon, tr.v_kmh)]
    out = []
    for a, b in _segments(tr, cond, cfg.accel_min_s, cfg.merge_gap_s):
        ip = max(range(a, b + 1), key=lambda i: tr.g_lon[i])
        peak = tr.g_lon[ip]
        out.append(_event(HarshAcceleration, tr, a, b, ip, peak, _sev(peak, cfg.accel_g),
                          from_kmh=round(tr.v_kmh[a]), to_kmh=round(tr.v_kmh[b])))
    return out


def detect_harsh_turning(tr: Trace, cfg: Config) -> List[Event]:
    cond = [abs(g) >= cfg.turn_g and v >= cfg.min_speed_kmh for g, v in zip(tr.g_lat, tr.v_kmh)]
    out = []
    for a, b in _segments(tr, cond, cfg.turn_min_s, cfg.merge_gap_s):
        ip = max(range(a, b + 1), key=lambda i: abs(tr.g_lat[i]))
        peak = abs(tr.g_lat[ip])
        out.append(_event(HarshTurning, tr, a, b, ip, peak, _sev(peak, cfg.turn_g)))
    return out


def detect_loss_of_control(tr: Trace, cfg: Config) -> List[Event]:
    """Heuristic "suspicion of loss of control". Triggers on any of:
      slip             — wheel slip above threshold (only if sensor available, e.g., game);
      grip_limit       — total acceleration sqrt(g_lon^2 + g_lat^2) near grip limit;
      braking_in_turn  — heavy braking simultaneously with heavy lateral acceleration.
    slip and grip_limit are considered only when lateral g >= loc_min_lat_g: harsh acceleration
    or wheelspin in a straight line is not a loss of control.
    Using just GPS + accelerometer, it's impossible to reliably distinguish a skid from a fast turn —
    therefore in the report this is a "suspicion", not a fact."""
    n = len(tr)
    comb = [math.hypot(a, b) for a, b in zip(tr.g_lon, tr.g_lat)]
    reasons: List[List[str]] = []
    for i in range(n):
        r: List[str] = []
        if tr.v_kmh[i] >= cfg.loc_min_speed_kmh:
            sideways = abs(tr.g_lat[i]) >= cfg.loc_min_lat_g
            if sideways and tr.slip is not None and tr.slip[i] >= cfg.loc_slip:
                r.append("slip")
            if sideways and comb[i] >= cfg.loc_combined_g:
                r.append("grip_limit")
            if abs(tr.g_lat[i]) >= cfg.loc_turn_lat_g and tr.g_lon[i] <= -cfg.loc_turn_brake_g:
                r.append("braking_in_turn")
        reasons.append(r)
    cond = [bool(r) for r in reasons]
    out = []
    for a, b in _segments(tr, cond, cfg.loc_min_s, cfg.merge_gap_s):
        ip = max(range(a, b + 1), key=lambda i: comb[i])
        why = sorted({x for i in range(a, b + 1) for x in reasons[i]})
        sev = _clamp01(0.4 + (comb[ip] - cfg.loc_combined_g) / cfg.loc_combined_g)
        out.append(_event(LossOfControl, tr, a, b, ip, comb[ip], sev, reasons=why))
    return out


def detect_weaving(tr: Trace, cfg: Config) -> List[Event]:
    """Weaving: sequence of >= weave_min_peaks lateral peaks of alternating sign,
    each no further than weave_peak_spacing_s from the previous, at speeds above minimum.
    Requires at least ~5 Hz data (accelerometer/gyroscope); weaving is not visible on 1 Hz GPS."""
    n, amp = len(tr), cfg.weave_amp_g

    def active(i: int) -> bool:
        return abs(tr.g_lat[i]) >= amp and tr.v_kmh[i] >= cfg.weave_min_speed_kmh

    runs = []                       # (start, end, sign, peak_index)
    i = 0
    while i < n:
        if not active(i):
            i += 1
            continue
        s, j = _sign(tr.g_lat[i]), i
        while j + 1 < n and active(j + 1) and _sign(tr.g_lat[j + 1]) == s:
            j += 1
        ip = max(range(i, j + 1), key=lambda k: abs(tr.g_lat[k]))
        runs.append((i, j, s, ip))
        i = j + 1

    groups, cur = [], []
    for r in runs:
        if cur and r[2] != cur[-1][2] and tr.t[r[3]] - tr.t[cur[-1][3]] <= cfg.weave_peak_spacing_s:
            cur.append(r)
        else:
            if len(cur) >= cfg.weave_min_peaks:
                groups.append(cur)
            cur = [r]
    if len(cur) >= cfg.weave_min_peaks:
        groups.append(cur)

    out = []
    for grp in groups:
        peaks = [abs(tr.g_lat[r[3]]) for r in grp]
        ip = max((r[3] for r in grp), key=lambda k: abs(tr.g_lat[k]))
        mean_peak = sum(peaks) / len(peaks)
        sev = _clamp01(0.2 + 0.1 * (len(grp) - cfg.weave_min_peaks) + (mean_peak - amp) / 0.4)
        out.append(_event(Weaving, tr, grp[0][0], grp[-1][1], ip, mean_peak, sev, peaks=len(grp)))
    return out


def detect_speeding(tr: Trace, cfg: Config) -> List[Event]:
    if tr.limit is None:
        return []

    def tol(lim: float) -> float:
        return max(cfg.speed_tol_kmh, cfg.speed_tol_rel * lim)

    cond = [lim is not None and v - lim > tol(lim) for v, lim in zip(tr.v_kmh, tr.limit)]
    out = []
    for a, b in _segments(tr, cond, cfg.speed_min_s, cfg.merge_gap_s):
        ip = max((i for i in range(a, b + 1) if tr.limit[i] is not None),
                 key=lambda i: tr.v_kmh[i] - tr.limit[i])
        over = tr.v_kmh[ip] - tr.limit[ip]
        sev = _clamp01((over - tol(tr.limit[ip])) / 30.0)
        out.append(_event(Speeding, tr, a, b, ip, over, sev,
                          limit_kmh=round(tr.limit[ip]), max_kmh=round(tr.v_kmh[ip])))
    return out


def detect_collisions(tr: Trace, cfg: Config) -> List[Event]:
    """g peak above collision_g AND sharp speed drop (to avoid catching potholes and curbs)."""
    cand = [i for i in range(len(tr)) if tr.g_peak[i] >= cfg.collision_g]
    clusters: List[List[int]] = []
    for i in cand:
        if clusters and tr.t[i] - tr.t[clusters[-1][-1]] <= 1.0:
            clusters[-1].append(i)
        else:
            clusters.append([i])
    out = []
    for c in clusters:
        a, b = c[0], c[-1]
        lo = bisect_left(tr.t, tr.t[a] - 1.0)
        hi = bisect_right(tr.t, tr.t[b] + 1.5)
        before = max(tr.v_kmh[lo:a + 1])
        after = min(tr.v_kmh[a:hi])
        drop = before - after
        if drop < cfg.collision_drop_kmh:
            continue
        ip = max(c, key=lambda i: tr.g_peak[i])
        out.append(_event(Collision, tr, a, b, ip, tr.g_peak[ip], _clamp01(tr.g_peak[ip] / 4.0),
                          drop_kmh=round(drop)))
    return out


DETECTORS = (detect_harsh_braking, detect_harsh_acceleration, detect_harsh_turning,
             detect_loss_of_control, detect_weaving, detect_speeding, detect_collisions)


def _suppress(events: List[Event]) -> List[Event]:
    """Impact absorbs loss of control, loss of control absorbs nearby harsh braking/turning/weaving,
    so that a single accident isn't counted as five violations."""
    pad = 1.0
    keep = []
    for e in events:
        absorbed = e.absorbable and any(
            f.priority > e.priority and f.t_start - pad <= e.t_end and e.t_start - pad <= f.t_end
            for f in events)
        if not absorbed:
            keep.append(e)
    return keep


def analyze_full(points: Sequence[TelemetryPoint], cfg: Optional[Config] = None) -> Tuple[List[Event], Trace]:
    cfg = cfg or Config()
    tr = build_trace(points, cfg)
    events: List[Event] = []
    for det in DETECTORS:
        events.extend(det(tr, cfg))
    events = _suppress(events)
    events.sort(key=lambda e: e.t_start)
    return events, tr


def analyze(points: Sequence[TelemetryPoint], cfg: Optional[Config] = None) -> List[Event]:
    return analyze_full(points, cfg)[0]


# ───────────────────────────────── rating ────────────────────────────

@dataclass
class Rating:
    score: float
    grade: str
    distance_km: float
    penalty_per_100km: float
    counts: Dict[str, int]
    note: str

    def as_dict(self) -> dict:
        return asdict(self)


def _grade(score: float) -> str:
    for lim, g in ((85, "A"), (70, "B"), (55, "C"), (40, "D")):
        if score >= lim:
            return g
    return "E"


def score_driver(events: Sequence[Event], distance_km: float, cfg: Optional[Config] = None) -> Rating:
    """Score 0..100. Penalty = sum of weight * (0.5 + severity), normalized per 100 km,
    score = 100 * exp(-penalty / score_scale). Weights and scale are EXPERT-BASED — without data on
    actual accidents they cannot be calibrated; this must be stated explicitly to the jury."""
    cfg = cfg or Config()
    eff_km = max(distance_km, cfg.min_distance_km)
    penalty = sum(e.weight * (0.5 + e.severity) for e in events)
    per100 = penalty / eff_km * 100.0
    score = 100.0 * math.exp(-per100 / cfg.score_scale)
    counts: Dict[str, int] = {}
    for e in events:
        counts[e.kind] = counts.get(e.kind, 0) + 1
    note = ""
    if distance_km < cfg.min_distance_km:
        note = (f"trip shorter than {cfg.min_distance_km:g} km ({distance_km:.1f} km) — "
                f"normalized to {cfg.min_distance_km:g} km, score has low reliability")
    return Rating(score=round(score, 1), grade=_grade(score), distance_km=round(distance_km, 2),
                  penalty_per_100km=round(per100, 1), counts=counts, note=note)