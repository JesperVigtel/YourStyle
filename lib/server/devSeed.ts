import "server-only";
import type { Category, Item, ItemColor, Season } from "@/lib/types";

// Fixture wardrobe for local development, screenshots and e2e tests (dev mode only).
// Each garment gets a simple flat SVG "cutout" so collages look like the real thing.

const SHAPES: Record<string, string> = {
  tee: "M120 70 L170 50 Q200 80 230 50 L280 70 L340 130 L300 165 L280 145 L280 350 L120 350 L120 145 L100 165 L60 130 Z",
  sweater:
    "M115 70 L170 52 Q200 75 230 52 L285 70 L345 300 L305 310 L280 150 L280 350 L120 350 L120 150 L95 310 L55 300 Z",
  shirt:
    "M120 70 L175 50 L200 85 L225 50 L280 70 L340 290 L305 300 L280 150 L280 350 L120 350 L120 150 L95 300 L60 290 Z M200 85 L200 350",
  hoodie:
    "M115 80 L160 60 Q200 20 240 60 L285 80 L345 300 L305 310 L280 160 L280 350 L120 350 L120 160 L95 310 L55 300 Z",
  trousers: "M140 40 L260 40 L275 360 L215 360 L200 140 L185 360 L125 360 Z",
  shorts: "M135 110 L265 110 L285 270 L210 280 L200 190 L190 280 L115 270 Z",
  coat: "M115 60 L165 45 L200 120 L235 45 L285 60 L340 360 L300 365 L285 170 L285 370 L115 370 L115 170 L100 365 L60 360 Z",
  jacket:
    "M115 70 L165 50 L200 110 L235 50 L285 70 L340 280 L300 290 L285 160 L285 320 L115 320 L115 160 L100 290 L60 280 Z",
  sneakers: "M60 230 L150 200 L200 230 L330 250 Q350 270 340 290 L60 290 Z",
  boots: "M130 90 L210 90 L215 250 L320 270 Q345 290 335 310 L120 310 Z",
  derby: "M60 240 L170 215 L220 235 L330 255 Q350 275 340 290 L60 290 Z",
  scarf: "M150 60 L250 60 L250 300 L280 360 L230 360 L200 300 L170 360 L120 360 L150 300 Z",
  tote: "M110 150 L290 150 L310 350 L90 350 Z M150 150 Q150 70 200 70 Q250 70 250 150",
};

type SeedItem = {
  shape: keyof typeof SHAPES;
  category: Category;
  subcategory: string;
  colors: ItemColor[];
  pattern?: string;
  material: string;
  formality: number;
  warmth: number;
  seasons: Season[];
  brand?: string;
  size_label?: string;
  fit_verdict?: Item["fit_verdict"];
  is_reference?: boolean;
  price?: number;
};

const c = (name: string, hex: string, role: ItemColor["role"] = "primary"): ItemColor => ({ name, hex, role });
const ALL: Season[] = ["spring", "summer", "autumn", "winter"];
const MILD: Season[] = ["spring", "autumn"];
const COLD: Season[] = ["autumn", "winter"];

export const SEED_ITEMS: SeedItem[] = [
  {
    shape: "tee",
    category: "top",
    subcategory: "t-shirt",
    colors: [c("white", "#f4f4f2")],
    material: "cotton",
    formality: 2,
    warmth: 1,
    seasons: ["spring", "summer", "autumn"],
    brand: "Uniqlo",
    size_label: "M",
    fit_verdict: "perfect",
    is_reference: true,
    price: 15,
  },
  {
    shape: "tee",
    category: "top",
    subcategory: "t-shirt",
    colors: [c("black", "#1d1d1f")],
    material: "cotton",
    formality: 2,
    warmth: 1,
    seasons: ["spring", "summer", "autumn"],
    brand: "Uniqlo",
    size_label: "M",
    price: 15,
  },
  {
    shape: "shirt",
    category: "top",
    subcategory: "oxford shirt",
    colors: [c("light blue", "#a9c4e4")],
    material: "cotton oxford",
    formality: 3,
    warmth: 2,
    seasons: ALL,
    brand: "COS",
    size_label: "M",
    fit_verdict: "slightly big",
    price: 59,
  },
  {
    shape: "sweater",
    category: "top",
    subcategory: "knit sweater",
    colors: [c("forest green", "#2e4a3a")],
    pattern: "cable knit",
    material: "merino wool",
    formality: 3,
    warmth: 4,
    seasons: COLD,
    brand: "COS",
    size_label: "L",
    price: 89,
  },
  {
    shape: "hoodie",
    category: "top",
    subcategory: "hoodie",
    colors: [c("heather grey", "#9a9da1")],
    material: "cotton fleece",
    formality: 1,
    warmth: 3,
    seasons: [...MILD, "winter"],
    price: 45,
  },
  {
    shape: "tee",
    category: "top",
    subcategory: "breton top",
    colors: [c("ecru", "#efe8d8"), c("navy", "#1f2a44", "secondary")],
    pattern: "striped",
    material: "cotton",
    formality: 2,
    warmth: 2,
    seasons: ["spring", "summer", "autumn"],
    price: 39,
  },
  {
    shape: "trousers",
    category: "bottom",
    subcategory: "straight jeans",
    colors: [c("indigo", "#2c3e63")],
    material: "denim",
    formality: 2,
    warmth: 3,
    seasons: ALL,
    brand: "Levi's",
    size_label: "W32 L32",
    fit_verdict: "perfect",
    is_reference: true,
    price: 99,
  },
  {
    shape: "trousers",
    category: "bottom",
    subcategory: "tailored trousers",
    colors: [c("black", "#202022")],
    material: "wool blend",
    formality: 4,
    warmth: 3,
    seasons: ALL,
    size_label: "48",
    price: 120,
  },
  {
    shape: "trousers",
    category: "bottom",
    subcategory: "chinos",
    colors: [c("beige", "#cbb894")],
    material: "cotton twill",
    formality: 3,
    warmth: 2,
    seasons: ["spring", "summer", "autumn"],
    price: 49,
  },
  {
    shape: "trousers",
    category: "bottom",
    subcategory: "wool trousers",
    colors: [c("charcoal", "#4a4b4f")],
    material: "wool",
    formality: 4,
    warmth: 4,
    seasons: COLD,
    price: 140,
  },
  {
    shape: "shorts",
    category: "bottom",
    subcategory: "denim shorts",
    colors: [c("light blue", "#8fa9c9")],
    material: "denim",
    formality: 1,
    warmth: 1,
    seasons: ["summer"],
    price: 30,
  },
  {
    shape: "coat",
    category: "outerwear",
    subcategory: "wool overcoat",
    colors: [c("camel", "#b48a5a")],
    material: "wool blend",
    formality: 4,
    warmth: 5,
    seasons: COLD,
    price: 220,
  },
  {
    shape: "jacket",
    category: "outerwear",
    subcategory: "leather jacket",
    colors: [c("black", "#1b1b1c")],
    material: "leather",
    formality: 3,
    warmth: 3,
    seasons: MILD,
    price: 260,
  },
  {
    shape: "jacket",
    category: "outerwear",
    subcategory: "field jacket",
    colors: [c("olive", "#5d6440")],
    material: "cotton canvas",
    formality: 2,
    warmth: 3,
    seasons: MILD,
    price: 110,
  },
  {
    shape: "sneakers",
    category: "shoes",
    subcategory: "leather sneakers",
    colors: [c("white", "#f2f2ef"), c("green", "#2f6b3a", "secondary")],
    material: "leather",
    formality: 2,
    warmth: 2,
    seasons: ["spring", "summer", "autumn"],
    size_label: "43",
    price: 110,
  },
  {
    shape: "boots",
    category: "shoes",
    subcategory: "chelsea boots",
    colors: [c("brown", "#5b3a26")],
    material: "suede",
    formality: 3,
    warmth: 4,
    seasons: COLD,
    size_label: "43",
    price: 180,
  },
  {
    shape: "derby",
    category: "shoes",
    subcategory: "derby shoes",
    colors: [c("black", "#151516")],
    material: "leather",
    formality: 4,
    warmth: 2,
    seasons: ALL,
    size_label: "43",
    price: 150,
  },
  {
    shape: "scarf",
    category: "accessory",
    subcategory: "scarf",
    colors: [c("grey", "#8b8d90")],
    material: "wool",
    formality: 3,
    warmth: 4,
    seasons: COLD,
    price: 35,
  },
  {
    shape: "tote",
    category: "bag",
    subcategory: "tote bag",
    colors: [c("natural", "#e2d6bd")],
    material: "canvas",
    formality: 2,
    warmth: 1,
    seasons: ALL,
    price: 20,
  },
];

/** Flat garment illustration. `cutout` = transparent background, else a "photo" with a backdrop. */
export function garmentSvg(seed: SeedItem, cutout: boolean): string {
  const [primary, secondary] = seed.colors;
  const stripes =
    seed.pattern === "striped" && secondary
      ? `<pattern id="p" width="400" height="28" patternUnits="userSpaceOnUse"><rect width="400" height="28" fill="${primary.hex}"/><rect y="18" width="400" height="10" fill="${secondary.hex}"/></pattern>`
      : "";
  const fill = stripes ? "url(#p)" : primary.hex;
  const backdrop = cutout
    ? ""
    : `<rect width="400" height="400" fill="#d9d4cc"/><rect y="300" width="400" height="100" fill="#c9c2b8"/>`;
  const accent = secondary && !stripes ? `<circle cx="300" cy="275" r="10" fill="${secondary.hex}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><defs>${stripes}</defs>${backdrop}<path d="${SHAPES[seed.shape]}" fill="${fill}" stroke="rgba(0,0,0,0.25)" stroke-width="3" stroke-linejoin="round"/>${accent}</svg>`;
}
