import { z } from "zod";
import { route, parseBody, BadRequestError } from "@/lib/api";
import type { Row } from "@/lib/data/repo";
import { listItems } from "@/lib/data/services";
import { isoDate } from "@/lib/server/schemas";
import type { Feedback, Outfit, WearLog } from "@/lib/types";

/** Outfit history with feedback and wear, newest first. `?rated=1` limits to rated outfits. */
export const GET = route(async ({ repo }, req) => {
  const rated = new URL(req.url).searchParams.get("rated") === "1";
  const [outfits, feedback, wear] = await Promise.all([
    repo.list<Outfit & Row>("outfits", { order: { column: "created_at", ascending: false }, limit: 300 }),
    repo.list<Feedback & Row>("feedback", { order: { column: "created_at", ascending: false } }),
    repo.list<WearLog & Row>("wear_log", {}),
  ]);
  const fbBy = new Map<string, Feedback>();
  for (const f of feedback) if (f.outfit_id && !fbBy.has(f.outfit_id)) fbBy.set(f.outfit_id, f);
  const wornBy = new Map<string, string>();
  for (const w of wear) if (w.outfit_id) wornBy.set(w.outfit_id, w.date);
  const rows = outfits
    .map((o) => ({ ...o, feedback: fbBy.get(o.id) ?? null, worn_on: wornBy.get(o.id) ?? null }))
    .filter((o) => !rated || o.feedback);
  return { outfits: rows };
});

const body = z.object({
  item_ids: z.array(z.string()).min(1),
  origin: z.enum(["manual", "logged"]).default("manual"),
  /** Also log it as worn on this date. */
  wear_date: isoDate.nullable().default(null),
  context: z.object({ mood: z.string().nullable().optional(), occasion: z.string().nullable().optional() }).default({}),
});

/** Manual outfit builder: save (and optionally log) a hand-picked outfit. */
export const POST = route(async ({ repo }, req) => {
  const b = await parseBody(req, body);
  const owned = new Set((await listItems(repo)).map((i) => i.id));
  const ids = [...new Set(b.item_ids)];
  if (ids.some((id) => !owned.has(id))) throw new BadRequestError("Unknown item in outfit");
  const outfit = await repo.insert<Outfit & Row>("outfits", {
    item_ids: ids,
    origin: b.origin,
    context: b.context,
    rationale: null,
  });
  const wear = b.wear_date
    ? await repo.insert<WearLog & Row>("wear_log", { date: b.wear_date, outfit_id: outfit.id, item_ids: ids })
    : null;
  return { outfit, wear };
});
