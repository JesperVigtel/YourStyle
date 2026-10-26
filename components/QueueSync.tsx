"use client";

import { useEffect } from "react";
import { mutate } from "swr";
import { processQueue } from "@/lib/client/offlineQueue";
import { uploadQueuedScan } from "@/lib/client/scanUpload";

/** Drains the offline scan queue whenever the app is (back) online. Mounted once in the tab layout. */
export function QueueSync() {
  useEffect(() => {
    const run = () => {
      if (!navigator.onLine) return;
      processQueue((s) => uploadQueuedScan(s)).then(({ done }) => {
        if (done.length) mutate("/api/scans");
      });
    };
    run();
    const onVisible = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(run, 30_000);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, []);
  return null;
}
