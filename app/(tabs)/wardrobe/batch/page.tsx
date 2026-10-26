"use client";

import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { ItemForm, type ItemDraft } from "@/components/ItemForm";
import { Button, ErrorNote, Page, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { makeCutout, prepareImage, tagPhoto, tagsToDraft, type TagResponse } from "@/lib/client/capture";

type Entry = {
  key: string;
  preview: string;
  blob: Blob;
  state: "queued" | "tagging" | "ready" | "error" | "saved" | "skipped";
  tagged?: TagResponse;
  draft?: ItemDraft;
  cutoutUrl?: string | null;
  error?: string;
};

const CONCURRENCY = 2;

/** Batch mode: pick many photos, tag them in the background, then review one by one. */
export default function BatchPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(0);
  // Background removal is memory-hungry on a phone, so cutouts run one at a time.
  const cutoutChain = useRef<Promise<unknown>>(Promise.resolve());
  const cutouts = useRef(new Map<string, Promise<string | null>>());

  const patch = (key: string, p: Partial<Entry>) =>
    setEntries((es) => es.map((e) => (e.key === key ? { ...e, ...p } : e)));

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: Entry[] = [];
    for (const f of Array.from(files)) {
      try {
        const blob = await prepareImage(f);
        added.push({
          key: crypto.randomUUID(),
          blob,
          preview: URL.createObjectURL(blob),
          state: "queued",
        });
      } catch {
        setError(`Skipped ${f.name}: couldn't read it.`);
      }
    }
    setEntries((es) => [...es, ...added]);
  };

  // Tag queued entries, two at a time.
  useEffect(() => {
    const next = entries.filter((e) => e.state === "queued").slice(0, CONCURRENCY - running.current);
    for (const e of next) {
      running.current++;
      patch(e.key, { state: "tagging" });
      tagPhoto(e.blob, [])
        .then((tagged) =>
          patch(e.key, {
            state: "ready",
            tagged,
            draft: tagsToDraft(tagged.tags),
          }),
        )
        .catch((err) => patch(e.key, { state: "error", error: errorMessage(err) }))
        .finally(() => {
          running.current--;
          setEntries((es) => [...es]);
        });
      // Cutouts run in the background; they're attached when the item is saved (or later).
      const cut = cutoutChain.current.then(() => makeCutout(e.blob));
      cutoutChain.current = cut.catch(() => null);
      cutouts.current.set(e.key, cut);
      cut.then((url) => patch(e.key, { cutoutUrl: url }));
    }
  }, [entries]);

  const reviewing = entries.find((e) => e.key === reviewKey);
  const nextReady = (after?: string) => {
    const list = entries;
    const start = after ? list.findIndex((e) => e.key === after) + 1 : 0;
    return (
      [...list.slice(start), ...list.slice(0, start)].find((e) => e.state === "ready" && e.key !== after)?.key ?? null
    );
  };

  const save = async () => {
    if (!reviewing?.draft || !reviewing.tagged) return;
    setSaving(true);
    try {
      const { item } = await api<{ item: { id: string } }>("/api/items", {
        method: "POST",
        json: {
          ...reviewing.draft,
          photo_url: reviewing.tagged.photo_url,
          cutout_url: reviewing.cutoutUrl ?? null,
          ai_raw: reviewing.tagged.tags,
          user_verified: true,
        },
      });
      if (reviewing.cutoutUrl === undefined) {
        // Cutout still running: attach when it lands.
        cutouts.current.get(reviewing.key)?.then(
          (url) =>
            url &&
            api(`/api/items/${item.id}`, {
              method: "PATCH",
              json: { cutout_url: url },
            }),
        );
      }
      patch(reviewing.key, { state: "saved" });
      mutate("/api/items");
      setReviewKey(nextReady(reviewing.key));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const counts = entries.reduce<Record<string, number>>((m, e) => ((m[e.state] = (m[e.state] ?? 0) + 1), m), {});

  return (
    <>
      <PageHeader title="Batch add" back="/wardrobe" />
      <Page>
        {error && (
          <div className="mb-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {!reviewing && (
          <>
            <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl bg-accent font-semibold text-accent-ink">
              Pick photos from library
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Pick photos"
                onChange={(e) => pick(e.target.files)}
              />
            </label>
            {entries.length > 0 && (
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                {counts.tagging || counts.queued ? `Tagging ${(counts.tagging ?? 0) + (counts.queued ?? 0)}… ` : ""}
                {counts.ready ? `${counts.ready} ready to review. ` : ""}
                {counts.saved ? `${counts.saved} saved.` : ""}
              </p>
            )}
            <ul className="mt-3 grid grid-cols-4 gap-2">
              {entries.map((e) => (
                <li key={e.key} className="relative">
                  <button
                    type="button"
                    disabled={e.state !== "ready"}
                    onClick={() => setReviewKey(e.key)}
                    className="block aspect-square w-full overflow-hidden rounded-xl bg-canvas"
                    aria-label={`Review photo (${e.state})`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.preview} alt="" className="h-full w-full object-cover" />
                  </button>
                  <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded bg-black/60 text-center text-[10px] text-white">
                    {e.state === "tagging" || e.state === "queued" ? "…" : e.state}
                  </span>
                </li>
              ))}
            </ul>
            {counts.ready > 0 && (
              <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => setReviewKey(nextReady())}>
                Review {counts.ready} item{counts.ready > 1 ? "s" : ""}
              </Button>
            )}
          </>
        )}

        {reviewing?.draft && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reviewing.cutoutUrl ?? reviewing.preview}
              alt="Garment"
              className="mx-auto aspect-square w-1/2 rounded-2xl bg-canvas object-contain"
            />
            <div className="mt-4">
              <ItemForm
                value={reviewing.draft}
                onChange={(d) => patch(reviewing.key, { draft: d })}
                confidence={reviewing.tagged?.tags.confidence}
                compact
              />
            </div>
            <div className="bottom-tabbar sticky mt-4 flex gap-2 bg-bg/95 py-2 backdrop-blur">
              <Button
                className="flex-1"
                onClick={() => {
                  patch(reviewing.key, { state: "skipped" });
                  setReviewKey(nextReady(reviewing.key));
                }}
              >
                Skip
              </Button>
              <Button variant="primary" className="flex-[2]" onClick={save} disabled={saving}>
                {saving ? <Spinner /> : "Save & next"}
              </Button>
            </div>
            <button
              type="button"
              className="mt-2 flex h-11 w-full items-center justify-center text-sm text-muted underline"
              onClick={() => setReviewKey(null)}
            >
              Back to all photos
            </button>
          </div>
        )}
      </Page>
    </>
  );
}
