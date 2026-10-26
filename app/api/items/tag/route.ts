import { route, BadRequestError } from "@/lib/api";
import { ai } from "@/lib/ai";
import { tagItem } from "@/lib/ai/tasks/tagItem";
import { filesFrom, saveUpload, toImageInput } from "@/lib/server/uploads";

export const maxDuration = 60;

/** Stores the garment photo (+ optional label photos) and returns AI tags with per-field confidence. */
export const POST = route(async ({ repo, store }, req) => {
  const form = await req.formData();
  const [photo] = filesFrom(form, "photo");
  if (!photo) throw new BadRequestError("Missing photo");
  const labels = filesFrom(form, "label").slice(0, 3);

  const savedPhoto = await saveUpload(store, photo);
  const savedLabels = await Promise.all(labels.map((f) => saveUpload(store, f)));
  const kinds = ["garment", ...labels.map((_, i) => String(form.getAll("labelKind")[i] ?? "label"))];

  const tags = await ai(repo, tagItem, {
    images: [savedPhoto, ...savedLabels].map(toImageInput),
    kinds,
  });
  return { photo_url: savedPhoto.url, label_photo_urls: savedLabels.map((s) => s.url), tags };
});
