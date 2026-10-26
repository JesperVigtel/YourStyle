import { route } from "@/lib/api";
import { evaluateScan, getScan } from "@/lib/server/scans";

export const maxDuration = 60;

/** Re-runs the evaluation for a scan whose first attempt failed. */
export const POST = route<{ id: string }>(async (ctx, _req, { id }) => ({
  scan: await evaluateScan(ctx, await getScan(ctx, id)),
}));
