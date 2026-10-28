"""
Assetto Corsa telemetry logger -> JSON the prototype can import ("Live example" tab).

Reads the game's shared memory (Windows only, game running, a session live), samples at 10 Hz and writes
    {"meta": {...}, "samples": [{"t": s, "v": km/h, "ay": lateral g, "phone": 0|1}, ...]}

Usage:   py -3 ac_logger.py --out calm.json --weather dry --limit 50 --name "Calm drive"
Keys:    P = toggle "phone use" marker (simulates handling the phone)   Q = stop and save   (Ctrl+C also saves)

Status: written from the documented SPageFilePhysics layout; NOT yet tested against a live game
(Assetto Corsa is not installed on the machine this was written on). If values look wrong, check the struct order.
"""
import argparse, ctypes, json, mmap, msvcrt, time
from ctypes import c_float, c_int


class Physics(ctypes.Structure):          # first fields of SPageFilePhysics (pack = 4)
    _pack_ = 4
    _fields_ = [("packetId", c_int), ("gas", c_float), ("brake", c_float), ("fuel", c_float), ("gear", c_int),
                ("rpms", c_int), ("steerAngle", c_float), ("speedKmh", c_float), ("velocity", c_float * 3),
                ("accG", c_float * 3), ("wheelSlip", c_float * 4)]


class GraphicsHead(ctypes.Structure):     # packetId, status  (status: 0 off, 1 replay, 2 live, 3 pause)
    _pack_ = 4
    _fields_ = [("packetId", c_int), ("status", c_int)]


def open_map(name, struct):
    m = mmap.mmap(0, ctypes.sizeof(struct), name)
    return m, struct


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ac_session.json")
    ap.add_argument("--hz", type=float, default=10)
    ap.add_argument("--weather", default="dry", choices=["dry", "wet", "fog", "snow"])
    ap.add_argument("--limit", type=float, default=50, help="speed limit to score against (the game has none)")
    ap.add_argument("--name", default="Assetto Corsa session")
    ap.add_argument("--any-status", action="store_true", help="record even when the game is paused / in menus")
    a = ap.parse_args()

    pm, _ = open_map("Local\\acpmf_physics", Physics)
    gm, _ = open_map("Local\\acpmf_graphics", GraphicsHead)
    print("Connected. Drive! P = phone marker, Q = stop+save.")
    samples, phone, t0, dt = [], 0, time.time(), 1.0 / a.hz
    try:
        while True:
            t = time.time()
            pm.seek(0); ph = Physics.from_buffer_copy(pm.read(ctypes.sizeof(Physics)))
            gm.seek(0); gr = GraphicsHead.from_buffer_copy(gm.read(ctypes.sizeof(GraphicsHead)))
            while msvcrt.kbhit():
                k = msvcrt.getwch().lower()
                if k == "p":
                    phone ^= 1; print("phone", "ON" if phone else "off")
                elif k == "q":
                    raise KeyboardInterrupt
            if gr.status == 2 or a.any_status:
                samples.append({"t": round(t - t0, 2), "v": round(ph.speedKmh, 1), "ay": round(ph.accG[0], 3), "phone": phone})
            time.sleep(max(0, dt - (time.time() - t)))
    except KeyboardInterrupt:
        pass
    meta = {"source": "assetto-corsa", "hz": a.hz, "weather": a.weather, "limit": a.limit, "name": a.name,
            "startISO": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t0)), "synthetic": False}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "samples": samples}, f)
    print(f"Saved {len(samples)} samples to {a.out}")


if __name__ == "__main__":
    main()
