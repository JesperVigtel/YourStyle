import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import type { Row } from "@/lib/data/repo";
import { getBody } from "@/lib/data/services";
import type { BodyProfile } from "@/lib/types";

export const GET = route(async ({ repo }) => ({ body: await getBody(repo) }));

const num = z.number().positive().max(400).nullable();
const body = z.object({
  height_cm: num,
  weight_kg: num,
  measurements: z.record(z.string(), num),
  shape_notes: z.string().max(2000).nullable(),
  fit_preferences: z.string().max(2000).nullable(),
  style_goals: z.string().max(2000).nullable(),
});

export const PUT = route(async ({ repo }, req) => {
  const b = await parseBody(req, body);
  const current = await getBody(repo);
  const row = { ...b, updated_at: new Date().toISOString() };
  const saved = current
    ? await repo.update<BodyProfile & Row>("body_profile", current.id, row)
    : await repo.insert<BodyProfile & Row>("body_profile", row);
  return { body: saved };
});
