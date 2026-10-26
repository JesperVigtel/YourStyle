import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { route, BadRequestError } from "@/lib/api";
import { env } from "@/lib/env";
import type { Row } from "@/lib/data/repo";
import { addDays } from "@/lib/domain/wardrobe";
import { garmentSvg, SEED_ITEMS } from "@/lib/server/devSeed";
import { imageUrl } from "@/lib/storage";
import type { Item } from "@/lib/types";

/**
 * Dev mode only. POST /api/dev/seed?reset=1&count=19&wear=1
 *  - reset: wipe the local database first
 *  - count: how many fixture items to add (default all)
 *  - wear:  also log yesterday's outfit (white tee + jeans + sneakers)
 */
export const POST = route(async ({ repo, store }, req) => {
  if (!env.authBypass) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const q = new URL(req.url).searchParams;
  if (q.get("reset") === "1") await fs.rm(path.join(env.localDataDir, "db.json"), { force: true });
  const count = Math.min(SEED_ITEMS.length, Number(q.get("count") ?? SEED_ITEMS.length));
  if (!Number.isFinite(count) || count < 0) throw new BadRequestError("Invalid count");

  const created: Item[] = [];
  for (const seed of SEED_ITEMS.slice(0, count)) {
    const id = randomUUID();
    const photoKey = `uploads/seed-${id}-photo.svg`;
    const cutoutKey = `uploads/seed-${id}-cutout.svg`;
    await store.put(photoKey, new TextEncoder().encode(garmentSvg(seed, false)), "image/svg+xml");
    await store.put(cutoutKey, new TextEncoder().encode(garmentSvg(seed, true)), "image/svg+xml");
    const { shape, ...fields } = seed;
    void shape;
    created.push(
      await repo.insert<Item & Row>("items", {
        ...fields,
        id,
        status: "owned",
        photo_url: imageUrl(photoKey),
        cutout_url: imageUrl(cutoutKey),
        user_verified: true,
        source: "store",
      }),
    );
  }

  if (q.get("wear") === "1" && created.length >= 15) {
    const today = q.get("today") ?? new Date().toISOString().slice(0, 10);
    await repo.insert("wear_log", {
      date: addDays(today, -1),
      item_ids: [created[0].id, created[6].id, created[14].id],
    });
  }
  return { created: created.length };
});
