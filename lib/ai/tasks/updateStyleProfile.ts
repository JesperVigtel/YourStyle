import type { StyleProfile } from "@/lib/types";
import { profileForPrompt, removedTexts } from "@/lib/domain/profile";
import * as prompt from "../prompts/updateStyleProfile";
import { updateStyleProfileSchema, type UpdateStyleProfileOutput } from "../schemas";
import type { TaskDef } from "../run";

export type ProfileInput = {
  current: StyleProfile | null;
  /** Feedback lines, already rendered with item descriptions. */
  feedback: string[];
  wear: string;
  body: string;
  /** Counts used by the mock. */
  reasonCounts: Record<string, number>;
};

export const updateStyleProfile: TaskDef<ProfileInput, UpdateStyleProfileOutput, UpdateStyleProfileOutput> = {
  name: "updateStyleProfile",
  schema: updateStyleProfileSchema,
  maxTokens: 4000,
  build(input) {
    const mine = input.current
      ? [...input.current.hard_rules, ...input.current.soft_preferences].filter(
          (e) => e.source === "user" && !e.removed,
        )
      : [];
    const removed = removedTexts(input.current);
    return {
      system: prompt.system,
      content: [
        {
          type: "text",
          text: prompt.user({
            current: profileForPrompt(input.current),
            mine: mine.length ? mine.map((e) => `- ${e.text} (mine)`).join("\n") : "(none)",
            removed: removed.length ? removed.map((t) => `- ${t}`).join("\n") : "(none)",
            body: input.body,
            feedback: input.feedback.length ? input.feedback.join("\n") : "(none)",
            wear: input.wear,
          }),
        },
      ],
    };
  },
  mock(input) {
    const top = Object.entries(input.reasonCounts).sort((a, b) => b[1] - a[1]);
    const neg = top.filter(([t]) => !["love it", "comfortable", "great colours", "fits the occasion"].includes(t));
    return {
      summary: `Mock profile from ${input.feedback.length} feedback events. Leans towards clean, easy combinations${
        top[0] ? `; most common reason so far: "${top[0][0]}"` : ""
      }.`,
      hard_rules: neg.filter(([, n]) => n >= 2).map(([t]) => `Never suggest outfits that are ${t}.`),
      soft_preferences: ["Prefers muted colours with one accent.", "Likes relaxed tops with straighter trousers."],
      diff: "Mock: rebuilt from the latest feedback.",
    };
  },
  post(out) {
    return {
      summary: out.summary.trim(),
      hard_rules: out.hard_rules.map((s) => s.trim()).filter(Boolean),
      soft_preferences: out.soft_preferences.map((s) => s.trim()).filter(Boolean),
      diff: out.diff.trim(),
    };
  },
};
