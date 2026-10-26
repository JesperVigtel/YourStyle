"use client";

import type { TaggedField } from "@/lib/types";
import { EMPTY_DRAFT, type ItemDraft } from "@/components/ItemForm";
import { api } from "./api";
import { removeBackgroundSafe } from "./bgRemoval";
import { blobToFile, prepareImage, trimTransparent } from "./image";

export type Tags = Omit<
  ItemDraft,
  "status" | "fit_verdict" | "fit_notes" | "is_reference" | "price" | "currency" | "acquired_date" | "source"
> & {
  notes: string | null;
  confidence: Record<TaggedField, number>;
};

export type TagResponse = {
  photo_url: string;
  label_photo_urls: string[];
  tags: Tags;
};

export async function uploadImage(blob: Blob, name = "image"): Promise<string> {
  const form = new FormData();
  form.append("file", blobToFile(blob, `${name}.${blob.type === "image/png" ? "png" : "jpg"}`));
  const { urls } = await api<{ urls: string[] }>("/api/uploads", {
    method: "POST",
    body: form,
  });
  return urls[0];
}

/** Uploads the garment photo (+ labels) and gets AI tags back. */
export async function tagPhoto(photo: Blob, labels: { blob: Blob; kind: string }[]): Promise<TagResponse> {
  const form = new FormData();
  form.append("photo", blobToFile(photo, "photo.jpg"));
  for (const l of labels) {
    form.append("label", blobToFile(l.blob, "label.jpg"));
    form.append("labelKind", l.kind);
  }
  return api<TagResponse>("/api/items/tag", { method: "POST", body: form });
}

/** Background removal + upload. Resolves to the cutout URL, or null (keep using the photo). */
export async function makeCutout(photo: Blob): Promise<string | null> {
  const cut = await removeBackgroundSafe(photo);
  if (!cut) return null;
  try {
    return await uploadImage(await trimTransparent(cut).catch(() => cut), "cutout");
  } catch {
    return null;
  }
}

export function tagsToDraft(t: Tags): ItemDraft {
  return {
    ...EMPTY_DRAFT,
    category: t.category,
    subcategory: t.subcategory,
    colors: t.colors,
    pattern: t.pattern,
    material: t.material,
    formality: t.formality,
    warmth: t.warmth,
    seasons: t.seasons,
    brand: t.brand,
    size_label: t.size_label,
    notes: t.notes,
  };
}

export { prepareImage };
