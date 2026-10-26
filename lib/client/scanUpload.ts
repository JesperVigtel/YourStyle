import type { QueuedScan, UploadOutcome } from "./offlineQueue";

/** Sends one queued scan to /api/scans (create + evaluate in one request). */
export async function uploadQueuedScan(scan: QueuedScan, timeoutMs = 45_000): Promise<UploadOutcome> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { result: "retry", error: "offline" };
  const form = new FormData();
  form.set("id", scan.id);
  form.set("source", scan.source);
  form.set("captured_at", scan.created_at);
  if (scan.location) form.set("location", scan.location);
  scan.photos.forEach((p, i) => {
    form.append("photo", new File([p.data], `scan-${i}.jpg`, { type: p.type }));
    form.append("kind", p.kind);
  });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/scans", {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
    if (res.ok) return { result: "done" };
    const err = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`;
    // 4xx won't fix itself (except auth, which needs a login first); 5xx may be transient.
    if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429) {
      return { result: "fail", error: err };
    }
    return { result: "retry", error: err };
  } catch (e) {
    return {
      result: "retry",
      error: (e as Error).name === "AbortError" ? "timeout" : "network error",
    };
  } finally {
    clearTimeout(t);
  }
}
