import type { Item } from "@/lib/types";

let n = 0;
export function makeItem(p: Partial<Item> = {}): Item {
  n++;
  return {
    id: p.id ?? `item-${n}`,
    status: "owned",
    photo_url: null,
    cutout_url: null,
    label_photo_urls: [],
    category: "top",
    subcategory: "t-shirt",
    colors: [{ name: "white", hex: "#ffffff", role: "primary" }],
    pattern: "solid",
    material: "cotton",
    formality: 2,
    warmth: 2,
    seasons: ["summer"],
    brand: null,
    size_label: null,
    fit_verdict: null,
    fit_notes: null,
    fit_areas: null,
    is_reference: false,
    price: null,
    currency: null,
    acquired_date: null,
    source: null,
    notes: null,
    ai_raw: null,
    user_verified: true,
    created_at: "2026-10-01T00:00:00Z",
    capture_seconds: null,
    ...p,
  };
}

/** A small but complete wardrobe: 4 tops, 3 bottoms, 2 shoes, 1 outerwear. */
export function wardrobe(): Item[] {
  return [
    makeItem({ id: "top-a", category: "top" }),
    makeItem({ id: "top-b", category: "top", colors: [{ name: "black", hex: "#000000", role: "primary" }] }),
    makeItem({ id: "top-c", category: "top", subcategory: "sweater", warmth: 4 }),
    makeItem({ id: "top-d", category: "top", subcategory: "shirt", formality: 3 }),
    makeItem({ id: "bot-a", category: "bottom", subcategory: "jeans" }),
    makeItem({ id: "bot-b", category: "bottom", subcategory: "chinos" }),
    makeItem({ id: "bot-c", category: "bottom", subcategory: "trousers", formality: 4 }),
    makeItem({ id: "sho-a", category: "shoes", subcategory: "sneakers" }),
    makeItem({ id: "sho-b", category: "shoes", subcategory: "boots" }),
    makeItem({ id: "out-a", category: "outerwear", subcategory: "coat", warmth: 5 }),
  ];
}
