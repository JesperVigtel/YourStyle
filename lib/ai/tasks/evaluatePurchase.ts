import type { Item, PurchaseExtracted, PurchaseVerdict } from "@/lib/types";
import { clamp, IdAliases, summarizeWardrobe, type WearStat } from "@/lib/domain/wardrobe";
import * as prompt from "../prompts/evaluatePurchase";
import { evaluatePurchaseSchema, type EvaluatePurchaseOutput } from "../schemas";
import type { TaskDef } from "../run";
import { imageBlocks, type ImageInput } from "./images";

export type EvaluateInput = {
  images: ImageInput[];
  kinds: string[];
  items: Item[];
  stats: Map<string, WearStat>;
  body: string;
  brandSizes: string;
  profile: string;
  /** Free-text hints: "vintage market", "online screenshot", etc. */
  hint: string;
  aliases?: IdAliases;
};

export type EvaluateResult = {
  extracted: PurchaseExtracted;
  verdict: PurchaseVerdict;
  hallucinated: number;
};

function aliasesFor(input: EvaluateInput) {
  return (input.aliases ??= new IdAliases(input.items.map((i) => i.id)));
}

export const evaluatePurchase: TaskDef<EvaluateInput, EvaluatePurchaseOutput, EvaluateResult> = {
  name: "evaluatePurchase",
  schema: evaluatePurchaseSchema,
  maxTokens: 6000,
  build(input) {
    const aliases = aliasesFor(input);
    return {
      system: prompt.system,
      content: [
        ...imageBlocks(input.images),
        {
          type: "text",
          text: prompt.user({
            kinds: input.kinds,
            hint: input.hint,
            body: input.body,
            brandSizes: input.brandSizes,
            profile: input.profile,
            wardrobe: input.items.length ? summarizeWardrobe(input.items, aliases, input.stats) : "(empty)",
          }),
        },
      ],
    };
  },
  mock(input) {
    const a = aliasesFor(input);
    const bottoms = input.items.filter((i) => i.category === "bottom");
    const shoes = input.items.filter((i) => i.category === "shoes");
    const tops = input.items.filter((i) => i.category === "top");
    const examples = [0, 1, 2]
      .map(
        (n) =>
          [bottoms[n % Math.max(1, bottoms.length)], shoes[n % Math.max(1, shoes.length)]].filter(Boolean) as Item[],
      )
      .filter((ids) => ids.length > 0)
      .map((its, n) => ({
        item_ids: [...its.map((i) => a.alias(i.id)), ...(n === 0 ? ["i9999"] : [])],
        note: "Mock outfit with the new piece.",
      }));
    const isVintage = input.hint.includes("vintage");
    return {
      extracted: {
        brand: "Acne Studios",
        size_label: "M",
        material: "100% wool",
        country_of_origin: "Portugal",
        price: 89,
        currency: "EUR",
        era: isVintage ? "1990s" : null,
        condition: isVintage ? "good, light pilling on cuffs" : null,
        category: "top",
        subcategory: "crewneck sweater",
        colors: [{ name: "charcoal", hex: "#3a3b3d", role: "primary" }],
        pattern: "solid",
        formality: 3,
        warmth: 4,
        seasons: ["autumn", "winter"],
      },
      fit: {
        prediction: "Your M tops have fit well; this M should fit, possibly slightly roomy in the body.",
        confidence: "medium",
        likely_verdict: "perfect",
      },
      outfit_gain: {
        count: Math.min(12, bottoms.length * Math.max(1, shoes.length)),
        examples,
      },
      overlap: tops.slice(0, 1).map((t) => ({
        item_id: a.alias(t.id),
        note: "Similar knit top already owned.",
      })),
      material_note: "100% wool: warm and breathable; hand wash or wool cycle.",
      price_sanity: isVintage
        ? {
            low: 30,
            high: 60,
            currency: "EUR",
            note: "Rough estimate for a used wool sweater.",
          }
        : null,
      verdict: examples.length >= 2 ? "buy" : "maybe",
      reason: "Mock verdict: works with several bottoms you own and fills a gap in warm layers.",
    };
  },
  post(out, input) {
    const a = aliasesFor(input);
    let hallucinated = 0;
    const resolveAll = (ids: string[]) =>
      ids.flatMap((x) => {
        const id = a.resolve(x);
        if (!id) hallucinated++;
        return id ? [id] : [];
      });
    const examples = out.outfit_gain.examples
      .map((e) => ({
        item_ids: [...new Set(resolveAll(e.item_ids))],
        note: e.note,
      }))
      .filter((e) => e.item_ids.length > 0)
      .slice(0, 3);
    const overlap = out.overlap.flatMap((o) => {
      const [id] = resolveAll([o.item_id]);
      return id ? [{ item_id: id, note: o.note }] : [];
    });
    const x = out.extracted;
    return {
      extracted: {
        ...x,
        formality: clamp(x.formality, 1, 5),
        warmth: clamp(x.warmth, 1, 5),
        seasons: [...new Set(x.seasons)],
      },
      verdict: {
        fit: out.fit,
        outfit_gain: {
          count: Math.max(examples.length, Math.max(0, Math.round(out.outfit_gain.count))),
          examples,
        },
        overlap,
        material_note: out.material_note,
        price_sanity: out.price_sanity,
        verdict: out.verdict,
        reason: out.reason,
      },
      hallucinated,
    };
  },
};
