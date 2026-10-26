// Offline queue for shop scans (IndexedDB). Every scan is written here first, so a dropped
// connection or a killed app never loses photos; the queue is drained whenever we're online.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ItemSource, ScanPhotoKind } from "@/lib/types";

export type QueuedPhoto = {
  kind: ScanPhotoKind;
  type: string;
  data: ArrayBuffer;
};

export type QueuedScan = {
  id: string;
  created_at: string;
  source: ItemSource;
  location: string | null;
  photos: QueuedPhoto[];
  state: "pending" | "uploading" | "failed";
  attempts: number;
  last_error: string | null;
};

interface QueueDB extends DBSchema {
  scans: { key: string; value: QueuedScan };
}

export const QUEUE_EVENT = "wardrobe:scanqueue";
let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;

function db() {
  return (dbPromise ??= openDB<QueueDB>("wardrobe", 1, {
    upgrade(d) {
      d.createObjectStore("scans", { keyPath: "id" });
    },
  }));
}

function changed() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function enqueueScan(scan: Omit<QueuedScan, "state" | "attempts" | "last_error">): Promise<void> {
  await (await db()).put("scans", { ...scan, state: "pending", attempts: 0, last_error: null });
  changed();
}

export async function listQueued(): Promise<QueuedScan[]> {
  const all = await (await db()).getAll("scans");
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function removeQueued(id: string): Promise<void> {
  await (await db()).delete("scans", id);
  changed();
}

async function patch(id: string, p: Partial<QueuedScan>) {
  const d = await db();
  const cur = await d.get("scans", id);
  if (cur) await d.put("scans", { ...cur, ...p });
  changed();
}

/** done: uploaded (remove). retry: transient, try later. fail: permanent, keep for the user to see. */
export type UploadOutcome = { result: "done" } | { result: "retry"; error: string } | { result: "fail"; error: string };

let running: Promise<{ done: string[] }> | null = null;

/**
 * Uploads queued scans one by one, oldest first. Stops at the first transient failure
 * (most likely we're offline again). Concurrent calls share one run.
 */
export function processQueue(
  upload: (scan: QueuedScan) => Promise<UploadOutcome>,
  opts: { includeFailed?: boolean } = {},
): Promise<{ done: string[] }> {
  if (running) return running;
  running = (async () => {
    const done: string[] = [];
    try {
      for (const scan of await listQueued()) {
        if (scan.state === "failed" && !opts.includeFailed) continue;
        await patch(scan.id, {
          state: "uploading",
          attempts: scan.attempts + 1,
        });
        let outcome: UploadOutcome;
        try {
          outcome = await upload(scan);
        } catch (e) {
          outcome = { result: "retry", error: (e as Error).message };
        }
        if (outcome.result === "done") {
          await removeQueued(scan.id);
          done.push(scan.id);
        } else if (outcome.result === "fail") {
          await patch(scan.id, { state: "failed", last_error: outcome.error });
        } else {
          await patch(scan.id, { state: "pending", last_error: outcome.error });
          break;
        }
      }
    } finally {
      running = null;
    }
    return { done };
  })();
  return running;
}

/** Test helper. */
export async function _resetQueueForTests() {
  const d = await db();
  await d.clear("scans");
}
