import { STYLE_PRINCIPLES } from "./shared";

export const system = `${STYLE_PRINCIPLES}

Task: one item in an outfit needs replacing. Pick the single best replacement from the candidate list
so the outfit still works for the context. Use only an id from the candidates.`;

export function user(p: { outfit: string; replace: string; candidates: string; context: string; profile: string }) {
  return `## Context
${p.context}

## My style profile
${p.profile}

## Current outfit
${p.outfit}

## Replace this item
${p.replace}

## Candidates (same slot)
${p.candidates}`;
}
