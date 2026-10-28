# Parking and low-speed manoeuvres — how we could track them

Status: **design proposal** (not in the prototype yet). Asked by the team 28.10.

## Why it matters
- Parking is where many small claims happen. BTA (Latvian insurer, 12 Mar 2026): CASCO claims for cars damaged in parking lots at shops, offices and residential buildings **rose 22 % in 2025**; average claim **€934**, largest in 3 years **€18,392** (leaving a space and hitting another car). The most common causes: **reversing and leaving a space**, plus inattention (handbrake not set, pedal mix-up — two cases ~€9,000 each). Winter: fewer but costlier claims (ice).
- Older/foreign figures are only indicative: ~14–20 % of claims in US-focused sources, 16–18 % in Australian insurers' figures, a 2001 UK fleet survey found two-thirds of fleet accidents at parking speed (under 9 mph); drivers also under-report (80 % say they would leave details, ~50 % do).
- **OCTA nuance:** OCTA pays for damage **you cause to others**. The BTA numbers are CASCO (own damage), but the commonest cause is exactly the OCTA case — *you* reversing into someone. So the thing worth scoring is **your own low-speed behaviour**, not being hit while parked.

## Two different problems
**A. Your own parking behaviour (trackable with the phone while driving).**
**B. Your parked car being hit by someone else (not trackable by the phone alone** — the phone leaves with the owner; a car-mounted sensor would be needed, e.g. a windscreen tag or dash-cam; out of scope since we dropped hardware). What we *can* do: a one-tap **"parking evidence"** — time + coarse place kept on the device, an optional 3-second photo of the car when parking, a prompt to compare when returning, and a pre-filled claim flow if damage is found. We do **not** claim to detect hit-and-runs.

## A. What we measure
| Signal | How (phone) | Why it is a risk signal |
|---|---|---|
| **Parking phase** | trip start/end with speed < ~15 km/h; refine with map (OSM `amenity=parking`, `parking_aisle`); both **leaving a space** (start of trip) and **parking** (end) | BTA: reversing and leaving spaces are the main causes |
| **Manoeuvre complexity** | stop-go cycles and direction changes (GPS course flips ≈180° at ~0 speed), time from entering the lot to stopping | many attempts / long manoeuvres = more exposure to contact |
| **Speed in the lot** | share of lot time above a lot norm (≈15 km/h) | too fast for the space |
| **Sudden surge at low speed** | acceleration spike (> ~0.3 g) from < 5 km/h | pedal mix-up / handbrake cases are the costly outliers |
| **Possible contact** | accelerometer (≥ 50 Hz, only during the low-speed phase to save battery) spike at < 10 km/h followed by a stop; shape/duration filter vs speed bumps, kerbs, potholes | prompts "Did you touch something?" → photo + pre-filled statement (CSNg) — also fights under-reporting |
| **Context** | ice/wet (weather), darkness, underground lot (GPS lost → dead-reckon), rush hour at shop lots | winter claims are fewer but costlier |

## How it enters the score
- New KPI **"Parking & low-speed manoeuvres"**, proposed weight **≈10 %** (others scale down, like the experience weight).
- Scored on **leading indicators** (manoeuvre complexity, lot speed, surge events), **not** on actual contacts — real contacts are far too rare per driver to score weekly; a *confirmed* contact is a flagged event and feeds claims history after the insurer confirms it.
- Passes the three tests: linked to risk (BTA causes), comparable (per parking / per 100 parkings), changeable (mirrors, slower reversing, choosing an easier spot).
- Belongs to the **driver score**; the **car score** inherits it through the car's drivers (car size/visibility is unknown to us — do not guess).
- Advice examples: "You needed 5 direction changes to park — choose a space you can enter in one go", "You left the space at 14 km/h — slow down to walking pace".

## In the app
Trip timeline gets a **P** key point at the start ("leaving the space") and the end ("parking"): duration, manoeuvres, lot speed, and — if detected — **"Possible contact → add photo / start statement"**. A KPI row "Parking" with its base. A optional "parking evidence" card (time, place on the device only, photo).

## Honest limits
- Reverse gear is not visible without the car's data → reversing is **inferred** (course vs heading); moderate reliability.
- GPS is poor at walking speed and underground; a bump detector on a phone has **false positives** (kerbs, dropped phone) and misses very light touches. Needs a confirmation step and tuning on real data.
- Continuous high-rate accelerometer sampling costs battery → only in the low-speed phase.
- Privacy: no parking-location history is uploaded; "where I parked" stays on the device; any hotspot map would be aggregated and anonymised.
- All thresholds are our assumptions until tested on real drives.
