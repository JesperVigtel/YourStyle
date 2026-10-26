import { describe, expect, it } from "vitest";
import { applyListEdit, mergeGenerated, profileForPrompt, removedTexts, visible, type ProfileDraft } from "@/lib/domain/profile";

const current: ProfileDraft = {
  summary: "Likes muted colours.",
  summary_source: "ai",
  hard_rules: [
    { text: "Never pair navy with black", source: "user" },
    { text: "Always add a layer below 10°C", source: "ai" },
    { text: "Never wear socks with sandals", source: "user", removed: true },
  ],
  soft_preferences: [{ text: "Prefers relaxed fits", source: "ai" }],
};

describe("mergeGenerated — my edits are never overwritten", () => {
  it("keeps user entries verbatim and replaces AI entries", () => {
    const next = mergeGenerated(current, {
      summary: "New summary",
      hard_rules: ["Never wear neon", "never pair navy with black"],
      soft_preferences: ["Likes earth tones"],
    });
    expect(next.hard_rules).toEqual([
      { text: "Never pair navy with black", source: "user" },
      { text: "Never wear socks with sandals", source: "user", removed: true },
      { text: "Never wear neon", source: "ai" },
    ]);
    expect(next.soft_preferences).toEqual([{ text: "Likes earth tones", source: "ai" }]);
    expect(next.summary).toBe("New summary");
  });

  it("does not re-add an entry I removed", () => {
    const next = mergeGenerated(current, { summary: "s", hard_rules: ["Never wear socks with sandals"], soft_preferences: [] });
    expect(visible(next.hard_rules).map((e) => e.text)).not.toContain("Never wear socks with sandals");
  });

  it("keeps a summary I wrote", () => {
    const next = mergeGenerated({ ...current, summary: "Mine", summary_source: "user" }, { summary: "AI", hard_rules: [], soft_preferences: [] });
    expect(next.summary).toBe("Mine");
    expect(next.summary_source).toBe("user");
  });

  it("works with no current profile", () => {
    const next = mergeGenerated(null, { summary: " S ", hard_rules: ["A", "a", ""], soft_preferences: [] });
    expect(next.summary).toBe("S");
    expect(next.hard_rules).toEqual([{ text: "A", source: "ai" }]);
  });
});

describe("applyListEdit", () => {
  const list = current.hard_rules;
  it("marks edited and new entries as mine, keeps untouched AI entries as AI", () => {
    const out = applyListEdit(list, [
      { text: "Never pair navy with black", source: "user" },
      { text: "Always add a layer below 10°C", source: "ai" },
      { text: "Never wear logos", source: "user" },
    ]);
    expect(out.filter((e) => !e.removed)).toEqual([
      { text: "Never pair navy with black", source: "user" },
      { text: "Always add a layer below 10°C", source: "ai" },
      { text: "Never wear logos", source: "user" },
    ]);
  });
  it("turns a deleted AI entry into a tombstone", () => {
    const out = applyListEdit(list, [{ text: "Never pair navy with black", source: "user" }]);
    expect(out).toContainEqual({ text: "Always add a layer below 10°C", source: "user", removed: true });
  });
  it("an edited AI entry becomes mine", () => {
    const out = applyListEdit(list, [{ text: "Always add a layer below 12°C", source: "ai" }]);
    expect(out[0]).toEqual({ text: "Always add a layer below 12°C", source: "user" });
  });
  it("re-adding a removed entry revives it", () => {
    const out = applyListEdit(list, [{ text: "Never wear socks with sandals", source: "user" }]);
    expect(out.filter((e) => e.text === "Never wear socks with sandals")).toEqual([{ text: "Never wear socks with sandals", source: "user" }]);
  });
});

describe("profileForPrompt", () => {
  it("hides tombstones and lists rules", () => {
    const text = profileForPrompt(current);
    expect(text).toContain("Never pair navy with black");
    expect(text).not.toContain("socks");
    expect(removedTexts(current)).toEqual(["Never wear socks with sandals"]);
  });
  it("handles an empty profile", () => {
    expect(profileForPrompt(null)).toBe("(no style profile yet)");
  });
});
