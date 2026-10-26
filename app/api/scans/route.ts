import { route, BadRequestError } from "@/lib/api";
import { ConflictError } from "@/lib/data/repo";
import { SOURCES, SCAN_STEPS, type ScanPhotoKind } from "@/lib/types";
import { evaluateScan, type ScanRow } from "@/lib/server/scans";
import { filesFrom, saveUpload, toImageInput } from "@/lib/server/uploads";

export const maxDuration = 60;

export const GET = route(async ({ repo }) => ({
  scans: await repo.list<ScanRow>("scans", { order: { column: "created_at", ascending: false }, limit: 100 }),
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set<string>([...SCAN_STEPS, "screenshot"]);
/** Longer than maxDuration, so an evaluation older than this has certainly died. */
const IN_FLIGHT_MS = 90_000;

/**
 * Creates a scan from photos and evaluates it in the same request (one round trip in the store).
 * The client picks the scan id, so a retried upload from the offline queue is idempotent.
 */
export const POST = route(async (ctx, req) => {
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) throw new BadRequestError("Missing or invalid scan id");

  const photos = filesFrom(form, "photo").slice(0, 5);
  const kinds = form.getAll("kind").map(String) as ScanPhotoKind[];
  if (!photos.length) throw new BadRequestError("At least one photo is needed");
  if (kinds.length !== photos.length || kinds.some((k) => !KINDS.has(k)))
    throw new BadRequestError("Invalid photo kinds");
  const source = String(form.get("source") ?? "store");
  if (!(SOURCES as readonly string[]).includes(source)) throw new BadRequestError("Invalid source");

  // Idempotent retries from the offline queue. The row is claimed *before* any upload or AI call,
  // so of two requests for the same scan only one does the work:
  //  - finished scan → returned as is
  //  - being evaluated by another request (claimed < 90 s ago) → returned as pending; the client polls
  //  - stale claim (that request died) → this request takes over
  const now = new Date().toISOString();
  let scan: ScanRow;
  try {
    scan = await ctx.repo.insert<ScanRow>("scans", {
      id,
      eval_started_at: now,
      photo_kinds: kinds,
      source: source as ScanRow["source"],
      location_text: (form.get("location") as string | null) || null,
      created_at: (form.get("captured_at") as string | null) || undefined,
    });
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
    const existing = (await ctx.repo.get<ScanRow>("scans", id))!;
    const inFlight = existing.eval_started_at && Date.now() - Date.parse(existing.eval_started_at) < IN_FLIGHT_MS;
    if (existing.status !== "pending" || inFlight) return { scan: existing };
    scan = await ctx.repo.update<ScanRow>("scans", id, { eval_started_at: now });
    if (scan.photo_urls.length) return { scan: await evaluateScan(ctx, scan) };
  }

  const saved = await Promise.all(photos.map((p) => saveUpload(ctx.store, p)));
  scan = await ctx.repo.update<ScanRow>("scans", id, { photo_urls: saved.map((s) => s.url), photo_kinds: kinds });
  return { scan: await evaluateScan(ctx, scan, saved.map(toImageInput)) };
});
