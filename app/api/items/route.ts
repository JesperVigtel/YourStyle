import { route, parseBody } from "@/lib/api";
import { allWear, listItems } from "@/lib/data/services";
import { wearStats } from "@/lib/domain/wardrobe";
import { itemInput } from "@/lib/server/schemas";
import type { Item } from "@/lib/types";

/** All items with derived wear count / last worn. */
export const GET = route(async ({ repo }) => {
  const [items, wear] = await Promise.all([listItems(repo), allWear(repo)]);
  const stats = wearStats(wear);
  return {
    items: items.map((it) => ({
      ...it,
      wear_count: stats.get(it.id)?.count ?? 0,
      last_worn: stats.get(it.id)?.lastWorn ?? null,
    })),
  };
});

export const POST = route(async ({ repo }, req) => {
  const body = await parseBody(req, itemInput);
  const item = await repo.insert<Item & { id: string; created_at: string }>(
    "items",
    body as Partial<Item & { id: string; created_at: string }>,
  );
  return { item };
});
