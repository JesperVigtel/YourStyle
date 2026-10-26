import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { isoDate } from "@/lib/server/schemas";
import { suggest } from "@/lib/server/suggest";

export const maxDuration = 60;

const weather = z
  .object({
    temp_c: z.number().nullable(),
    temp_min_c: z.number().nullable().optional(),
    temp_max_c: z.number().nullable().optional(),
    precipitation_mm: z.number().nullable().optional(),
    rain_chance: z.number().nullable().optional(),
    wind_kmh: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    overridden: z.boolean().optional(),
  })
  .nullable();

const body = z.object({
  mood: z.string().min(1),
  occasion: z.string().max(200).nullable(),
  weather,
  includeRecent: z.boolean().default(false),
  today: isoDate,
});

export const POST = route(async (ctx, req) => suggest(ctx, await parseBody(req, body)));
