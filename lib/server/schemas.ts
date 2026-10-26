import { z } from "zod";
import { CATEGORIES, FIT_VERDICTS, ITEM_STATUSES, SEASONS, SOURCES } from "@/lib/types";

// Request body schemas for the API routes. No .default()s here: missing fields fall back to the
// column defaults (DB for Supabase, DEFAULTS for the local repo), and PATCH stays a true patch.

const color = z.object({
  name: z.string(),
  hex: z.string(),
  role: z.enum(["primary", "secondary"]),
});
const level = z.number().int().min(1).max(5).nullable();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const itemFields = z.object({
  status: z.enum(ITEM_STATUSES),
  photo_url: z.string().nullable(),
  cutout_url: z.string().nullable(),
  label_photo_urls: z.array(z.string()),
  category: z.enum(CATEGORIES),
  subcategory: z.string().nullable(),
  colors: z.array(color),
  pattern: z.string().nullable(),
  material: z.string().nullable(),
  formality: level,
  warmth: level,
  seasons: z.array(z.enum(SEASONS)),
  brand: z.string().nullable(),
  size_label: z.string().nullable(),
  fit_verdict: z.enum(FIT_VERDICTS).nullable(),
  fit_notes: z.string().nullable(),
  is_reference: z.boolean(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().max(8).nullable(),
  acquired_date: isoDate.nullable(),
  source: z.enum(SOURCES).nullable(),
  notes: z.string().nullable(),
  ai_raw: z.unknown(),
  user_verified: z.boolean(),
  capture_seconds: z.number().nonnegative().nullable(),
});

export const itemPatch = itemFields.partial();
export const itemInput = itemFields.partial().required({ category: true });
