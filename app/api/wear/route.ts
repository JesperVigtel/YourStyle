import { z } from "zod";
import { route, parseBody, BadRequestError } from "@/lib/api";
import { NotFoundError, type Row } from "@/lib/data/repo";
import { isoDate } from "@/lib/server/schemas";
import type { Outfit, WearLog } from "@/lib/types";

const body = z.object({
  outfit_id: z.string().nullable().default(null),
  item_ids: z.array(z.string()).default([]),
  date: isoDate,
  notes: z.string().max(500).nullable().default(null),
});

/** One-tap wear logging. */
export const POST = route(async ({ repo }, req) => {
  const b = await parseBody(req, body);
  let itemIds = b.item_ids;
  if (b.outfit_id) {
    const outfit = await repo.get<Outfit & Row>("outfits", b.outfit_id);
    if (!outfit) throw new NotFoundError("outfits", b.outfit_id);
    itemIds = outfit.item_ids;
  }
  if (!itemIds.length) throw new BadRequestError("Nothing to log");
  const wear = await repo.insert<WearLog & Row>("wear_log", {
    date: b.date,
    outfit_id: b.outfit_id,
    item_ids: itemIds,
    notes: b.notes,
  });
  return { wear };
});

export const DELETE = route(async ({ repo }, req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new BadRequestError("Missing id");
  await repo.remove("wear_log", id);
  return { ok: true };
});
