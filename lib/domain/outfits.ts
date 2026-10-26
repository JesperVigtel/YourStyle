import type { Feedback } from "@/lib/types";
import { itemSetKey, type IdAliases } from "./wardrobe";

export type RawOutfit = {
  item_ids: string[];
  rationale: string;
  swap: { replace_item_id: string; with_item_id: string; note: string } | null;
};

export type CleanOutfit = {
  item_ids: string[];
  rationale: string;
  swap: { replace_item_id: string; with_item_id: string; note: string } | null;
};

export type FilterOptions = {
  aliases: IdAliases;
  /** Real ids that must not appear (recently worn, unless the user asked for them). */
  excluded: Set<string>;
  /** itemSetKey()s of combinations the user disliked. */
  disliked: Set<string>;
  max: number;
};

export type FilterReport = {
  hallucinated: number;
  droppedExcluded: number;
  droppedDisliked: number;
  duplicates: number;
};

/**
 * Cleans model outfits: maps aliases to real ids and drops hallucinated ones, then removes
 * outfits that are too small, use excluded items, repeat a disliked combination unchanged,
 * or duplicate an earlier outfit. Invalid swap suggestions become null.
 */
export function filterOutfits(raw: RawOutfit[], opts: FilterOptions): { outfits: CleanOutfit[]; report: FilterReport } {
  const report: FilterReport = {
    hallucinated: 0,
    droppedExcluded: 0,
    droppedDisliked: 0,
    duplicates: 0,
  };
  const seen = new Set<string>();
  const outfits: CleanOutfit[] = [];

  for (const o of raw) {
    const ids: string[] = [];
    for (const a of o.item_ids) {
      const id = opts.aliases.resolve(a);
      if (!id) report.hallucinated++;
      else if (!ids.includes(id)) ids.push(id);
    }
    if (ids.length < 2) continue;
    if (ids.some((id) => opts.excluded.has(id))) {
      report.droppedExcluded++;
      continue;
    }
    const key = itemSetKey(ids);
    if (opts.disliked.has(key)) {
      report.droppedDisliked++;
      continue;
    }
    if (seen.has(key)) {
      report.duplicates++;
      continue;
    }
    seen.add(key);

    let swap: CleanOutfit["swap"] = null;
    if (o.swap) {
      const from = opts.aliases.resolve(o.swap.replace_item_id);
      const to = opts.aliases.resolve(o.swap.with_item_id);
      if (from && to && ids.includes(from) && !ids.includes(to) && !opts.excluded.has(to)) {
        const swapped = itemSetKey(ids.map((id) => (id === from ? to : id)));
        if (!opts.disliked.has(swapped)) swap = { replace_item_id: from, with_item_id: to, note: o.swap.note };
      }
    }
    outfits.push({ item_ids: ids, rationale: o.rationale.trim(), swap });
    if (outfits.length >= opts.max) break;
  }
  return { outfits, report };
}

/** Combinations given 👎. An outfit with the exact same items is never suggested again. */
export function dislikedSets(feedback: Pick<Feedback, "rating" | "item_ids">[]): Set<string> {
  const keys = new Set<string>();
  for (const f of feedback) if (f.rating === -1 && f.item_ids.length >= 2) keys.add(itemSetKey(f.item_ids));
  return keys;
}
