# PRD — Wardrobe: personal style & shopping assistant

**Owner:** me (sole user) · **Status:** Draft v1 · **Date:** 2026-10-26
**Companion doc:** `SPEC.md` holds the technical build instructions. This PRD defines *what* and *why*, and the priorities. If the two conflict, the PRD wins on scope and priority, and SPEC.md wins on technical details.

---

## 1. Problem statement

Getting dressed and buying clothes cost me more time and money than they should. Every morning I re-decide outfits from scratch, without any memory of what worked or didn't. In stores and at vintage markets, I make purchase decisions with no overview of what I already own, how that brand's sizing fits me, or whether the piece actually combines with my wardrobe. The cost is decision fatigue, repeated outfits, garments that rarely get worn, and impulse buys that don't fit — either my body or the rest of my wardrobe.

Existing wardrobe apps (Stylebook, Cladwell, Whering, Acloset, Indyx) mostly fail at the same point: **registering clothes is too tedious**, so the wardrobe data is never complete enough for the suggestions to be useful.

---

## 2. Goals

1. **Low-friction wardrobe capture.** Register a garment in **under 20 seconds**, so the whole wardrobe gets registered within 2 weeks of first use.
2. **Faster mornings.** Get a wearable outfit suggestion for today's context in **under 1 minute** from opening the app to choosing.
3. **Personalisation that improves.** After 30 days of feedback, I accept **at least 50% of suggestions** without swapping items.
4. **Better purchase decisions.** In a store, get a buy/skip verdict with fit prediction and outfit gain in **under ~10 seconds**, and buy fewer items that end up unworn.
5. **Usable anywhere.** Works on iPhone as an installed app and on Mac, with synced data, including at markets with poor signal.

---

## 3. Non-goals

| Non-goal | Why |
|---|---|
| Multi-user accounts, sharing, social feed | Personal tool first. Adds auth, privacy and moderation complexity with no value for me now |
| Native iOS app / App Store release | A PWA covers the needs without the Apple developer fee or the review process |
| Monetisation (affiliate links, ads, subscriptions) | Premature. It would also bias the purchase advice |
| Trend scraping / fashion feeds | Advice should be driven by my wardrobe and taste, not by trends |
| Automatic import from shop order emails | High complexity and parser maintenance. Photo capture is good enough for v1 |

---

## 4. Personas & user stories

There is one user (me), in four distinct situations.

### A. Morning dresser (highest priority)
- As a morning dresser, I want 3 outfit suggestions based on today's mood, occasion and weather, **so that** I don't have to start from zero every day.
- As a morning dresser, I want to log what I wear with one tap, **so that** the app knows my wear history without extra work.
- As a morning dresser, I want to give 👍/👎 with a quick reason, **so that** future suggestions match my taste.
- As a morning dresser, I want to swap just one item in a suggestion, **so that** a nearly-right outfit doesn't get discarded entirely.
- *Edge case:* as a morning dresser with few registered items, I want the app to say plainly that it needs more items for good suggestions, rather than giving weak ones.

### B. Wardrobe builder
- As a wardrobe builder, I want to photograph a garment and have category, colour, material, formality and season filled in automatically, **so that** registration is fast enough to actually finish.
- As a wardrobe builder, I want low-confidence AI guesses highlighted, **so that** I only check what's likely wrong.
- As a wardrobe builder, I want to add several photos from my camera roll in one batch, **so that** I can register a whole shelf at once.
- As a wardrobe builder, I want to mark garments that fit perfectly as reference items, **so that** fit predictions have something concrete to compare against.

### C. In-store / vintage shopper
- As a shopper, I want one tap to open a guided capture (garment → brand label → size/care label → price tag), with every step skippable, **so that** I can do it quickly and discreetly in a store.
- As a shopper, I want a prediction of how this brand and size will fit me, **so that** I can skip the fitting room or know what to try on.
- As a shopper, I want to see how many new outfits the piece enables with what I own, and whether I already have something similar, **so that** I avoid buying duplicates and orphan items.
- As a shopper, I want a clear Buy / Maybe / Skip verdict with a short reason, **so that** I can decide on the spot.
- As a vintage shopper with no signal, I want my scan saved and processed automatically once I'm back online, **so that** bad coverage never loses a scan.
- As a shopper who decides to buy, I want one tap to turn the scan into an owned item, **so that** I never register the same garment twice.
- As an online shopper, I want to run the same evaluation on a screenshot from a web shop.

### D. Reflective owner (later)
- As an owner, I want to see and edit the style profile the app has learned about me, **so that** I stay in control of how it interprets my taste.
- As an owner, I want cost-per-wear and "not worn in 90 days" lists, **so that** I can declutter and buy smarter.
- As a traveller, I want a packing list built from my own wardrobe for a trip's length and weather.

---

## 5. Requirements

### P0 — Must-have (Run 1; the app is useless without these)

**R1. Installable, synced, private app**
- [ ] Installs to the iPhone home screen and opens in standalone mode, respecting safe areas.
- [ ] Same data on iPhone and Mac.
- [ ] Only my allowlisted email can log in. API keys are never present in client code.

**R2. AI-assisted garment capture**
- Given I tap "+" and take a photo, when tagging finishes, then a pre-filled edit form appears with low-confidence fields highlighted.
- [ ] Background removal produces a cutout. If it fails, the original photo is used and no error blocks saving.
- [ ] Median time from tap to saved item is **≤ 20 s** on iPhone over Wi-Fi.
- [ ] Every AI field is editable before and after saving.

**R3. Wardrobe browsing**
- [ ] Grid of cutouts, with filters for category, colour, season and status, plus text search.
- [ ] Item detail page with wear history and archive.

**R4. Daily outfit suggestions**
- Given at least ~15 owned items, when I choose a mood and occasion and tap Suggest, then 3 distinct outfits appear in **≤ 8 s**, each shown as a collage with a one-line rationale.
- [ ] Weather is fetched automatically, and I can override it.
- [ ] Suggestions only contain items I own (hallucinated item IDs are filtered out).
- [ ] Recently worn items (last 3 days) are avoided unless I explicitly include them.
- [ ] With fewer than ~15 items, the app explains it needs more items, instead of showing weak suggestions.
- [ ] Moods are configurable. Seeded with: everyday, experimental, party, alternative, smart/formal, comfy.

**R5. Feedback & memory**
- [ ] One-tap wear logging. 👍/👎 with reason chips and an optional comment.
- [ ] The style profile (summary, hard rules, soft preferences) regenerates after every ~10 feedback events, and on demand.
- [ ] I can edit the profile, and my edits are never overwritten by regeneration.
- [ ] An outfit I gave 👎 for a stated reason is not suggested again unchanged.

**R6. Shop mode**
- [ ] One tap from the Shop tab to the camera. Guided 4-step capture, every step skippable.
- [ ] The verdict includes: extracted brand, size, material and price; fit prediction; outfit gain with 2–3 example collages; overlap warning; material note; and Buy / Maybe / Skip with a reason.
- [ ] Verdict arrives in **≤ 10 s** on decent mobile data.
- [ ] The scan can be saved as considered or wishlist, and "I bought it" converts it to an owned item with no re-entry.
- [ ] Screenshots from web shops work through the same flow.

**R7. Offline scan queue**
- Given no network, when I complete a scan, then it is stored locally, marked "pending", and processed automatically when connectivity returns, without losing any photos.

### P1 — Nice-to-have (in Run 1 if time allows; first to cut)
- Swap a single item in a suggestion.
- Manual outfit builder.
- Batch import from the camera roll.
- Vintage price-sanity estimate (clearly labelled as a rough estimate).
- AI cost dashboard (monthly spend).

### P2 — Future considerations (Run 2+; design the data model for these now)
- Fit learning per brand and body area, reference garments, and a brand size table *(Phase 5)*.
- Outfit-photo itemisation from mirror selfies *(Phase 6)*.
- Stats: cost per wear, unworn items, colour distribution.
- Packing list generator.
- iOS Shortcut endpoint for sending screenshots from the share sheet.
- Possible future multi-user support. Don't make this harder than necessary, but don't build for it.

---

## 6. Success metrics

Self-measured. Most can be derived from the app's own tables.

| Metric | Type | Success | Stretch | How measured |
|---|---|---|---|---|
| Items registered | Leading | ≥ 60 in 14 days | Full wardrobe in 14 days | `items` count |
| Median capture time | Leading | ≤ 20 s | ≤ 12 s | Timestamps from capture start to save |
| Days the Today tab is used | Leading | ≥ 4 / week | ≥ 6 / week | `wear_log` + suggestion events |
| Suggestion acceptance (no swap) | Lagging | ≥ 50% at day 30 | ≥ 70% | `outfits` with origin=suggested that were worn |
| 👎 rate trend | Lagging | Falling week over week for the first month | — | `feedback` |
| Shop-mode verdict latency | Leading | ≤ 10 s | ≤ 6 s | Timing logged per scan |
| Purchases worn ≥ 5× in 60 days | Lagging | ≥ 80% | 100% | `wear_log` joined with `acquired_date` |
| AI spend | Guardrail | ≤ $5 / month | ≤ $2 / month | `ai_calls` |

Evaluate at **2 weeks** for capture and adoption, and at **30 / 60 days** for personalisation and purchases.

---

## 7. Open questions

| Question | Owner | Blocking? |
|---|---|---|
| Is in-browser background removal fast enough on iPhone 15, or do I need a server-side or API fallback? | Engineering | No. Measure in Run 1 and decide after |
| What is the minimum wardrobe size for good suggestions (~15? ~30?) | Data / me | No. Tune after real use |
| Should the outfit-gain count be pure LLM, or a deterministic compatibility filter plus LLM ranking? | Engineering | No. Start with LLM and validated item IDs |
| Which body measurements do I actually want to record? | Me | No. All are optional |
| Is a one-handed 4-step capture actually fast enough in a busy store, or should there be a "single photo, AI figures it out" mode? | Me | No. Answer from real use after Run 1 |
| Supabase free-tier limits (storage, pausing when inactive): are they a problem at ~150 items × 2 images? | Engineering | No. Compress images, and verify before Run 2 |

---

## 8. Timeline & phasing

There are no hard deadlines. It is a personal project during the exchange year.

1. **Run 1 (autonomous Claude Code build):** all P0 requirements, plus P1 where time allows → `SETUP_FOR_ME.md` and `IPHONE_TEST.md`.
2. **Me (≈1 day):** set up accounts and keys, deploy, install on iPhone, run the test script.
3. **Real use (≈2 weeks):** register the wardrobe, use Today daily, and try Shop mode at least once in a physical store or market.
4. **Run 2:** fixes from real use, then P2 fit learning and extras.

**Dependencies:** Anthropic API key, Supabase project, Vercel project, iPhone for device testing.
