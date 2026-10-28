"""
live.py — console interface displaying driver errors in real time.

  python live.py demo                       synthetic trip (played back at 10x speed)
  python live.py demo --mode phone          same, but data degraded to phone level
  python live.py demo --mode gps            GPS only at 1 Hz
  python live.py demo --calm                smooth trip (no errors expected)
  python live.py demo --save-csv trip.csv   save trip to CSV
  python live.py csv trip.csv               run custom file
  python live.py ac --zones "0-1500:60,1500-:90"   Assetto Corsa in real time (Windows)
  python live.py ac-check                   show raw values from the game (for threshold tuning)

Common flags: --report out.json, --limit KM/H, --zones "0-1500:60,1500-:90", --speed X (0 = instant).
Ctrl+C stops recording and prints summary.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from dataclasses import replace
from typing import Iterable, List, Optional

from driving_events import Config, Event, TelemetryPoint, analyze_full, score_driver
from sources import (AssettoCorsaSource, ConstantLimit, DistanceZones, ac_raw_check, apply_limits,
                     calm_trip, degrade, demo_trip, load_csv, save_csv)


# ───────────────────────────── online monitor ─────────────────────────

class LiveMonitor:
    """Accepts points one by one. Every live_analyze_every_s, runs detectors over a sliding
    window and yields finished events (live_close_delay_s earlier than the current moment)
    one by one."""

    def __init__(self, cfg: Optional[Config] = None, window_s: float = 90.0):
        self.cfg = cfg or Config()
        self.window_s = window_s
        self.buf: List[TelemetryPoint] = []
        self.t0: Optional[float] = None
        self.last_t = 0.0
        self.dist_m = 0.0
        self.events: List[Event] = []
        self.trace = None
        self._reported_end: dict = {}
        self._next = 0.0

    def feed(self, p: TelemetryPoint) -> List[Event]:
        if self.t0 is None:
            self.t0 = p.t
        p = replace(p, t=p.t - self.t0)
        if self.buf:
            self.dist_m += self.buf[-1].speed_kmh / 3.6 * (p.t - self.buf[-1].t)
        self.buf.append(p)
        self.last_t = p.t
        if p.t - self.buf[0].t > self.window_s * 1.5:
            keep = next(i for i, q in enumerate(self.buf) if q.t >= p.t - self.window_s)
            del self.buf[:keep]
        if p.t < self._next or len(self.buf) < 10:
            return []
        self._next = p.t + self.cfg.live_analyze_every_s
        return self._scan(final=False)

    def finish(self) -> List[Event]:
        return self._scan(final=True)

    def _scan(self, final: bool) -> List[Event]:
        try:
            events, self.trace = analyze_full(self.buf, self.cfg)
        except ValueError:
            return []
        horizon = float("inf") if final else self.last_t - self.cfg.live_close_delay_s
        fresh = []
        for e in sorted(events, key=lambda e: e.t_end):
            if e.t_end > horizon or e.t_end <= self._reported_end.get(e.kind, -1.0) + 1e-9:
                continue
            self._reported_end[e.kind] = e.t_end
            fresh.append(e)
        fresh.sort(key=lambda e: e.t_start)
        self.events.extend(fresh)
        return fresh


# ───────────────────────────────── output ──────────────────────────────

if os.name == "nt":
    os.system("")                                   # enables ANSI colors in Windows console
try:
    sys.stdout.reconfigure(encoding="utf-8")        # UTF-8 support for console output
except Exception:
    pass

RESET = "\033[0m"
COLORS = ("\033[33m", "\033[38;5;208m", "\033[91m")     # yellow, orange, red


def _mmss(sec: float) -> str:
    return f"{int(sec // 60):02d}:{sec % 60:04.1f}"


def format_event(e: Event) -> str:
    color = COLORS[0 if e.severity < 0.34 else 1 if e.severity < 0.67 else 2]
    n = max(1, round(e.severity * 5))
    bar = "#" * n + "-" * (5 - n)
    peak = f"{e.peak:.2f} {e.unit}" if e.unit == "g" else f"+{e.peak:.0f} {e.unit}"
    return (f"{color}[{_mmss(e.t_start)}] {e.label:<21} {peak:>10}  {e.duration:4.1f} s  "
            f"at {e.speed_kmh:3.0f} km/h  severity {bar} {e.severity:.2f}  {e.details()}{RESET}")


def print_summary(mon: LiveMonitor, cfg: Config) -> dict:
    km = mon.dist_m / 1000.0
    rating = score_driver(mon.events, km, cfg)
    print("\n" + "=" * 64)
    print(f"SUMMARY  time {_mmss(mon.last_t)}   distance {km:.2f} km   events {len(mon.events)}")
    print("=" * 64)
    labels = {}
    for e in mon.events:
        labels.setdefault((e.kind, e.label), 0)
        labels[(e.kind, e.label)] += 1
    for (_, label), cnt in sorted(labels.items(), key=lambda kv: -kv[1]):
        print(f"  {label:<24} x{cnt}")
    if not labels:
        print("  no violations detected")
    print(f"\nRATING   {rating.score:.1f} / 100   grade {rating.grade}   "
          f"(penalty {rating.penalty_per_100km:.1f} per 100 km)")
    if rating.note:
        print(f"  ! {rating.note}")
    if mon.trace is not None:
        print("\nSignal sources:")
        for k, v in mon.trace.sources.items():
            print(f"  {k:<7} {v}")
    return rating.as_dict()


def run_session(source: Iterable[TelemetryPoint], cfg: Config, speed_factor: float = 0.0,
                report: Optional[str] = None, title: str = "", record: Optional[list] = None, live=None):
    """Returns the finished LiveMonitor (None on a source error). `record` collects every point (for --upload);
    `live` (upload.LiveStream) shows the drive on the website while it happens."""
    mon = LiveMonitor(cfg)
    tty = sys.stdout.isatty()
    print(f"=== {title} ===  (Ctrl+C — stop and show summary)")
    wall0 = time.perf_counter()
    first_t, last_status, counter = None, -1.0, 0
    last_p = None
    try:
        for p in source:
            if first_t is None:
                first_t = p.t
            if speed_factor > 0:
                delay = (p.t - first_t) / speed_factor - (time.perf_counter() - wall0)
                if delay > 0:
                    time.sleep(delay)
            if record is not None:
                record.append(replace(p, t=p.t - first_t))
            fresh = mon.feed(p)
            last_p = p
            if live is not None:
                live.update(p.t - first_t, mon.dist_m / 1000.0, p.speed_kmh, p.speed_limit_kmh, p.g_lat, p.g_lon)
                for e in fresh:
                    live.event(e)
            for e in fresh:
                if tty:
                    sys.stdout.write("\r" + " " * 78 + "\r")
                print(format_event(e), flush=True)
            if tty and p.t - first_t - last_status >= 0.5:
                last_status = p.t - first_t
                lim = f"limit {p.speed_limit_kmh:.0f}" if p.speed_limit_kmh else "limit ?"
                sys.stdout.write(f"\r  t={_mmss(last_status)}  v={p.speed_kmh:5.1f} km/h  {lim:<10} "
                                 f"events: {len(mon.events)}   ")
                sys.stdout.flush()
    except KeyboardInterrupt:
        print("\nStopped.")
    except RuntimeError as exc:
        print(f"\nSource error: {exc}")
        return None
    for e in mon.finish():
        print(format_event(e))
    data = print_summary(mon, cfg)
    if report:
        out = {"duration_s": round(mon.last_t, 1), "distance_km": data["distance_km"],
               "signals": mon.trace.sources if mon.trace else {}, "rating": data,
               "events": [e.to_dict() for e in mon.events]}
        with open(report, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print(f"\nReport saved: {report}")
    return mon


# ────────────────────────────────── CLI ───────────────────────────────

def _limit_provider(args):
    if getattr(args, "zones", None):
        return DistanceZones.parse(args.zones)
    if getattr(args, "osm", False):
        from osm_limits import OsmLimits
        return OsmLimits(getattr(args, "limit", None) or 50.0)
    if getattr(args, "limit", None):
        return ConstantLimit(args.limit)
    return None


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Telemetry -> dangerous driving -> rating")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("--report", help="save report to JSON")
        p.add_argument("--limit", type=float, help="constant speed limit, km/h")
        p.add_argument("--osm", action="store_true", help="speed limits from OpenStreetMap roads of central Riga (needs real lat/lon, e.g. a csv)")
        p.add_argument("--zones", help='path speed limit zones in meters: "0-1500:60,1500-:90"')
        p.add_argument("--upload", action="store_true", help="send the finished trip to the OCTA database (ac and csv only)")
        p.add_argument("--car", default="Mercedes-Benz 190E Evo2", help="car name (with --upload)")
        p.add_argument("--plate", default="AL1990", help="plate of the car; the ride is attached to the user's car with this plate (with --upload)")
        p.add_argument("--email", default=None, help="account to upload as (default: demo user Ali Aslanov; or env OCTA_EMAIL)")
        p.add_argument("--password", default=None, help="password of that account (or env OCTA_PASSWORD)")
        p.add_argument("--weather", choices=("dry", "wet", "snow", "fog"), default="dry", help="in-game weather (with --upload)")

    d = sub.add_parser("demo", help="synthetic trip")
    common(d)
    d.add_argument("--mode", choices=("rich", "phone", "gps"), default="rich")
    d.add_argument("--calm", action="store_true", help="smooth trip without violations")
    d.add_argument("--seed", type=int, default=7)
    d.add_argument("--speed", type=float, default=10.0, help="playback speed, 0 = instant")
    d.add_argument("--save-csv", help="save trip to CSV")

    c = sub.add_parser("csv", help="run CSV file")
    common(c)
    c.add_argument("path")
    c.add_argument("--speed", type=float, default=10.0)

    a = sub.add_parser("ac", help="Assetto Corsa in real time (Windows)")
    common(a)
    a.add_argument("--hz", type=float, default=30.0)
    a.add_argument("--save-csv", help="also record the drive to CSV (a backup you can replay later with: csv <file> --speed 1 --upload)")

    sub.add_parser("ac-check", help="raw values from Assetto Corsa")

    args = ap.parse_args(argv)

    # Configure thresholds: Harsh acceleration starting from 0.5 and accurate control loss settings
    cfg = Config()
    if hasattr(cfg, "harsh_accel_threshold"):
        cfg.harsh_accel_threshold = 0.5
    if hasattr(cfg, "control_loss_threshold"):
        cfg.control_loss_threshold = 0.5  # adjusted for improved accuracy

    if args.cmd == "ac-check":
        try:
            ac_raw_check()
        except Exception as exc:
            print(f"Failed to open Assetto Corsa: {exc}")
        return

    provider = _limit_provider(args)
    if args.cmd == "demo":
        pts = calm_trip(args.seed) if args.calm else demo_trip(args.seed)[0]
        pts = degrade(pts, args.mode)
        if args.save_csv:
            save_csv(pts, args.save_csv)
            print(f"Trip saved: {args.save_csv}")
        source, speed = pts, args.speed
        title = f"demo ({args.mode}{', calm' if args.calm else ''})"
    elif args.cmd == "csv":
        source, speed, title = load_csv(args.path), args.speed, f"CSV {args.path}"
    else:
        source, speed, title = AssettoCorsaSource(args.hz), 0.0, "Assetto Corsa"

    if provider is not None:
        source = apply_limits(source, provider, override=True)
    if args.upload and args.cmd == "demo":
        print("--upload is for real Assetto Corsa trips only (ac, or a csv recorded from the game); demo data is synthetic.")
        return
    save_to = getattr(args, "save_csv", None) if args.cmd == "ac" else None
    rec: Optional[list] = [] if (args.upload or save_to) else None
    started = datetime.now(timezone.utc)
    live = None
    if args.upload:
        import upload as up
        live = up.LiveStream(args.email, args.password, plate=args.plate)    # the website shows the drive while it happens
        if not live.ok:
            live = None
    mon = run_session(source, cfg, speed_factor=speed, report=args.report, title=title, record=rec, live=live)
    if save_to and rec:
        save_csv(rec, save_to)
        print(f"Drive recorded: {save_to}  (replay: python live.py csv {save_to} --speed 1 --upload)")
    if args.upload and mon is not None:
        if mon.last_t < 20 or mon.dist_m < 100:
            print("\nTrip too short to upload (need at least 20 s and 100 m).")
            if live:
                live.finish(None)
            return
        payload = up.build_payload(rec, mon.events, mon.dist_m, mon.last_t, car=args.car, plate=args.plate,
                                   limit_kmh=args.limit or 50.0, weather=args.weather, started=started)
        trip_id = up.upload(payload, email=args.email, password=args.password)
        if live:
            live.finish(trip_id)
    elif live:
        live.finish(None)


if __name__ == "__main__":
    main()