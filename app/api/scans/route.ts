import { route, BadRequestError } from "@/lib/api";
import { SOURCES, SCAN_STEPS, type ScanPhotoKind } from "@/lib/types";
import { evaluateScan, type ScanRow } from "@/lib/server/scans";
import { filesFrom, saveUpload, toImageInput } from "@/lib/server/uploads";

export const maxDuration = 60;

export const GET = route(async ({ repo }) => ({
  scans: await repo.list<ScanRow>("scans", { order: { column: "created_at", ascending: false }, limit: 100 }),
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set<string>([...SCAN_STEPS, "screenshot"]);

/**
 * Creates a scan from photos and evaluates it in the same request (one round trip in the store).
 * The client picks the scan id, so a retried upload from the offline queue is idempotent.
 */
export const POST = route(async (ctx, req) => {
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) throw new BadRequestError("Missing or invalid scan id");

  const existing = await ctx.repo.get<ScanRow>("scans", id);
  if (existing && existing.status !== "pending") return { scan: existing };

  const photos = filesFrom(form, "photo").slice(0, 5);
  const kinds = form.getAll("kind").map(String) as ScanPhotoKind[];
  if (!photos.length) throw new BadRequestError("At least one photo is needed");
  if (kinds.length !== photos.length || kinds.some((k) => !KINDS.has(k)))
    throw new BadRequestError("Invalid photo kinds");
  const source = String(form.get("source") ?? "store");
  if (!(SOURCES as readonly string[]).includes(source)) throw new BadRequestError("Invalid source");

  const saved = await Promise.all(photos.map((p) => saveUpload(ctx.store, p)));
  const scan =
    existing ??
    (await ctx.repo.insert<ScanRow>("scans", {
      id,
      photo_urls: saved.map((s) => s.url),
      photo_kinds: kinds,
      source: source as ScanRow["source"],
      location_text: (form.get("location") as string | null) || null,
      created_at: (form.get("captured_at") as string | null) || undefined,
    }));
  return { scan: await evaluateScan(ctx, scan, saved.map(toImageInput)) };
});
