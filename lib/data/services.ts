import "server-only";
import type { BodyProfile, BrandSize, Feedback, Item, Mood, StyleProfile, WearLog } from "@/lib/types";
import { DEFAULT_MOODS } from "@/lib/types";
import type { Repo, Row } from "./repo";

type R<T> = T & Row;

export async function listItems(repo: Repo, status?: Item["status"]): Promise<Item[]> {
  return repo.list<R<Item>>("items", {
    eq: status ? { status } : undefined,
    order: { column: "created_at", ascending: false },
  });
}

export async function latestProfile(repo: Repo): Promise<StyleProfile | null> {
  const [p] = await repo.list<R<StyleProfile>>("style_profile", {
    order: { column: "created_at", ascending: false },
    limit: 1,
  });
  return p ?? null;
}

export async function getBody(repo: Repo): Promise<(BodyProfile & Row) | null> {
  const [b] = await repo.list<R<BodyProfile>>("body_profile", { limit: 1 });
  return b ?? null;
}

export async function listMoods(repo: Repo): Promise<Mood[]> {
  let moods = await repo.list<R<Mood>>("moods", { order: { column: "sort" } });
  if (!moods.length) {
    for (const [i, m] of DEFAULT_MOODS.entries()) await repo.insert("moods", { ...m, sort: i });
    moods = await repo.list<R<Mood>>("moods", { order: { column: "sort" } });
  }
  return moods;
}

export async function wearSince(repo: Repo, sinceDate: string): Promise<WearLog[]> {
  return repo.list<R<WearLog>>("wear_log", {
    gte: { date: sinceDate },
    order: { column: "date", ascending: false },
  });
}

export async function allWear(repo: Repo): Promise<WearLog[]> {
  return repo.list<R<WearLog>>("wear_log", {
    order: { column: "date", ascending: false },
  });
}

export async function recentFeedback(repo: Repo, limit = 30): Promise<Feedback[]> {
  return repo.list<R<Feedback>>("feedback", {
    order: { column: "created_at", ascending: false },
    limit,
  });
}

export async function listBrandSizes(repo: Repo): Promise<BrandSize[]> {
  return repo.list<R<BrandSize>>("brand_sizes", {
    order: { column: "created_at", ascending: false },
  });
}

export function bodyForPrompt(b: BodyProfile | null): string {
  if (!b) return "(not filled in)";
  const m = Object.entries(b.measurements ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== ("" as unknown))
    .map(([k, v]) => `${k} ${v} cm`);
  const lines = [
    b.height_cm ? `Height: ${b.height_cm} cm` : null,
    b.weight_kg ? `Weight: ${b.weight_kg} kg` : null,
    m.length ? `Measurements: ${m.join(", ")}` : null,
    b.shape_notes ? `Shape notes: ${b.shape_notes}` : null,
    b.fit_preferences ? `Fit preferences: ${b.fit_preferences}` : null,
    b.style_goals ? `Style goals: ${b.style_goals}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "(not filled in)";
}

/** Brand/size history: explicit brand_sizes rows plus owned items that have a brand, size and fit verdict. */
export function brandSizesForPrompt(rows: BrandSize[], items: Item[]): string {
  const lines = rows.map(
    (r) =>
      `${r.brand} ${r.size_label}${r.garment_type ? ` (${r.garment_type})` : ""}: ${r.fit_verdict ?? "?"}${r.notes ? ` – ${r.notes}` : ""}`,
  );
  for (const it of items) {
    if (it.status !== "owned" || !it.brand || !it.size_label) continue;
    const fit = it.fit_verdict ?? (it.is_reference ? "perfect" : null);
    if (!fit && !it.fit_notes) continue;
    lines.push(
      `${it.brand} ${it.size_label} (${it.subcategory ?? it.category}): ${fit ?? "?"}${it.is_reference ? " [reference]" : ""}${
        it.fit_notes ? ` – ${it.fit_notes}` : ""
      }`,
    );
  }
  return lines.length ? lines.join("\n") : "(no brand/size history yet)";
}
