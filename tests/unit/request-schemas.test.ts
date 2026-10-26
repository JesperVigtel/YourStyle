import { describe, expect, it } from "vitest";
import { itemInput, itemPatch } from "@/lib/server/schemas";

describe("item request schemas", () => {
  it("PATCH is a true patch: nothing is added", () => {
    expect(itemPatch.parse({ brand: "COS" })).toEqual({ brand: "COS" });
  });
  it("create requires a category and validates ranges", () => {
    expect(itemInput.safeParse({}).success).toBe(false);
    expect(itemInput.safeParse({ category: "top", formality: 6 }).success).toBe(false);
    expect(itemInput.safeParse({ category: "top", acquired_date: "26/10/2026" }).success).toBe(false);
    expect(itemInput.parse({ category: "top", formality: 3 })).toEqual({ category: "top", formality: 3 });
  });
});
