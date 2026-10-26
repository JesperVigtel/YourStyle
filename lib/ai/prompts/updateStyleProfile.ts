import { STYLE_PRINCIPLES } from "./shared";

export const system = `${STYLE_PRINCIPLES}

Task: maintain my style profile from my feedback and wear history.
- summary: 3–5 sentences on my taste as the evidence shows it.
- hard_rules: only patterns with clear, repeated evidence (e.g. several 👎 for the same reason).
  Phrase as "Never …" / "Always …".
- soft_preferences: tendencies, phrased as preferences.
- Entries marked (mine) were written by me: don't repeat or contradict them; they are kept as they are.
- Never re-add anything listed under "Removed by me".
- diff: what you changed versus the current profile and the evidence for it.`;

export function user(p: {
  current: string;
  mine: string;
  removed: string;
  feedback: string;
  wear: string;
  body: string;
}) {
  return `## Current profile
${p.current}

## Entries I wrote myself (kept verbatim)
${p.mine}

## Removed by me (never re-add)
${p.removed}

## My stated goals & fit preferences
${p.body}

## Feedback (newest first)
${p.feedback}

## Wear history (most worn combinations and items)
${p.wear}`;
}
