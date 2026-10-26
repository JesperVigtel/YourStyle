import "server-only";
import { randomUUID } from "crypto";
import { BadRequestError } from "@/lib/api";
import { imageUrl, keyFromImageUrl, type BlobStore } from "@/lib/storage";
import type { ImageInput } from "@/lib/ai/tasks/images";

// No SVG: it can carry script. (The dev seed writes its SVGs straight to the store.)
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 8 * 1024 * 1024;

export type Saved = { url: string; bytes: Uint8Array; contentType: string };

/** Stores an uploaded image and returns its /api/img URL. */
export async function saveUpload(store: BlobStore, file: File): Promise<Saved> {
  const contentType = file.type || "image/jpeg";
  const ext = EXT[contentType];
  if (!ext) throw new BadRequestError(`Unsupported image type ${contentType}`);
  if (file.size > MAX_BYTES) throw new BadRequestError("Image too large (max 8 MB)");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `uploads/${randomUUID()}.${ext}`;
  await store.put(key, bytes, contentType);
  return { url: imageUrl(key), bytes, contentType };
}

export function filesFrom(form: FormData, field: string): File[] {
  return form.getAll(field).filter((v): v is File => typeof v === "object" && "arrayBuffer" in v);
}

export function toImageInput(s: Pick<Saved, "bytes" | "contentType">): ImageInput {
  const mediaType = (
    ["image/jpeg", "image/png", "image/webp"].includes(s.contentType) ? s.contentType : "image/jpeg"
  ) as ImageInput["mediaType"];
  return { base64: Buffer.from(s.bytes).toString("base64"), mediaType };
}

/** Loads stored images back as AI inputs (used when re-running an evaluation). */
export async function loadImages(store: BlobStore, urls: string[]): Promise<ImageInput[]> {
  const out: ImageInput[] = [];
  for (const url of urls) {
    const key = keyFromImageUrl(url);
    const blob = key ? await store.get(key) : null;
    if (blob && blob.contentType !== "image/svg+xml") out.push(toImageInput(blob));
  }
  return out;
}
