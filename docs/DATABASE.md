# Database (Supabase)

Project **box-drive** · region **eu-central-1 (Frankfurt, EU)** · Postgres 17 · API `https://qjakepgeqioqrmsufaty.supabase.co`.
Schema: `supabase/migrations/20261028000000_init_driver_score_schema.sql` (already applied). Keys: dashboard → Project Settings → API. The **publishable (anon) key is public by design** — safety comes from row level security; the **service-role key must never be committed or shipped to a browser**.

## Model
| Table | What |
|---|---|
| `drivers` | the person (`user_id` → `auth.users` for real users; demo rows have `is_demo = true`) |
| `cars` | the insured car (plate, **claims history per car** — OCTA is per car) |
| `driver_cars` | who drives which car (many-to-many) → car score = all trips on the car |
| `trips` | one row per trip: summary counters (brake/accel/corner, over-speed seconds, phone, parking, surge, contact…), mode + driver confidence, weather, `counted`, `source` (`phone` · `synthetic` · `assetto-corsa`) |
| `trip_events` | the key points shown on the timeline/map (`brake · accel · corner · phone · surge · bump · lot`) |
| `trip_traces` | optional compact speed/lateral-g trace for the schematic route (no GPS stored); **short retention in production** |
| `consents` | per purpose (`collect`, `share_with_insurer`, `share_in_car_score`), with timestamps |
| `score_snapshots` | versioned scores (`params_version`) for driver and car — **service role only** (insurer API / scoring job) |

## Access rules (row level security)
- **Anyone (anon):** read-only, **synthetic demo rows only** (`is_demo` / `source = 'synthetic'`). No writes.
- **Signed-in user:** full access to their own driver profile, trips, events, traces and consents; read access to the cars they drive.
- **Insurer / scoring:** only through server-side code with the service role (car level only — never individual drivers).
- Verified from outside with the publishable key: demo reads work, inserts are rejected (401), updates change nothing, `score_snapshots` returns nothing.

## Seeded demo data
5 cars, 4 drivers, 6 driver↔car links, 117 trips, 1,034 events, 117 traces — the same synthetic data as `data.js` (`tools/export-seed.js` rebuilds the payloads).

## Next
1. ~~App reads demo data from the database~~ ✅ done: `db.js` loads it with the public key after the first render from `data.js` (offline fallback); `node tools/test-db.js` checks the database copy scores identically to `data.js`.
2. Ingest endpoint (Edge Function) for real trips from the collector / phone, with auth.
3. Scoring job writing `score_snapshots`; insurer API returning **car** scores only.
4. Retention job for `trip_traces`; consent checks before car-score sharing.

Notes: GDPR — EU region, minimised data, consent records; a DPIA is still required before any real use. Supabase MCP cannot delete Edge Functions: the temporary `seed-demo` function is replaced by a stub (410) and should be deleted in the dashboard.
