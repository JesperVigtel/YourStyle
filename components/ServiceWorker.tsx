"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (or when NEXT_PUBLIC_SW=1). */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW !== "1") return;
    if (process.env.NEXT_PUBLIC_SW === "0") return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.includes("/_next/static/"));
        reg.active?.postMessage({ type: "cache-urls", urls });
      })
      .catch((e) => console.warn("SW registration failed", e));
  }, []);
  return null;
}
