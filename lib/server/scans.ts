import "server-only";
import type { Ctx } from "@/lib/auth";
import { ai } from "@/lib/ai";
import { AiError } from "@/lib/ai/provider";
import { evaluatePurchase } from "@/lib/ai/tasks/evaluatePurchase";
import type { ImageInput } from "@/lib/ai/tasks/images";
import { NotFoundError, type Row } from "@/lib/data/repo";
import {
  allWear,
  bodyForPrompt,
  brandSizesForPrompt,
  getBody,
  latestProfile,
  listBrandSizes,
  listItems,
} from "@/lib/data/services";
import { profileForPrompt } from "@/lib/domain/profile";
import { wearStats } from "@/lib/domain/wardrobe";
import type { Item, Scan } from "@/lib/types";
import { loadImages } from "./uploads";

export type ScanRow = Scan & Row;

const HINTS: Record<string, string> = {
  store: "I'm in a physical store.",
  vintage: "I'm at a vintage / second-hand market: estimate era, condition and a fair price.",
  online: "This is a screenshot from an online shop.",
};

/** Runs evaluatePurchase for a stored scan and saves the verdict (or the error) on the scan. */
export async function evaluateScan(ctx: Ctx, scan: ScanRow, images?: ImageInput[]): Promise<ScanRow> {
  const started = Date.now();
  const { repo } = ctx;
  const [items, wear, body, brandSizes, profile] = await Promise.all([
    listItems(repo, "owned"),
    allWear(repo),
    getBody(repo),
    listBrandSizes(repo),
    latestProfile(repo),
  ]);
  try {
    const imgs = images ?? (await loadImages(ctx.store, scan.photo_urls));
    const res = await ai(repo, evaluatePurchase, {
      images: imgs,
      kinds: scan.photo_kinds,
      items,
      stats: wearStats(wear),
      body: bodyForPrompt(body),
      brandSizes: brandSizesForPrompt(brandSizes, items),
      profile: profileForPrompt(profile),
      hint: [HINTS[scan.source ?? ""] ?? "", scan.location_text ? `Location: ${scan.location_text}` : ""]
        .filter(Boolean)
        .join("\n"),
    });
    return repo.update<ScanRow>("scans", scan.id, {
      extracted: res.extracted,
      verdict: res.verdict,
      price: res.extracted.price,
      currency: res.extracted.currency,
      status: "done",
      error: null,
      latency_ms: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof AiError ? e.userMessage : "Evaluation failed.";
    if (!(e instanceof AiError)) console.error(e);
    return repo.update<ScanRow>("scans", scan.id, {
      status: "error",
      error: message,
      latency_ms: Date.now() - started,
    });
  }
}

/** Item fields derived from a scan, used for "save as wishlist/considered" and "I bought it". */
export function itemFromScan(scan: ScanRow): Partial<Item & Row> {
  const x = scan.extracted;
  const garmentIdx = Math.max(
    0,
    scan.photo_kinds.findIndex((k) => k === "garment" || k === "screenshot"),
  );
  const photo = scan.photo_urls[garmentIdx] ?? null;
  const labels = scan.photo_urls.filter((_, i) => i !== garmentIdx && ["brand", "care"].includes(scan.photo_kinds[i]));
  return {
    photo_url: photo,
    cutout_url: scan.cutout_url,
    label_photo_urls: labels,
    category: x?.category ?? "other",
    subcategory: x?.subcategory ?? null,
    colors: x?.colors ?? [],
    pattern: x?.pattern ?? null,
    material: x?.material ?? null,
    formality: x?.formality ?? null,
    warmth: x?.warmth ?? null,
    seasons: x?.seasons ?? [],
    brand: x?.brand ?? null,
    size_label: x?.size_label ?? null,
    price: scan.price ?? x?.price ?? null,
    currency: scan.currency ?? x?.currency ?? null,
    source: scan.source,
    notes: [x?.era, x?.condition].filter(Boolean).join(", ") || null,
    ai_raw: { scan_id: scan.id, extracted: x, verdict: scan.verdict },
  };
}

export async function getScan(ctx: Ctx, id: string): Promise<ScanRow> {
  const scan = await ctx.repo.get<ScanRow>("scans", id);
  if (!scan) throw new NotFoundError("scans", id);
  return scan;
}
