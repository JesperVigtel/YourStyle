import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import type { Item } from "@/lib/types";
import type { Row } from "@/lib/data/repo";
import { getScan, itemFromScan, type ScanRow } from "@/lib/server/scans";

export const GET = route<{ id: string }>(async (ctx, _req, { id }) => {
  const scan = await getScan(ctx, id);
  const item = scan.item_id ? await ctx.repo.get<Item & Row>("items", scan.item_id) : null;
  return { scan, item };
});

const patch = z.object({
  saved_as: z.enum(["considered", "wishlist"]).nullable().optional(),
  decision: z.enum(["bought", "skipped", "undecided"]).optional(),
  cutout_url: z.string().nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
});

/**
 * Updates a scan. Saving as considered/wishlist also creates (or updates) a linked item with that
 * status, so it shows up in the wardrobe and "I bought it" later just flips it to owned.
 */
export const PATCH = route<{ id: string }>(async (ctx, req, { id }) => {
  const b = await parseBody(req, patch);
  let scan = await ctx.repo.update<ScanRow>("scans", id, b);
  if (b.saved_as) {
    if (scan.item_id) {
      await ctx.repo.update<Item & Row>("items", scan.item_id, { status: b.saved_as });
    } else {
      const item = await ctx.repo.insert<Item & Row>("items", { ...itemFromScan(scan), status: b.saved_as });
      scan = await ctx.repo.update<ScanRow>("scans", id, { item_id: item.id });
    }
  } else if (b.decision === "skipped" && scan.item_id) {
    await ctx.repo.update<Item & Row>("items", scan.item_id, { status: "passed" });
  } else if (b.cutout_url && scan.item_id) {
    await ctx.repo.update<Item & Row>("items", scan.item_id, { cutout_url: b.cutout_url });
  }
  return { scan };
});

export const DELETE = route<{ id: string }>(async (ctx, _req, { id }) => {
  await ctx.repo.remove("scans", id);
  return { ok: true };
});
