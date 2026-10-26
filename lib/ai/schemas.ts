import { z } from "zod";
import { CATEGORIES, FIT_VERDICTS, SEASONS } from "@/lib/types";

// Response schemas for every AI task. These double as the JSON schema sent to the model
// (structured outputs) and as the validator for what comes back. Keep them transform-free
// and give every property a value (nullable instead of optional) so they convert cleanly.
// Numeric ranges are described rather than enforced; post-processing clamps them.

const color = z.object({
  name: z.string().describe("Plain colour name, e.g. 'navy', 'off-white', 'olive'"),
  hex: z.string().describe("Hex colour like #1f2a44"),
  role: z.enum(["primary", "secondary"]),
});

const conf = z.number().describe("Confidence 0..1 that this field is correct");

export const tagItemSchema = z.object({
  category: z.enum(CATEGORIES),
  subcategory: z.string().nullable().describe("e.g. 't-shirt', 'chinos', 'chelsea boots'"),
  colors: z.array(color).describe("1–3 colours, primary first"),
  pattern: z.string().nullable().describe("solid, striped, check, floral, graphic, …"),
  material: z.string().nullable().describe("Best guess, or exact composition if a care label is visible"),
  formality: z.number().describe("1 = loungewear … 5 = formal"),
  warmth: z.number().describe("1 = very light/summer … 5 = heavy winter"),
  seasons: z.array(z.enum(SEASONS)),
  brand: z.string().nullable().describe("Only if readable on a label or clearly identifiable"),
  size_label: z.string().nullable().describe("Exactly as printed on the size label, else null"),
  notes: z.string().nullable().describe("Anything notable: fit, details, condition. Short."),
  confidence: z.object({
    category: conf,
    subcategory: conf,
    colors: conf,
    pattern: conf,
    material: conf,
    formality: conf,
    warmth: conf,
    seasons: conf,
    brand: conf,
    size_label: conf,
  }),
});
export type TagItemOutput = z.infer<typeof tagItemSchema>;

export const suggestOutfitsSchema = z.object({
  outfits: z
    .array(
      z.object({
        item_ids: z.array(z.string()).describe("Item ids from the wardrobe list, e.g. ['i3','i12','i40']"),
        rationale: z.string().describe("One line: why this works for the mood, occasion and weather"),
        swap: z
          .object({
            replace_item_id: z.string(),
            with_item_id: z.string(),
            note: z.string(),
          })
          .nullable()
          .describe("Optional single-item alternative, or null"),
      }),
    )
    .describe("Exactly the requested number of distinct outfits"),
});
export type SuggestOutfitsOutput = z.infer<typeof suggestOutfitsSchema>;

export const swapItemSchema = z.object({
  with_item_id: z.string().describe("Id of the replacement item from the candidate list"),
  note: z.string().describe("One short line on why it works"),
});
export type SwapItemOutput = z.infer<typeof swapItemSchema>;

export const evaluatePurchaseSchema = z.object({
  extracted: z.object({
    brand: z.string().nullable(),
    size_label: z.string().nullable(),
    material: z.string().nullable().describe("Composition from the care label, e.g. '80% wool, 20% polyamide'"),
    country_of_origin: z.string().nullable(),
    price: z.number().nullable(),
    currency: z.string().nullable().describe("ISO code, e.g. EUR"),
    era: z.string().nullable().describe("Vintage only: estimated decade/era, else null"),
    condition: z.string().nullable().describe("Vintage only: visible condition, else null"),
    category: z.enum(CATEGORIES),
    subcategory: z.string().nullable(),
    colors: z.array(color),
    pattern: z.string().nullable(),
    formality: z.number().describe("1–5"),
    warmth: z.number().describe("1–5"),
    seasons: z.array(z.enum(SEASONS)),
  }),
  fit: z.object({
    prediction: z.string().describe("Plain answer, referencing my history with this brand/size if any"),
    confidence: z.enum(["low", "medium", "high"]),
    likely_verdict: z.enum(FIT_VERDICTS).nullable(),
  }),
  outfit_gain: z.object({
    count: z.number().describe("How many concrete new outfits this enables with items I own"),
    examples: z
      .array(
        z.object({
          item_ids: z.array(z.string()).describe("Owned item ids worn WITH the new piece"),
          note: z.string(),
        }),
      )
      .describe("2–3 example outfits"),
  }),
  overlap: z
    .array(z.object({ item_id: z.string(), note: z.string() }))
    .describe("Owned items that are similar to this piece (possible duplicates). Empty if none."),
  material_note: z.string().describe("Quality/material note, e.g. '100% wool, good for winter'"),
  price_sanity: z
    .object({
      low: z.number(),
      high: z.number(),
      currency: z.string(),
      note: z.string(),
    })
    .nullable()
    .describe("Vintage/second-hand only: rough fair-price range. Null otherwise."),
  verdict: z.enum(["buy", "maybe", "skip"]),
  reason: z.string().describe("2–3 sentences"),
});
export type EvaluatePurchaseOutput = z.infer<typeof evaluatePurchaseSchema>;

export const updateStyleProfileSchema = z.object({
  summary: z.string().describe("3–5 sentences describing my taste as learned so far"),
  hard_rules: z.array(z.string()).describe("Things to never/always do, only with clear evidence"),
  soft_preferences: z.array(z.string()).describe("Tendencies and likes, phrased as preferences"),
  diff: z.string().describe("What changed compared to the current profile, and why"),
});
export type UpdateStyleProfileOutput = z.infer<typeof updateStyleProfileSchema>;
