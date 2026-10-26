import type { Feedback, Item, WearLog } from "@/lib/types";
import { IdAliases, summarizeWardrobe, type WearStat } from "@/lib/domain/wardrobe";
import { filterOutfits, type CleanOutfit, type FilterReport } from "@/lib/domain/outfits";
import * as prompt from "../prompts/suggestOutfits";
import { suggestOutfitsSchema, type SuggestOutfitsOutput } from "../schemas";
import type { TaskDef } from "../run";
import { hashString } from "./images";

export type SuggestInput = {
  count: number;
  /** All owned items. Every one gets an alias (so wear history and feedback stay readable), but
   *  only the non-excluded ones are offered in the wardrobe list. */
  items: Item[];
  /** Real ids that must not be used (recently worn etc.); also enforced after the response. */
  excluded: Set<string>;
  stats: Map<string, WearStat>;
  mood: { name: string; description: string };
  occasion: string | null;
  weather: string;
  profile: string;
  body: string;
  recentWear: Pick<WearLog, "date" | "item_ids">[];
  feedback: Pick<Feedback, "rating" | "item_ids" | "reason_tags" | "comment">[];
  disliked: Set<string>;
  /** Item sets already shown, to get different outfits on a top-up request. */
  alreadySuggested?: string[][];
  /** Aliases are created once per input so build/mock/post agree. */
  aliases?: IdAliases;
};

export type SuggestResult = { outfits: CleanOutfit[]; report: FilterReport };

function aliasesFor(input: SuggestInput) {
  return (input.aliases ??= new IdAliases(input.items.map((i) => i.id)));
}

/** Items as aliases (or as a short description with `plain`, or when they no longer exist). */
function describeIds(ids: string[], aliases: IdAliases, byId: Map<string, Item>, plain = false) {
  return ids
    .map((id) => {
      const it = byId.get(id);
      if (!plain && aliases.resolve(id)) return aliases.alias(id);
      return it ? `${it.colors[0]?.name ?? ""} ${it.subcategory ?? it.category}`.trim() : "(removed item)";
    })
    .join(" + ");
}

export const suggestOutfits: TaskDef<SuggestInput, SuggestOutfitsOutput, SuggestResult> = {
  name: "suggestOutfits",
  schema: suggestOutfitsSchema,
  maxTokens: 6000,
  build(input) {
    const aliases = aliasesFor(input);
    const byId = new Map(input.items.map((i) => [i.id, i]));
    const recentWear = input.recentWear.length
      ? input.recentWear.map((w) => `${w.date}: ${describeIds(w.item_ids, aliases, byId)}`).join("\n")
      : "(nothing logged)";
    const feedback = input.feedback.length
      ? input.feedback
          .map((f) => {
            const icon = f.rating > 0 ? "👍" : f.rating < 0 ? "👎" : "•";
            const tags = f.reason_tags.length ? ` [${f.reason_tags.join(", ")}]` : "";
            const comment = f.comment ? ` "${f.comment}"` : "";
            return `${icon}${tags} ${describeIds(f.item_ids, aliases, byId)}${comment}`;
          })
          .join("\n")
      : "(none yet)";
    const disliked = [...input.disliked]
      .map((key) => key.split("|"))
      .filter((ids) => ids.every((id) => aliases.resolve(id)))
      .map((ids) => ids.map((id) => aliases.alias(id)).join(" + "));
    const exclude = (input.alreadySuggested ?? [])
      .map((ids) =>
        ids
          .filter((id) => aliases.resolve(id))
          .map((id) => aliases.alias(id))
          .join(" + "),
      )
      .join("\n");
    const avoided = input.items
      .filter((i) => input.excluded.has(i.id))
      .map((i) => `${aliases.alias(i.id)} (${describeIds([i.id], aliases, byId, true)})`);
    const offered = input.items.filter((i) => !input.excluded.has(i.id));
    return {
      system: prompt.system,
      content: [
        {
          type: "text",
          text: prompt.user({
            count: input.count,
            mood: input.mood,
            occasion: input.occasion,
            weather: input.weather,
            wardrobe: summarizeWardrobe(offered, aliases, input.stats),
            profile: input.profile,
            body: input.body,
            recentWear,
            feedback,
            disliked: disliked.length ? disliked.join("\n") : "(none)",
            avoided: avoided.length ? avoided.join(", ") : "(none)",
            exclude,
          }),
        },
      ],
    };
  },
  mock(input) {
    const aliases = aliasesFor(input);
    const usable = input.items.filter((i) => !input.excluded.has(i.id));
    const by = (cats: string[]) => usable.filter((i) => cats.includes(i.category));
    const tops = by(["top"]);
    const bottoms = by(["bottom"]);
    const shoes = by(["shoes"]);
    const outer = by(["outerwear"]);
    const seed = hashString(`${input.mood.name}|${input.occasion ?? ""}|${(input.alreadySuggested ?? []).length}`);
    const pick = <T>(arr: T[], n: number) => (arr.length ? arr[(seed + n) % arr.length] : undefined);
    const outfits: SuggestOutfitsOutput["outfits"] = [];
    for (let n = 0; n < input.count + 3; n++) {
      const parts = [
        pick(tops, n * 7 + 1),
        pick(bottoms, n * 3 + 2),
        pick(shoes, n),
        n % 2 ? pick(outer, n) : undefined,
      ]
        .filter((x): x is Item => !!x)
        .map((i) => aliases.alias(i.id));
      // The first outfit includes a made-up id to exercise the hallucination filter.
      if (n === 0) parts.push("i9999");
      const alt = pick(tops, n * 7 + 4);
      outfits.push({
        item_ids: parts,
        rationale: `Mock: ${input.mood.name} look for ${input.occasion || "the day"} (${input.weather}).`,
        swap:
          alt && parts[0] !== aliases.alias(alt.id)
            ? {
                replace_item_id: parts[0],
                with_item_id: aliases.alias(alt.id),
                note: "Mock alternative top.",
              }
            : null,
      });
    }
    return { outfits };
  },
  post(out, input) {
    return filterOutfits(out.outfits, {
      aliases: aliasesFor(input),
      excluded: input.excluded,
      disliked: input.disliked,
      max: input.count,
    });
  },
};
