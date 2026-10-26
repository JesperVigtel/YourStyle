import type { Item, WearLog } from "@/lib/types";

export type WearStat = { count: number; lastWorn: string | null };

/** Wear count and last-worn date per item, derived from wear_log (never stored). */
export function wearStats(logs: Pick<WearLog, "date" | "item_ids">[]): Map<string, WearStat> {
  const stats = new Map<string, WearStat>();
  for (const log of logs) {
    for (const id of new Set(log.item_ids)) {
      const s = stats.get(id) ?? { count: 0, lastWorn: null };
      s.count += 1;
      if (!s.lastWorn || log.date > s.lastWorn) s.lastWorn = log.date;
      stats.set(id, s);
    }
  }
  return stats;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Item ids worn on `today` or within the `days` days before it. */
export function recentlyWornIds(logs: Pick<WearLog, "date" | "item_ids">[], today: string, days: number): Set<string> {
  const since = addDays(today, -days);
  const ids = new Set<string>();
  for (const log of logs) if (log.date >= since && log.date <= today) log.item_ids.forEach((id) => ids.add(id));
  return ids;
}

/** Order-independent key for a combination of items. */
export function itemSetKey(ids: string[]): string {
  return [...new Set(ids)].sort().join("|");
}

/**
 * Short aliases (i1, i2, …) for item ids. The model sees aliases instead of UUIDs: fewer tokens
 * and no mangled ids. Anything it returns that isn't in the map is dropped as hallucinated.
 */
export class IdAliases {
  private toAlias = new Map<string, string>();
  private toId = new Map<string, string>();

  constructor(ids: string[]) {
    ids.forEach((id, i) => {
      const alias = `i${i + 1}`;
      this.toAlias.set(id, alias);
      this.toId.set(alias, id);
    });
  }

  alias(id: string): string {
    const a = this.toAlias.get(id);
    if (!a) throw new Error(`No alias for ${id}`);
    return a;
  }

  /** Resolves an alias (or a raw known id) back to the real id; null if unknown. */
  resolve(aliasOrId: string): string | null {
    const key = aliasOrId.trim();
    return this.toId.get(key) ?? (this.toAlias.has(key) ? key : null);
  }

  get size() {
    return this.toId.size;
  }
}

function colorText(item: Pick<Item, "colors">) {
  return item.colors.map((c) => c.name).join("/") || "?";
}

/** One compact line per item: what the model sees instead of the photos. */
export function summarizeItem(item: Item, alias: string, stat?: WearStat): string {
  const parts = [
    alias,
    [item.category, item.subcategory].filter(Boolean).join("/"),
    colorText(item),
    item.pattern && item.pattern !== "solid" ? item.pattern : null,
    item.material,
    item.formality ? `formality ${item.formality}` : null,
    item.warmth ? `warmth ${item.warmth}` : null,
    item.seasons.length ? item.seasons.join(",") : null,
    item.brand,
    item.size_label ? `size ${item.size_label}` : null,
    item.fit_verdict ? `fit: ${item.fit_verdict}` : null,
    item.is_reference ? "REFERENCE FIT" : null,
    stat ? `worn ${stat.count}x, last ${stat.lastWorn}` : "never worn",
  ];
  return parts.filter(Boolean).join(" | ");
}

export function summarizeWardrobe(items: Item[], aliases: IdAliases, stats: Map<string, WearStat>): string {
  return items.map((it) => summarizeItem(it, aliases.alias(it.id), stats.get(it.id))).join("\n");
}

export const clamp = (n: number | null | undefined, lo: number, hi: number): number | null =>
  n === null || n === undefined || Number.isNaN(n) ? null : Math.min(hi, Math.max(lo, Math.round(n)));

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
