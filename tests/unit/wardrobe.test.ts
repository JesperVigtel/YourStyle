import { describe, expect, it } from "vitest";
import {
  addDays,
  clamp,
  IdAliases,
  itemSetKey,
  recentlyWornIds,
  summarizeItem,
  wearStats,
} from "@/lib/domain/wardrobe";
import { makeItem } from "./fixtures";

describe("wearStats (derived from wear_log)", () => {
  it("counts wears and finds the last worn date", () => {
    const stats = wearStats([
      { date: "2026-10-01", item_ids: ["a", "b"] },
      { date: "2026-10-05", item_ids: ["a"] },
      { date: "2026-10-03", item_ids: ["a", "a"] }, // duplicate id in one log counts once
    ]);
    expect(stats.get("a")).toEqual({ count: 3, lastWorn: "2026-10-05" });
    expect(stats.get("b")).toEqual({ count: 1, lastWorn: "2026-10-01" });
    expect(stats.get("c")).toBeUndefined();
  });
});

describe("recentlyWornIds", () => {
  const logs = [
    { date: "2026-10-26", item_ids: ["today"] },
    { date: "2026-10-23", item_ids: ["three-days-ago"] },
    { date: "2026-10-22", item_ids: ["four-days-ago"] },
    { date: "2026-10-27", item_ids: ["future"] },
  ];
  it("includes today and the previous N days only", () => {
    expect([...recentlyWornIds(logs, "2026-10-26", 3)].sort()).toEqual(["three-days-ago", "today"]);
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("itemSetKey", () => {
  it("is order-independent and ignores duplicates", () => {
    expect(itemSetKey(["b", "a", "b"])).toBe(itemSetKey(["a", "b"]));
  });
});

describe("IdAliases", () => {
  const a = new IdAliases(["uuid-1", "uuid-2"]);
  it("maps aliases both ways", () => {
    expect(a.alias("uuid-2")).toBe("i2");
    expect(a.resolve("i1")).toBe("uuid-1");
    expect(a.resolve(" i2 ")).toBe("uuid-2");
  });
  it("accepts a known real id and rejects unknown ids", () => {
    expect(a.resolve("uuid-1")).toBe("uuid-1");
    expect(a.resolve("i3")).toBeNull();
    expect(a.resolve("uuid-9")).toBeNull();
  });
});

describe("summarizeItem", () => {
  it("is a compact single line with wear info", () => {
    const line = summarizeItem(makeItem({ brand: "COS", is_reference: true, size_label: "M" }), "i4", {
      count: 2,
      lastWorn: "2026-10-20",
    });
    expect(line).toContain("i4 | top/t-shirt | white");
    expect(line).toContain("COS");
    expect(line).toContain("REFERENCE FIT");
    expect(line).toContain("worn 2x, last 2026-10-20");
    expect(line).not.toContain("\n");
  });
});

describe("clamp", () => {
  it("rounds and bounds, passing null through", () => {
    expect(clamp(7, 1, 5)).toBe(5);
    expect(clamp(0.4, 1, 5)).toBe(1);
    expect(clamp(3.6, 1, 5)).toBe(4);
    expect(clamp(null, 1, 5)).toBeNull();
  });
});
