import { after } from "next/server";
import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { NotFoundError, type Row } from "@/lib/data/repo";
import { maybeRegenerateProfile } from "@/lib/server/profile";
import type { Feedback, Outfit } from "@/lib/types";

const body = z.object({
  outfit_id: z.string().nullable().default(null),
  item_ids: z.array(z.string()).default([]),
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  reason_tags: z.array(z.string().max(60)).max(10).default([]),
  comment: z.string().max(1000).nullable().default(null),
});

export const POST = route(async (ctx, req) => {
  const b = await parseBody(req, body);
  let itemIds = b.item_ids;
  if (b.outfit_id) {
    const outfit = await ctx.repo.get<Outfit & Row>("outfits", b.outfit_id);
    if (!outfit) throw new NotFoundError("outfits", b.outfit_id);
    itemIds = outfit.item_ids;
  }
  const feedback = await ctx.repo.insert<Feedback & Row>("feedback", { ...b, item_ids: itemIds });
  // Style profile regenerates every ~10 feedback events, after the response is sent.
  after(async () => {
    try {
      await maybeRegenerateProfile(ctx);
    } catch (e) {
      console.error("style profile regeneration failed", e);
    }
  });
  return { feedback };
});
