import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import type { Row } from "@/lib/data/repo";
import { isoDate } from "@/lib/server/schemas";
import { getScan, itemFromScan, type ScanRow } from "@/lib/server/scans";
import type { Item } from "@/lib/types";

const body = z.object({
  acquired_date: isoDate,
  price: z.number().nonnegative().nullable().optional(),
});

/** "I bought it": turns the scan into an owned item, reusing photos and extracted data. */
export const POST = route<{ id: string }>(async (ctx, req, { id }) => {
  const b = await parseBody(req, body);
  const scan = await getScan(ctx, id);
  const price = b.price !== undefined ? b.price : scan.price;
  const fields = { ...itemFromScan(scan), status: "owned" as const, acquired_date: b.acquired_date, price };
  const item = scan.item_id
    ? await ctx.repo.update<Item & Row>("items", scan.item_id, {
        status: "owned",
        acquired_date: b.acquired_date,
        price,
      })
    : await ctx.repo.insert<Item & Row>("items", fields);
  const updated = await ctx.repo.update<ScanRow>("scans", id, { decision: "bought", item_id: item.id, price });
  return { scan: updated, item };
});
