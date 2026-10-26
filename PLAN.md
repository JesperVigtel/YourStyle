# PLAN — Wardrobe (Run 1: Phases 0–4)

Living checklist. **Status: Run 1 complete (Phases 0–4 and all P1 items).** See `DECISIONS.md` for the reasoning behind non-obvious choices.

## Architecture

```
iPhone PWA / Mac browser
  │  (static client shells, SWR data hooks, IndexedDB scan queue, service worker)
  ▼
Next.js 16 App Router on Vercel
  ├─ proxy.ts ............ session refresh + auth gate (pages → /login, /api → 401)
  ├─ app/api/* ........... route handlers: all data access + all AI calls (keys stay here)
  ├─ lib/data ............ Repo interface → SupabaseRepo (prod) | LocalRepo (dev/test, JSON file)
  ├─ lib/storage ......... Blob storage → Supabase Storage (prod) | local folder (dev/test)
  ├─ lib/ai .............. one function per task, zod-validated, id-filtered, cost-logged
  │    ├─ provider: anthropic (AI_MODEL env) | mock (AI_PROVIDER=mock, fixture JSON)
  │    └─ prompts/ ....... one readable template file per task
  └─ lib/domain .......... pure logic: wardrobe summary, outfit filters, profile merge, fit
Supabase: Postgres (RLS on every table, user_id = auth.uid()), Storage bucket `wardrobe` (private), email OTP/magic link
Open-Meteo: called from the browser (no key)
Background removal: @imgly/background-removal in the browser, lazy-loaded, falls back to the original photo
```

Pages are client components rendered into static shells; they fetch from `/api/*`. That keeps the
shell cacheable by the service worker (Shop must open with no signal) and keeps every secret server-side.
Images are served through `/api/img/<path>` (auth-checked, immutable cache headers), so the same URLs
work for both storage backends.

## Folder structure

```
app/
  (tabs)/today, wardrobe, wardrobe/[id], wardrobe/add, wardrobe/batch, shop, shop/[id], profile, profile/*
  login/, auth/callback/
  api/  items, items/[id], items/tag, outfits, outfits/suggest, outfits/swap, wear, feedback,
        style-profile, body-profile, moods, scans, scans/[id], scans/[id]/convert, costs, img/[...path],
        auth/*, dev/seed
  manifest.ts, layout.tsx, globals.css
components/          TabBar, Collage, ItemForm, Chips, Skeleton, …
lib/
  types.ts           shared domain types (client + server)
  env.ts, auth.ts    env parsing, auth guard + dev bypass
  supabase/          browser / server / proxy clients
  data/              repo interface, local + supabase implementations
  storage/           local + supabase implementations
  ai/                provider, anthropic, mock, run (validate/retry/log), tasks/, prompts/, schemas
  domain/            pure functions (unit-tested)
  client/            image compression + HEIC, background removal, offline queue, weather, fetch helpers
public/              sw.js, icons
supabase/migrations/ SQL schema + RLS + storage policies
scripts/             icon + fixture generation
tests/unit/          Vitest
e2e/                 Playwright (iPhone 15 viewport) + fixture images + screenshots
```

## Order of work & checklist

### Phase 0 — Scaffold & deploy
- [x] Next.js + TS + Tailwind scaffold, deps installed
- [x] env parsing, Repo + Storage abstractions (local + supabase)
- [x] SQL migration: all tables (incl. Phase 5/6 columns), RLS, storage bucket + policies
- [x] Auth: magic link + 6-digit code (iOS PWA), allowlist, dev bypass (refuses to run on Vercel)
- [x] PWA: manifest, icons, iOS meta, safe areas, theme colour, service worker
- [x] Tab bar: Today · Wardrobe · Shop · Profile
- [x] README, .env.example, SETUP_FOR_ME.md
- **Verify:** `npm run typecheck && npm run lint && npm run build` pass; manifest checked by a unit test
  (required fields, icons exist) and by Playwright fetching `/manifest.webmanifest`; migration SQL is
  executed against PGlite in a unit test.

### Phase 1 — Capture & wardrobe
- [x] Client image pipeline: HEIC fallback, compress (1600px, q0.8), cutout input (1024px)
- [x] `tagItem` (AI) + mock; confidence per field → highlighted fields
- [x] "+" flow: photo → optional labels → parallel bg-removal + tagging (skeleton) → form → save
- [x] Batch mode: pick many → queue tagging → review one by one
- [x] Wardrobe grid + filters (category, colour, season, status) + search
- [x] Item detail: edit, archive, wear history (derived from wear_log)
- **Verify:** unit tests for schemas/filters; e2e "add item" (photo → form prefilled, low-confidence
  highlighted → saved → visible in grid); screenshots light/dark.

### Phase 2 — Today
- [x] Context bar: mood chips (configurable), occasion chips + free text, weather (geolocation + Open-Meteo, override)
- [x] `suggestOutfits`: wardrobe summary, recent wear, feedback, profile → 3 outfits; filters for
      hallucinated ids, recently worn (3 days), disliked combos, duplicates
- [x] Collage rendering; Wear this (1 tap); 👍/👎 with reason chips + comment; swap one item
- [x] < 15 items → explain instead of suggesting
- [x] Manual outfit builder
- **Verify:** unit tests for filters; e2e suggest → wear → feedback → swap; e2e small-wardrobe message.

### Phase 3 — Memory & style profile
- [x] `updateStyleProfile` auto after every 10 feedback events (`after()`), and on demand
- [x] Profile tab: summary, hard rules, soft preferences — editable; user entries survive regeneration
- [x] History of liked / disliked outfits
- [x] Body profile + moods editor + AI cost (monthly) on settings
- **Verify:** unit tests for merge (user edits preserved) and for disliked-combo exclusion; e2e edit profile.

### Phase 4 — Shop mode
- [x] Scan button → camera; guided 4 steps, each skippable, Done always visible; screenshot upload
- [x] `evaluatePurchase` → extracted, fit prediction, outfit gain + collages, overlap, material note,
      vintage price sanity, Buy/Maybe/Skip
- [x] Save as considered / wishlist; "I bought it" → owned item reusing photos + data
- [x] Offline: IndexedDB queue, pending list, auto-process on reconnect; SW keeps the shell available
- [x] Latency logged per scan
- **Verify:** unit tests for queue (fake-indexeddb) + verdict parsing; e2e scan, offline → online sync,
  convert to owned item.

### Wrap-up
- [x] Screenshots of every main screen at 393×852, light + dark; fix layout issues
- [x] IPHONE_TEST.md, SETUP_FOR_ME.md final, summary

## Verification results (end of Run 1)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm test` (Vitest) | ✅ 86 tests in 11 files, including the SQL migration on PGlite (tables, checks, RLS isolation, storage policies) |
| `npm run build` | ✅ all pages prerender as static shells (item and scan pages partially prerendered) |
| `npm run e2e` (Playwright, 393×852, Chromium iPhone emulation) | ✅ 19 tests: capture, batch, filters, suggest/wear/👎/swap, disliked never repeated, < 15 items, weather override, builder, profile edits vs regeneration, auto-regeneration, body/moods, cost, guided scan → buy, offline queue → sync, screenshot, offline shell |
| Screenshots of every main screen, light + dark | ✅ `e2e/screenshots/`, reviewed; layout assertions (no horizontal overflow, ≥ 32 px tap targets) run on each |
| Manual API smoke test against `next start` | ✅ seed → suggest → wear → feedback → swap → scan (idempotent retry) → wishlist → convert → regenerate → costs |

### "Done when" criteria

| Phase | Criterion | How verified |
|---|---|---|
| 0 | Builds, runs locally with auth (or a clearly disabled dev bypass), manifest validates | Build passes; local backend = no login and refuses to run on Vercel (`lib/env.ts`); manifest + icon sizes checked in `tests/unit/pwa.test.ts` |
| 1 | Add 10 items in a few minutes, tags mostly right | e2e add/batch flows; capture time is stored per item. **Tag quality needs the real AI on real clothes → IPHONE_TEST §2** |
| 2 | Suggestion in ~5 s; logging what I wear is one tap | e2e wear is a single tap. Mock latency only, **real latency → IPHONE_TEST §3** (time shown in the UI) |
| 3 | Suggestions stop repeating disliked combinations | Deterministic post-filter; unit tests + e2e (3 rounds of suggestions after a 👎) |
| 4 | Store scan verdict in < 10 s on mobile data | e2e asserts < 10 s with the mock; **real latency → IPHONE_TEST §4** (time shown next to the verdict) |

### Not in this run
- Phases 5–6 (fit learning UI, brand size table, outfit-photo itemisation, stats, packing list, iOS
  Shortcut endpoint). The data model already has `items.fit_areas`, `items.is_reference` (with a toggle
  in the item form), `brand_sizes` (already read by `evaluatePurchase`) and `wear_log.photo_url`, so
  these need no breaking migrations.
