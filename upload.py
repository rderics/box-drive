"""
upload.py — sends a finished Assetto Corsa trip (events from driving_events.py) to the OCTA database.

Used by live.py:   python live.py ac --zones "0-1500:60,1500-:90" --upload --car "Mazda MX-5" --plate AC-001

What is sent (the same trip summary the web collector sends to the `ingest-trip` Edge Function):
  trip totals (km, seconds, counts of harsh braking / acceleration / cornering, seconds over the limit),
  the key events, and a 1 Hz speed + lateral-g trace. NO coordinates are sent (the game's are fake anyway).
Rows are stored with source = 'simulator', so they are never mixed up with real phone driving and show up on
https://rderics.id.lv/octa/live.html within seconds.

Mapping from driving_events.py -> the engine's trip fields
  harsh_braking      -> brake        harsh_acceleration -> accel
  harsh_turning      -> corner       loss_of_control    -> corner (data.kind = "loss")
  weaving            -> corner (data.kind = "weave")     collision -> bump
  speeding           -> over_lim_s / over_safe_s (seconds), severe_s (seconds >= 20 km/h over the limit)

Only the standard library is used. No sign-in: a device account is created once and kept in .octa_device.json.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence

URL = "https://qjakepgeqioqrmsufaty.supabase.co"
KEY = "sb_publishable_NzsKaKSt1Nc-cuuJADWySQ_kLekErYS"       # public (publishable) key, same as in db.js
CRED_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".octa_device.json")

EVENT_MAP = {"harsh_braking": "brake", "harsh_acceleration": "accel", "harsh_turning": "corner",
             "loss_of_control": "corner", "weaving": "corner", "collision": "bump"}
DATA_KIND = {"loss_of_control": "loss", "weaving": "weave"}


def _http(method: str, url: str, body=None, headers: Optional[dict] = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json", "apikey": KEY, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode("utf-8")
            return r.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(txt)
        except ValueError:
            return e.code, {"error": txt[:300]}


def _load_cred() -> dict:
    try:
        with open(CRED_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save_cred(c: dict) -> None:
    with open(CRED_FILE, "w", encoding="utf-8") as f:
        json.dump(c, f)


def _login() -> str:
    c = _load_cred()
    if not c.get("email"):
        s, r = _http("POST", f"{URL}/functions/v1/device-register", {}, {"Authorization": "Bearer " + KEY})
        if s != 200 or "email" not in r:
            raise RuntimeError(f"device registration failed ({s}): {r}")
        c = {"email": r["email"], "password": r["password"]}
        _save_cred(c)
    s, r = _http("POST", f"{URL}/auth/v1/token?grant_type=password", {"email": c["email"], "password": c["password"]})
    if s != 200 or "access_token" not in r:
        os.remove(CRED_FILE)
        raise RuntimeError(f"sign-in failed ({s}): {r}. Credentials were reset, run again.")
    return r["access_token"]


def _ask_consent() -> bool:
    c = _load_cred()
    if c.get("consent"):
        return True
    print("\nUpload consent: this trip summary (speeds, g-forces, event counts, no location) will be stored in the OCTA team database\n"
          "and shown on the public live page as a SIMULATOR trip.")
    ok = input("Allow? [y/N] ").strip().lower() == "y"
    if ok:
        c["consent"] = True
        _save_cred(c)
    return ok


def build_payload(points: Sequence, events: Sequence, dist_m: float, duration_s: float, *, car: str, plate: str,
                  limit_kmh: float = 50.0, weather: str = "dry", started: Optional[datetime] = None,
                  name: str = "Assetto Corsa driver") -> dict:
    """points: every TelemetryPoint of the trip with t relative to the start; events: driving_events.Event list."""
    started = started or (datetime.now(timezone.utc) - timedelta(seconds=duration_s))
    n = max(1, int(duration_s) + 1)

    # 1 Hz resampling: last sample at or before each whole second
    v, ay, lim = [0.0] * n, [0.0] * n, [limit_kmh] * n
    j = 0
    for k in range(n):
        while j + 1 < len(points) and points[j + 1].t <= k:
            j += 1
        p = points[j] if points else None
        if p is None:
            continue
        v[k] = round(float(p.speed_kmh or 0.0), 1)
        ay[k] = int(round(100.0 * float(p.g_lat or 0.0)))
        lim[k] = float(p.speed_limit_kmh) if p.speed_limit_kmh else limit_kmh
    runs: List[list] = []
    for L in lim:
        if runs and runs[-1][0] == L:
            runs[-1][1] += 1
        else:
            runs.append([L, 1])

    count = {"brake": 0, "accel": 0, "corner": 0, "bump": 0}
    over = severe = 0.0
    evs = []
    for e in events:
        if e.kind == "speeding":
            over += e.duration
            if float(e.meta.get("max_kmh", 0)) - float(e.meta.get("limit_kmh", 0)) >= 20:
                severe += e.duration
            continue
        typ = EVENT_MAP.get(e.kind)
        if not typ:
            continue
        count[typ] += 1
        d = {"kind": DATA_KIND[e.kind]} if e.kind in DATA_KIND else None
        evs.append({"i": min(n - 1, int(e.t_start)), "type": typ, "g": round(min(abs(e.peak), 19.9), 2) if e.unit == "g" else None,
                    **({"data": d} if d else {})})

    max_g = max([abs(float(p.g_lat or 0.0)) for p in points] + [0.0])
    km = dist_m / 1000.0
    return {
        "source": "simulator", "driver_name": name, "exp_hours": 0,
        "car": {"name": car, "plate": plate or None},
        "trip": {
            "id": "ac-" + started.strftime("%Y%m%d%H%M%S"), "start_at": started.isoformat(), "mode": "car", "role_conf": 1, "confirmed": True,
            "weather": weather, "traffic": "free", "road_type": "mixed", "counted": True,
            "duration_s": round(duration_s, 1), "km": round(km, 3), "dark_km": 0, "max_g": round(min(max_g, 19.9), 2),
            "brake": count["brake"], "accel": count["accel"], "corner": count["corner"], "bump": count["bump"],
            "over_lim_s": round(over, 1), "over_safe_s": round(over, 1), "severe_s": round(severe, 1),
            "phone_ev": 0, "phone_s": 0, "parkings": 0, "lot_cycles": 0, "lot_s": 0, "lot_over_s": 0, "lot_max": 0, "surge": 0,
        },
        "events": evs,
        "trace": {"step": 1, "v": v, "ay100": ay, "lim_runs": runs, "phone_ranges": []},
    }


def upload(payload: dict) -> bool:
    if not _ask_consent():
        print("Not uploaded (no consent).")
        return False
    try:
        token = _login()
    except RuntimeError as exc:
        print("Upload failed:", exc)
        return False
    H = {"Authorization": "Bearer " + token}
    s, r = _http("POST", f"{URL}/functions/v1/ingest-trip", payload, H)
    if s == 403 and r.get("driver_id"):                       # first time: record the 'collect' consent, then retry
        _http("POST", f"{URL}/rest/v1/consents", {"driver_id": r["driver_id"], "purpose": "collect", "granted": True},
              {**H, "Prefer": "return=minimal"})
        s, r = _http("POST", f"{URL}/functions/v1/ingest-trip", payload, H)
    if s == 200 and r.get("ok"):
        print(f"\nUploaded: trip {r['trip_id']} · car {r.get('car_id')} · {r['events']} events · source {r.get('source')}")
        print("See it live: https://rderics.id.lv/octa/live.html")
        return True
    print(f"Upload failed ({s}): {r}", file=sys.stderr)
    return False
