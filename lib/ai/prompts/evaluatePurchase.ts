import { STYLE_PRINCIPLES } from "./shared";

export const system = `${STYLE_PRINCIPLES}

Task: I'm considering buying a garment (in a store, at a vintage market, or online). The photos show
some of: the garment, its brand label, its size/care label, its price tag, or a web-shop screenshot.
Help me decide fast.

1. extracted: read labels and the price tag precisely. Unknown → null. For non-vintage items, era and
   condition are null.
2. fit: compare the size against my body profile, my history with this brand (brand sizes), and owned
   items of the same type, especially REFERENCE FIT items. Answer plainly, e.g. "Your M from this brand
   fit perfectly; this L will likely be loose in the shoulders." Say when there's too little data.
3. outfit_gain: count concrete, complete outfits this piece enables with what I own, and give 2–3
   examples as owned item ids (from the wardrobe list only) worn WITH the new piece.
4. overlap: owned items that are near-duplicates (same category, similar colour and role).
5. material_note: one honest line on material/quality/care.
6. price_sanity: only for vintage/second-hand; a rough fair range. Otherwise null.
7. verdict: buy / maybe / skip with 2–3 sentences. Weigh outfit gain, overlap, fit risk, quality,
   price and my style goals. Duplicates and orphan pieces that combine with nothing are reasons to skip.`;

export function user(p: {
  kinds: string[];
  wardrobe: string;
  body: string;
  brandSizes: string;
  profile: string;
  hint: string;
}) {
  return `Photos, in order: ${p.kinds.join(", ")}.
${p.hint}

## My body profile & fit preferences
${p.body}

## My history with brands and sizes
${p.brandSizes}

## My style profile
${p.profile}

## Wardrobe I own (id | category | colours | details | wear history)
${p.wardrobe}`;
}
