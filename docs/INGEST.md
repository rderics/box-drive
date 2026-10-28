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

## Update 28.10 (v2) — no sign-in screen, car, real weather
**Device account (`device-register`).** The app calls `POST /functions/v1/device-register` with `{device_id}` (random id generated once on the device). The function creates an anonymous, device-bound Supabase Auth user (`d-…@device.invalid`) and returns credentials that stay on the device; the app then signs in with password silently — the user never sees a login. Capped at 300 registrations/hour. Cleaner later: enable Supabase *anonymous sign-ins* and delete this function.

**New body fields**
```json
{ "car": { "name": "VW Golf", "plate": "EB 4821" },
  "location": { "lat": 56.95, "lon": 24.11 },
  "trip": { "…": "…", "car_id": "omitted → created from car{} on first use" } }
```
- `car`: creates a car (`cars.created_by` = user, link in `driver_cars`) and uses it for the trip; later trips send the returned `car_id`.
- `location`: coarse only; the function rounds it to 2 decimals (~1 km), looks up **Open-Meteo** for the trip's time window and **never stores the coordinates**. Overrides client `weather`.
- Response now includes `weather` (`class`, `temp_c`, `precip_mm`, `snow_cm`, `visibility_m`, `wmo_code`, `ice_risk`, `src`), stored in `trips.temp_c … trips.ice_risk` and `weather_src`.

## Insurer view — `car-scores`
`GET /functions/v1/car-scores?source=all|phone|synthetic` with header `x-api-key` (hash stored in `api_keys`, role `insurer|admin`). Returns **one score per car** (score, ± uncertainty, band, reliability, KPIs, effective weights, illustrative premium) and only a driver **count**. Each call writes `score_snapshots` rows (`subject_type='car'`, `params_version` = pinned engine commit). Verified 28.10: no key / wrong key → 401; engine@f44546e weights 26/12/18/10/10/14/dynamic.

**Try it:** `node tools/ingest-demo.js <email> <password>` (a user must exist in Supabase Auth) — signs in, records consent, uploads one demo trip.
Verified 28.10: anon → 401; user without consent → 403; with consent → 200 (4 events + trace stored, `source=phone`, a client-supplied `source:"synthetic"` ignored); the uploaded trip is invisible to anon and the public demo stays at 117 trips. Test user and rows were deleted afterwards.

## Assetto Corsa → database (v3, 28.10)
`python live.py ac --zones "0-1500:60,1500-:90" --upload --car "Mazda MX-5" --plate AC-001` records the drive as before and, when you stop it (Ctrl+C), `upload.py` sends the trip to `ingest-trip` with `source: "simulator"`. First run creates a device account (`.octa_device.json`, git-ignored) and asks consent once. Event mapping: braking→brake, acceleration→accel, harsh turning / loss of control / weaving→corner, collision→bump, speeding→over_lim_s / severe_s (≥ 20 km/h over). No coordinates are sent. `source='simulator'` rows are publicly readable (game data, no personal data; policy `sim_read`) and shown on `live.html` (refreshes every 5 s); the insurer API can filter them with `?source=simulator`. Real phone trips (`source='phone'`) stay private. Only AC (and CSV recorded from the game) may be uploaded; `demo` refuses.

## Accounts and real data (28.10 evening)
- **Sign-up / login:** `login.html` (tabs: log in / create account) and `account.html` (own score, advice, trips). `auth.js` talks to Supabase Auth; sign-up goes through the `account` Edge Function (creates the user, the `drivers` row and the `collect` consent). **Passwords are never stored by us in plain text: Supabase Auth keeps only a bcrypt hash in `auth.users`.** No e-mail verification in the prototype.
- **Collector:** `collect.html` now requires a logged-in account (no anonymous device accounts); trips go to that user's driver row, visible only to them (row-level security).
- **Demo data deleted from the database** (4 demo drivers, 5 cars, 117 synthetic trips, test accounts). The public page still contains the built-in synthetic scenarios from `data.js`, labelled as synthetic. `tools/test-db.js` (database parity) no longer applies. Re-creating the demo rows: `tools/export-seed.js`.
- **Speed limits:** `riga-limits.json` (from `riga_roads.graphml`, OSMnx) + `limits.js` (collector) / `osm_limits.py` (`live.py csv … --osm`): nearest-road match within 30 m, central Riga only; 79 % of segments carry an OSM `maxspeed`, the rest are assumed 50 (living street 20).
- **Driver advice:** `recommend` Edge Function (Gemini if `GEMINI_API_KEY` is set as a function secret, otherwise template text; numbers always from the engine).

## Advice pipeline (28.10 night): engine → Jev → Gemini
1. **Engine** (`engine.js`) computes score, `whatIf` gains (points, euros, cumulative).
2. **Jev** (TypeSafe AI, a decision model, not an LLM) ranks: Cloudflare Pages Function `/api/jev` asks it *which habit to change first* (choice + confidence) and *how risky the pattern is* (score 0–2). A pick with confidence ≥ 0.6 is moved to the top, otherwise the engine's order (biggest gain) stays. Tested: smoothness first at 0.85 confidence on a sample, risk 1.98/2.
3. **Gemini** writes the advice text: `/api/gemini` (model chosen automatically among the key's `*-flash` models, currently gemini-3.8-flash). Text containing digits is rejected and replaced by a template sentence; all numbers come from the engine.
4. `recommend` (Supabase Edge Function) glues them together, caches 24 h, falls back to template text on any failure. **All keys live in the Cloudflare Pages project** (any variable containing JEV/TYPESAFE or GEMINI); nothing is stored in Supabase or the repo.
Status 28.10 night: Jev works; Gemini returns HTTP 402 "prepayment credits are depleted" until the Google AI Studio balance is topped up (template text is shown meanwhile).
**Cars:** the account page lets a logged-in user add cars by hand (plate, make, model, year, fuel, cc, kW, odometer, VIN, registration certificate no., OCTA expiry, claims in 3 years) — stored in `cars` as `self-declared` (no CSDD access); `collect.html` has a "my car" selector.

## Hackathon flow (28.10 night, Ali's spec)
**ASSETTO CORSA → `live.py` analyses → `upload.py` sends ride + events to the database → the website (login first) reads the user's rows and calculates the rating from the LAST rides.**
- Website: first page = login/sign-up (`login.html`); then the app shows only the signed-in user's own data from Supabase (`DB.loadMine`). Empty account → illustrative **sample** rides are inserted (`samples.js`, `source='sample'`, labelled "SAMPLE data" in the app). The site records nothing; it only reads and calculates (rating = last 20 counted rides, `P.lastRides`).
- No AI-agent processing for now (`AI_ON=false` in `app.js`, advice call off in `account.html`); the `recommend` / Jev / Gemini pipeline stays deployed but unused.
- Demo user: **Ali Aslanov** (`tools/create-ali.js`; email `ali.aslanov@boxdrive.demo`, demo password in `upload.py`/the script — made-up details, throw-away account), car **Mercedes-Benz 190E Evo2** (plate AL1990, 2.5 16V, 173 kW, 1991, illustrative odometer/VIN/registration), 41 sample rides.
- `python live.py ac --zones "0-1500:60,1500-:90" --upload` uploads as Ali (override with `--email/--password` or env `OCTA_EMAIL/OCTA_PASSWORD`); the ride is attached to the car with plate AL1990.

## Admin (28.10 night)
- `drivers.admin` smallint (0/1). **Users cannot set it:** insert/update on `drivers` is granted to `authenticated` only for the other columns; verified — a normal user's `PATCH admin=1` returns `permission denied` (42501).
- After login `login.html` asks the `admin` Edge Function (`action: "me"`): admins go to **`admin.html`** (separate site), everyone else to the app. `admin.html` re-checks, and the function checks `drivers.admin = 1` on **every** call (service role inside the function; the browser never holds a service key).
- Admin can: list/search all users (name, e-mail, id), see their rides and cars, delete one ride, all rides, a car, or a whole user (needs typing DZĒST). Cannot delete themselves or another admin. Every destructive action is written to `admin_log`.
- Admin account (made-up details): **Rinalds Derits**, `rinalds.derits@boxdrive.demo`. The password is NOT in the repo (ask Rinalds); it is weak on purpose for the demo, so change it before real use. Make another admin with SQL: `update drivers set admin = 1 where id = '<driver id>'`.
