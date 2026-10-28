# Ingest API — `ingest-trip` (Supabase Edge Function)

`POST https://qjakepgeqioqrmsufaty.supabase.co/functions/v1/ingest-trip` — a **signed-in user** uploads one trip summary computed on the phone (same shape `engine.js` `analyzeTrip` produces).

**Headers:** `apikey: <publishable key>`, `Authorization: Bearer <user access token>` (Supabase Auth). The public key alone is rejected (401).

**Body**
```json
{
  "driver_name": "optional, first upload only", "exp_hours": 25, "lic_years": 1,
  "trip": { "id": "client-trip-id", "start_at": "2026-10-28T08:10:00Z", "car_id": "golf (must be one of the driver's cars, else ignored)",
            "mode": "car|train|bus|bike|walk", "mode_conf": 0.97, "role_conf": 0.95, "confirmed": true,
            "weather": "dry|wet|snow|fog", "traffic": "free|dense", "road_type": "mixed", "counted": true,
            "duration_s": 1240, "km": 12.8, "dark_km": 0, "max_g": 0.4,
            "brake": 1, "accel": 0, "corner": 1, "over_lim_s": 30, "over_safe_s": 30, "severe_s": 0, "phone_ev": 1, "phone_s": 8,
            "parkings": 2, "lot_cycles": 5, "lot_s": 90, "lot_over_s": 4, "lot_max": 14, "surge": 0, "bump": 1 },
  "events": [ { "i": 17, "type": "brake|accel|corner|phone|surge|bump|lot", "g": 0.42, "data": { "kind": "park", "dur": 40 } } ],
  "trace":  { "step": 1, "v": [0, 12, 30], "ay100": [0, 3, -5], "lim_runs": [[50, 3]], "phone_ranges": [] }
}
```
Samples are **speed and lateral g only** — no GPS coordinates are accepted or stored.

**Rules (enforced in the function and by row level security)**
- 401 without a user JWT. The first call creates the user's driver profile (`u-<id>`).
- **403 until a `collect` consent is on record** — the client inserts `{driver_id, purpose:'collect', granted:true}` into `consents` (allowed for the owner).
- `source` is **always `phone`** (a client cannot create public/synthetic rows); values are range-checked; max 500 events, 20,000 samples, 3 MB, 500 trips/day.
- Idempotent per `trip.id` (re-upload replaces events and trace). Rows are visible only to their owner (and, later, as **car-level** scores to the insurer through server-side code).

**Try it:** `node tools/ingest-demo.js <email> <password>` (a user must exist in Supabase Auth) — signs in, records consent, uploads one demo trip.
Verified 28.10: anon → 401; user without consent → 403; with consent → 200 (4 events + trace stored, `source=phone`, a client-supplied `source:"synthetic"` ignored); the uploaded trip is invisible to anon and the public demo stays at 117 trips. Test user and rows were deleted afterwards.
