// Storage-agnostic table access. Two implementations: LocalRepo (JSON file, dev/tests)
// and SupabaseRepo (Postgres with RLS). Domain code only talks to this interface.

export const TABLES = [
  "items",
  "outfits",
  "wear_log",
  "feedback",
  "style_profile",
  "body_profile",
  "moods",
  "scans",
  "ai_calls",
  "brand_sizes",
] as const;
export type TableName = (typeof TABLES)[number];

type Scalar = string | number | boolean | null;

export type Query = {
  eq?: Record<string, Scalar>;
  gte?: Record<string, string | number>;
  gt?: Record<string, string | number>;
  in?: { column: string; values: Scalar[] };
  order?: { column: string; ascending?: boolean };
  limit?: number;
};

export type Row = { id: string; created_at: string } & Record<string, unknown>;

export interface Repo {
  list<T extends Row>(table: TableName, query?: Query): Promise<T[]>;
  get<T extends Row>(table: TableName, id: string): Promise<T | null>;
  insert<T extends Row>(table: TableName, row: Partial<T>): Promise<T>;
  update<T extends Row>(table: TableName, id: string, patch: Partial<T>): Promise<T>;
  remove(table: TableName, id: string): Promise<void>;
  count(table: TableName, query?: Query): Promise<number>;
}

/** Column defaults, mirrored from supabase/migrations so both backends return identical rows. */
export const DEFAULTS: Record<TableName, Record<string, unknown>> = {
  items: {
    status: "owned",
    photo_url: null,
    cutout_url: null,
    label_photo_urls: [],
    category: "other",
    subcategory: null,
    colors: [],
    pattern: null,
    material: null,
    formality: null,
    warmth: null,
    seasons: [],
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
    user_verified: false,
    capture_seconds: null,
  },
  outfits: { item_ids: [], context: {}, origin: "manual", rationale: null },
  wear_log: { outfit_id: null, item_ids: [], photo_url: null, notes: null },
  feedback: {
    outfit_id: null,
    item_ids: [],
    rating: 0,
    reason_tags: [],
    comment: null,
  },
  style_profile: {
    summary: "",
    summary_source: "ai",
    hard_rules: [],
    soft_preferences: [],
    diff: null,
    generated_from_feedback_until: null,
    edited_by_user: false,
  },
  body_profile: {
    height_cm: null,
    weight_kg: null,
    measurements: {},
    shape_notes: null,
    fit_preferences: null,
    style_goals: null,
  },
  moods: { description: "", sort: 0 },
  scans: {
    photo_urls: [],
    photo_kinds: [],
    cutout_url: null,
    extracted: null,
    verdict: null,
    status: "pending",
    error: null,
    source: null,
    location_text: null,
    price: null,
    currency: null,
    decision: "undecided",
    saved_as: null,
    item_id: null,
    latency_ms: null,
    eval_started_at: null,
  },
  ai_calls: {
    input_tokens: 0,
    output_tokens: 0,
    est_cost_usd: 0,
    latency_ms: null,
    ok: true,
  },
  brand_sizes: {
    garment_type: null,
    fit_verdict: null,
    notes: null,
    item_id: null,
  },
};

/** Pure query evaluation, shared by LocalRepo and the unit tests. */
export function applyQuery<T extends Record<string, unknown>>(rows: T[], q: Query = {}): T[] {
  let out = rows.filter((r) => {
    for (const [k, v] of Object.entries(q.eq ?? {})) if ((r[k] ?? null) !== v) return false;
    for (const [k, v] of Object.entries(q.gte ?? {})) if (!((r[k] as string | number) >= v)) return false;
    for (const [k, v] of Object.entries(q.gt ?? {})) if (!((r[k] as string | number) > v)) return false;
    if (q.in && !q.in.values.includes((r[q.in.column] ?? null) as Scalar)) return false;
    return true;
  });
  if (q.order) {
    const { column, ascending = true } = q.order;
    out = [...out].sort((a, b) => {
      const av = a[column] as string | number;
      const bv = b[column] as string | number;
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
    });
  }
  if (q.limit !== undefined) out = out.slice(0, q.limit);
  return out;
}

/** Insert with an id that already exists (Postgres unique violation 23505). */
export class ConflictError extends Error {
  constructor(table: string, detail = "") {
    super(`${table}: duplicate key ${detail}`.trim());
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(table: string, id: string) {
    super(`${table} ${id} not found`);
    this.name = "NotFoundError";
  }
}
