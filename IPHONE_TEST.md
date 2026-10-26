# iPhone test script (≈ 10 minutes)

For what the automated tests can't cover: the real camera, the installed PWA, background-removal speed
on the device, and real AI quality on your own clothes. Do it after [`SETUP_FOR_ME.md`](SETUP_FOR_ME.md),
on the iPhone 15, on Wi-Fi unless a step says otherwise.

Note anything odd in the **Notes** column. That list is the input for Run 2.

## 1. Install & shell (1 min)

| # | Do | Expect | ✓ / Notes |
|---|---|---|---|
| 1.1 | Open Wardrobe from the home screen | Full-screen, no Safari bars, splash in the app background colour | |
| 1.2 | Look at the top and bottom edges on every tab | Nothing hidden behind the Dynamic Island or the home bar; tab bar sits above the home indicator | |
| 1.3 | Rotate the phone | Stays usable (portrait is the target) | |
| 1.4 | Switch the iPhone to Dark Mode (Control Centre) and back | App follows; text stays readable; black clothes still visible on the grey background | |

## 2. Capture: real camera, background removal, tagging (3 min)

| # | Do | Expect | ✓ / Notes |
|---|---|---|---|
| 2.1 | Wardrobe → **+** → **Take a photo** | The rear camera opens directly | |
| 2.2 | Photograph a T-shirt flat on the bed | Preview appears; badge says "Removing background…" | |
| 2.3 | **+ Label photo** → photograph the size/care label → **Tag it** | Skeleton while tagging; then a pre-filled form. Label fields (size, material) are filled in from the label | |
| 2.4 | Wait for the badge | "Cutout ready (N s)". **Write down N** (first time includes the model download, ~40 MB) | N first = ___ s |
| 2.5 | Check the highlighted (yellow "check this") fields | They're the ones that really were uncertain | |
| 2.6 | **Save & add another**, then add 2 more garments quickly | Each one from tap to saved in **≤ 20 s** (target). The second time, background removal should be faster | N second = ___ s |
| 2.7 | Wardrobe grid | Cutouts look clean. If background removal failed, the original photo shows and nothing broke | |
| 2.8 | Batch: **Batch add** → pick 5 photos from the library → review | Tagging runs while you review; Save & next works | |

## 3. Today (2 min)

Needs ≥ 15 owned items. If you don't have that many yet, do 3.1 and come back later.

| # | Do | Expect | ✓ / Notes |
|---|---|---|---|
| 3.1 | Today with < 15 items → **Suggest outfits** | Explains it needs more items; no weak suggestions | |
| 3.2 | Allow location → weather card | Real temperature and rain chance for where you are | |
| 3.3 | Pick a mood + "uni" → **Suggest outfits** | 3 different outfits as collages, each with a sensible one-line reason. Time shown under the button: target **≤ 8 s** | ___ s |
| 3.4 | **Wear this** on one | Changes to "✓ Logged for today", instantly | |
| 3.5 | 👎 another → "too formal" → Save | Sheet closes; 👎 stays highlighted | |
| 3.6 | Swap icon → tap one garment in the collage | That item changes; the outfit still makes sense | |
| 3.7 | Suggest again | The 👎 outfit doesn't come back unchanged; today's worn items aren't used | |

## 4. Shop mode: in a real store or market if you can (3 min)

| # | Do | Expect | ✓ / Notes |
|---|---|---|---|
| 4.1 | Shop → **Scan** (one hand) | Camera opens immediately | |
| 4.2 | Garment → brand label → size/care label → price tag (skip one step) | Each step is one tap to the camera; **Skip** and **Done** always reachable with the thumb | |
| 4.3 | Verdict on mobile data | Arrives in **≤ 10 s** (shown next to the verdict badge) | ___ s |
| 4.4 | Read the verdict | Brand, size, material and price read correctly from the labels; fit prediction is plausible; example outfits use your real clothes; duplicates flagged if you own something similar | |
| 4.5 | **Airplane mode on** → do a scan → Done | "No signal — scan saved…"; it appears under "Waiting for signal" | |
| 4.6 | Close the app completely, airplane mode **off**, reopen the app | The pending scan is processed automatically and shows up under Recent scans | |
| 4.7 | Airplane mode on → open the app from the home screen → Shop tab | The Shop tab loads offline (you opened it online before) | |
| 4.8 | On a scan you like: **Wishlist**, then **I bought it** | It appears in Wardrobe as owned, with photos and details, and **only once** | |
| 4.9 | Screenshot a product in a web shop → Shop → **Evaluate a web-shop screenshot** | Same verdict flow | |

## 5. Profile & cost (1 min)

| # | Do | Expect | ✓ / Notes |
|---|---|---|---|
| 5.1 | Profile → write a hard rule ("Never pair navy with black") → Save → **Regenerate** | Your rule is still there, marked "mine" | |
| 5.2 | Profile → Settings | Monthly AI cost is shown and plausible (check against console.anthropic.com → Usage) | $___ |
| 5.3 | Open the app on the Mac | Same data as on the phone | |

## What to send back for Run 2

- The three timings (cutout, suggestion, verdict) and whether they felt fast enough.
- Fields the AI got wrong more than once (they become prompt fixes).
- Anything in Shop mode that was awkward one-handed, plus whether you'd prefer a
  "single photo, AI figures it out" mode (open question in the PRD).
- The monthly cost after the first week, so you can pick the model for good.
