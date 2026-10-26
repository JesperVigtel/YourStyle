"use client";

import useSWR from "swr";
import { fetcher } from "./api";
import type { Item, Mood, Scan, StyleProfile } from "@/lib/types";

export type ItemWithStats = Item & {
  wear_count: number;
  last_worn: string | null;
};

export function useItems() {
  const r = useSWR<{ items: ItemWithStats[] }>("/api/items", fetcher);
  return { ...r, items: r.data?.items };
}

export function useMoods() {
  const r = useSWR<{ moods: Mood[] }>("/api/moods", fetcher);
  return { ...r, moods: r.data?.moods };
}

export function useStyleProfile() {
  const r = useSWR<{ profile: StyleProfile | null }>("/api/style-profile", fetcher);
  return { ...r, profile: r.data?.profile };
}

export function useScans() {
  const r = useSWR<{ scans: Scan[] }>("/api/scans", fetcher);
  return { ...r, scans: r.data?.scans };
}
