import "server-only";
import type { Ctx } from "@/lib/auth";
import { ai } from "@/lib/ai";
import { suggestOutfits } from "@/lib/ai/tasks/suggestOutfits";
import { swapItem } from "@/lib/ai/tasks/swapItem";
import { BadRequestError } from "@/lib/api";
import { NotFoundError, type Row } from "@/lib/data/repo";
import {
  bodyForPrompt,
  getBody,
  latestProfile,
  listItems,
  listMoods,
  recentFeedback,
  wearSince,
} from "@/lib/data/services";
import { dislikedSets } from "@/lib/domain/outfits";
import { profileForPrompt } from "@/lib/domain/profile";
import { addDays, itemSetKey, recentlyWornIds, wearStats } from "@/lib/domain/wardrobe";
import { describeWeather } from "@/lib/domain/weather";
import {
  MIN_ITEMS_FOR_SUGGESTIONS,
  RECENT_WEAR_DAYS,
  type Feedback,
  type Item,
  type Outfit,
  type OutfitContext,
  type SuggestedOutfit,
} from "@/lib/types";

export type SuggestRequest = {
  mood: string;
  occasion: string | null;
  weather: OutfitContext["weather"];
  includeRecent: boolean;
  today: string;
  count?: number;
};

export type SuggestResponse =
  | { needMoreItems: true; have: number; min: number }
  | {
      needMoreItems: false;
      outfits: SuggestedOutfit[];
      avoidedRecent: number;
      notice: string | null;
    };

async function loadContext(ctx: Ctx, today: string, includeRecent: boolean) {
  const { repo } = ctx;
  const [owned, wear14, feedback, disliked, profile, body] = await Promise.all([
    listItems(repo, "owned"),
    wearSince(repo, addDays(today, -14)),
    recentFeedback(repo, 30),
    repo.list<Feedback & Row>("feedback", { eq: { rating: -1 } }),
    latestProfile(repo),
    getBody(repo),
  ]);
  const recent = recentlyWornIds(wear14, today, RECENT_WEAR_DAYS);
  const excluded = includeRecent ? new Set<string>() : recent;
  return {
    owned,
    wear14,
    feedback,
    disliked: dislikedSets(disliked),
    recent,
    excluded,
    stats: wearStats(wear14),
    profile: profileForPrompt(profile),
    body: bodyForPrompt(body),
  };
}

export async function suggest(ctx: Ctx, req: SuggestRequest): Promise<SuggestResponse> {
  const count = req.count ?? 3;
  const c = await loadContext(ctx, req.today, req.includeRecent);
  if (c.owned.length < MIN_ITEMS_FOR_SUGGESTIONS) {
    return {
      needMoreItems: true,
      have: c.owned.length,
      min: MIN_ITEMS_FOR_SUGGESTIONS,
    };
  }
  const moods = await listMoods(ctx.repo);
  const mood = moods.find((m) => m.name === req.mood || m.id === req.mood) ?? {
    name: req.mood,
    description: "",
  };
  const items = c.owned.filter((i) => !c.excluded.has(i.id));
  const base = {
    items,
    excluded: c.excluded,
    stats: c.stats,
    mood: { name: mood.name, description: mood.description },
    occasion: req.occasion,
    weather: describeWeather(req.weather),
    profile: c.profile,
    body: c.body,
    recentWear: c.wear14,
    feedback: c.feedback,
    disliked: c.disliked,
  };

  let { outfits } = await ai(ctx.repo, suggestOutfits, { ...base, count });
  if (outfits.length < count) {
    // One top-up round for outfits the filters removed (hallucinated ids, disliked repeats, …).
    const more = await ai(ctx.repo, suggestOutfits, {
      ...base,
      count: count - outfits.length,
      alreadySuggested: outfits.map((o) => o.item_ids),
    });
    const keys = new Set(outfits.map((o) => itemSetKey(o.item_ids)));
    outfits = [...outfits, ...more.outfits.filter((o) => !keys.has(itemSetKey(o.item_ids)))].slice(0, count);
  }

  const context: OutfitContext = {
    mood: mood.name,
    occasion: req.occasion,
    weather: req.weather ?? null,
  };
  const saved: SuggestedOutfit[] = [];
  for (const o of outfits) {
    const row = await ctx.repo.insert<Outfit & Row>("outfits", {
      item_ids: o.item_ids,
      context,
      origin: "suggested",
      rationale: o.rationale,
    });
    saved.push({
      outfit_id: row.id,
      item_ids: o.item_ids,
      rationale: o.rationale,
      swap: o.swap,
    });
  }
  return {
    needMoreItems: false,
    outfits: saved,
    avoidedRecent: req.includeRecent ? 0 : c.recent.size,
    notice:
      saved.length < count ? "Only found these combinations that fit today. Add more items for more variety." : null,
  };
}

/** Same slot = same category (one-pieces can stand in for tops and vice versa is not assumed). */
function sameSlot(a: Item, b: Item) {
  return a.category === b.category;
}

export async function swap(
  ctx: Ctx,
  req: {
    outfit_id: string;
    replace_item_id: string;
    with_item_id?: string;
    today: string;
    includeRecent: boolean;
  },
): Promise<{ outfit: SuggestedOutfit; replaced: string; with: string }> {
  const outfit = await ctx.repo.get<Outfit & Row>("outfits", req.outfit_id);
  if (!outfit) throw new NotFoundError("outfits", req.outfit_id);
  if (!outfit.item_ids.includes(req.replace_item_id)) throw new BadRequestError("Item is not part of this outfit");
  const c = await loadContext(ctx, req.today, req.includeRecent);
  const byId = new Map(c.owned.map((i) => [i.id, i]));
  const replace = byId.get(req.replace_item_id);
  if (!replace) throw new BadRequestError("Item not found in wardrobe");
  const current = outfit.item_ids.map((id) => byId.get(id)).filter((x): x is Item => !!x);
  const rest = outfit.item_ids.filter((id) => id !== replace.id);
  const candidates = c.owned.filter(
    (i) =>
      sameSlot(i, replace) &&
      !outfit.item_ids.includes(i.id) &&
      !c.excluded.has(i.id) &&
      !c.disliked.has(itemSetKey([...rest, i.id])),
  );
  if (!candidates.length) throw new BadRequestError(`No other ${replace.category} available to swap in.`);

  const ctxText = [
    outfit.context.mood ? `Mood: ${outfit.context.mood}` : null,
    outfit.context.occasion ? `Occasion: ${outfit.context.occasion}` : null,
    `Weather: ${describeWeather(outfit.context.weather)}`,
  ]
    .filter(Boolean)
    .join("\n");
  // A specific replacement (the alternative offered with the suggestion) skips the AI call.
  const direct = req.with_item_id ? candidates.find((i) => i.id === req.with_item_id) : undefined;
  let pick = direct
    ? { with_item_id: direct.id, note: "Suggested alternative." }
    : await ai(ctx.repo, swapItem, {
        outfit: current,
        replace,
        candidates,
        stats: c.stats,
        context: ctxText,
        profile: c.profile,
      });
  if (!pick) {
    // Hallucinated or invalid answer: fall back to the closest candidate by formality and warmth.
    const score = (i: Item) =>
      Math.abs((i.formality ?? 3) - (replace.formality ?? 3)) + Math.abs((i.warmth ?? 3) - (replace.warmth ?? 3));
    const best = [...candidates].sort((a, b) => score(a) - score(b))[0];
    pick = {
      with_item_id: best.id,
      note: "Closest match by formality and warmth.",
    };
  }
  const itemIds = outfit.item_ids.map((id) => (id === replace.id ? pick!.with_item_id : id));
  const row = await ctx.repo.insert<Outfit & Row>("outfits", {
    item_ids: itemIds,
    context: { ...outfit.context, swapped_from: outfit.id } as OutfitContext,
    origin: "suggested",
    rationale: `${outfit.rationale ?? ""} Swap: ${pick.note}`.trim(),
  });
  return {
    outfit: {
      outfit_id: row.id,
      item_ids: itemIds,
      rationale: row.rationale ?? "",
      swap: null,
    },
    replaced: replace.id,
    with: pick.with_item_id,
  };
}
