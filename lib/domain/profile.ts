import type { ProfileEntry, StyleProfile } from "@/lib/types";

/**
 * Profile entries can be:
 *  - { source: "ai" }                  generated, replaced on every regeneration
 *  - { source: "user" }                written or edited by me, always kept verbatim
 *  - { source: "user", removed: true } an AI entry I deleted; kept as a tombstone so
 *                                      regeneration can't bring it back
 */
export type Entry = ProfileEntry & { removed?: boolean };

export type ProfileDraft = Pick<StyleProfile, "summary" | "summary_source" | "hard_rules" | "soft_preferences">;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Visible entries (tombstones hidden). */
export function visible(entries: Entry[]): Entry[] {
  return entries.filter((e) => !e.removed);
}

function mergeList(current: Entry[], generated: string[]): Entry[] {
  const userEntries = current.filter((e) => e.source === "user");
  const blocked = new Set(userEntries.map((e) => norm(e.text)));
  const out: Entry[] = [...userEntries];
  for (const text of generated) {
    const t = text.trim();
    if (!t || blocked.has(norm(t))) continue;
    blocked.add(norm(t));
    out.push({ text: t, source: "ai" });
  }
  return out;
}

/** Merges a regenerated profile into the current one. My edits always win. */
export function mergeGenerated(
  current: ProfileDraft | null,
  generated: {
    summary: string;
    hard_rules: string[];
    soft_preferences: string[];
  },
): ProfileDraft {
  const keepSummary = current?.summary_source === "user";
  return {
    summary: keepSummary ? current!.summary : generated.summary.trim(),
    summary_source: keepSummary ? "user" : "ai",
    hard_rules: mergeList((current?.hard_rules ?? []) as Entry[], generated.hard_rules),
    soft_preferences: mergeList((current?.soft_preferences ?? []) as Entry[], generated.soft_preferences),
  };
}

/**
 * Applies an edit from the profile page. `next` is the list as shown in the UI after editing.
 * Changed or new entries become user entries; deleted AI entries become tombstones.
 */
export function applyListEdit(current: Entry[], next: { text: string; source: "ai" | "user" }[]): Entry[] {
  const nextNorm = new Set(next.map((e) => norm(e.text)));
  const currentAi = new Set(current.filter((e) => e.source === "ai" && !e.removed).map((e) => norm(e.text)));
  const out: Entry[] = [];
  for (const e of next) {
    const t = e.text.trim();
    if (!t) continue;
    // An AI entry left untouched stays AI; anything else is mine.
    const untouchedAi = e.source === "ai" && currentAi.has(norm(t));
    out.push({ text: t, source: untouchedAi ? "ai" : "user" });
  }
  for (const e of current) {
    if (e.removed) {
      if (!nextNorm.has(norm(e.text))) out.push(e);
    } else if (e.source === "ai" && !nextNorm.has(norm(e.text))) {
      out.push({ text: e.text, source: "user", removed: true });
    }
  }
  return out;
}

/** Profile text for prompts: the summary plus visible rules/preferences, and what to avoid re-adding. */
export function profileForPrompt(p: ProfileDraft | null): string {
  if (!p || (!p.summary && !p.hard_rules.length && !p.soft_preferences.length)) return "(no style profile yet)";
  const hard = visible(p.hard_rules as Entry[]);
  const soft = visible(p.soft_preferences as Entry[]);
  return [
    p.summary ? `Summary: ${p.summary}` : null,
    hard.length ? `Hard rules (must follow):\n${hard.map((e) => `- ${e.text}`).join("\n")}` : null,
    soft.length ? `Soft preferences:\n${soft.map((e) => `- ${e.text}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function removedTexts(p: ProfileDraft | null): string[] {
  if (!p) return [];
  return [...p.hard_rules, ...p.soft_preferences].filter((e) => (e as Entry).removed).map((e) => e.text);
}
