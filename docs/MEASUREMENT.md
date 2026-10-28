# How we measure — weather, driver, car, phone use, parking, fatigue

Status 28.10: **built** = in the repo and tested; **design** = proposal, not built.

## Weather and road condition — built (real data, with limits)
- Source: **Open-Meteo** (temperature, precipitation, snowfall, visibility, weather code) for the trip's place and time. Server-side in `ingest-trip` (also `weather.js` in the collector). Only a **coarse location (2 decimals ≈ 1 km)** is used for the lookup and **never stored**.
- Classes: `dry · wet · snow · fog`. Snow also covers freezing precipitation and **ice risk** (≤ 1 °C with precipitation / freezing codes). Safe-speed factors and harsh-brake thresholds depend on the class.
- Limits: this is **model/reanalysis data, not a road-surface sensor**; local black ice is invisible to it (CSDD 2024 notes local, short-lived slippery stretches). Next: Latvian State Roads (LVC) road-weather stations (`data.gov.lv`, fields to be checked) for road-surface temperature, and an in-trip signal (wheel-slip is not available to a phone).

## No sign-in screen — built
A device-bound **anonymous account** is created silently (`device-register`), credentials stay on the device, consent (`collect`) is recorded once. Cleaner later: enable Supabase *anonymous sign-ins* and delete `device-register`.

## Background tracking — design (needs a native app)
A web page **cannot** record in the background (screen must stay on). Two routes: (1) a **native app** (Swift / Kotlin, or React Native / Flutter with a background-location module), (2) a **telematics SDK** (e.g. DriveQuant, Cambridge Mobile Telematics, Sentiance) which already does trip detection and events. The web collector (`collect.html`) is the *experimental stand-in*: GPS speed + motion sensors → events computed on the phone → summary to `ingest-trip`.

## Is the person the driver? (also with Waze / Google Maps) — design
Navigation apps change nothing for sensing (we never need to know which app is open) but they make **"phone in use" useless as a signal of who drives** — passengers navigate too. Signals fused into one confidence (trip counts only above ~0.6):
1. **Car pairing:** Bluetooth hands-free/audio to the car, **CarPlay / Android Auto active** = the phone is projecting to the car → very likely the driver's phone. (Native only: Core Bluetooth / AVAudioSession route; Android Bluetooth ACL events.)
2. **Two phones, one car:** the server sees two app users with overlapping time + route + car → the one paired to the car is the driver, the other the passenger.
3. **Routine:** same car + route + time as earlier confirmed trips.
4. **Entry side / posture** (weak): sit-down motion and left/right turn asymmetry.
5. **One-tap fix only when the model is unsure** (and the answer trains it) — rare, not every trip.
Honest ceiling for sensor-only methods ≈ 87–93 %; uncertain trips are stored but **not scored**. A cheap **BLE/NFC sticker** in the car would give a certain car + "this phone is inside" without any dongle (optional).

## Which car? — design
First trip: the app asks **once** "which car?" and binds it to the **car's Bluetooth / CarPlay identity** (hash of the device id); after that it is automatic. Fallbacks: parking place + routine, a BLE/NFC tag, manual pick. The web collector can only ask (dropdown / name + plate). In the database a car is created per user (`cars`, `driver_cars`); LTAB/insurer-verified plates and claims history are linked later.

## Phone use — design + experimental
- **Not** "which app is open" (iOS does not expose it, and navigation on a mount is fine). Measure **handling**: short bursts of **rotation that is not about the vertical axis** (phone lifted, tilted, turned in the hand) while moving > 5 km/h (gyroscope + gravity projection — implemented in the collector, threshold 1 rad/s, **experimental**).
- Native add-ons: **screen-on / unlock while moving** (Android broadcasts; iOS only indirectly), **calls** (CallKit / telephony — hands-free via car Bluetooth does not count), Do-Not-Disturb-while-driving state.
- Not counted: phone mounted + screen on (navigation), hands-free calls, stopped at a light.
- Accuracy differs by OS; iOS is weaker. **CSDD found no smart-device crash in its 2024 sample but says it is almost impossible to prove afterwards** → the weight is reduced (see `WEIGHTS.md`).

## Parking — design + experimental
Parking phase = slow part at trip start/end (and, with map data, inside OSM parking polygons). Scored on **leading indicators** (direction changes per parking, lot speed, sudden surges from standstill); a **possible contact** (accelerometer spike < 10 km/h; collector uses the linear acceleration of `devicemotion`) only triggers "Did you touch something?" → photo + statement. Details: `PARKING.md`.

## Driver fatigue — design (proxy, not a drowsiness meter)
A phone cannot see drowsiness. Measurable proxies, in order of strength:
1. **Time of day:** deep night (23–05) fully, ordinary darkness at ¼ (implemented); the early-morning dip 03:00–06:00 is the highest risk (CSDD: the 4 asleep-at-the-wheel crashes were at night or early morning).
2. **Continuous driving without a 15-min break** > 2 h (implemented) and **total driving in the last 24 h** (to add).
3. **Time since the last long rest** — unknown to a phone; shift workers declare a schedule (optional).
4. **Behaviour signature:** CSDD's fatigue crashes show a *gentle drift without braking* → lateral-g **drift/correction pattern** (slow lateral wander followed by an abrupt correction) and growing speed variability — research idea, needs labelled data (to add).
5. Optional wearable (heart-rate variability) — out of scope.
Weight is modest (10 %) because there are few cases but severe ones; fatigue is **not** discoverable through harsh events.

## Scoring on the server and the insurer view — built
`car-scores` (Edge Function, `x-api-key`, hash stored in `api_keys`) computes **one score per car** with the same engine (pinned to a commit), writes `score_snapshots`, and returns **cars only** — drivers appear only as a count. Page: `insurer.html`. Try: `curl -H "x-api-key: …" https://qjakepgeqioqrmsufaty.supabase.co/functions/v1/car-scores`.
