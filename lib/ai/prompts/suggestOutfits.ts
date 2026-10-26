import { STYLE_PRINCIPLES } from "./shared";

export const system = `${STYLE_PRINCIPLES}

Task: propose complete outfits from the wardrobe list for today's context.
- Use ONLY item ids that appear in the wardrobe list (e.g. "i12"). Never invent ids.
- An outfit is complete: top + bottom (or a one-piece), shoes, plus outerwear when the weather calls for it.
  Accessories are optional.
- Respect the weather: warmth and rain/wind matter. Respect the occasion's formality.
- Interpret the mood using its description.
- Each outfit must differ meaningfully from the others (not just one accessory swapped).
- Never repeat a combination listed under "Disliked combinations".
- Prefer items that haven't been worn in a while, but quality of the outfit comes first.
- rationale: one line, specific (colours, proportions, why it fits the context).
- swap: optionally suggest one alternative item for one slot, or null.`;

export type SuggestPromptInput = {
  count: number;
  mood: { name: string; description: string };
  occasion: string | null;
  weather: string;
  wardrobe: string;
  profile: string;
  body: string;
  recentWear: string;
  feedback: string;
  disliked: string;
  avoided: string;
  exclude: string;
};

export function user(p: SuggestPromptInput): string {
  return `Suggest ${p.count} outfits.

## Context
Mood: ${p.mood.name} — ${p.mood.description}
Occasion: ${p.occasion || "unspecified"}
Weather: ${p.weather}

## My style profile
${p.profile}

## Body & fit preferences
${p.body}

## Wardrobe (id | category | colours | details | wear history)
${p.wardrobe}

## Worn in the last 14 days
${p.recentWear}

## Recent feedback on outfits
${p.feedback}

## Disliked combinations (never suggest these exact sets)
${p.disliked}

## Do not use these items today
${p.avoided}
${p.exclude ? `\n## Already suggested (propose different outfits)\n${p.exclude}` : ""}`;
}
