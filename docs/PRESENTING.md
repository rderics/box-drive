# Presenting Box-Driver with the game

The demo in one sentence: **Ali drives in Assetto Corsa, and the audience watches the drive arrive on the projector — live speed and events, the saved ride, the new score, and the AI coach's advice.**

## Setup (two laptops)

| | Game laptop (Ali) | Projector laptop |
|---|---|---|
| Runs | Assetto Corsa + `live.py` (Windows, Python 3.10+) | A browser on https://rderics.id.lv/octa/ (or https://octa-xun.pages.dev) |
| Logged in as | the demo user (default in `upload.py`) | **the same account** — the live view only shows your own rides |
| Window | game full screen | browser full screen (F11), **at least 1180 px wide** |

On the projector the phone stays in the middle. Two panels appear beside it in the app's own style: **left = the game, live**; **right = the AI coach**. Press **P** to hide or show them.

## 30 minutes before

1. Both laptops: `git pull`. Projector: hard refresh (Ctrl+Shift+R), log in, check the panels show.
2. Open https://octa-xun.pages.dev/status on the projector: every line should be green.
3. Game laptop, game running in a session: `python live.py ac-check` — values should move when you drive.
4. **Record a backup drive** (1–2 minutes, no upload):
   `python live.py ac --zones "0-1500:60,1500-:90" --save-csv backup.csv`
   If the game or the network fails on stage, replay this real recorded drive (step 4 below).
5. One test drive with upload; watch the projector react; then delete the test ride from the admin site (`/admin`) if you don't want it in the history.

## On stage (about 5 minutes for the demo part)

1. **Before the drive** — point at the phone: cars, score, illustrative OCTA price. Point at the left panel: “waiting for a drive”.
2. **Start the drive** on the game laptop:
   `python live.py ac --zones "0-1500:60,1500-:90" --upload`
   The console prints `Live view on`. The left panel switches to **Live**: speed, the limit sign, g-forces, a speed line, and events as they happen.
3. **Drive one calm stretch, then one aggressive stretch** (hard braking, a fast corner, over the limit). Each event appears on the left within a second. Say: *“A phone measures exactly these signals with GPS, accelerometer and gyroscope; the game gives us the same signals safely and repeatably.”*
4. **Stop** with Ctrl+C. The ride uploads; the projector shows **“Ride saved”**, the phone's car score updates, and the right panel runs the coach:
   - **Engine** calculates the numbers (points and euros),
   - **Jev** ranks which habit to change first and shows how sure it is (if under 60 %, the engine's order stays — say so, it shows the system is careful),
   - **Gemini** writes the advice text. If Gemini is out of quota the panel says so and shows the standard text.
5. Tap the phone: **Braukšana** → open the new ride → map, speed chart and every event.
6. Close with the insurer angle: *“The insurer sees one score per car, never the driver.”*

**Backup if the game fails:** `python live.py csv backup.csv --speed 1 --upload` — the same live view, from the real drive you recorded earlier. Say it is a recording.

## What is real, what is illustrative (say it if asked)

- Real: the scoring engine, the database, the live link, the event detection, Jev's ranking.
- Illustrative: OCTA prices and discounts (not a Balcia model); sample rides in accounts are labelled as samples; speed limits in the game are set by `--zones`.
- Gemini text needs a paid quota; without it the coach uses standard text and says so.

## If something goes wrong

- **No panels:** the window is narrower than 1180 px, you are not in the app view, not logged in, or panels are hidden — press P.
- **Panel stays “waiting”:** the game laptop did not print `Live view on` (wrong account or no internet), or the projector is logged in as a different account.
- **Ride not appearing:** the drive was shorter than 20 s / 100 m (not uploaded).
- Anything else: open `/status` on the projector and read the red line.
