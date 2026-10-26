import { route } from "@/lib/api";
import { NotFoundError } from "@/lib/data/repo";

export const GET = route<{ path: string[] }>(async ({ store }, _req, { path }) => {
  if (path.some((p) => p === ".." || p.includes("\\"))) throw new NotFoundError("img", path.join("/"));
  const key = path.join("/");
  const blob = await store.get(key);
  if (!blob) throw new NotFoundError("img", key);
  return new Response(blob.bytes as BodyInit, {
    headers: {
      "Content-Type": blob.contentType,
      // Keys are unique per upload and never rewritten, so they can be cached forever (privately).
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Never let a stored file run script if it's opened directly.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
});
