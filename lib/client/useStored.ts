"use client";

import { useCallback, useSyncExternalStore } from "react";

type Area = "local" | "session";
const EVENT = "wardrobe:storage";

function storage(area: Area): Storage | null {
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // private mode / blocked storage
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** A string in local/session storage as React state. Renders `null` on the server. */
export function useStored(key: string, area: Area = "local"): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => storage(area)?.getItem(key) ?? null,
    () => null,
  );
  const set = useCallback(
    (v: string | null) => {
      const s = storage(area);
      if (!s) return;
      if (v === null) s.removeItem(key);
      else s.setItem(key, v);
      window.dispatchEvent(new Event(EVENT));
    },
    [key, area],
  );
  return [value, set];
}

export function writeStored(key: string, value: string, area: Area = "local") {
  storage(area)?.setItem(key, value);
}
