"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { mutate } from "swr";
import { Button, Card, Chip, ErrorNote, Page, PageHeader, SectionTitle, Skeleton, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/date";
import { useScans } from "@/lib/client/hooks";
import { prepareImage } from "@/lib/client/image";
import { warmUpBackgroundRemoval } from "@/lib/client/bgRemoval";
import {
  QUEUE_EVENT,
  enqueueScan,
  listQueued,
  processQueue,
  removeQueued,
  type QueuedPhoto,
  type QueuedScan,
} from "@/lib/client/offlineQueue";
import { uploadQueuedScan } from "@/lib/client/scanUpload";
import { useStored, writeStored } from "@/lib/client/useStored";
import { VerdictBadge } from "@/components/VerdictBadge";
import type { ItemSource, ScanPhotoKind } from "@/lib/types";

const STEPS: { kind: ScanPhotoKind; title: string; hint: string }[] = [
  { kind: "garment", title: "Garment", hint: "The whole piece" },
  { kind: "brand", title: "Brand label", hint: "Neck or waist label" },
  {
    kind: "care",
    title: "Size / care label",
    hint: "Size + material composition",
  },
  { kind: "price", title: "Price tag", hint: "Tag or sign" },
];
const SOURCE_KEY = "wardrobe:shopSource";

type Shot = { kind: ScanPhotoKind; blob: Blob; preview: string };

export default function ShopPage() {
  const router = useRouter();
  const { scans } = useScans();
  const [storedSource, setStoredSource] = useStored(SOURCE_KEY);
  const source: ItemSource = storedSource === "vintage" ? "vintage" : "store";
  const [step, setStep] = useState<number | null>(null); // null = not capturing
  const [shots, setShots] = useState<Shot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueuedScan[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      listQueued()
        .then((q) => alive && setQueued(q))
        .catch(() => alive && setQueued([]));
    };
    refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(QUEUE_EVENT, refresh);
    };
  }, []);

  const chooseSource = (s: ItemSource) => setStoredSource(s);

  const addShot = async (file: File | undefined, kind: ScanPhotoKind) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await prepareImage(file);
      const next = [...shots, { kind, blob, preview: URL.createObjectURL(blob) }];
      setShots(next);
      if (kind === "screenshot") return submit(next, "online");
      const idx = STEPS.findIndex((s) => s.kind === kind);
      if (idx === STEPS.length - 1) return submit(next, source);
      setStep(idx + 1);
    } catch (e) {
      setError(`Couldn't read that photo: ${errorMessage(e)}`);
    }
  };

  const reset = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.preview));
    setShots([]);
    setStep(null);
  };

  const submit = async (list: Shot[], src: ItemSource) => {
    if (!list.length) return;
    setSubmitting(true);
    setNotice(null);
    const started = performance.now();
    const id = crypto.randomUUID();
    try {
      const photos: QueuedPhoto[] = await Promise.all(
        list.map(async (s) => ({
          kind: s.kind,
          type: s.blob.type || "image/jpeg",
          data: await s.blob.arrayBuffer(),
        })),
      );
      // Persist first: nothing is lost if the signal or the app drops from here on.
      await enqueueScan({
        id,
        created_at: new Date().toISOString(),
        source: src,
        location: null,
        photos,
      });
      reset();
      if (!navigator.onLine) {
        setNotice("No signal — scan saved. It'll be evaluated automatically when you're back online.");
        return;
      }
      const { done } = await processQueue((s) => uploadQueuedScan(s));
      if (done.includes(id)) {
        try {
          writeStored(`scan-latency:${id}`, String(Math.round(performance.now() - started)), "session");
        } catch {}
        mutate("/api/scans");
        router.push(`/shop/${id}`);
      } else {
        setNotice("Weak signal — scan saved and queued. It'll be evaluated automatically.");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const capturing = step !== null;
  const current = step !== null ? STEPS[step] : null;

  return (
    <>
      <PageHeader title="Shop" />
      <Page>
        {error && (
          <div className="mb-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        {notice && (
          <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
            {notice}
          </p>
        )}

        {submitting && (
          <Card className="text-center">
            <div className="flex flex-col items-center gap-3 py-6" aria-live="polite">
              <Spinner className="h-8 w-8 text-accent" />
              <p className="font-medium">Checking it against your wardrobe…</p>
              <p className="text-xs text-muted">Fit · outfits · duplicates · verdict</p>
            </div>
          </Card>
        )}

        {!capturing && !submitting && (
          <>
            <div className="flex justify-center gap-2" role="group" aria-label="Where are you?">
              <Chip selected={source === "store"} onClick={() => chooseSource("store")}>
                In a store
              </Chip>
              <Chip selected={source === "vintage"} onClick={() => chooseSource("vintage")}>
                Vintage / second-hand
              </Chip>
            </div>
            <label
              className="mt-4 flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[2rem] bg-accent text-accent-ink shadow-lg active:scale-[0.99]"
              onClick={() => warmUpBackgroundRemoval()}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-16 w-16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span className="text-2xl font-semibold">Scan</span>
              <span className="text-sm opacity-80">Garment → brand → size/care → price</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label="Scan garment"
                onChange={(e) => addShot(e.target.files?.[0], "garment")}
              />
            </label>
            <label className="mt-3 flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium">
              Evaluate a web-shop screenshot
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Upload screenshot"
                onChange={(e) => addShot(e.target.files?.[0], "screenshot")}
              />
            </label>
          </>
        )}

        {capturing && current && !submitting && (
          <div>
            <ol className="flex gap-1.5" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s.kind} className={clsx("h-1.5 flex-1 rounded-full", i <= step! ? "bg-accent" : "bg-line")} />
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              {shots.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={s.preview} alt={s.kind} className="h-16 w-16 rounded-xl object-cover" />
              ))}
            </div>
            <label className="mt-4 flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-accent/60 bg-accent-soft text-accent">
              <span className="text-xl font-semibold">{current.title}</span>
              <span className="text-sm text-muted">{current.hint}</span>
              <span className="mt-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
                Take photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label={`Photo of ${current.title}`}
                onChange={(e) => addShot(e.target.files?.[0], current.kind)}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="lg" onClick={() => (step! < STEPS.length - 1 ? setStep(step! + 1) : submit(shots, source))}>
                Skip
              </Button>
              <Button variant="primary" size="lg" onClick={() => submit(shots, source)}>
                Done
              </Button>
            </div>
            <button type="button" className="mt-3 flex h-11 w-full items-center justify-center text-sm text-muted underline" onClick={reset}>
              Cancel scan
            </button>
          </div>
        )}

        {queued.length > 0 && (
          <>
            <SectionTitle>Waiting for signal</SectionTitle>
            <ul className="space-y-2" aria-label="Pending scans">
              {queued.map((q) => (
                <PendingScan key={q.id} scan={q} />
              ))}
            </ul>
          </>
        )}

        {!capturing && !submitting && (
          <>
            <SectionTitle>Recent scans</SectionTitle>
            {!scans && <Skeleton className="h-16 w-full" />}
            {scans?.length === 0 && <p className="text-sm text-muted">No scans yet.</p>}
            <ul className="space-y-2">
              {scans?.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shop/${s.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.cutout_url ?? s.photo_urls[0]}
                      alt=""
                      className="h-14 w-14 rounded-xl bg-canvas object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {[s.extracted?.brand, s.extracted?.subcategory ?? s.extracted?.category]
                          .filter(Boolean)
                          .join(" · ") || "Scan"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(s.created_at)}
                        {s.decision === "bought" ? " · bought" : s.saved_as ? ` · ${s.saved_as}` : ""}
                      </p>
                    </div>
                    <VerdictBadge verdict={s.status === "done" ? s.verdict?.verdict : s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Page>
    </>
  );
}

function PendingScan({ scan }: { scan: QueuedScan }) {
  const photo = scan.photos[0];
  const url = useMemo(
    () => (photo ? URL.createObjectURL(new Blob([photo.data], { type: photo.type })) : null),
    [photo],
  );
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return (
    <li
      className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-2"
      data-testid="pending-scan"
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-14 w-14 rounded-xl object-cover" />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {scan.state === "uploading" ? "Evaluating…" : scan.state === "failed" ? "Failed" : "Pending"}
        </p>
        <p className="truncate text-xs text-muted">
          {scan.photos.length} photo{scan.photos.length > 1 ? "s" : ""} · {formatDate(scan.created_at)}
          {scan.last_error ? ` · ${scan.last_error}` : ""}
        </p>
      </div>
      {scan.state === "failed" && (
        <Button onClick={() => processQueue((s) => uploadQueuedScan(s), { includeFailed: true })}>Retry</Button>
      )}
      <button
        type="button"
        aria-label="Delete pending scan"
        className="h-11 w-11 text-muted"
        onClick={() => removeQueued(scan.id)}
      >
        ×
      </button>
    </li>
  );
}
