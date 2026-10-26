# Decisions

Non-obvious choices made during Run 1, with the reasoning and the alternatives I considered.

## Platform & architecture

### D1. Pages are static client shells; all data goes through `/api/*`
Next.js 16 (App Router, Cache Components on). Pages are client components that prerender to static HTML
shells, then fetch from route handlers with SWR.
- **Why:** the PWA must open at a market with no signal. Static shells can be cached by the service
  worker and render offline. Server-rendered pages that read the session can't be. It also keeps every
  secret and every AI call in route handlers.
- **Alternatives:** React Server Components reading Supabase directly. Faster first paint online, but
  pages wouldn't work offline and the auth/session code would be spread across every page.

### D2. A `Repo` interface with two backends: Supabase (prod) and a JSON file (dev/tests)
No Docker daemon was available in this environment, so `supabase start` couldn't run. The spec allows
"a clearly separated test setup", so `DATA_BACKEND=local` stores everything in `.data/db.json` plus an
uploads folder. The repo is deliberately generic (list/get/insert/update/remove/count with simple
filters), so the two implementations stay small and behave the same.
- The SQL migration is still **executed in a unit test** against PGlite (real Postgres compiled to WASM),
  with small stand-ins for Supabase's `auth` and `storage` schemas. The test checks every table exists,
  RLS isolates users, check constraints work, and every column the local backend fills in exists in SQL.
- **Risk:** the `SupabaseRepo` class itself (the query-builder calls) is typechecked but not run against
  a live Supabase in this run. It's thin, but it's the first thing to check on the iPhone test.
- **Alternative:** an in-memory Postgres for e2e too. Rejected: Supabase Auth/Storage can't be emulated
  that way, so it wouldn't test more than the current setup.

### D3. Local backend = no login, and it refuses to run on Vercel
"Dev auth bypass, clearly disabled in production": `DATA_BACKEND=local` runs as a fixed dev user, and
`lib/env.ts` throws if `DATA_BACKEND=local` while `VERCEL` is set (Vercel's filesystem is read-only
anyway). So a deployed app always needs Supabase and therefore a login. The proxy does the same check.

### D4. Images are served through `/api/img/<key>`
Supabase Storage bucket is **private**; objects live under `<user_id>/…` with storage RLS. The app
stores keys like `/api/img/uploads/<uuid>.jpg` and the route streams the object after an auth check,
with `Cache-Control: private, max-age=31536000, immutable` (keys are never rewritten). The service
worker also caches them, so the wardrobe grid works offline.
- **Alternatives:** public bucket (photos of my wardrobe would be world-readable by URL); signed URLs
  (expire, so they'd be refetched constantly and break offline caching).

### D5. Every table has `user_id default auth.uid()` + RLS `user_id = auth.uid()`
Single-user today, enforced by the email allowlist (in `proxy.ts` and again in every route handler).
Scoping rows by `user_id` costs nothing now and avoids a data migration if multi-user ever happens.
Even if someone else managed to create an account, they'd see an empty app and be bounced by the allowlist.

### D6. Login: email **code** as well as magic link (iOS limitation)
On iOS, a magic link opens in Safari, and Safari's cookies are **not shared** with the home-screen app.
Tapping the link would log in Safari, not the installed PWA. The login page therefore asks for the
6-digit code from the same email (`verifyOtp`). The magic link still works on the Mac. This needs a
one-line change to the Supabase email template (`{{ .Token }}`), described in `SETUP_FOR_ME.md`.

## AI

### D7. Model and effort come from env, defaulting to `claude-opus-5-5` at `low` effort
`AI_MODEL` (default `claude-opus-5-5`, the current default Claude model) and `AI_EFFORT` (default `low`).
Opus 5.5 always thinks; lower effort is the lever for latency and cost.
- **Cost/latency trade-off (your call):** with Opus 5.5 my estimate is roughly $0.02–0.05 per tagged
  item and per shop scan, so registering ~150 items in the first month could exceed the $5/month
  guardrail on its own. Setting `AI_MODEL=claude-sonnet-5-5` halves the price; `claude-haiku-5-5` is
  ~40× cheaper and fastest, but weaker at reading labels. I didn't downgrade the default for cost, since
  that trade-off should be yours. The Settings page shows the real monthly spend so you can decide from data.
- **Refusal fallback:** requests include the beta server-side fallback (`fallbacks: "default"`), so a
  rare false-positive refusal is retried on a fallback model instead of failing. `AI_FALLBACKS=off`
  disables it. It's skipped for Haiku, which has no fallback model.

### D8. Structured outputs + zod validation + one retry
Each task's zod schema is converted to a JSON schema (`output_config.format`). The response is still
validated with zod. On failure the request is retried once with the validation error appended, and
after that the user sees a friendly error. Schemas avoid transforms and use nullable instead of optional
so they convert cleanly. Numeric ranges (formality 1–5, confidence 0–1) are clamped in post-processing
rather than rejected, which avoids a paid retry for an off-by-one.

### D9. Short item aliases (`i1`, `i2`, …) instead of UUIDs in prompts
The model sees `i12`, not a 36-character UUID: about 20 fewer tokens per item per call, and no
half-copied ids. After the response every id is resolved through the alias map. Anything that doesn't
resolve is dropped as hallucinated (`filterOutfits`, `evaluatePurchase.post`, `swapItem.post`), as the
spec requires. An outfit left with fewer than 2 real items is discarded.

### D10. Deterministic guards around the LLM for the rules that must hold
- Recently worn items (last 3 days) are **removed from the wardrobe list** sent to the model, *and*
  outfits containing them are filtered out afterwards.
- A 👎 combination (same set of items, any order) is filtered out **after** the response too, not just
  listed in the prompt. That makes "a disliked outfit is never suggested again unchanged" a guarantee
  rather than a hope. If the filters leave fewer than 3 outfits, one top-up call asks for the rest.
- "< 15 owned items" is checked before any AI call (no cost, clear message).

### D11. Style profile: user entries are tagged, deletions are tombstones
Each rule/preference is `{ text, source: "ai" | "user" }`. Regeneration replaces only `ai` entries.
Editing an AI entry turns it into a `user` entry, and deleting an AI entry keeps a hidden tombstone so
regeneration can't quietly bring it back. The prompt also tells the model about both. A summary I
edit is locked (`summary_source = "user"`). Each save or regeneration inserts a new row, which gives a
version history for free. Auto-regeneration runs in `after()` once ≥ 10 feedback events have arrived
since the last generation, so the feedback tap stays instant.

### D12. Swap: AI first, deterministic fallback
"Swap one item" asks the model to pick from same-category candidates (excluding recently worn and
anything that would recreate a disliked set). If its answer isn't a valid candidate, the closest
candidate by formality and warmth is used, so the button never fails just because of an LLM answer. The
"alternative" offered with a suggestion is applied directly, with no extra AI call.

### D13. Prompts are TypeScript template files
`lib/ai/prompts/*.ts`, one per task, plain template strings. `.md` files would need runtime file reads,
and Vercel's output tracing doesn't reliably include them.

## Shop mode & offline

### D14. Every scan goes into IndexedDB first, then uploads
Even online, the scan is written to the IndexedDB queue before the upload starts, so a dropped signal
or a killed app never loses photos. The client generates the scan id, so a retried upload is
idempotent: the server returns the existing scan instead of evaluating twice. Upload + evaluation is a
single request to save a round trip in the store. The queue drains on `online`, on app focus, every 30 s,
and at startup (mounted once in the tab layout).

### D15. Hand-written service worker instead of a plugin
`public/sw.js` (≈100 lines): cache-first for hashed static assets and images, network-first for API
GETs and pages, with `/offline` as the fallback. The page sends the asset URLs it loaded before the
worker took control, so the very first visit is cached too.
- **Alternative:** Serwist/next-pwa. Extra build integration with Next 16 + Turbopack for little gain
  at this size.

### D16. Saving a scan as wishlist/considered creates a linked item
Items already have `wishlist`/`considered` statuses, so saving a scan creates an item with that status
(visible under the Wardrobe status filter). "I bought it" then flips that same item to `owned`, or
creates it if it doesn't exist yet. No re-entry and no duplicates.

## Images

### D17. Background removal in the browser, never blocking
`@imgly/background-removal` (`isnet_quint8`, the smallest model) is lazy-loaded when the capture screen
opens. It runs on a 1024 px copy, in parallel with tagging, and saving never waits for it. If it
finishes after saving, the cutout is attached with a PATCH. Any error or a 45 s timeout keeps the
original photo. For shop scans the cutout is made later, on the verdict page, so it doesn't add to the
≤ 10 s verdict. In batch mode cutouts run one at a time, to avoid memory pressure on the phone.
- **Licence note:** `@imgly/background-removal` is **AGPL-3.0**. Fine for a private, personal app. If
  the app is ever distributed or offered to others, its source would have to be offered too, or the
  library swapped for a server/API alternative.
- No COOP/COEP headers. That means no multi-threaded WASM: slower, but cross-origin isolation would
  break the CDN model download and other cross-origin requests. Measure on the iPhone first (open
  question in the PRD).

### D18. Client-side compression: 1600 px JPEG q0.8, HEIC fallback
iOS converts HEIC to JPEG for `<input type=file>` uploads, but desktop Chrome can't decode HEIC, so
`heic2any` is lazy-loaded only when native decoding fails. EXIF orientation is applied via
`createImageBitmap(..., { imageOrientation: "from-image" })`.

## Testing

### D19. Playwright runs Chromium with iPhone 15 emulation, not WebKit
The environment only ships Chromium for Playwright, and installing other browsers was off-limits. The
e2e suite uses the iPhone 15 viewport (393×852), device scale factor 3, touch, and a mobile Safari user
agent in Chromium. WebKit-specific behaviour (camera input, standalone mode, safe areas on a real notch,
IndexedDB quirks) is covered by `IPHONE_TEST.md` instead. To run on WebKit locally, use
`npx playwright install webkit` and `--project=iphone-webkit`.

### D20. Mock AI provider in tests and dev
`AI_PROVIDER=mock` returns per-task fixtures, which still go through the zod validation and the id
filter. The suggestion and purchase mocks deliberately include a made-up item id, so the hallucination
filter is exercised on every e2e run.
