
"""
sources.py — where telemetry and speed limits come from.

  TripBuilder / demo_trip / calm_trip   synthetic trip with predefined events
  degrade(points, "phone" | "gps")      degrades ideal data to phone-level quality
  load_csv / save_csv                   save and load a trip
  AssettoCorsaSource                    real-time data from Assetto Corsa (Windows only)
  ConstantLimit / DistanceZones         speed limits when they are missing from the data
"""
from __future__ import annotations

import csv
import math
import random
import time
from contextlib import contextmanager
from dataclasses import fields, replace
from typing import Iterable, Iterator, List, Optional, Tuple

from driving_events import G, TelemetryPoint

# ─────────────────────────── speed limits ──────────────────────────


class SpeedLimitProvider:
    def limit_at(self, dist_m: float, p: TelemetryPoint) -> Optional[float]:
        raise NotImplementedError


class ConstantLimit(SpeedLimitProvider):
    def __init__(self, kmh: float):
        self.kmh = kmh

    def limit_at(self, dist_m, p):
        return self.kmh


class DistanceZones(SpeedLimitProvider):
    """Zones by distance traveled in meters: [(from, to or None, limit in km/h), ...].
    For the game demo: "first 1500 m — 60, then — 90"."""

    def __init__(self, zones: List[Tuple[float, Optional[float], float]]):
        self.zones = zones

    @classmethod
    def parse(cls, text: str) -> "DistanceZones":
        zones = []
        for part in text.split(","):
            rng, kmh = part.strip().split(":")
            a, b = rng.split("-")
            zones.append((float(a or 0), float(b) if b.strip() else None, float(kmh)))
        return cls(zones)

    def limit_at(self, dist_m, p):
        for a, b, kmh in self.zones:
            if dist_m >= a and (b is None or dist_m < b):
                return kmh
        return None


def apply_limits(points: Iterable[TelemetryPoint], provider: SpeedLimitProvider,
                 override: bool = False) -> Iterator[TelemetryPoint]:
    """Assigns speed_limit_kmh to each point as a stream (also works with live sources)."""
    dist, prev = 0.0, None
    for p in points:
        if prev is not None:
            dist += prev.speed_kmh / 3.6 * (p.t - prev.t)
        prev = p
        if override or p.speed_limit_kmh is None:
            p = replace(p, speed_limit_kmh=provider.limit_at(dist, p))
        yield p


# ──────────────────────── synthetic trip ───────────────────────

class TripBuilder:
    """Simple kinematics: each step is defined by longitudinal acceleration and yaw rate.
    These determine speed, heading, coordinates, g_lon, and g_lat. Sensor noise is added.
    span(kind) records the ground truth — where each event is built into the trip."""

    def __init__(self, hz: int = 10, seed: int = 7, noise: bool = True,
                 lat0: float = 56.9496, lon0: float = 24.1052):
        self.dt = 1.0 / hz
        self.rng = random.Random(seed)
        self.noise = noise
        self.lat0, self.lon0 = lat0, lon0
        self.t = 0.0
        self.v = 0.0                 # m/s
        self.heading = 90.0
        self.x = self.y = 0.0
        self.limit: Optional[float] = None
        self.points: List[TelemetryPoint] = []
        self.truth: List[Tuple[str, float, float]] = []

    def _rg(self, sigma: float) -> float:
        return self.rng.gauss(0.0, sigma) if self.noise else 0.0

    def _emit(self, a: float, yaw: float, slip: float = 0.0) -> None:
        dt = self.dt
        self.v = max(0.0, self.v + a * dt)
        self.heading = (self.heading + yaw * dt) % 360.0
        h = math.radians(self.heading)
        self.x += self.v * math.sin(h) * dt
        self.y += self.v * math.cos(h) * dt
        self.t += dt
        g_lon = a / G
        g_lat = self.v * math.radians(yaw) / G
        self.points.append(TelemetryPoint(
            t=round(self.t, 3),
            lat=self.lat0 + self.y / 111320.0,
            lon=self.lon0 + self.x / (111320.0 * math.cos(math.radians(self.lat0))),
            speed_kmh=max(0.0, self.v * 3.6 + self._rg(0.15)),
            g_force=abs(math.hypot(g_lon, g_lat) + self._rg(0.01)),
            g_lon=g_lon + self._rg(0.015),
            g_lat=g_lat + self._rg(0.015),
            heading=(self.heading + self._rg(0.3)) % 360.0,
            yaw_rate=yaw + self._rg(0.3),
            speed_limit_kmh=self.limit,
            wheel_slip=slip,
        ))

    @contextmanager
    def span(self, kind: str):
        t0 = self.t
        yield
        self.truth.append((kind, t0, self.t))

    def set_limit(self, kmh: Optional[float]) -> None:
        self.limit = kmh

    def cruise(self, seconds: float, yaw: float = 0.0) -> None:
        for _ in range(int(round(seconds / self.dt))):
            self._emit(0.0, yaw)

    def speed_to(self, target_kmh: float, g: float, yaw: float = 0.0) -> None:
        tgt = target_kmh / 3.6
        sign = 1.0 if tgt > self.v else -1.0
        while (tgt - self.v) * sign > 1e-9:
            self._emit(sign * g * G, yaw)

    def turn(self, seconds: float, lat_g: float, sign: int = 1) -> None:
        for _ in range(int(round(seconds / self.dt))):
            self._emit(0.0, sign * math.degrees(lat_g * G / max(self.v, 1.0)))

    def weave(self, seconds: float, amp_g: float, period_s: float) -> None:
        steps = int(round(seconds / self.dt))
        for i in range(steps):
            g = amp_g * math.sin(2 * math.pi * i * self.dt / period_s)
            self._emit(0.0, math.degrees(g * G / max(self.v, 1.0)))

    def skid(self, lat_g: float, brake_g: float, seconds: float = 1.5) -> None:
        """Skid: strong lateral g-force + braking + wheel slip, followed by a sharp correction."""
        for _ in range(int(round(seconds / self.dt))):
            self._emit(-brake_g * G, math.degrees(lat_g * G / max(self.v, 1.0)), slip=6.0)
        for _ in range(int(round(1.0 / self.dt))):
            self._emit(-0.1 * G, -math.degrees(0.5 * lat_g * G / max(self.v, 1.0)), slip=4.0)

    def crash(self, to_kmh: float = 0.0, seconds: float = 0.3) -> None:
        a = -(self.v - to_kmh / 3.6) / seconds
        for _ in range(int(round(seconds / self.dt))):
            self._emit(a, 0.0, slip=8.0)


def demo_trip(seed: int = 7) -> Tuple[List[TelemetryPoint], List[Tuple[str, float, float]]]:
    """A trip containing each predefined event once. Returns (points, ground truth)."""
    b = TripBuilder(seed=seed)
    b.set_limit(50)
    b.speed_to(50, 0.12)                          # smooth start
    b.cruise(12, yaw=2.0)
    with b.span("harsh_braking"):
        b.speed_to(10, 0.45)
    b.speed_to(50, 0.12)
    b.cruise(6)
    with b.span("harsh_turning"):
        b.turn(3.0, 0.45)
    b.cruise(6)
    b.speed_to(10, 0.15)                          # normal braking
    with b.span("harsh_acceleration"):
        b.speed_to(50, 0.38)
    b.cruise(5)
    with b.span("speeding"):                      # 75 with a limit of 50
        b.speed_to(75, 0.12)
        b.cruise(12)
        b.speed_to(50, 0.12)
    b.cruise(5)
    b.set_limit(90)                               # entered the highway
    b.speed_to(80, 0.10)
    b.cruise(10)
    with b.span("weaving"):
        b.weave(9.0, 0.28, 2.4)
    b.cruise(8)
    with b.span("loss_of_control"):
        b.skid(0.75, 0.5)
    b.speed_to(60, 0.10)
    b.cruise(8)
    with b.span("collision"):
        b.crash(0.0, 0.3)
    b.cruise(3)
    return b.points, b.truth


def calm_trip(seed: int = 3) -> List[TelemetryPoint]:
    """A careful trip: no events should be triggered (used to check false alarms)."""
    b = TripBuilder(seed=seed)
    b.set_limit(50)
    b.speed_to(50, 0.10)
    b.cruise(20, yaw=1.5)
    b.speed_to(30, 0.15)
    b.turn(4.0, 0.15)
    b.speed_to(50, 0.12)
    b.cruise(10)
    b.weave(3.0, 0.12, 3.0)                       # one normal lane change
    b.cruise(10)
    b.speed_to(54, 0.05)                          # within the tolerance (+5 km/h)
    b.cruise(15)
    b.set_limit(90)
    b.speed_to(85, 0.08)
    b.cruise(30)
    b.speed_to(20, 0.20)
    b.cruise(5)
    return b.points


def degrade(points: List[TelemetryPoint], mode: str = "rich", seed: int = 11) -> List[TelemetryPoint]:
    """rich  — unchanged (game-level quality: clean data, wheel slip available);
    phone — noisy IMU + 1 Hz GPS (speed, coordinates, and heading are held between seconds), no wheel slip;
    gps   — GPS only at 1 Hz: speed, coordinates, and heading, without accelerometer or gyroscope data."""
    if mode == "rich":
        return list(points)
    rng = random.Random(seed)
    step = max(1, int(round(1.0 / (points[1].t - points[0].t))))     # samples per second
    kx = 111320.0 * math.cos(math.radians(points[0].lat))
    out: List[TelemetryPoint] = []
    hold = None
    for i, p in enumerate(points):
        if i % step == 0:
            hold = (p.lat, p.lon, p.speed_kmh, p.heading)
        if mode == "phone":
            lat, lon, spd, hd = hold
            out.append(TelemetryPoint(
                t=p.t, lat=lat, lon=lon, speed_kmh=spd, heading=hd,
                g_force=abs(math.hypot(p.g_lon, p.g_lat) + rng.gauss(0, 0.04)),
                g_lon=p.g_lon + rng.gauss(0, 0.04), g_lat=p.g_lat + rng.gauss(0, 0.04),
                yaw_rate=p.yaw_rate + rng.gauss(0, 1.0), speed_limit_kmh=p.speed_limit_kmh))
        elif mode == "gps":
            if i % step:
                continue
            out.append(TelemetryPoint(
                t=p.t, lat=p.lat + rng.gauss(0, 1.5 / 111320.0), lon=p.lon + rng.gauss(0, 1.5 / kx),
                speed_kmh=max(0.0, p.speed_kmh + rng.gauss(0, 0.4)),
                heading=(p.heading + rng.gauss(0, 1.5)) % 360.0, speed_limit_kmh=p.speed_limit_kmh))
        else:
            raise ValueError(f"Unknown mode: {mode}")
    return out


# ───────────────────────────────── CSV ────────────────────────────────

CSV_FIELDS = [f.name for f in fields(TelemetryPoint)]
_ALIASES = {
    "t": ("t", "time", "timestamp", "ts"),
    "lat": ("lat", "latitude"),
    "lon": ("lon", "lng", "longitude"),
    "speed_kmh": ("speed_kmh", "speed"),
    "g_force": ("g_force", "gforce"),
    "g_lon": ("g_lon", "g_long"),
    "g_lat": ("g_lat",),
    "heading": ("heading", "bearing", "course"),
    "yaw_rate": ("yaw_rate", "gyro_z"),
    "speed_limit_kmh": ("speed_limit_kmh", "speed_limit", "limit"),
    "wheel_slip": ("wheel_slip", "slip"),
}


def save_csv(points: Iterable[TelemetryPoint], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CSV_FIELDS)
        for p in points:
            w.writerow(["" if getattr(p, c) is None else getattr(p, c) for c in CSV_FIELDS])


def load_csv(path: str) -> List[TelemetryPoint]:
    """Columns: t, lat, lon, speed_kmh are required; the others are optional (see _ALIASES).
    Time is in seconds (or Unix epoch milliseconds, which are converted), and is reset to start at 0."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rd = csv.DictReader(f)
        header = {h.strip().lower(): h for h in (rd.fieldnames or [])}
        col = {}
        for name, aliases in _ALIASES.items():
            for a in aliases:
                if a in header:
                    col[name] = header[a]
                    break
        missing = [c for c in ("t", "lat", "lon", "speed_kmh") if c not in col]
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(missing)}; available: {list(header)}")

        def num(row, name):
            raw = row.get(col[name]) if name in col else None
            if raw is None or str(raw).strip() == "":
                return None
            return float(raw)

        pts = []
        for row in rd:
            vals = {c: num(row, c) for c in CSV_FIELDS}
            if vals["t"] is None or vals["speed_kmh"] is None or vals["lat"] is None or vals["lon"] is None:
                continue
            pts.append(TelemetryPoint(**vals))
    if not pts:
        raise ValueError("CSV contains no usable rows")
    pts.sort(key=lambda p: p.t)
    t0 = pts[0].t
    scale = 1000.0 if t0 > 1e11 else 1.0
    return [replace(p, t=(p.t - t0) / scale) for p in pts]


# ─────────────────────────── Assetto Corsa ────────────────────────────

# Beginning of SPageFilePhysics (shared memory "acpmf_physics"):
# packetId, gas, brake, fuel, gear, rpms, steerAngle, speedKmh, velocity[3], accG[3], wheelSlip[4]
_AC_FMT = "<ifffiiff3f3f4f"
_AC_BASE_LAT, _AC_BASE_LON = 56.9496, 24.1052      # approximate origin coordinates


def _ac_open():
    import mmap
    import os
    if os.name != "nt":
        raise OSError("Assetto Corsa shared memory is available only on Windows")
    return mmap.mmap(-1, 128, tagname="acpmf_physics", access=mmap.ACCESS_READ)


class AssettoCorsaSource:
    """Reads Assetto Corsa physics data from shared memory (Windows only; the game must be running).

    g_lat — from accG[0] (the sign does not matter for detectors: they use the magnitude or sign changes),
    g_lon — NOT taken from the game; calculated from speed (avoids dependence on accG axis signs),
    g_force — magnitude sqrt(accG_x^2 + accG_z^2) for collision detection,
    wheel_slip — maximum across the four wheels (tune the loc_slip threshold using ac-check),
    coordinates — integrated from the velocity vector (the game has no GPS, so coordinates are approximate).
    """

    def __init__(self, hz: float = 30.0):
        self.period = 1.0 / hz

    def __iter__(self) -> Iterator[TelemetryPoint]:
        import struct
        try:
            shm = _ac_open()
        except Exception as exc:        # Not Windows or the game is not running
            raise RuntimeError(
                "Could not open Assetto Corsa shared memory. Windows and a running game are required "
                f"(in a session, not the menu). Error: {exc}") from exc
        last_id, t0, last_t = None, None, None
        x = z = 0.0
        kx = 111320.0 * math.cos(math.radians(_AC_BASE_LAT))
        while True:
            (pid, _gas, _brk, _fuel, _gear, _rpm, _steer, speed, vx, _vy, vz,
             gx, _gy, gz, s0, s1, s2, s3) = struct.unpack_from(_AC_FMT, shm, 0)
            now = time.perf_counter()
            if pid == last_id:
                time.sleep(self.period / 2)
                continue
            last_id = pid
            if t0 is None:
                t0 = last_t = now
            x += vx * (now - last_t)
            z += vz * (now - last_t)
            last_t = now
            yield TelemetryPoint(
                t=now - t0, lat=_AC_BASE_LAT + z / 111320.0, lon=_AC_BASE_LON + x / kx,
                speed_kmh=speed, g_lat=gx, g_force=math.hypot(gx, gz),
                wheel_slip=max(s0, s1, s2, s3))
            time.sleep(self.period)


def ac_raw_check(seconds: float = 20.0, hz: float = 5.0) -> None:
    """Prints raw values from the game to verify the connection and tune thresholds."""
    import struct
    shm = _ac_open()
    end = time.perf_counter() + seconds
    peak_slip = peak_gx = peak_gz = 0.0
    while time.perf_counter() < end:
        (pid, gas, brk, _f, gear, _r, steer, speed, _vx, _vy, _vz,
         gx, _gy, gz, s0, s1, s2, s3) = struct.unpack_from(_AC_FMT, shm, 0)
        slip = max(s0, s1, s2, s3)
        peak_slip, peak_gx, peak_gz = max(peak_slip, slip), max(peak_gx, abs(gx)), max(peak_gz, abs(gz))
        print(f"pkt={pid:>8}  v={speed:6.1f} km/h  gas={gas:.2f} brake={brk:.2f}  "
              f"accG[x]={gx:+.2f} accG[z]={gz:+.2f}  slip(max)={slip:5.2f}   "
              f"peaks: |x|={peak_gx:.2f} |z|={peak_gz:.2f} slip={peak_slip:.2f}")
        time.sleep(1.0 / hz)