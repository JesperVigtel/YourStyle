# Wardrobe — personal style & wardrobe app

> Build spec for Claude Code. Read **`PRD.md` first** (goals, priorities, acceptance criteria), then this whole file, before writing any code.
> If the two conflict, PRD.md wins on scope and priority, and this file wins on technical details. If time or complexity forces cuts, cut P1 items from the PRD before anything P0.
> **Run 1: build Phases 0–4 autonomously, end to end.** Do not stop for plan approval. Follow the working rules in §8. Phases 5–6 come in a later run, after I've used the app on my iPhone.

---

## 1. Goal

A personal (single-user) app that makes getting dressed and buying clothes easier:

- Register my wardrobe with minimal effort (photo → AI does the tagging).
- Store my size, fit and body-shape information, plus learned brand-size fit.
- Suggest outfits from what I own, based on mood, occasion and weather.
- Remember which combinations I like or dislike, and get better over time.
- Help me decide on purchases, **especially in physical stores and vintage markets**. I take photos of the garment, brand label, size/care label and price tag, and get a fast verdict.

Primary device: **iPhone 15**, used as an installed PWA (Add to Home Screen). Secondary device: **MacBook** (same app in the browser, with data synced). UI language: **English**.

It starts as a tool for myself. Write clean code, but do **not** build multi-tenant, monetisation or social features.

---

## 2. Tech stack (use free tiers)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server route handlers hold all API keys |
| Styling | Tailwind CSS | Mobile-first, one-thumb usable, dark mode |
| Hosting | **Vercel** (Hobby/free) | Gives HTTPS, which the camera and PWA features need on iPhone |
| DB + file storage + auth | **Supabase** (free tier) | Postgres, Storage for images, magic-link auth |
| AI | **Anthropic Claude API** (vision) | Model name comes from env var `AI_MODEL`; all calls go through one module `lib/ai/` so the provider can be swapped |
| Weather | **Open-Meteo** | Free, no API key |
| Background removal | Client-side `@imgly/background-removal` (or a similar in-browser lib) | Runs on device, no API cost. Must gracefully fall back to the original photo |
| Validation | `zod` | Validate **every** AI JSON response against a schema |
| Offline queue | IndexedDB (e.g. `idb`) | For shop scans when there is no signal |

Requirements:
- **PWA:** web manifest, app icons, `apple-mobile-web-app-capable`, standalone display, safe-area insets (Dynamic Island / home bar), and a splash/theme colour.
- **Auth:** Supabase magic link, with access restricted to one allowlisted email (`ALLOWED_EMAIL` env var). Enable Row Level Security on all tables.
- **Secrets:** never expose the Anthropic key or Supabase service key to the client.
- **Images:** compress client-side before upload (longest side ~1600 px, JPEG quality ~0.8). Handle HEIC if it appears. Store the original and the cutout separately.
- **Camera:** use `<input type="file" accept="image/*" capture="environment">` as the primary capture method, because it is the most reliable on iOS Safari/PWA. Also allow picking from the photo library.
- **AI cost logging:** log model, tokens and estimated cost for every AI call to a table, and show the monthly total on a settings page.

---

## 3. Data model (Supabase / Postgres)

Adapt names as needed, but keep these concepts:

- **items**: `id, status ('owned'|'wishlist'|'considered'|'passed'|'archived'), photo_url, cutout_url, label_photo_urls[], category, subcategory, colors (jsonb: name + hex, primary/secondary), pattern, material, formality (1–5), warmth (1–5), seasons[], brand, size_label, fit_verdict ('too small'|'slightly small'|'perfect'|'slightly big'|'too big'|null), fit_notes, price, currency, acquired_date, source ('store'|'vintage'|'online'|'gift'|'other'), notes, ai_raw (jsonb), user_verified (bool), created_at`
- **body_profile** (single row): `height_cm, weight_kg (optional), measurements (jsonb: chest, waist, hips, inseam, shoulder, etc. — all optional), shape_notes (free text), fit_preferences (free text, e.g. "slim but not skinny trousers, relaxed tees"), style_goals (free text)`
- **brand_sizes**: `brand, size_label, garment_type, fit_verdict, notes, item_id (ref)`. This is learned from owned items and from feedback.
- **outfits**: `id, item_ids[], context (jsonb: mood, occasion, weather snapshot), origin ('suggested'|'manual'|'logged'), rationale, created_at`
- **wear_log**: `id, date, outfit_id, photo_url (optional), notes`
- **feedback**: `id, outfit_id (nullable), item_ids[], rating (-1|0|1), reason_tags[], comment, created_at`
- **style_profile** (versioned): `id, summary (text), hard_rules (jsonb list, e.g. "never pair navy with black"), soft_preferences (jsonb), generated_from_feedback_until, created_at, edited_by_user (bool)`
- **moods**: configurable list, seeded with `everyday, experimental, party, alternative, smart/formal, comfy`. Each mood has a short description that is passed to the AI.
- **scans** (shop mode): `id, photo_urls[], extracted (jsonb), verdict (jsonb), location_text, price, currency, decision ('bought'|'skipped'|'undecided'), item_id (if converted), created_at`
- **ai_calls**: `id, task, model, input_tokens, output_tokens, est_cost_usd, created_at`

Wear count and last-worn date are **derived** from `wear_log`. Do not store them redundantly.

---

## 4. AI design

All AI calls are server-side, in `lib/ai/`, with one function per task. Each function:
1. Builds a compact context. For the wardrobe, send a **text summary per item** (id, category, colours, formality, warmth, brand), never all the images.
2. Requests **structured JSON**, using tool use or a JSON schema.
3. Validates the response with zod. On failure, retry once with the validation error included, then surface a friendly error.
4. **Checks that every returned `item_id` actually exists**, and drops any hallucinated ones.
5. Logs cost to `ai_calls`.

Tasks:

| Function | Input | Output |
|---|---|---|
| `tagItem` | 1–4 images (garment + optional labels) | All item attributes, plus confidence per field. Low-confidence fields are highlighted in the UI for me to check |
| `suggestOutfits` | mood, occasion, weather, wardrobe summary, style_profile, last 14 days of wear_log, recent feedback | 3 distinct outfits: item_ids, a one-line rationale each, and an optional "swap" alternative |
| `evaluatePurchase` | scan photos, wardrobe summary, body_profile, brand_sizes, style_profile | See §5.4 |
| `itemiseOutfitPhoto` | one mirror/outfit photo | Detected garments, each matched to an existing item_id or proposed as a new item |
| `updateStyleProfile` | all feedback + wear history + current profile | New summary, hard_rules and soft_preferences, plus a diff explaining what changed |

Style logic must be **gender-neutral and driven by my profile** (style_goals, fit_preferences, style_profile). Do not assume a gendered wardrobe.

All prompts live in `lib/ai/prompts/` as separate, readable template files, so I can tune them.

---

## 5. Phases

### Phase 0 — Scaffold & deploy
- Next.js + TS + Tailwind, Supabase client (browser and server), migrations, RLS policies, magic-link auth with the email allowlist.
- PWA manifest, icons (generate a simple placeholder icon), iOS meta tags, safe areas.
- Bottom tab bar: **Today · Wardrobe · Shop · Profile**.
- `README.md` with exact setup steps for creating the Supabase project, the Vercel project and the Anthropic API key, plus an env var list, `.env.example`, and how to install the app on my iPhone.
- Make it deploy-ready for Vercel. The actual deploy and iPhone install are my steps, documented in `SETUP_FOR_ME.md`.
- **Done when:** the app builds, runs locally with auth (or a dev auth bypass that is clearly disabled in production), and the PWA manifest validates.

### Phase 1 — Capture & wardrobe
- **"+" capture flow**, optimised for speed:
  1. Take a garment photo.
  2. Optionally add label photos.
  3. Background removal and AI tagging run in parallel; show a skeleton while they work.
  4. A pre-filled edit form opens, with low-confidence fields highlighted.
  5. Save.
  
  The target is **under 20 seconds per item**.
- **Batch mode:** pick several photos from the library and queue them for tagging. I review them one by one afterwards.
- **Wardrobe grid:** cutout images on a neutral background. Filter by category, colour, season and status. Search. Item detail page with edit, archive and wear history.
- **Done when:** I can add 10 items in a few minutes and the tags are mostly right.

### Phase 2 — Today (daily outfit)
- Context bar: mood chips, occasion (free text plus quick chips: uni, dinner, party, travel, sport), and weather fetched automatically via geolocation and Open-Meteo (temperature, rain, wind; I can override).
- "Suggest" returns 3 outfits, each rendered as a **collage of cutouts** with its rationale.
- Actions per outfit:
  - **Wear this:** logs it to wear_log.
  - **👍 / 👎** with quick reason chips: too formal, too casual, colours clash, wrong for weather, not me, love it, plus custom text.
  - **Swap one item:** re-asks for that slot only.
- **Manual outfit builder:** tap items to compose an outfit, then save or log it.
- Avoid suggesting items worn in the last few days unless I ask for them.
- **Done when:** a morning suggestion takes ~5 seconds and logging what I wear takes one tap.

### Phase 3 — Memory & style profile
- `updateStyleProfile` runs automatically after every ~10 new feedback events, and also on demand.
- Profile tab shows the current style summary, hard rules and soft preferences, all **editable by me**. My edits take precedence over AI-generated content and are preserved.
- History of liked and disliked outfits.
- **Done when:** suggestions visibly stop repeating combinations I disliked.

### Phase 4 — Shop mode (in-store & vintage)
This is a key feature, so make it **fast and one-handed**.
- A large **Scan** button on the Shop tab. One tap opens the camera.
- Guided multi-shot capture, where every step is skippable: **garment → brand label → size/care label → price tag**. A "Done" button is always visible.
- `evaluatePurchase` returns:
  - **Extracted:** brand, size label, material composition (from the care label), country of origin if visible, price, and an estimated era or condition for vintage.
  - **Fit prediction:** compares against body_profile, brand_sizes (my history with that brand) and reference items I own of the same type. Gives a plain answer like "Your M from this brand fit perfectly; this L will likely be loose in the shoulders."
  - **Outfit gain:** the number of concrete new outfits this enables with items I already own. Show 2–3 of them as collages, using the scan cutout plus my item cutouts.
  - **Overlap warning:** similar items I already own.
  - **Material/quality note** (e.g. "100% wool, good for winter"; "acrylic blend, pills easily").
  - **Price sanity** for vintage, flagged as a rough estimate only.
  - **Verdict:** Buy / Maybe / Skip, with a 2–3 sentence reason.
- Save as `considered` or `wishlist`. One tap on **"I bought it"** converts it to an owned item, reusing the photos and extracted data.
- **Offline:** if there is no connection (common at markets), queue the scan in IndexedDB, show it as pending, and process it automatically when back online.
- Also accept **screenshots from online shops** through the same flow.
- **Done when:** a store scan gives a verdict in under ~10 seconds on mobile data.

### Phase 5 — Fit learning
- After wearing or buying an item, prompt occasionally: "How does this fit?" Answer with a fit verdict per area (shoulders, chest, waist, length, etc.).
- Build and display a per-brand size table from this data.
- Mark items as **reference garments** ("this fits perfectly"), to be used in fit predictions.

### Phase 6 — Extras (only after 0–5 work well)
- **Outfit photo → itemise:** a mirror selfie is matched to existing items and logs the wear.
- **Stats:** cost per wear, most and least worn, items unworn for 90+ days (declutter suggestions), and colour distribution.
- **Packing list:** given a trip length, destination weather and occasions, pick a minimal capsule from my wardrobe.
- **iOS Shortcut endpoint:** a token-protected API route that accepts an image, so an iOS Shortcut in the share sheet can send screenshots straight to Shop mode. iOS PWAs cannot be share targets, so this is the workaround. Include setup instructions for the Shortcut.

---

## 6. UX principles
- Mobile-first, thumb-reachable primary actions, large tap targets.
- Every AI wait shows a skeleton or progress state. Nothing blocks without feedback.
- AI output is always **editable**. I am the source of truth.
- Clean, minimal visual design that lets the clothing photos stand out. Neutral background, one accent colour, dark mode.
- Fast cold start. Lazy-load the background-removal model.

## 7. Non-goals
Multi-user support, social/sharing, payments, App Store native build, affiliate links, and trend scraping.

## 8. How to work (autonomous mode)

### Scope of this run
- Build **Phases 0–4** in order, without pausing for approval between phases. Make reasonable decisions yourself, and log non-obvious ones in `DECISIONS.md` with the reasoning and the alternatives you considered.
- Phases 5–6 are **out of scope** for this run. Still design the data model so they fit without migrations that break things.

### Before writing code
- Write `PLAN.md`: the architecture, folder structure, the order of work, and how each phase's "Done when" criterion will be verified. Keep it updated as you go, and use it as your checklist.

### Verify your own work (this matters more than speed)
- **Typecheck, lint and build must pass** before a phase counts as done.
- **Unit tests** (Vitest) for data logic, AI response parsing and validation, and the item_id hallucination filter.
- **AI layer:** create a mock provider (`AI_PROVIDER=mock`) that returns realistic fixture JSON. That way the whole app runs and is testable without an API key, and tests never cost money. Add a few fixture garment images for the tests.
- **End-to-end tests** (Playwright) at **iPhone 15 viewport (393×852, WebKit)** for the main flows: add item, get outfit suggestion, give feedback, run a shop scan (including the offline queue → sync), and convert a scan to an owned item.
- **Look at the UI yourself.** Take Playwright screenshots of every main screen at iPhone size, in light and dark mode, and fix layout problems (safe areas, overflow, tap targets) before moving on.
- Local Supabase (`supabase start` via the CLI/Docker) for development and tests, if available. Otherwise use a clearly separated test setup.

### Git
- Initialise a repo. Commit at least once per phase with a clear message, and commit more often on big phases. Never commit secrets.

### Only stop and ask me when
- You need something only I can provide: accounts, API keys, env values, or the Vercel/Supabase dashboard setup. **Don't block on this.** Keep building against the mock provider and local Supabase, and collect everything I need to do in `SETUP_FOR_ME.md`, written as a step-by-step checklist.
- A choice would add a paid service or go beyond free tiers.
- Something in this spec turns out to be infeasible (e.g. an iOS Safari limitation). Explain it and propose an alternative instead of silently dropping the feature.

### When the run is done, give me
1. A short summary of what was built per phase, and anything not finished or known to be fragile.
2. `SETUP_FOR_ME.md`: accounts, keys and deploy steps, plus how to install on iPhone.
3. `IPHONE_TEST.md`: a 10-minute manual test script for the things automated tests can't cover (real camera, PWA install, background-removal speed on device, real AI quality on my own clothes).
4. Suggested prompt tweaks or open questions I should consider before Run 2.
