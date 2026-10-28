type: knowledge
status: open

# OCTA Tech Challenge — backend and the real app (Rinalds asked 28.10 ~16:30)

Builds on [[OCTA Tech Challenge — LTAB OCTA lietotnes dizains un pilnās prezentācijas (28.10.2026)]] (two scores, OBD2, per-car OCTA). Everything here is a design proposal unless marked built.

## 1. Principle: process on the phone, upload summaries
Meets the brief ("minimal setup", "low resources", GDPR/EU): the phone detects trips, computes events and a trip summary; the server gets **summaries + events**, not a GPS history. Same scoring code on phone and server (`engine.js` is plain JS → TypeScript package, versioned parameters).

## 2. On the phone (the hard 80 %)
| Job | iOS | Android | Notes |
|---|---|---|---|
| Detect trip start/stop | Core Motion activity = automotive + significant-location-change | Activity Recognition transition API + geofence | sensors/GPS wake only during a trip → battery |
| Speed, route | GPS 1 Hz (Core Location, "Always" permission) | Fused location | needed for speed limit + weather join |
| Hard brake/accel/corner | accelerometer + gyro 10–50 Hz, gravity removed, aligned to the car axis using GPS bearing | same | thresholds per road condition (assumption, tunable) |
| Phone use while driving | weak: pick-up/handling pattern, calls (CallKit); cannot see other apps | screen-on/unlock events (UsageStats permission) | accuracy differs by OS — be honest in the pitch |
| Which car | car Bluetooth / CarPlay / Android Auto pairing, **OBD2 BLE adapter**, or one-time "which car?" | same | per-car score needs this |
| Driver vs passenger | confidence from pairing + routine + entry signature; one-tap "that was me" | same | ≈ 87–93 % best case; low confidence → not scored |
**Build vs buy:** background sensing is months of native work; a telematics SDK (DriveQuant, Cambridge Mobile Telematics, Sentiance…) would give trip detection + events out of the box. Realistic product path = SDK or native modules; tonight = a web collector (below).

## 3. Backend (EU region)
`Phone → Ingest API → queue → Enrichment → Scoring → DB → App API / Insurer API`
- **Ingest:** authenticated (reuse the existing app login), idempotent trip upload, device + vehicle registration, consent records.
- **Enrichment** (server, transient trace deleted after processing): map-matching + **speed limit / road type** (OSM via Valhalla/OSRM), **weather/ice-risk** (Open-Meteo; LVC road-weather if fields allow), sunrise/sunset for night exposure.
- **Scoring:** deterministic, versioned; recompute driver score and car score (all trips on the car + the car's claims history from LTAB); Bayesian shrinkage for new drivers; later **fit weights on real claims** (GLM/GBM) with the insurer — until then expert weights.
- **Store:** Postgres (users, vehicles, driver↔vehicle, trips, events, scores per version, consents, audit log). No raw GPS retention by default.
- **Insurer API:** **car level only** (score ± reliability, band, #drivers) — no driver identity; discount decision stays with the insurer. LTAB/insurer feed claims + policy data in.
- **Business/fleet (later):** tenant → vehicles → drivers; fleet manager sees driver scores per car, insurer sees car score only (row-level security).
- **Privacy/legal (needs a lawyer, flagged not solved):** DPIA required; consent per purpose; GDPR Art. 22 (pricing based solely on automated profiling needs safeguards/human review); retention limits; delete/export; EU processing.

## 4. What can be real by the 20:30 freeze (≈4 h)
Not the native app. Proposed **end-to-end thin slice**:
1. **Backend MVP** on Cloudflare (Workers + D1/R2, EU jurisdiction): `POST /api/trips`, `GET /api/scores` — the scoring engine runs unchanged in a Worker.
2. **Web collector (PWA)**: records a **real drive** with the phone's GPS + motion sensors (screen on, Wake Lock, motion permission via tap), computes events with `engine.js`, uploads a summary; the app UI shows the real trip with a real GPS map.
3. **Assetto Corsa logger → API** (PC) as the second real-data source.
4. Prototype reads from the API; synthetic personas stay as fallback.
Limits to state: foreground only (a web page cannot track in the background), iOS Safari motion permission quirks, phone-use detection not available in a browser, map-matching/weather join minimal.

— Kenji, 2026-10-28
