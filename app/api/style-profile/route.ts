import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import type { Row } from "@/lib/data/repo";
import { latestProfile } from "@/lib/data/services";
import { applyListEdit } from "@/lib/domain/profile";
import type { StyleProfile } from "@/lib/types";

export const GET = route(async ({ repo }) => ({ profile: await latestProfile(repo) }));

const entry = z.object({ text: z.string().max(500), source: z.enum(["ai", "user"]) });
const body = z.object({
  summary: z.string().max(4000),
  hard_rules: z.array(entry).max(50),
  soft_preferences: z.array(entry).max(50),
});

/** Saves my edits as a new version. Edited entries become mine and survive regeneration. */
export const PUT = route(async ({ repo }, req) => {
  const b = await parseBody(req, body);
  const current = await latestProfile(repo);
  const summaryChanged = (current?.summary ?? "").trim() !== b.summary.trim();
  const profile = await repo.insert<StyleProfile & Row>("style_profile", {
    summary: b.summary.trim(),
    // An empty summary is never "mine": leave it to the AI to fill in.
    summary_source: !b.summary.trim() ? "ai" : summaryChanged ? "user" : (current?.summary_source ?? "ai"),
    hard_rules: applyListEdit(current?.hard_rules ?? [], b.hard_rules),
    soft_preferences: applyListEdit(current?.soft_preferences ?? [], b.soft_preferences),
    diff: "Edited by me.",
    generated_from_feedback_until: current?.generated_from_feedback_until ?? null,
    edited_by_user: true,
  });
  return { profile };
});
