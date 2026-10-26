import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { isoDate } from "@/lib/server/schemas";
import { swap } from "@/lib/server/suggest";

export const maxDuration = 60;

const body = z.object({
  outfit_id: z.string(),
  replace_item_id: z.string(),
  with_item_id: z.string().optional(),
  today: isoDate,
  includeRecent: z.boolean().default(false),
});

export const POST = route(async (ctx, req) => swap(ctx, await parseBody(req, body)));
