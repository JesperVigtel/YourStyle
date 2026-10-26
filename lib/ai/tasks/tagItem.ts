import { TAGGED_FIELDS, type TaggedField } from "@/lib/types";
import { clamp, clamp01 } from "@/lib/domain/wardrobe";
import * as prompt from "../prompts/tagItem";
import { tagItemSchema, type TagItemOutput } from "../schemas";
import type { TaskDef } from "../run";
import { hashString, imageBlocks, type ImageInput } from "./images";
import { TAG_FIXTURES } from "../fixtures/tagItem";

export type TagItemInput = { images: ImageInput[]; kinds: string[] };

export type TagItemResult = Omit<TagItemOutput, "confidence" | "formality" | "warmth"> & {
  formality: number | null;
  warmth: number | null;
  confidence: Record<TaggedField, number>;
};

const HEX = /^#[0-9a-f]{6}$/i;

export const tagItem: TaskDef<TagItemInput, TagItemOutput, TagItemResult> = {
  name: "tagItem",
  schema: tagItemSchema,
  maxTokens: 4000,
  build(input) {
    return {
      system: prompt.system,
      content: [...imageBlocks(input.images), { type: "text", text: prompt.user(input.kinds) }],
    };
  },
  mock(input) {
    return TAG_FIXTURES[hashString(input.images[0]?.base64 ?? "") % TAG_FIXTURES.length];
  },
  post(out) {
    const confidence = Object.fromEntries(TAGGED_FIELDS.map((f) => [f, clamp01(out.confidence[f])])) as Record<
      TaggedField,
      number
    >;
    return {
      ...out,
      formality: clamp(out.formality, 1, 5),
      warmth: clamp(out.warmth, 1, 5),
      seasons: [...new Set(out.seasons)],
      colors: out.colors.slice(0, 3).map((c) => ({
        ...c,
        hex: HEX.test(c.hex) ? c.hex.toLowerCase() : "#888888",
      })),
      brand: out.brand?.trim() || null,
      size_label: out.size_label?.trim() || null,
      confidence,
    };
  },
};
