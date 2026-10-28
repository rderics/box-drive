# OCTA Driver Score — hackathon prototype

Concept add-on for an OCTA (motor third-party liability) insurance app: a **driver score** (the person) and a **car score** (what OCTA is priced on), tracked passively in the background, explained to the driver and turned into an illustrative OCTA discount. Built for the OCTA Tech Challenge (28 Oct 2026). **Synthetic demo data** — not an official LTAB/insurer product, no LTAB assets.

Live: https://rderics.id.lv/octa/ (moving to its own repo/subdomain).

## Run
Static, no build, no dependencies: open `index.html`, or `py -3 -m http.server` and visit http://localhost:8000.
```
node tools/test.js    # engine sanity tests
node tools/gen.js     # regenerate data.js (synthetic drivers, cars, trips, Assetto Corsa-format sessions)
```

## Layout
| Path | What |
|---|---|
| `engine.js` | Scoring engine (browser + Node): samples → events → KPIs → score ± uncertainty → advice → illustrative premium. **All thresholds/weights are our assumptions** in `P` at the top. |
| `phone.js`, `phone.css` | The in-app mock-up (Mani auto · Braukšana · CSNg · Vairāk), car/driver screens, trip route map + timeline, OBD2 block, onboarding. |
| `app.js`, `i18n.js`, `style.css` | Presenter pages (insurer view, hours vs years, Assetto Corsa, how it works), LV/EN, demo panel. |
| `data.js` | Generated synthetic data (do not edit by hand). |
| `tools/ac_logger.py` | Records a real Assetto Corsa session to JSON (untested against the live game). |
| `docs/ARCHITECTURE.md` | Backend + real-app design and the thin slice for the hackathon. |

## Rules of the road
- **Bump the `?v=` stamp in `index.html`** whenever you change an asset (Cloudflare caches static files 4 h).
- Never commit personal data, real plates/photos, or organiser materials.
- Keep the honesty notes: synthetic data, illustrative prices, schematic (dead-reckoned) route, no GPS stored.
