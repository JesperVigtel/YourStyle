"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Collage } from "@/components/Collage";
import { Chip, ChipRow, Page, PageHeader, Skeleton } from "@/components/ui";
import { fetcher } from "@/lib/client/api";
import { formatDate } from "@/lib/client/date";
import { useItems } from "@/lib/client/hooks";
import type { Feedback, Outfit } from "@/lib/types";

type Row = Outfit & { feedback: Feedback | null; worn_on: string | null };

export default function HistoryPage() {
  const { data } = useSWR<{ outfits: Row[] }>("/api/outfits", fetcher);
  const { items } = useItems();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const [filter, setFilter] = useState<"liked" | "disliked" | "worn">("liked");

  const rows = (data?.outfits ?? []).filter((o) =>
    filter === "liked" ? o.feedback?.rating === 1 : filter === "disliked" ? o.feedback?.rating === -1 : !!o.worn_on,
  );

  return (
    <>
      <PageHeader title="Outfit history" back="/profile" />
      <Page>
        <ChipRow label="Filter">
          <Chip selected={filter === "liked"} onClick={() => setFilter("liked")}>
            👍 Liked
          </Chip>
          <Chip selected={filter === "disliked"} onClick={() => setFilter("disliked")}>
            👎 Disliked
          </Chip>
          <Chip selected={filter === "worn"} onClick={() => setFilter("worn")}>
            Worn
          </Chip>
        </ChipRow>
        {!data && <Skeleton className="mt-4 h-40 w-full" />}
        {data && !rows.length && <p className="mt-8 text-center text-sm text-muted">Nothing here yet.</p>}
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {rows.map((o) => (
            <li key={o.id} className="rounded-2xl border border-line bg-surface p-2">
              <Collage items={o.item_ids.map((id) => byId.get(id)).filter((x) => !!x)} />
              <p className="mt-1.5 text-[11px] text-muted">
                {formatDate(o.worn_on ?? o.created_at)}
                {o.context.mood ? ` · ${o.context.mood}` : ""}
              </p>
              {o.feedback && (o.feedback.reason_tags.length > 0 || o.feedback.comment) && (
                <p className="mt-0.5 text-xs">
                  {[...o.feedback.reason_tags, o.feedback.comment].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}
