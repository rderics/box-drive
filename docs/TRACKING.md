# What we track, and why

Status: matches the prototype (`engine.js`, parameters in `P`). Thresholds and weights are **our assumptions** (no public standard found) and are tunable. Demo data is synthetic.

## The idea in one paragraph
A driver installs the app and does nothing. In the background the phone notices trips, measures how the person drives, and turns it into **two scores**: a **driver score** (follows the person across every car, used for advice and progress) and a **car score** (all drivers of that car + the car's claims history — OCTA is insured **per car**, so this is the one that sets the price). Every number must pass three tests (from the Balcia workshop): **1) linked to accident risk, 2) comparable (per 100 km / per hour / vs the average driver), 3) the driver can change it** — otherwise it is context, not a score input.

## 1. What goes into the score

| KPI (weight) | What we measure | Why it matters | Base used | Driver can change it? |
|---|---|---|---|---|
| **Speeding for the conditions (22 %)** | Share of driving time above the **condition-adjusted safe speed** (posted limit × 0.9 wet · 0.75 fog · 0.7 snow/ice, +3 km/h tolerance) | Speed is the most consistent risk factor in telematics scoring; a speed is only "high" relative to the road and the weather (60 km/h on a highway is calm, past a school it is risk) | % of driving time; average driver ≈ 6 % | Yes |
| **Phone use while driving (18 %)** | Phone handled while the car is moving (> 5 km/h; a red light does not count) | Distraction is a major crash cause; insurers treat it as a high-signal behaviour | events per driving hour; average ≈ 0.6 /h | Yes |
| **Smoothness (17 %)** | Hard braking, hard acceleration, hard cornering — thresholds per road condition (brake 0.30 g dry · 0.24 wet/fog · 0.14 snow; accel 0.28 g; corner 0.35 g) | Harsh events show late reaction and tailgating; **rate, not count** (9 hard brakes on 50 km is 20× the rate of 9 on 1,000 km) | events per 100 km; average ≈ 1.0 | Yes |
| **Claims history (14 %)** | Accidents in the last 3 years — **per car** for the car score (from LTAB/insurer data), personal for the driver score | The strongest known predictor; it is also the only input a new driver does not have | count; 3+ = 0 points | No (the past) → context, shown but not advice |
| **Parking & low-speed manoeuvres (10 %)** | Inside parking areas only: direction changes per parking, share of lot time above ~15 km/h, sudden surges from standstill (pedal mix-up); a *possible contact* (low-speed accelerometer spike) triggers "Did you touch something?" → photo + statement | The commonest cause of parking claims is reversing/leaving a space (BTA 2026: parking CASCO claims +22 %, avg €934); real contacts are too rare to score, so only leading indicators count | manoeuvres per parking; typical ≈ 2 | Yes |
| **Night exposure & fatigue (9 %)** | Share of km driven at deep night (23:00–05:00 local) fully, ordinary darkness at ¼ weight (winter evenings are not a habit to punish); plus drives > 2 h without a 15-min break | Night and fatigue raise crash risk; but a night-shift commute is normal, so the weight is low and ordinary darkness counts little | % of km; average ≈ 10 % | Partly |
| **Experience (10–35 %, dynamic)** | **Hours behind the wheel** as confirmed driver, weighted by variety (city · highway · night · bad weather) — not years on the licence | Risk is highest in the first months / first ~500–1,000 miles and then falls slowly; "years licensed" cannot tell a daily commuter from an occasional driver. It is a **prior, not a prize**: a veteran with bad habits still scores low. **Weight is dynamic:** ≈35 % for a brand-new driver (little else to go on), ≈19 % at 150 h, ≈11 % at 800 h; the other weights scale down to keep 100 % | cumulative hours, saturating curve | Over time |

Every score is shown with a **± band and a reliability label**: little measured driving or little experience → wider band ("low data").

## 2. Context we add before scoring (not scored by itself)
- **Weather / road condition** (dry · wet · fog · snow-ice): changes the safe speed and the "harsh" thresholds, so the same braking is judged against the grip available. We *infer* ice risk from weather data; we do not measure road friction.
- **Speed limit and road type:** needed to judge speed at all.
- **Time of day:** fatigue window, rush-hour traffic (harsh braking in stop-and-go is normal), darkness vs clock. Hour alone is never a penalty (shift workers).
- **Traffic density:** raises the harsh-brake threshold slightly.

## 3. Which trips count
Only trips where the person was **driving a car**: mode (car / train / bus / bike / walk) and role (driver / passenger) are classified with a confidence. Below the threshold (0.6) a trip is stored but **not scored**, and the driver can fix it with one tap ("That was me"). Car identity comes from car Bluetooth / CarPlay / Android Auto pairing or a one-time "which car?" prompt.

## 4. Two scores, two audiences
- **Driver score** — all of a person's counted trips, all cars. For the **driver**: why the score is what it is, one advice, weekly trend, experience in hours.
- **Car score** — all counted trips on the car by all its drivers + the car's claims history (+ km-weighted driver experience). For the **insurer**: risk profile and price (illustrative discount: 0 % at 50 points → −25 % at 100, never a surcharge). The insurer sees **cars only, never individual drivers**; each driver's contribution is visible to the other drivers only in aggregate / with consent.
- Later (business mode): a company sees each worker's driver score per car; the insurer still sees only the car score.

## 5. What we deliberately do NOT track
Raw GPS history or home address (the trip map is dead-reckoned from speed and lateral g; nothing is stored as a location trail), average speed (meaningless without context), engine RPM / fuel (not a crash predictor), phone content / contacts / other apps, and trips where we do not know who drove. **Why:** privacy and GDPR (data minimisation, on-device processing, only summaries to an EU server, consent per purpose), low battery use, and fairness — we only score what we can explain and the driver can act on.

## 6. How it is shown to the driver
A passive app: nothing to tap. The driver opens it when curious and sees (1) the **OCTA price effect**, (2) the score and **why**, (3) **how to improve** with the € effect, (4) each trip as a **route map with numbered key points** (hard braking, acceleration, cornering, phone use, speeding) and a timeline.

## 7. Honest limits (say these in the pitch)
- Thresholds, weights, safe-speed factors and the discount model are assumptions; real weights need real claims data (fit with the insurer).
- Phone-use detection is weaker on iOS than on Android; driver-vs-passenger detection is probabilistic (best methods ≈ 87–93 %), hence the confidence rule and one-tap fix.
- Weather in the demo is simulated; the real build joins weather and speed-limit data (Open-Meteo, OSM; LVC road-weather if the fields allow).
- Pricing based solely on automated profiling needs GDPR Art. 22 safeguards and a DPIA; the discount decision stays with the insurer.
- The demo shows synthetic drivers and cars; the Assetto Corsa session is a stand-in for real telemetry until a real log is recorded.
