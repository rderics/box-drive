# Handover — Box-Driver (OCTA Tech Challenge)

Written 2026-10-28 (evening) by Kenji (Claude) so another agent or person can continue. Read this first, then `docs/INGEST.md` (data pipeline), `docs/SCORING.md` (formulas), `docs/WEIGHTS.md` (evidence), `docs/PRESENTING.md` (stage script).

## 1. What this is
Hackathon project for the **OCTA Tech Challenge** (Balcia / LTAB, "Build the Driver Risk Profile"), team **box-drive**. An add-on prototype to the LTAB OCTA app: a **driver score** and a **car score** from driving behaviour, a visual for the driver, advice, and a cars-only insurer view. Owner: **Rinalds Dērics** (talks Latvian/English, wants direct answers, no fluff). Teammate **Ali Aslanov** owns the Python game side (`live.py`, `driving_events.py`, `sources.py`).

**Final flow (Ali's spec):** Assetto Corsa → `live.py` analyses → `upload.py` sends ride + events to Supabase → website (login first) reads the signed-in user's rows and calculates the rating from the **last 20 rides** → shows it. The website records nothing. The AI advice (Jev + Gemini) is built but **switched off in the main UI** (`AI_ON=false`), except the presentation panel.

## 2. Where things live
| Thing | Where |
|---|---|
| Code (team repo) | https://github.com/rderics/box-drive → local `C:\Users\RiRi\Desktop\Rinalds\Work\octa-driver-score` |
| Site | Cloudflare Pages project **`octa`** (Git-connected, auto-deploys `main`): https://octa-xun.pages.dev ; also proxied at https://rderics.id.lv/octa (personal-site repo `rderics/rinalds-derics`, `functions/octa/[[path]].js`) |
| Database + functions | Supabase project **`box-drive`**, id `qjakepgeqioqrmsufaty` (EU Frankfurt) |
| Cloudflare account id | `bf6148047067adb8a858c0f5097f3255` (wrangler OAuth login exists on this PC) |
| Notes | Obsidian vault `C:\Users\RiRi\Desktop\Rinalds\Work\Obsidian Vault` — `Knowledge/OCTA Tech Challenge — …` notes + `System/STATE.md` rows dated 28.10. Vault rule: every verbal decision of Rinalds goes into `System/STATE.md` first; commit/push the vault freely |
| Pitch page (interactive, front-end only) | https://claude.ai/artifact/RdY9PbE5GRyHKPTAVT4Tct (private) |
| Deck (6 slides, dark/orange design — **keep that design**, Rinalds said so) | https://claude.ai/artifact/6uTPn34Gcahp54GYkS1PAf (private) |

## 3. Architecture in one screen
```
Assetto Corsa ─ live.py (driving_events.py, sources.py) ─ upload.py ──► Supabase
                    │ LiveStream (0.5 s)  ──► table live_state      (left panel on the projector)
                    └ at the end: ingest-trip ──► trips / trip_events / trip_traces (source='simulator')
Browser (index.html, phone UI: app.js phone.js db.js engine.js samples.js present.js)
  login.html → Supabase Auth (email+password, bcrypt hash) → DB.loadMine() reads ONLY the user's rows (RLS)
  engine.js scoreDriver(): last 20 counted rides → KPIs → factor scores → weighted total ± uncertainty
  empty account → samples.js inserts illustrative rides (source='sample')
  admin.html (admin=1 only) → Edge Function `admin`
  present.js (≥1180 px, app view): left = live game feed, right = AI coach (engine → Jev → Gemini)
```
**Scoring** (`engine.js`, `P`): weights speeding 29 · smooth 20 · claims 16 · phone 14 · night/fatigue 11 · experience 10→35 (dynamic). Softened zero-points: over-safe-speed 20 %, harsh 10/100 km, phone 4/h, claims 5. Bands ≥75 low / ≥55 medium. Illustrative price: 0 % at 40 pts → −25 % at 90, base 300 €. **Parking was removed** (Rinalds, 28.10). Rating = last 20 rides (`P.lastRides`).

## 4. Supabase
**Tables:** drivers (`admin` 0/1, column grants stop users setting it), cars (self-declared details, `data_source`), driver_cars, trips (`source` = `phone | simulator | sample | synthetic`), trip_events, trip_traces, consents, score_snapshots, api_keys, device_registrations (old), ai_cache, ai_calls, signup_log, admin_log, live_state. RLS everywhere; users see only their own rows; `simulator` trips are publicly readable (game data); `sample` rows are owner-only.

**Edge Functions (deployed via the Supabase MCP; sources in `supabase/functions/` where noted):**
| Function | Purpose |
|---|---|
| `account` | sign-up (creates auth user, driver row, consent) — public, rate-limited 30/h |
| `ingest-trip` (v3) | receives a ride from `upload.py`/collector; `source` = phone or simulator |
| `admin` | `me / list / rides / delete_ride / delete_rides / delete_car / delete_user`; checks `drivers.admin = 1` on every call; logs to `admin_log` |
| `recommend` (v5, `supabase/functions/recommend/index.ts`) | engine → Jev (`/api/jev`) → Gemini (`/api/gemini`); 24 h cache; template fallback; engine pinned to commit `e3f1ee9` via jsDelivr |
| `car-scores` | insurer API (`x-api-key`), engine pinned to `512cdff` (**older engine — does not know "last 20 rides"; repin if the insurer view matters**) |
| `device-register` | old anonymous accounts — unused |
| `seed-demo` | empty stub — **delete in the Supabase dashboard** |
Migrations are in `supabase/migrations/` (the later ones — admin flag, live_state, cars fields, sample source — were applied through the MCP; add their SQL files if you want the folder complete).

## 5. Cloudflare Pages Functions (keys live ONLY here)
`functions/api/jev.js` (Jev ranking; returns probabilities + ms) and `functions/api/gemini.js` (advice text; picks an available `*-flash` model). Env var names are discovered by pattern (any name containing JEV/TYPESAFE or GEMINI). **New env vars only apply after a new deploy** (push any commit). Last state: **Jev works; Gemini key valid but Google says quota/credits exhausted (402/429)** → template text until Rinalds tops up AI Studio.

## 6. Accounts (no passwords in the repo — ask Rinalds)
- **Rinalds** (real): his email, car Volvo V70 HA3787, 2 real phone rides + **41 sample rides copied in** (labelled as samples in the status line).
- **Ali Aslanov** demo: `ali.aslanov@boxdrive.demo`, Mercedes-Benz 190E Evo2 `AL1990`, 41 sample rides. Default credentials for `live.py` are in `upload.py` (demo account; override with `--email/--password` or `OCTA_EMAIL/OCTA_PASSWORD`).
- **Admin** "Rinalds Derits": `rinalds.derits@boxdrive.demo`, `admin=1`. Weak demo password — **change it**.
- A second real signup "Ali Aslanov" (`u-db77ceab`, 14 samples, car deleted) exists; harmless.
- Create/refresh the demo user: `node tools/create-ali.js`.

## 7. Run / test
```
node tools/test.js                      # engine tests (weights, softer scores, whatIf, OSM limits)
python -m http.server 8123              # local site → http://localhost:8123/
python live.py ac --zones "0-1500:60,1500-:90" --upload       # game → live view + upload (Windows, game on track)
python live.py ac --save-csv backup.csv                       # record a backup drive; replay: csv backup.csv --speed 1 --upload
python tools/build_limits.py                                   # OSM speed limits from riga_roads.graphml → riga-limits.json
https://octa-xun.pages.dev/status       # connection diagnostics for any PC
```

## 8. Open items / known issues
1. **Ali's real Assetto Corsa drive never reached the DB** (server logs show no requests from his machine). Most likely no `--upload`, no `git pull`, or the drive was <20 s/100 m or the game was in a menu. Ask for the last 15 console lines. Never tested with the real game on this PC.
2. **Gemini quota** exhausted (see §5).
3. `car-scores` pinned to an old engine (§4). `tools/test-db.js` is obsolete (demo rows were deleted).
4. `riga_roads.csv` in the repo is actually a copy of `phone.js` (wrong upload); the real OSM data is `riga_roads.graphml`. Speed limits: collector uses OSM limits for central Riga only; the game uses `--zones/--limit`.
5. Rinalds' teammate said the site "doesn't work on their PC" — not reproduced (clean sign-up works). `/status` page was built to diagnose; waiting for its output. Cloudflare's zone cache (4 h) can serve old assets: hard refresh or use `octa-xun.pages.dev`; every change bumps `?v=` stamps (currently `20261028x`).
6. Gemini/Jev AI is hidden in the main UI by request ("no AI processing for now"); it shows only in the presentation panel (right side). Flip `AI_ON` in `app.js` to bring the in-phone advice card back.
7. Pitch artifact's AI screen and drive simulator are **front-end replays** (no server). Say so when presenting.

## 9. Gotchas that cost time
- **Windows/CRLF:** repo files are CRLF; patch scripts must read with `newline=''`, normalise, write back (see how earlier patches were done). Non-ASCII in Bash heredocs gets mangled — write a script file with the Write tool and run it with `python -X utf8`.
- **Supabase Edge Functions** can't be deployed from the shell here; use the Supabase MCP `deploy_edge_function` (paste full source; escape non-ASCII as `\u…`). A truncated paste silently deploys a broken function — re-read the deployed code if in doubt.
- **jsDelivr pin:** `recommend`/`car-scores` import `engine.js` from a commit SHA; after changing the engine, push, then redeploy the function with the new SHA.
- **Cloudflare Pages:** unknown paths return the SPA fallback with 200 — verify new pages by content, not status. `/x.html` redirects to `/x`.
- **Permission classifier** blocks writing passwords into repo files; don't work around it.
- DB columns: users have **column-level** privileges on `drivers`; adding a driver column the app must write needs a `grant insert/update (…)`.
- Standing rules from the vault: never put the Supabase service-role key or any API key in the repo/browser; answer in the user's language; be honest about synthetic vs real data; no real personal data or LTAB logo on public pages; commit footer `Co-Authored-By: Claude … <noreply@anthropic.com>`.

## 10. Suggested next steps
1. Get Ali's console output; fix whatever blocks his upload; do one real drive end to end (see `docs/PRESENTING.md`).
2. Top up Gemini credits (or accept template text) and re-test `/api/gemini`.
3. Change the admin password; delete the `seed-demo` stub; repin `car-scores`.
4. Decide whether logged-in users should still see the built-in demo scenarios anywhere (currently only their own DB data in the app).
5. Optional: add the new pitch points (young-driver incentive, game simulation, cost) as extra slides in the existing deck design.
