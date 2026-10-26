# Wardrobe

A personal style and shopping assistant, built as an installable web app (PWA) for iPhone and Mac.

- **Today:** 3 outfit suggestions from the clothes you own, for today's mood, occasion and weather.
  Log what you wear in one tap, rate outfits, swap a single item.
- **Wardrobe:** photograph a garment and the AI fills in category, colours, material, formality, warmth,
  seasons, brand and size. Fields it's unsure about are highlighted. Background removal runs on the device.
- **Shop:** in a store or at a vintage market, scan garment → brand label → size/care label → price tag
  and get **Buy / Maybe / Skip**: fit prediction, how many new outfits it enables, duplicates you already
  own, a material note and (for vintage) a price sanity check. Works with no signal: scans queue and are
  processed when you're back online.
- **Profile:** a style profile learned from your 👍/👎 that you can edit (your edits always win), plus
  body and fit info, moods, outfit history and the month's AI cost.

Product requirements: [`PRD.md`](PRD.md) · build spec: [`SPEC.md`](SPEC.md) · plan and checklist:
[`PLAN.md`](PLAN.md) · design decisions: [`DECISIONS.md`](DECISIONS.md).

**Setting it up for real (Supabase, Vercel, Anthropic, iPhone):** see [`SETUP_FOR_ME.md`](SETUP_FOR_ME.md).
**Manual test on the phone:** [`IPHONE_TEST.md`](IPHONE_TEST.md).

## Quick start (no accounts needed)

```bash
npm install
cp .env.development.local.example .env.local   # local data + mock AI, no login
npm run dev                                      # http://localhost:3000
npm run seed                                     # (in another terminal) adds 19 example items
```

`DATA_BACKEND=local` keeps everything in `.data/` and skips login. `AI_PROVIDER=mock` returns fixture
AI responses, so nothing costs money. Both are refused on Vercel. To use the real AI locally, set
`AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in `.env.local`.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 |
| Data, files, auth | Supabase: Postgres with row-level security, private Storage bucket, email login |
| AI | Anthropic Claude API (vision + structured outputs) via `lib/ai/`; model from `AI_MODEL` |
| Weather | Open-Meteo (no key), called from the browser |
| Background removal | `@imgly/background-removal`, in the browser, lazy-loaded |
| Offline | Service worker (`public/sw.js`) + IndexedDB queue for shop scans |
| Validation | zod, for every API body and every AI response |
| Tests | Vitest (unit), Playwright (e2e at iPhone 15 size) |

## Project layout

```
app/(tabs)/        today, wardrobe, shop, profile pages (client components)
app/api/           route handlers: all data access and all AI calls happen here
lib/ai/            provider (anthropic | mock), runner (validate → retry → log cost), tasks/, prompts/
lib/domain/        pure logic: outfit filters, wear stats, profile merge (unit-tested)
lib/data/          Repo interface → SupabaseRepo | LocalRepo
lib/server/        suggestion, scan, profile and upload services
lib/client/        image compression, background removal, offline queue, weather
supabase/migrations/  schema + RLS + storage policies
e2e/               Playwright tests, fixture photos, screenshots of every screen (light/dark)
tests/unit/        Vitest
```

To tune the AI, edit the prompt files in `lib/ai/prompts/`. Each task (`tagItem`, `suggestOutfits`,
`swapItem`, `evaluatePurchase`, `updateStyleProfile`) has its own file.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run check` | Typecheck + lint + unit tests |
| `npm test` | Unit tests (Vitest), including running the SQL migration on PGlite |
| `npm run e2e` | Builds and starts the app with local data + mock AI, then runs Playwright at 393×852 |
| `npm run seed` | Adds the 19 example items to a running dev server (local mode only) |
| `node scripts/gen-icons.mjs` | Re-renders the app icons |
| `node scripts/gen-fixtures.mjs` | Re-renders the test photos |

## Environment variables

See [`.env.example`](.env.example) for the full list with comments.

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon/publishable key (safe in the browser; RLS protects data) |
| `ALLOWED_EMAIL` | server | The only email that can sign in |
| `ANTHROPIC_API_KEY` | **server only** | Claude API key. Never prefix with `NEXT_PUBLIC_` |
| `AI_PROVIDER` | server | `anthropic` (default) or `mock` |
| `AI_MODEL` | server | Default `claude-opus-5-5`. See SETUP_FOR_ME.md for the cost/latency trade-off |
| `AI_EFFORT` | server | `low` (default) / `medium` / `high` |
| `AI_FALLBACKS` | server | Server-side refusal fallback; `off` to disable |
| `DATA_BACKEND` | server | `supabase` (default) or `local` (dev/tests only) |
| `NEXT_PUBLIC_BG_REMOVAL` | client | `off` to skip background removal |

## Security model

- The proxy (`proxy.ts`) and every route handler only let the allowlisted email through.
- Every table has row-level security (`user_id = auth.uid()`); storage objects are private and scoped
  to `<user_id>/…`. Images are served through `/api/img/…` after an auth check.
- The Anthropic key exists only on the server. The browser never talks to the AI directly.
