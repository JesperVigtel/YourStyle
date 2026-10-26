import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/mock";
import { runTask, type TaskDef } from "@/lib/ai/run";
import { evaluatePurchaseSchema, suggestOutfitsSchema, tagItemSchema, updateStyleProfileSchema } from "@/lib/ai/schemas";
import { tagItem } from "@/lib/ai/tasks/tagItem";
import { suggestOutfits, type SuggestInput } from "@/lib/ai/tasks/suggestOutfits";
import { evaluatePurchase, type EvaluateInput } from "@/lib/ai/tasks/evaluatePurchase";
import { swapItem } from "@/lib/ai/tasks/swapItem";
import { updateStyleProfile } from "@/lib/ai/tasks/updateStyleProfile";
import { TAG_FIXTURES } from "@/lib/ai/fixtures/tagItem";
import { itemSetKey } from "@/lib/domain/wardrobe";
import { wardrobe } from "./fixtures";

const run = <I, O, R>(task: TaskDef<I, O, R>, input: I) => runTask({ provider: new MockProvider(), log: async () => {} }, task, input);
const img = { base64: Buffer.from("fake image bytes").toString("base64"), mediaType: "image/jpeg" as const };

function suggestInput(p: Partial<SuggestInput> = {}): SuggestInput {
  return {
    count: 3,
    items: wardrobe(),
    excluded: new Set(),
    stats: new Map(),
    mood: { name: "everyday", description: "easy" },
    occasion: "uni",
    weather: "12°C",
    profile: "(none)",
    body: "(none)",
    recentWear: [],
    feedback: [],
    disliked: new Set(),
    ...p,
  };
}

describe("fixtures validate against the response schemas", () => {
  it.each(TAG_FIXTURES.map((f, i) => [i, f]))("tagItem fixture %i", (_, f) => {
    expect(tagItemSchema.safeParse(f).success).toBe(true);
  });
  it("suggestOutfits / evaluatePurchase / updateStyleProfile mocks", () => {
    const si = suggestInput();
    expect(suggestOutfitsSchema.safeParse(suggestOutfits.mock(si)).success).toBe(true);
    const ei: EvaluateInput = { images: [img], kinds: ["garment"], items: wardrobe(), stats: new Map(), body: "", brandSizes: "", profile: "", hint: "vintage" };
    expect(evaluatePurchaseSchema.safeParse(evaluatePurchase.mock(ei)).success).toBe(true);
    const pi = { current: null, feedback: [], wear: "", body: "", reasonCounts: { "too formal": 3 } };
    expect(updateStyleProfileSchema.safeParse(updateStyleProfile.mock(pi)).success).toBe(true);
  });
});

describe("tagItem", () => {
  it("sends images before the instruction and clamps the output", async () => {
    const built = tagItem.build({ images: [img, img], kinds: ["garment", "label"] });
    expect(built.content.map((b) => b.type)).toEqual(["image", "image", "text"]);
    const out = tagItem.post({ ...TAG_FIXTURES[0], formality: 9, warmth: -2, colors: [{ name: "x", hex: "red", role: "primary" }], confidence: { ...TAG_FIXTURES[0].confidence, brand: 4 } }, { images: [], kinds: [] });
    expect(out.formality).toBe(5);
    expect(out.warmth).toBe(1);
    expect(out.colors[0].hex).toBe("#888888");
    expect(out.confidence.brand).toBe(1);
  });
  it("returns per-field confidence with at least one low-confidence field in fixtures", async () => {
    const out = await run(tagItem, { images: [img], kinds: ["garment"] });
    expect(Object.keys(out.confidence)).toHaveLength(10);
    expect(TAG_FIXTURES.every((f) => Object.values(f.confidence).some((c) => c < 0.6))).toBe(true);
  });
});

describe("suggestOutfits", () => {
  it("only returns owned item ids (the mock injects a fake one)", async () => {
    const input = suggestInput();
    const owned = new Set(input.items.map((i) => i.id));
    const res = await run(suggestOutfits, input);
    expect(res.outfits).toHaveLength(3);
    expect(res.report.hallucinated).toBeGreaterThan(0);
    for (const o of res.outfits) for (const id of o.item_ids) expect(owned.has(id)).toBe(true);
  });

  it("sends aliases, not UUIDs, and lists disliked combinations", () => {
    const input = suggestInput({ disliked: new Set([itemSetKey(["top-a", "bot-a"])]) });
    const text = (suggestOutfits.build(input).content[0] as { text: string }).text;
    expect(text).toContain("i1 | top/t-shirt");
    expect(text).not.toContain("top-a");
    expect(text).toMatch(/Disliked combinations[^\n]*\n(i1 \+ i5|i5 \+ i1)/);
  });

  it("removes excluded and disliked outfits after the response", async () => {
    const input = suggestInput({ excluded: new Set(["top-a"]) });
    const res = await run(suggestOutfits, input);
    for (const o of res.outfits) expect(o.item_ids).not.toContain("top-a");
  });
});

describe("swapItem", () => {
  it("accepts only a candidate id", () => {
    const items = wardrobe();
    const input = { outfit: [items[0], items[4]], replace: items[0], candidates: [items[1], items[2]], stats: new Map(), context: "", profile: "" };
    swapItem.build(input);
    expect(swapItem.post({ with_item_id: "i3", note: "n" }, input)).toEqual({ with_item_id: "top-b", note: "n" });
    expect(swapItem.post({ with_item_id: "i2", note: "n" }, input)).toBeNull(); // in the outfit, not a candidate
    expect(swapItem.post({ with_item_id: "i42", note: "n" }, input)).toBeNull();
  });
});

describe("evaluatePurchase", () => {
  it("drops hallucinated ids from examples and overlap, keeps the count consistent", async () => {
    const input: EvaluateInput = { images: [img], kinds: ["garment"], items: wardrobe(), stats: new Map(), body: "", brandSizes: "", profile: "", hint: "" };
    const res = await run(evaluatePurchase, input);
    const owned = new Set(input.items.map((i) => i.id));
    expect(res.hallucinated).toBeGreaterThan(0);
    for (const ex of res.verdict.outfit_gain.examples) for (const id of ex.item_ids) expect(owned.has(id)).toBe(true);
    for (const o of res.verdict.overlap) expect(owned.has(o.item_id)).toBe(true);
    expect(res.verdict.outfit_gain.count).toBeGreaterThanOrEqual(res.verdict.outfit_gain.examples.length);
    expect(res.verdict.price_sanity).toBeNull(); // not vintage
  });

  it("post-processing handles a fully hallucinated answer", () => {
    const input: EvaluateInput = { images: [], kinds: [], items: wardrobe(), stats: new Map(), body: "", brandSizes: "", profile: "", hint: "" };
    evaluatePurchase.build(input);
    const raw = evaluatePurchase.mock(input);
    const out = evaluatePurchase.post({ ...raw, outfit_gain: { count: -3, examples: [{ item_ids: ["i500"], note: "" }] }, overlap: [{ item_id: "zzz", note: "" }] }, input);
    expect(out.verdict.outfit_gain).toEqual({ count: 0, examples: [] });
    expect(out.verdict.overlap).toEqual([]);
  });
});

describe("structured output schemas", () => {
  it.each([tagItem, suggestOutfits, swapItem, evaluatePurchase, updateStyleProfile])("$name converts to a strict JSON schema", async (task) => {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const schema = zodOutputFormat(task.schema).schema as { type: string; additionalProperties: boolean; required: string[] };
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.length).toBeGreaterThan(0);
  });
});
