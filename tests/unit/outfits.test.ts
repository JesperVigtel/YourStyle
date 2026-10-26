import { describe, expect, it } from "vitest";
import { dislikedSets, filterOutfits, type RawOutfit } from "@/lib/domain/outfits";
import { IdAliases, itemSetKey } from "@/lib/domain/wardrobe";

const aliases = new IdAliases(["t1", "t2", "b1", "b2", "s1"]); // i1..i5
const o = (ids: string[], swap: RawOutfit["swap"] = null): RawOutfit => ({ item_ids: ids, rationale: " ok ", swap });
const base = { aliases, excluded: new Set<string>(), disliked: new Set<string>(), max: 3 };

describe("filterOutfits — hallucination filter", () => {
  it("maps aliases to real ids and drops ids that don't exist", () => {
    const { outfits, report } = filterOutfits([o(["i1", "i3", "i5", "i99", "uuid-made-up"])], base);
    expect(outfits).toHaveLength(1);
    expect(outfits[0].item_ids).toEqual(["t1", "b1", "s1"]);
    expect(outfits[0].rationale).toBe("ok");
    expect(report.hallucinated).toBe(2);
  });

  it("drops an outfit left with fewer than two real items", () => {
    const { outfits } = filterOutfits([o(["i1", "i98", "i99"])], base);
    expect(outfits).toHaveLength(0);
  });

  it("de-duplicates repeated ids within an outfit", () => {
    const { outfits } = filterOutfits([o(["i1", "i1", "i3"])], base);
    expect(outfits[0].item_ids).toEqual(["t1", "b1"]);
  });
});

describe("filterOutfits — business rules", () => {
  it("drops outfits that use excluded (recently worn) items", () => {
    const { outfits, report } = filterOutfits([o(["i1", "i3"]), o(["i2", "i4"])], { ...base, excluded: new Set(["t1"]) });
    expect(outfits.map((x) => x.item_ids)).toEqual([["t2", "b2"]]);
    expect(report.droppedExcluded).toBe(1);
  });

  it("never returns a disliked combination unchanged, in any order", () => {
    const disliked = new Set([itemSetKey(["b1", "t1"])]);
    const { outfits, report } = filterOutfits([o(["i3", "i1"]), o(["i1", "i3", "i5"])], { ...base, disliked });
    expect(outfits.map((x) => x.item_ids)).toEqual([["t1", "b1", "s1"]]); // a superset is a different outfit
    expect(report.droppedDisliked).toBe(1);
  });

  it("removes duplicate outfits and respects max", () => {
    const { outfits, report } = filterOutfits([o(["i1", "i3"]), o(["i3", "i1"]), o(["i2", "i3"]), o(["i2", "i4"])], { ...base, max: 2 });
    expect(outfits).toHaveLength(2);
    expect(report.duplicates).toBe(1);
  });
});

describe("filterOutfits — swap suggestion", () => {
  it("keeps a valid swap with real ids", () => {
    const { outfits } = filterOutfits([o(["i1", "i3"], { replace_item_id: "i1", with_item_id: "i2", note: "n" })], base);
    expect(outfits[0].swap).toEqual({ replace_item_id: "t1", with_item_id: "t2", note: "n" });
  });
  it.each([
    ["unknown replacement", { replace_item_id: "i1", with_item_id: "i77", note: "" }],
    ["replaces an item not in the outfit", { replace_item_id: "i2", with_item_id: "i4", note: "" }],
    ["replacement already in outfit", { replace_item_id: "i1", with_item_id: "i3", note: "" }],
  ])("nulls an invalid swap (%s)", (_, swap) => {
    const { outfits } = filterOutfits([o(["i1", "i3"], swap)], base);
    expect(outfits[0].swap).toBeNull();
  });
  it("nulls a swap that would produce a disliked combination", () => {
    const disliked = new Set([itemSetKey(["t2", "b1"])]);
    const { outfits } = filterOutfits([o(["i1", "i3"], { replace_item_id: "i1", with_item_id: "i2", note: "" })], { ...base, disliked });
    expect(outfits[0].swap).toBeNull();
  });
});

describe("dislikedSets", () => {
  it("collects 👎 combinations of two or more items", () => {
    const s = dislikedSets([
      { rating: -1, item_ids: ["a", "b"] },
      { rating: 1, item_ids: ["c", "d"] },
      { rating: -1, item_ids: ["e"] },
    ]);
    expect([...s]).toEqual([itemSetKey(["a", "b"])]);
  });
});
