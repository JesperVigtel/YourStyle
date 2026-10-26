"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Collage, type CollageItem } from "@/components/Collage";
import clsx from "clsx";
import {
  Button,
  Card,
  ErrorNote,
  Page,
  PageHeader,
  SectionTitle,
  Skeleton,
  Spinner,
  inputClass,
} from "@/components/ui";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/date";
import { useItems } from "@/lib/client/hooks";
import { makeCutout } from "@/lib/client/capture";
import { useStored } from "@/lib/client/useStored";
import type { Item, Scan } from "@/lib/types";

export default function ScanView() {
  const { id } = useParams<{ id: string }>();
  const key = `/api/scans/${id}`;
  const { data, error } = useSWR<{ scan: Scan; item: Item | null }>(key, fetcher, {
    // Still being evaluated (e.g. by a request that's still running): poll until it's done.
    refreshInterval: (d) => (d?.scan.status === "pending" ? 2000 : 0),
  });
  const { items } = useItems();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [priceInput, setPrice] = useState<string | null>(null);
  const [latencyText] = useStored(`scan-latency:${id}`, "session");
  const latency = latencyText ? Number(latencyText) : null;
  const cutoutStarted = useRef(false);

  const scan = data?.scan;
  const v = scan?.verdict;
  const x = scan?.extracted;

  const price = priceInput ?? (scan?.price != null ? String(scan.price) : "");

  // Make a cutout of the garment photo for the collages (in the background, best effort).
  useEffect(() => {
    if (!scan || scan.cutout_url || cutoutStarted.current) return;
    const idx = scan.photo_kinds.findIndex((k) => k === "garment");
    if (idx < 0) return;
    cutoutStarted.current = true;
    fetch(scan.photo_urls[idx])
      .then((r) => r.blob())
      .then(makeCutout)
      .then((url) => url && api(key, { method: "PATCH", json: { cutout_url: url } }).then(() => mutate(key)))
      .catch(() => undefined);
  }, [scan, key]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      await mutate(key);
      mutate("/api/scans");
      mutate("/api/items");
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const parsedPrice = () => {
    const n = parseFloat(price.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const newPiece: CollageItem | null = scan
    ? {
        id: "__new__",
        category: x?.category ?? "top",
        cutout_url: scan.cutout_url,
        photo_url:
          scan.photo_urls[
            Math.max(
              0,
              scan.photo_kinds.findIndex((k) => k === "garment" || k === "screenshot"),
            )
          ] ?? null,
        subcategory: x?.subcategory,
      }
    : null;

  return (
    <>
      <PageHeader title="Verdict" back="/shop" />
      <Page>
        {error && <ErrorNote>{error.message}</ErrorNote>}
        {err && (
          <div className="mb-3">
            <ErrorNote>{err}</ErrorNote>
          </div>
        )}
        {!scan && !error && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {scan?.status === "pending" && (
          <Card className="text-center">
            <div className="flex flex-col items-center gap-3 py-6" aria-live="polite">
              <Spinner className="h-8 w-8 text-accent" />
              <p className="font-medium">Still checking it against your wardrobe…</p>
            </div>
          </Card>
        )}

        {scan?.status === "error" && (
          <Card>
            <p className="text-sm text-bad">{scan.error ?? "Evaluation failed."}</p>
            <Button
              className="mt-3 w-full"
              onClick={() => act("retry", () => api(`${key}/evaluate`, { method: "POST" }))}
              disabled={!!busy}
            >
              {busy === "retry" ? <Spinner /> : "Try again"}
            </Button>
          </Card>
        )}

        {scan && v && x && (
          <>
            {/* The decision first, readable at arm's length in a shop: verdict, then the three facts behind it. */}
            <section
              aria-label="Verdict"
              className={clsx(
                "rounded-3xl p-4",
                v.verdict === "buy" && "bg-good-soft",
                v.verdict === "maybe" && "bg-warn-soft",
                v.verdict === "skip" && "bg-bad-soft",
              )}
            >
              <div className="flex items-center gap-3">
                {newPiece && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={newPiece.cutout_url ?? newPiece.photo_url ?? ""}
                    alt="Scanned garment"
                    className="h-20 w-20 shrink-0 rounded-2xl bg-canvas object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    data-testid="verdict-badge"
                    className={clsx(
                      "text-4xl font-bold capitalize",
                      v.verdict === "buy" && "text-good",
                      v.verdict === "maybe" && "text-warn",
                      v.verdict === "skip" && "text-bad",
                    )}
                  >
                    {v.verdict}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 text-sm font-medium">
                    <li>+{v.outfit_gain.count} outfits</li>
                    <li>{v.fit.likely_verdict ? `fit: ${v.fit.likely_verdict}` : "fit: unsure"}</li>
                    {v.overlap.length > 0 && <li>{v.overlap.length} similar owned</li>}
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-[15px] leading-snug" data-testid="verdict-reason">
                {v.reason}
              </p>
              {latency && <p className="mt-2 text-xs text-muted">Verdict in {(latency / 1000).toFixed(1)} s</p>}
            </section>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {(
                [
                  ["Brand", x.brand],
                  ["Size", x.size_label],
                  ["Material", x.material],
                  ["Price", x.price != null ? `${x.price} ${x.currency ?? ""}` : null],
                  ["Made in", x.country_of_origin],
                  ["Era", x.era],
                  ["Condition", x.condition],
                  ["Type", [x.category, x.subcategory].filter(Boolean).join(" · ")],
                ] as const
              )
                .filter(([, val]) => val)
                .map(([k, val]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
            </dl>

            <SectionTitle>Fit</SectionTitle>
            <Card>
              <p className="text-sm">{v.fit.prediction}</p>
              <p className="mt-1 text-xs text-muted">
                Confidence: {v.fit.confidence}
                {v.fit.likely_verdict ? ` · likely ${v.fit.likely_verdict}` : ""}
              </p>
            </Card>

            <SectionTitle>Outfit gain</SectionTitle>
            <p className="text-sm">
              <strong className="text-lg">{v.outfit_gain.count}</strong> new outfit
              {v.outfit_gain.count === 1 ? "" : "s"} with what you own
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {newPiece &&
                v.outfit_gain.examples.map((ex, i) => (
                  <figure key={i}>
                    <Collage
                      items={[
                        newPiece,
                        ...ex.item_ids.map((iid) => byId.get(iid)).filter((it): it is NonNullable<typeof it> => !!it),
                      ]}
                      highlightId="__new__"
                    />
                    <figcaption className="mt-1 text-xs text-muted">{ex.note}</figcaption>
                  </figure>
                ))}
            </div>

            {v.overlap.length > 0 && (
              <>
                <SectionTitle>You already own something similar</SectionTitle>
                <ul className="space-y-2">
                  {v.overlap.map((o) => {
                    const it = byId.get(o.item_id);
                    return (
                      <li
                        key={o.item_id}
                        className="flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn-soft p-2 text-sm"
                      >
                        {it && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.cutout_url ?? it.photo_url ?? ""}
                            alt=""
                            className="h-12 w-12 rounded-lg bg-canvas object-contain"
                          />
                        )}
                        <span>{o.note}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <SectionTitle>Material</SectionTitle>
            <p className="text-sm">{v.material_note}</p>

            {v.price_sanity && (
              <>
                <SectionTitle>Price sanity (rough estimate)</SectionTitle>
                <p className="text-sm">
                  {v.price_sanity.low}–{v.price_sanity.high} {v.price_sanity.currency}.{" "}
                  <span className="text-muted">{v.price_sanity.note}</span>
                </p>
              </>
            )}

            <SectionTitle>Decide</SectionTitle>
            {scan.decision === "bought" ? (
              <Card>
                <p className="text-sm">
                  Bought ✓ — it&apos;s in your wardrobe.{" "}
                  {scan.item_id && (
                    <Link
                      className="inline-flex h-11 items-center text-accent underline"
                      href={`/wardrobe/${scan.item_id}`}
                    >
                      Open item
                    </Link>
                  )}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-muted">
                  Price paid
                  <input
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    aria-label="Price paid"
                  />
                </label>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={!!busy}
                  onClick={() =>
                    act("buy", () =>
                      api(`${key}/convert`, {
                        method: "POST",
                        json: {
                          acquired_date: todayLocal(),
                          price: parsedPrice(),
                        },
                      }),
                    )
                  }
                >
                  {busy === "buy" ? <Spinner /> : "I bought it"}
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    disabled={!!busy}
                    aria-pressed={scan.saved_as === "wishlist"}
                    onClick={() =>
                      act("wish", () =>
                        api(key, {
                          method: "PATCH",
                          json: { saved_as: "wishlist" },
                        }),
                      )
                    }
                  >
                    {scan.saved_as === "wishlist" ? "✓ Wishlist" : "Wishlist"}
                  </Button>
                  <Button
                    disabled={!!busy}
                    aria-pressed={scan.saved_as === "considered"}
                    onClick={() =>
                      act("cons", () =>
                        api(key, {
                          method: "PATCH",
                          json: { saved_as: "considered" },
                        }),
                      )
                    }
                  >
                    {scan.saved_as === "considered" ? "✓ Considered" : "Considered"}
                  </Button>
                  <Button
                    disabled={!!busy}
                    aria-pressed={scan.decision === "skipped"}
                    onClick={() =>
                      act("skip", () =>
                        api(key, {
                          method: "PATCH",
                          json: { decision: "skipped" },
                        }),
                      )
                    }
                  >
                    {scan.decision === "skipped" ? "✓ Skipped" : "Skip"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Page>
    </>
  );
}
