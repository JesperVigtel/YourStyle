import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import type { Row } from "@/lib/data/repo";
import { listMoods } from "@/lib/data/services";
import type { Mood } from "@/lib/types";

export const GET = route(async ({ repo }) => ({ moods: await listMoods(repo) }));

const body = z.object({
  moods: z
    .array(z.object({ id: z.string().optional(), name: z.string().min(1).max(40), description: z.string().max(300) }))
    .min(1)
    .max(20),
});

/** Replaces the mood list (order = sort). */
export const PUT = route(async ({ repo }, req) => {
  const b = await parseBody(req, body);
  const existing = await listMoods(repo);
  const keep = new Set(b.moods.map((m) => m.id).filter(Boolean));
  for (const m of existing) if (!keep.has(m.id)) await repo.remove("moods", m.id);
  for (const [sort, m] of b.moods.entries()) {
    if (m.id && existing.some((e) => e.id === m.id)) {
      await repo.update<Mood & Row>("moods", m.id, { name: m.name, description: m.description, sort });
    } else {
      await repo.insert<Mood & Row>("moods", { name: m.name, description: m.description, sort });
    }
  }
  return { moods: await listMoods(repo) };
});
