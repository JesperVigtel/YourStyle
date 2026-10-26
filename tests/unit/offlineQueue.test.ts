import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetQueueForTests,
  enqueueScan,
  listQueued,
  processQueue,
  type QueuedScan,
  type UploadOutcome,
} from "@/lib/client/offlineQueue";

const photo = (s: string) => ({
  kind: "garment" as const,
  type: "image/jpeg",
  data: new TextEncoder().encode(s).buffer as ArrayBuffer,
});
const scan = (id: string, t: string) => ({
  id,
  created_at: t,
  source: "vintage" as const,
  location: null,
  photos: [photo(id)],
});

beforeEach(() => _resetQueueForTests());

describe("offline scan queue", () => {
  it("persists scans with their photos, oldest first", async () => {
    await enqueueScan(scan("b", "2026-10-26T10:00:01Z"));
    await enqueueScan(scan("a", "2026-10-26T10:00:00Z"));
    const q = await listQueued();
    expect(q.map((s) => s.id)).toEqual(["a", "b"]);
    expect(q[0].state).toBe("pending");
    expect(new TextDecoder().decode(q[0].photos[0].data)).toBe("a");
  });

  it("uploads everything when online and removes uploaded scans", async () => {
    await enqueueScan(scan("a", "1"));
    await enqueueScan(scan("b", "2"));
    const seen: string[] = [];
    const { done } = await processQueue(async (s) => (seen.push(s.id), { result: "done" }));
    expect(done).toEqual(["a", "b"]);
    expect(seen).toEqual(["a", "b"]);
    expect(await listQueued()).toEqual([]);
  });

  it("stops at the first transient failure and keeps everything (no photo lost)", async () => {
    await enqueueScan(scan("a", "1"));
    await enqueueScan(scan("b", "2"));
    const seen: string[] = [];
    await processQueue(async (s) => (seen.push(s.id), { result: "retry", error: "offline" }));
    expect(seen).toEqual(["a"]);
    const q = await listQueued();
    expect(q.map((s) => [s.id, s.state, s.attempts])).toEqual([
      ["a", "pending", 1],
      ["b", "pending", 0],
    ]);
    expect(q[0].last_error).toBe("offline");
    expect(q[0].photos).toHaveLength(1);
  });

  it("treats a thrown uploader error as transient", async () => {
    await enqueueScan(scan("a", "1"));
    await processQueue(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect((await listQueued())[0]).toMatchObject({ state: "pending", last_error: "Failed to fetch" });
  });

  it("marks permanent failures as failed, skips them later unless asked", async () => {
    await enqueueScan(scan("a", "1"));
    await enqueueScan(scan("b", "2"));
    await processQueue(
      async (s): Promise<UploadOutcome> => (s.id === "a" ? { result: "fail", error: "bad photo" } : { result: "done" }),
    );
    expect((await listQueued()).map((s) => [s.id, s.state])).toEqual([["a", "failed"]]);

    const seen: string[] = [];
    await processQueue(async (s) => (seen.push(s.id), { result: "done" }));
    expect(seen).toEqual([]);
    await processQueue(async (s) => (seen.push(s.id), { result: "done" }), { includeFailed: true });
    expect(seen).toEqual(["a"]);
  });

  it("never uploads a scan twice when calls overlap", async () => {
    await enqueueScan(scan("a", "1"));
    let uploads = 0;
    const upload = async (): Promise<UploadOutcome> => {
      uploads++;
      await new Promise((r) => setTimeout(r, 20));
      return { result: "done" };
    };
    await Promise.all([processQueue(upload), processQueue(upload)]);
    expect(uploads).toBe(1);
  });

  it("a call made during a run also processes scans added after that run started", async () => {
    await enqueueScan(scan("old", "1"));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const seen: string[] = [];
    const upload = async (s: QueuedScan): Promise<UploadOutcome> => {
      seen.push(s.id);
      if (s.id === "old") await gate;
      return { result: "done" };
    };
    const first = processQueue(upload);
    await new Promise((r) => setTimeout(r, 10));
    await enqueueScan(scan("new", "2"));
    const second = processQueue(upload);
    release();
    await first;
    const res = await second;
    expect(res.done).toContain("new");
    expect(seen).toEqual(["old", "new"]);
  });

  it("honours includeFailed even when another run is in progress", async () => {
    await enqueueScan(scan("a", "1"));
    await processQueue(async () => ({ result: "fail", error: "x" }));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await enqueueScan(scan("b", "2"));
    const first = processQueue(async () => (await gate, { result: "done" }));
    const retry = processQueue(async () => ({ result: "done" }), { includeFailed: true });
    release();
    await first;
    expect((await retry).done).toContain("a");
  });
});
