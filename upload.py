"""
upload.py — sends a finished Assetto Corsa trip (events from driving_events.py) to the OCTA database (Supabase).

Used by live.py:   python live.py ac --zones "0-1500:60,1500-:90" --upload

Pipeline: ASSETTO CORSA -> live.py analyses the data -> this file sends the RIDE + EVENT HISTORY to the database -> the web site (login first) reads it
and calculates the rating from the last rides.

Who it uploads as: the demo user ALI ASLANOV (illustrative, made-up details) with his car Mercedes-Benz 190E Evo2. Override with
  --email / --password  (or env OCTA_EMAIL / OCTA_PASSWORD).  If the demo user does not exist yet it is created through the public sign-up function.
(For the demo only: the demo password sits in this file; the real password is stored by Supabase Auth as a bcrypt hash. Do not reuse it anywhere.)

What is sent: trip totals (km, seconds, counts of harsh braking / acceleration / cornering, seconds over the limit), the key events, and a 1 Hz speed +
lateral-g trace. NO coordinates are sent (the game's are fake anyway). Rows are stored with source = 'simulator'.

Mapping from driving_events.py -> the engine's trip fields
  harsh_braking      -> brake        harsh_acceleration -> accel
  harsh_turning      -> corner       loss_of_control    -> corner (data.kind = "loss")
  weaving            -> corner (data.kind = "weave")     collision -> bump
  speeding           -> over_lim_s / over_safe_s (seconds), severe_s (seconds >= 20 km/h over the limit)

Only the standard library is used.
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

DEMO_NAME = "Ali Aslanov"
DEMO_EMAIL = "ali.aslanov@boxdrive.demo"
DEMO_PASSWORD = "1234554321"                                  # demo account only
DEMO_CAR = "Mercedes-Benz 190E Evo2"
DEMO_PLATE = "AL1990"

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


def _login(email: str, password: str):
    """Returns (access_token, user_id). Creates the account through the public sign-up function when it does not exist."""
    def grant():
        return _http("POST", f"{URL}/auth/v1/token?grant_type=password", {"email": email, "password": password})
    s, r = grant()
    if s != 200 and r.get("error_code") == "invalid_credentials":
        s2, r2 = _http("POST", f"{URL}/functions/v1/account", {"email": email, "password": password, "name": DEMO_NAME, "consent": True},
                       {"Authorization": "Bearer " + KEY})
        if s2 == 200 and r2.get("ok"):
            print(f"Created account {email} ({DEMO_NAME}).")
            s, r = grant()
        elif r2.get("error") == "email_taken":
            raise RuntimeError("wrong password for an existing account")
    if s != 200 or "access_token" not in r:
        raise RuntimeError(f"sign-in failed ({s}): {r.get('msg') or r.get('error') or r}")
    return r["access_token"], r["user"]["id"]


def build_payload(points: Sequence, events: Sequence, dist_m: float, duration_s: float, *, car: str, plate: str,
                  limit_kmh: float = 50.0, weather: str = "dry", started: Optional[datetime] = None,
                  name: str = DEMO_NAME) -> dict:
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


def upload(payload: dict, email: Optional[str] = None, password: Optional[str] = None) -> bool:
    email = email or os.environ.get("OCTA_EMAIL") or DEMO_EMAIL
    password = password or os.environ.get("OCTA_PASSWORD") or DEMO_PASSWORD
    try:
        token, uid = _login(email, password)
    except RuntimeError as exc:
        print("Upload failed:", exc)
        return False
    H = {"Authorization": "Bearer " + token}

    # attach the ride to the user's existing car with the same plate (the Mercedes created by tools/create-ali.js), else the first car, else let the server create it
    plate = (payload.get("car") or {}).get("plate")
    s, cars = _http("GET", f"{URL}/rest/v1/cars?select=id,plate,name&created_by=eq.{uid}&order=created_at.asc", None, H)
    if s == 200 and isinstance(cars, list) and cars:
        car = next((c for c in cars if plate and c.get("plate") == plate), cars[0] if not plate else None)
        if car:
            payload["trip"]["car_id"] = car["id"]
            payload.pop("car", None)

    s, r = _http("POST", f"{URL}/functions/v1/ingest-trip", payload, H)
    if s == 200 and r.get("ok"):
        print(f"\nUploaded as {email}: trip {r['trip_id']} · car {r.get('car_id')} · {r['events']} events · source {r.get('source')}")
        print("See it on the site: log in at https://rderics.id.lv/octa/ (the rating follows the last rides)")
        return True
    print(f"Upload failed ({s}): {r}", file=sys.stderr)
    return False
