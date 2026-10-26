import "server-only";
import type { Ctx } from "@/lib/auth";
import { ai } from "@/lib/ai";
import { updateStyleProfile } from "@/lib/ai/tasks/updateStyleProfile";
import type { Row } from "@/lib/data/repo";
import { allWear, bodyForPrompt, getBody, latestProfile, listItems } from "@/lib/data/services";
import { mergeGenerated } from "@/lib/domain/profile";
import { itemSetKey } from "@/lib/domain/wardrobe";
import { PROFILE_REGEN_EVERY, type Feedback, type Item, type StyleProfile } from "@/lib/types";

const describe = (ids: string[], byId: Map<string, Item>) =>
  ids
    .map((id) => byId.get(id))
    .filter((i): i is Item => !!i)
    .map((i) => `${i.colors[0]?.name ?? ""} ${i.subcategory ?? i.category}${i.brand ? ` (${i.brand})` : ""}`.trim())
    .join(" + ");

export async function regenerateProfile(ctx: Ctx): Promise<StyleProfile> {
  const { repo } = ctx;
  const [feedback, items, wear, current, body] = await Promise.all([
    repo.list<Feedback & Row>("feedback", {
      order: { column: "created_at", ascending: false },
      limit: 200,
    }),
    listItems(repo),
    allWear(repo),
    latestProfile(repo),
    getBody(repo),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const reasonCounts: Record<string, number> = {};
  const lines = feedback.map((f) => {
    f.reason_tags.forEach((t) => (reasonCounts[t] = (reasonCounts[t] ?? 0) + 1));
    const icon = f.rating > 0 ? "👍" : f.rating < 0 ? "👎" : "•";
    return `${f.created_at.slice(0, 10)} ${icon} ${describe(f.item_ids, byId) || "(items removed)"}${
      f.reason_tags.length ? ` [${f.reason_tags.join(", ")}]` : ""
    }${f.comment ? ` "${f.comment}"` : ""}`;
  });

  // Most worn combinations and items, as evidence of what I actually like wearing.
  const combos = new Map<string, number>();
  const perItem = new Map<string, number>();
  for (const w of wear) {
    combos.set(itemSetKey(w.item_ids), (combos.get(itemSetKey(w.item_ids)) ?? 0) + 1);
    w.item_ids.forEach((id) => perItem.set(id, (perItem.get(id) ?? 0) + 1));
  }
  const top = <K>(m: Map<K, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  const wearText = wear.length
    ? [
        "Most worn combinations:",
        ...top(combos, 8).map(([k, n]) => `- ${n}x ${describe(k.split("|"), byId)}`),
        "Most worn items:",
        ...top(perItem, 10).map(([id, n]) => `- ${n}x ${describe([id], byId)}`),
      ].join("\n")
    : "(no wear logged yet)";

  const out = await ai(repo, updateStyleProfile, {
    current,
    feedback: lines,
    wear: wearText,
    body: bodyForPrompt(body),
    reasonCounts,
  });
  const merged = mergeGenerated(current, out);
  return repo.insert<StyleProfile & Row>("style_profile", {
    ...merged,
    diff: out.diff,
    generated_from_feedback_until: feedback[0]?.created_at ?? current?.generated_from_feedback_until ?? null,
    edited_by_user: current?.edited_by_user ?? false,
  });
}

// One automatic regeneration at a time per user, and a pause after a failure so a broken AI
// setup doesn't cost a call on every rating. In memory: per server instance, which is enough to
// stop the burst of parallel runs that quick ratings in a row would otherwise start.
const RETRY_AFTER_FAILURE_MS = 15 * 60 * 1000;
const g = globalThis as unknown as { __profileRegen?: { running: Set<string>; failedAt: Map<string, number> } };
const regenState = (g.__profileRegen ??= { running: new Set(), failedAt: new Map() });

/** Regenerates when at least PROFILE_REGEN_EVERY feedback events arrived since the last generation. */
export async function maybeRegenerateProfile(ctx: Ctx): Promise<boolean> {
  const uid = ctx.user.id;
  if (regenState.running.has(uid)) return false;
  if (Date.now() - (regenState.failedAt.get(uid) ?? 0) < RETRY_AFTER_FAILURE_MS) return false;
  regenState.running.add(uid);
  try {
    const current = await latestProfile(ctx.repo);
    const since = current?.generated_from_feedback_until;
    const n = await ctx.repo.count("feedback", since ? { gt: { created_at: since } } : undefined);
    if (n < PROFILE_REGEN_EVERY) return false;
    await regenerateProfile(ctx);
    regenState.failedAt.delete(uid);
    return true;
  } catch (e) {
    regenState.failedAt.set(uid, Date.now());
    throw e;
  } finally {
    regenState.running.delete(uid);
  }
}
