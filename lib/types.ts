// Shared domain types, used by both client and server code.

export const ITEM_STATUSES = ["owned", "wishlist", "considered", "passed", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CATEGORIES = ["top", "bottom", "one-piece", "outerwear", "shoes", "accessory", "bag", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const FIT_VERDICTS = ["too small", "slightly small", "perfect", "slightly big", "too big"] as const;
export type FitVerdict = (typeof FIT_VERDICTS)[number];

export const SOURCES = ["store", "vintage", "online", "gift", "other"] as const;
export type ItemSource = (typeof SOURCES)[number];

export type ItemColor = {
  name: string;
  hex: string;
  role: "primary" | "secondary";
};

/** Fields the AI fills in and reports a confidence for. */
export const TAGGED_FIELDS = [
  "category",
  "subcategory",
  "colors",
  "pattern",
  "material",
  "formality",
  "warmth",
  "seasons",
  "brand",
  "size_label",
] as const;
export type TaggedField = (typeof TAGGED_FIELDS)[number];

export type Item = {
  id: string;
  status: ItemStatus;
  photo_url: string | null;
  cutout_url: string | null;
  label_photo_urls: string[];
  category: Category;
  subcategory: string | null;
  colors: ItemColor[];
  pattern: string | null;
  material: string | null;
  formality: number | null; // 1–5
  warmth: number | null; // 1–5
  seasons: Season[];
  brand: string | null;
  size_label: string | null;
  fit_verdict: FitVerdict | null;
  fit_notes: string | null;
  /** Phase 5: per-area fit, e.g. { shoulders: "perfect", length: "slightly big" }. */
  fit_areas: Record<string, FitVerdict> | null;
  /** Reference garment: "this fits perfectly", used in fit predictions. */
  is_reference: boolean;
  price: number | null;
  currency: string | null;
  acquired_date: string | null; // YYYY-MM-DD
  source: ItemSource | null;
  notes: string | null;
  ai_raw: unknown;
  user_verified: boolean;
  created_at: string;
  /** Seconds from capture start to save (PRD metric). */
  capture_seconds: number | null;
};

export type BodyProfile = {
  height_cm: number | null;
  weight_kg: number | null;
  measurements: Record<string, number | null>;
  shape_notes: string | null;
  fit_preferences: string | null;
  style_goals: string | null;
  updated_at?: string;
};

export type BrandSize = {
  id: string;
  brand: string;
  size_label: string;
  garment_type: string | null;
  fit_verdict: FitVerdict | null;
  notes: string | null;
  item_id: string | null;
  created_at: string;
};

export type WeatherSnapshot = {
  temp_c: number | null;
  temp_min_c?: number | null;
  temp_max_c?: number | null;
  precipitation_mm?: number | null;
  rain_chance?: number | null;
  wind_kmh?: number | null;
  description?: string | null;
  overridden?: boolean;
};

export type OutfitContext = {
  mood?: string | null;
  occasion?: string | null;
  weather?: WeatherSnapshot | null;
};

export type OutfitOrigin = "suggested" | "manual" | "logged";

export type Outfit = {
  id: string;
  item_ids: string[];
  context: OutfitContext;
  origin: OutfitOrigin;
  rationale: string | null;
  created_at: string;
};

export type WearLog = {
  id: string;
  date: string; // YYYY-MM-DD
  outfit_id: string | null;
  item_ids: string[];
  photo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type Rating = -1 | 0 | 1;

export type Feedback = {
  id: string;
  outfit_id: string | null;
  item_ids: string[];
  rating: Rating;
  reason_tags: string[];
  comment: string | null;
  created_at: string;
};

export type ProfileEntry = {
  text: string;
  source: "ai" | "user";
  removed?: boolean;
};

export type StyleProfile = {
  id: string;
  summary: string;
  summary_source: "ai" | "user";
  hard_rules: ProfileEntry[];
  soft_preferences: ProfileEntry[];
  diff: string | null;
  generated_from_feedback_until: string | null;
  edited_by_user: boolean;
  created_at: string;
};

export type Mood = {
  id: string;
  name: string;
  description: string;
  sort: number;
  created_at: string;
};

export type ScanDecision = "bought" | "skipped" | "undecided";

export type Scan = {
  id: string;
  photo_urls: string[];
  /** Step label for each photo, same order as photo_urls. */
  photo_kinds: ScanPhotoKind[];
  cutout_url: string | null;
  extracted: PurchaseExtracted | null;
  verdict: PurchaseVerdict | null;
  status: "pending" | "done" | "error";
  error: string | null;
  source: ItemSource | null;
  location_text: string | null;
  price: number | null;
  currency: string | null;
  decision: ScanDecision;
  saved_as: "considered" | "wishlist" | null;
  item_id: string | null;
  latency_ms: number | null;
  eval_started_at: string | null;
  created_at: string;
};

export const SCAN_STEPS = ["garment", "brand", "care", "price"] as const;
export type ScanPhotoKind = (typeof SCAN_STEPS)[number] | "screenshot";

export type PurchaseExtracted = {
  brand: string | null;
  size_label: string | null;
  material: string | null;
  country_of_origin: string | null;
  price: number | null;
  currency: string | null;
  era: string | null;
  condition: string | null;
  category: Category;
  subcategory: string | null;
  colors: ItemColor[];
  pattern: string | null;
  formality: number | null;
  warmth: number | null;
  seasons: Season[];
};

export type PurchaseVerdict = {
  fit: {
    prediction: string;
    confidence: "low" | "medium" | "high";
    likely_verdict: FitVerdict | null;
  };
  outfit_gain: {
    count: number;
    examples: { item_ids: string[]; note: string }[];
  };
  overlap: { item_id: string; note: string }[];
  material_note: string;
  price_sanity: {
    low: number;
    high: number;
    currency: string;
    note: string;
  } | null;
  verdict: "buy" | "maybe" | "skip";
  reason: string;
};

export type AiCall = {
  id: string;
  task: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  est_cost_usd: number;
  latency_ms: number | null;
  ok: boolean;
  created_at: string;
};

export type SuggestedOutfit = {
  outfit_id: string;
  item_ids: string[];
  rationale: string;
  swap: { replace_item_id: string; with_item_id: string; note: string } | null;
};

export const REASON_TAGS_NEGATIVE = [
  "too formal",
  "too casual",
  "colours clash",
  "wrong for weather",
  "not me",
] as const;
export const REASON_TAGS_POSITIVE = ["love it", "comfortable", "great colours", "fits the occasion"] as const;

export const OCCASION_CHIPS = ["uni", "dinner", "party", "travel", "sport"] as const;

export const DEFAULT_MOODS: { name: string; description: string }[] = [
  {
    name: "everyday",
    description: "Easy, reliable, put-together without effort.",
  },
  {
    name: "experimental",
    description: "Try unexpected combinations and pieces I rarely wear together.",
  },
  {
    name: "party",
    description: "Stand out a bit: statement pieces, more contrast, evening-ready.",
  },
  {
    name: "alternative",
    description: "Darker, edgier, subcultural references; layered and textured.",
  },
  {
    name: "smart/formal",
    description: "Sharp and polished: tailoring, clean lines, higher formality.",
  },
  {
    name: "comfy",
    description: "Soft fabrics, relaxed fits, minimal structure. Comfort first.",
  },
];

/** Minimum owned items before outfit suggestions are offered (PRD R4). */
export const MIN_ITEMS_FOR_SUGGESTIONS = 15;
/** Items worn within this many days are avoided in suggestions (PRD R4). */
export const RECENT_WEAR_DAYS = 3;
/** Feedback events between automatic style-profile regenerations (PRD R5). */
export const PROFILE_REGEN_EVERY = 10;
/** AI field confidence below this is highlighted for review. */
export const LOW_CONFIDENCE = 0.6;
