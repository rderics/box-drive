# How the score is built — data, events, KPIs, formulas

Status 28.10. Everything below is what `engine.js` really does (constants in `P`). Anything marked **assumption** is our design choice, not a published standard. Weights and their evidence: `WEIGHTS.md`.

## 1. The pipeline (same code in the browser, the tests, the Edge Function)
```
samples (1–10 Hz: speed, lateral g, limit, phone flag, time, weather)
  → analyzeTrip()  : per trip, count EVENTS and SECONDS over the limit      (engine.js)
  → scoreDriver()  : add trips up → KPIs (rates per 100 km / per hour) → 0–100 score per factor
  → weighted sum   : total = Σ weight × factor score / 100,   ± uncertainty
  → advice()       : the one factor that costs the most weighted points → one sentence
  → premiumPreview : illustrative discount (0 % at 50 pts … −25 % at 100, never a surcharge)
```
Two scores use the same engine: **driver score** = the person's trips in any car; **car score** = all trips in that car by all drivers + that car's claims + km-weighted driver experience. The insurer sees car scores only (`car-scores`).

## 2. Factor by factor

| Factor | Raw signal | Where the data comes from | Event / KPI | Score (0–100) | Weight |
|---|---|---|---|---|---|
| **Speeding for the conditions** | speed (km/h), posted limit, weather class | **Speed:** phone GPS (collector) or game (Assetto Corsa). **Limit:** today the user's default (`--limit/--zones` for the game, "default limit" in the collector); real app: OSM / road data (**not built**). **Weather:** Open-Meteo, looked up for trip time and place | seconds with speed > limit × safe factor + 3 km/h tolerance. Safe factor: dry 1.0, wet 0.9, fog 0.75, snow 0.7 (**assumption**). KPI `overSafePct` = those seconds ÷ driving seconds | `100 × (1 − overSafePct / 12)`, floored at 0 (0 % over → 100, ≥ 12 % over → 0) | 29 |
| **Smoothness** | speed change over ~0.5 s, lateral g | speed derivative (GPS/game); lateral g from phone gyro/accelerometer or game | harsh **brake** (> 0.30 g dry, 0.24 wet/fog, 0.14 snow; +0.05 in dense traffic), harsh **accel** (> 0.28 g), harsh **corner** (> 0.35 g lateral), each counted once per episode, ignoring very low speeds. KPI `harshPer100` = (brake+accel+corner) ÷ km × 100 | `100 × (1 − harshPer100 / 5)` (average driver ≈ 1.0 → 80) | 20 |
| **Claims history** | claims in the last 3 years of that driver/car | **LTAB / insurer** — in the demo this is a field we fill; no real feed yet | `claims3y` | `100 × (1 − claims / 3)` | 16 |
| **Phone use** | bursts of phone handling while moving | phone motion sensors (rotation not about the vertical axis > 1 rad/s while > 5 km/h) — **experimental**, not available for the game | events per hour of driving; handling at a standstill is not counted | `100 × (1 − phonePerHour / 2)` (average ≈ 0.6 → 70) | 14 |
| **Night & fatigue** | time of day, continuous driving | trip start/end times + sunrise/sunset for the place (NOAA formula) | `nightShare` = km driven in darkness ÷ km; `fatigue` = number of runs > 120 min with no 15-min break | `100 − 150 × nightShare − 20 × fatigue`, clamped 0–100 | 11 |
| **Experience** | hours behind the wheel, variety (city / highway / night / bad weather ≥ 10 h each) | self-declared at first use, then our own measured hours | effective hours = hours × (0.6 + 0.4 × variety share) | `100 × (1 − exp(−effHours / 200))` | 10 + 25 × exp(−effHours / 150) ≈ **35 new → 19 at 150 h → 13 at 300 h → 10 at 800 h** |

Parking was removed from the score on 28.10 (decision: not needed). Old rows keep their parking counters; nothing reads them.

### Which trips count
A trip is **scored** only if mode = car and driver confidence ≥ 0.6 (a trip with a confirmed "I was the passenger" is stored, not scored). Rail/bus/bike/walk are stored for context only.

## 3. Combining the factors
1. Experience weight `wExp = 10 + 25·exp(−effHours/150)`; the other five are multiplied by `(100 − wExp) / 90`, so the weights always sum to 100.
2. `total = Σ weight_i × score_i / 100`.
3. **Uncertainty** `± = 3 + 14·exp(−km/500) + 6·(1 − experience score/100)` — little measured driving or experience → a wide band. Reliability for the insurer: ± ≤ 7 high, ≤ 12 medium, else low.
4. **Band:** ≥ 80 low risk, 60–80 medium, < 60 high.
5. **Advice:** for speeding, phone, smoothness, night/fatigue the points lost = `weight × (100 − score)/100`; the largest one is the advice. Colour: green good / yellow middle / red bad.

### Worked example (typical-average driver, 300 h, claims 0)
Over-speed share 6 % → speeding 50 · harsh 1.0/100 km → smooth 80 · phone 0.6/h → 70 · night 10 %, no fatigue → 85 · claims 0 → 100 · experience → 77.7.
Weights: speeding 27.9 · phone 13.5 · smooth 19.2 · claims 15.4 · night 10.6 · experience 13.4. **Total = 73.6 (medium)**; the illustrative premium is 264 € instead of 300 € (−12 %).

## 4. What is real, what is assumed (honest table)
| Piece | State |
|---|---|
| Speed, lateral g, phone handling from a phone browser | **built**, foreground only, tested in simulation + with sensors; no field data yet |
| Assetto Corsa trips (`live.py --upload`) | **built**; the game's physics, **not** road driving; stored as `simulator` |
| Real weather per trip | **built** (Open-Meteo = model data, not a road sensor) |
| Speed limits | **assumption**: a default limit or zones; no map matching yet (**the weak point for speeding**) |
| Claims history | **demo value**; needs LTAB / insurer data |
| Average drivers (`AVG`), zero-points (12 %, 5 / 100 km, 2 / h, 3 claims), safe factors, g thresholds | **assumptions**; to be replaced by population percentiles (see §5) |
| Weights | evidence-ranked priors (CSDD); to be fitted on claims in a pilot (`WEIGHTS.md`) |
| 117 demo trips in the public demo | **synthetic** (generated from driver scenarios) |

## 5. Using more real data (new sources)
**a) Vehicle Energy / telemetry dataset (Kaggle, `trips.csv`, your teammate's `brauksanas_parskats.html`).** I could not open the Kaggle page (login wall), so the column list and licence are **not verified**. The report shows the file has timestamps, speed and a posted limit per row, grouped by vehicle/trip (vehicle 560: 1,001.7 km, 382 trip groups). It looks like the Ann Arbor Vehicle Energy Dataset (VED/eVED, 383 cars, 2017–18) — **US urban driving, not Latvia**. What it is good for:
- **Calibrate the "average driver" and the zero-points from a real population** instead of guessing: compute, per vehicle, over-speed share, harsh events per 100 km and night share; set `AVG` = median and the score's zero-point ≈ 90–95th percentile. This is exactly the workshop rule "KPI relative to the average".
- **A real-data demo for the jury** (clearly labelled "US dataset, not Latvian"): run the same engine over a few real vehicles.
- **Limits the report itself states:** posted limit is known for only **24.1 %** of the analysed time (so over-speed is measured on a small slice: 1.3 % over +10 km/h); 744 braking and 1,307 acceleration "candidate intervals" at 3.5 m/s² are **not** events (several intervals = one manoeuvre); 55 % of intervals fit the 2 s gap rule; no phone-handling signal, no weather. Candidate counts must be merged and thresholds matched to ours (0.30 g ≈ 2.9 m/s²) before comparing.
- To do it: give me the `trips.csv` path (or the team's `extract_telematics.py`); I compute the percentiles and update `P.AVG` / `P.zero` with the source cited.

**b) "Vieglo automobiļu vadītāju veikto apdzīšanas manevru izpēte" (APKC 2025, 213 valid overtakes, drone + PC-Crash, outside towns on 90 km/h roads, dry).** Findings that support our choices:
- **Speed:** only **1.4 %** of overtaking cars were at/below the limit; mean speed during overtakes **114 km/h** on 90 km/h roads; 36 % of the cars being overtaken were already over the limit → supports speeding as the biggest weight and links risky overtaking to speeding.
- **Following distance:** 90 % kept < 1.8 s before overtaking, 56 % < 1.27 s, 23–25 % < 1 s; people follow at ~1 s for kilometres. **Not measurable by a phone** (needs a front camera/radar) → we do not score it; the advice screen can still teach the 2-second rule.
- **Overtaking in forbidden places:** 20 % (42 of 213 overtakes were prohibited by markings/signs); more line crossing at dusk/night → supports counting darkness in the night factor.
- **Not usable as coefficients:** a 1–10 *expert* risk rating of each overtake, 213 cases, no crash outcome, dry daytime-weighted; and the authors state it is not evidence for insurance disputes. Candidate future KPI (not built): **overtake events** = a lateral S-shaped move with speed above limit + 10 km/h; GPS accuracy makes this weak without lane-level data.

## 6. How a number gets onto the live page (data path)
`collect.html` (phone) or `live.py --upload` (Assetto Corsa) → summary + events + 1 Hz trace → `ingest-trip` (checks consent, ranges, adds real weather) → Postgres (`trips`, `trip_events`, `trip_traces`, source = phone | simulator | synthetic) → `live.html` and `car-scores` run the same `engine.js` and show/return the score.
