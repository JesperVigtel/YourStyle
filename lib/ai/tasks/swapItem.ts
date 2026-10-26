import type { Item } from "@/lib/types";
import { IdAliases, summarizeItem, type WearStat } from "@/lib/domain/wardrobe";
import * as prompt from "../prompts/swapItem";
import { swapItemSchema, type SwapItemOutput } from "../schemas";
import type { TaskDef } from "../run";

export type SwapInput = {
  outfit: Item[];
  replace: Item;
  candidates: Item[];
  stats: Map<string, WearStat>;
  context: string;
  profile: string;
  aliases?: IdAliases;
};

export type SwapResult = { with_item_id: string; note: string } | null;

function aliasesFor(input: SwapInput) {
  return (input.aliases ??= new IdAliases([...input.outfit, ...input.candidates].map((i) => i.id)));
}

export const swapItem: TaskDef<SwapInput, SwapItemOutput, SwapResult> = {
  name: "swapItem",
  schema: swapItemSchema,
  maxTokens: 2000,
  build(input) {
    const a = aliasesFor(input);
    const line = (i: Item) => summarizeItem(i, a.alias(i.id), input.stats.get(i.id));
    return {
      system: prompt.system,
      content: [
        {
          type: "text",
          text: prompt.user({
            context: input.context,
            profile: input.profile,
            outfit: input.outfit.map(line).join("\n"),
            replace: line(input.replace),
            candidates: input.candidates.map(line).join("\n"),
          }),
        },
      ],
    };
  },
  mock(input) {
    const a = aliasesFor(input);
    const c = input.candidates[0];
    return {
      with_item_id: c ? a.alias(c.id) : "i0",
      note: "Mock: similar formality, different colour.",
    };
  },
  post(out, input) {
    const id = aliasesFor(input).resolve(out.with_item_id);
    // Only accept a real candidate; anything else counts as a hallucination.
    if (!id || !input.candidates.some((c) => c.id === id)) return null;
    return { with_item_id: id, note: out.note };
  },
};
