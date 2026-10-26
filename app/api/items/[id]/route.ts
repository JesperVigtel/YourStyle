import { route, parseBody } from "@/lib/api";
import { NotFoundError } from "@/lib/data/repo";
import { allWear } from "@/lib/data/services";
import { itemPatch } from "@/lib/server/schemas";
import type { Item } from "@/lib/types";

type ItemRow = Item & { id: string; created_at: string };

export const GET = route<{ id: string }>(async ({ repo }, _req, { id }) => {
  const item = await repo.get<ItemRow>("items", id);
  if (!item) throw new NotFoundError("items", id);
  const wear = (await allWear(repo)).filter((w) => w.item_ids.includes(id));
  return { item, wear };
});

export const PATCH = route<{ id: string }>(async ({ repo }, req, { id }) => {
  const patch = await parseBody(req, itemPatch);
  const item = await repo.update<ItemRow>("items", id, patch as Partial<ItemRow>);
  return { item };
});

export const DELETE = route<{ id: string }>(async ({ repo }, _req, { id }) => {
  await repo.remove("items", id);
  return { ok: true };
});
