"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { ItemForm, type ItemDraft } from "@/components/ItemForm";
import { Button, ErrorNote, Page, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { makeCutout, prepareImage, tagPhoto, tagsToDraft, type TagResponse } from "@/lib/client/capture";
import { warmUpBackgroundRemoval } from "@/lib/client/bgRemoval";
import type { Item } from "@/lib/types";

type Stage = "photo" | "labels" | "tagging" | "review" | "saving" | "saved";

const now = () => performance.now();
const secondsSince = (start: number) => Math.round((now() - start) / 100) / 10;

export default function AddItemPage() {
  const router = useRouter();
  const started = useRef(0);
  const [stage, setStage] = useState<Stage>("photo");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [labels, setLabels] = useState<Blob[]>([]);
  const [tagged, setTagged] = useState<TagResponse | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [cutout, setCutout] = useState<{
    state: "running" | "done" | "failed";
    url: string | null;
  }>({ state: "running", url: null });
  const cutoutPromise = useRef<Promise<string | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    started.current = now(); // capture time is measured from opening this screen (tapping +)
    warmUpBackgroundRemoval();
  }, []);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await prepareImage(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
      setStage("labels");
      // Background removal starts right away and runs in parallel with tagging.
      setCutout({ state: "running", url: null });
      cutoutPromise.current = makeCutout(blob);
      cutoutPromise.current.then((url) => setCutout({ state: url ? "done" : "failed", url }));
    } catch (e) {
      setError(`Couldn't read that photo: ${errorMessage(e)}`);
    }
  };

  const onLabel = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await prepareImage(file);
      setLabels((l) => [...l, blob].slice(0, 3));
    } catch (e) {
      setError(`Couldn't read that photo: ${errorMessage(e)}`);
    }
  };

  const runTagging = async () => {
    if (!photo) return;
    setStage("tagging");
    setError(null);
    try {
      const res = await tagPhoto(
        photo,
        labels.map((blob) => ({ blob, kind: "label" })),
      );
      setTagged(res);
      setDraft(tagsToDraft(res.tags));
      setStage("review");
    } catch (e) {
      setError(errorMessage(e));
      setStage("labels");
    }
  };

  const save = async (addAnother: boolean) => {
    if (!draft || !tagged) return;
    setStage("saving");
    try {
      const { item } = await api<{ item: Item }>("/api/items", {
        method: "POST",
        json: {
          ...draft,
          photo_url: tagged.photo_url,
          label_photo_urls: tagged.label_photo_urls,
          cutout_url: cutout.url,
          ai_raw: tagged.tags,
          user_verified: true,
          capture_seconds: secondsSince(started.current),
        },
      });
      // If the cutout finishes after saving, attach it then. Never blocks saving.
      if (!cutout.url && cutoutPromise.current) {
        cutoutPromise.current.then((url) => {
          if (url)
            api(`/api/items/${item.id}`, {
              method: "PATCH",
              json: { cutout_url: url },
            }).then(() => mutate("/api/items"));
        });
      }
      mutate("/api/items");
      if (addAnother) reset();
      else {
        setSavedId(item.id);
        setStage("saved");
      }
    } catch (e) {
      setError(errorMessage(e));
      setStage("review");
    }
  };

  const reset = () => {
    started.current = now();
    setStage("photo");
    setPhoto(null);
    setPreview(null);
    setLabels([]);
    setTagged(null);
    setDraft(null);
    setError(null);
    cutoutPromise.current = null;
  };

  return (
    <>
      <PageHeader title="Add item" back="/wardrobe" />
      <Page>
        {error && (
          <div className="mb-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {stage === "photo" && (
          <div className="space-y-3">
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-accent/50 bg-accent-soft text-accent">
              <CameraIcon />
              <span className="text-base font-semibold">Take a photo</span>
              <span className="text-xs text-muted">Garment flat or hanging, good light</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label="Take a photo"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </label>
            <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium">
              Choose from library
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Choose from library"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </label>
            <Link href="/wardrobe/batch" className="flex h-11 items-center justify-center text-sm text-muted underline">
              Adding many? Use batch mode
            </Link>
          </div>
        )}

        {stage !== "photo" && preview && (
          <div className="relative mx-auto w-2/3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cutout.url ?? preview}
              alt="Garment"
              className="aspect-square w-full rounded-2xl bg-canvas object-contain"
            />
            <span
              className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white"
              aria-live="polite"
            >
              {cutout.state === "running"
                ? "Removing background…"
                : cutout.state === "done"
                  ? "Cutout ready"
                  : "Using original photo"}
            </span>
          </div>
        )}

        {stage === "labels" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">Optional: add the brand, size or care label for better tags.</p>
            {labels.length > 0 && (
              <p className="text-sm">
                {labels.length} label photo{labels.length > 1 ? "s" : ""} added
              </p>
            )}
            {labels.length < 3 && (
              <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium">
                + Label photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label="Add label photo"
                  onChange={(e) => onLabel(e.target.files?.[0])}
                />
              </label>
            )}
            <Button variant="primary" size="lg" className="w-full" onClick={runTagging}>
              Tag it
            </Button>
          </div>
        )}

        {stage === "tagging" && (
          <div className="mt-4 space-y-3" aria-label="Tagging">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Reading the garment…
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        )}

        {(stage === "review" || stage === "saving") && draft && (
          <div className="mt-4">
            <ItemForm value={draft} onChange={setDraft} confidence={tagged?.tags.confidence} compact />
            <div className="bottom-tabbar sticky mt-4 flex gap-2 bg-bg/95 py-2 backdrop-blur">
              <Button className="flex-1" onClick={() => save(false)} disabled={stage === "saving"}>
                Save
              </Button>
              <Button variant="primary" className="flex-[2]" onClick={() => save(true)} disabled={stage === "saving"}>
                {stage === "saving" ? <Spinner /> : "Save & add another"}
              </Button>
            </div>
          </div>
        )}

        {stage === "saved" && (
          <div className="mt-6 space-y-3 text-center">
            <p className="text-lg font-semibold">Saved ✓</p>
            <Button variant="primary" size="lg" className="w-full" onClick={reset}>
              Add another
            </Button>
            <Button className="w-full" onClick={() => router.push(savedId ? `/wardrobe/${savedId}` : "/wardrobe")}>
              View item
            </Button>
          </div>
        )}
      </Page>
    </>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
