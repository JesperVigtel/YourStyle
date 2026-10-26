import { route, BadRequestError } from "@/lib/api";
import { filesFrom, saveUpload } from "@/lib/server/uploads";

/** Generic image upload (cutouts, extra photos). Returns /api/img URLs in the same order. */
export const POST = route(async ({ store }, req) => {
  const files = filesFrom(await req.formData(), "file");
  if (!files.length) throw new BadRequestError("No files");
  const urls = [];
  for (const f of files) urls.push((await saveUpload(store, f)).url);
  return { urls };
});
