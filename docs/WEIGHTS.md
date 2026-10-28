# Why each metric has its weight

Weights in `engine.js` (`P.weights`): speeding **29** · smoothness **20** · claims **16** · phone **14** · night & fatigue **11** · experience **10 → 35 (dynamic, fades with hours)**; the others scale so the total is 100. **Parking was removed from the score on 28.10 (Rinalds: not needed)**; its 10 points were spread over the other factors.

## Evidence base
**CSDD, “Smago ceļu satiksmes negadījumu izpētes pilotprojekts 2024” (v2)** — in-depth investigation of **69 severe crashes (66 fatal)**; factors identified in **29 completed** cases. Factors overlap. It reports how often a factor was **present in severe crashes** (prevalence), not how much it *raises* the risk (no exposure denominator) — and fatal crashes are not the typical OCTA claim (mostly property damage). So CSDD is used for *ranking and direction*, not for exact coefficients.

| Metric (weight) | CSDD / other evidence | Strength | Consequence for the weight |
|---|---|---|---|
| **Speeding for the conditions (26)** | Speeding in **22** crashes (10× +10–20, 4× +20–30, 5× +30–50, 3× >+50 km/h); in **≥ 8** cases the crash was avoidable / far milder at the limit; +10–20 over is “not insignificant”, esp. in towns; all **6 weather cases** also had a speed wrong for the conditions | **Strong** | Largest weight; speed measured against **conditions**, not only the posted limit (raised 22 → 26) |
| **Smoothness / aggressive driving (18)** | Aggressive driving in **6** (5 with major speeding), a **long-standing style** (repeated speeding, risky manoeuvres, short distance); 3 cases late braking | Medium | Score **rates over time**, not single events (18) |
| **Claims history (14)** | CSDD examined past violations/crashes for a “driver portrait” but gives no number; strongest known predictor in insurance practice | **Assumption** | Keep 14 until insurer data validates it |
| **Phone use (12)** | **0** crashes with smart-device use found; 2 with other distraction; authors: very hard to prove afterwards (no recordings/operator data) | **Weak (locally)** | Reduced **18 → 12**; raise only with Latvian evidence |
| **Night & fatigue (10)** | Fatigue **5** (4 asleep/likely asleep), night / early morning, drift without braking; “actual scale not identified”; darkness dominant in pedestrian crashes | Medium | Few but severe → 10; measured by time of day + continuous driving, not harsh events |
| **Experience (10 → 35)** | **10** cases of missing skills/qualification (4 no licence, 3 wrong category); wrong reaction to hazards (over-steering, swerving instead of braking); severe crashes involve all ages | Medium | Highest weight for brand-new drivers, fades as measured behaviour accumulates |

## Big factors we do **not** measure
**Alcohol** (21 cases, 14 drivers; **≥ 32 of 98** fatal crashes in 2024 — a third), risky overtaking, failure to give way (9), infrastructure (13 black spots), health (7), no/incorrect seat belt (5), pedestrians without reflectors (14). The phone cannot see alcohol and we do not infer it from night/weekend driving. Infrastructure belongs in a hotspot map, not in a driver's score.

## How the weights should really be set (next)
1. **Now:** expert + evidence priors (this table), reviewed with LTAB/insurer actuaries.
2. **Pilot:** collect telematics for the same drivers as the insurer's claims (≥ ~10,000 driver-years is typical for stable estimates); fit a **claim-frequency model** (Poisson/GLM with km as exposure; monotonic, non-negative, regularised) on the KPIs. Weight ∝ standardised effect × how often it varies.
3. **Check** fairness (no proxies for age/occupation), stability over time, and that advice items are things the driver can change; refit yearly; keep `params_version` on every score.
4. Use CSDD for **ranking/sanity** and for what to measure next, not as coefficients.
