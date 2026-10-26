"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { ItemImage } from "@/components/Collage";
import { ItemForm, draftFrom, type ItemDraft } from "@/components/ItemForm";
import { Button, Card, ErrorNote, Page, PageHeader, SectionTitle, Skeleton, Spinner } from "@/components/ui";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { formatDate, todayLocal } from "@/lib/client/date";
import type { Item, WearLog } from "@/lib/types";

export default function ItemView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const key = `/api/items/${id}`;
  const { data, error } = useSWR<{ item: Item; wear: WearLog[] }>(key, fetcher);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const item = data?.item;
  const wear = data?.wear ?? [];

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      await mutate(key);
      mutate("/api/items");
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      await api(key, {
        method: "PATCH",
        json: { ...draft, user_verified: true },
      });
      setEditing(false);
    });

  const remove = async () => {
    if (!confirm("Delete this item permanently? Archiving keeps its history.")) return;
    await run("delete", () => api(key, { method: "DELETE" }));
    router.push("/wardrobe");
  };

  const costPerWear = item?.price && wear.length ? item.price / wear.length : null;

  return (
    <>
      <PageHeader
        title={item ? (item.subcategory ?? item.category) : "Item"}
        back="/wardrobe"
        action={
          item && !editing ? (
            <button
              type="button"
              className="h-11 px-2 text-sm font-medium text-accent"
              onClick={() => {
                setDraft(draftFrom(item));
                setEditing(true);
              }}
            >
              Edit
            </button>
          ) : null
        }
      />
      <Page>
        {error && <ErrorNote>{error.message}</ErrorNote>}
        {err && (
          <div className="mb-3">
            <ErrorNote>{err}</ErrorNote>
          </div>
        )}
        {!item && !error && <Skeleton className="aspect-square w-full" />}
        {item && (
          <>
            <button
              type="button"
              className="block w-full rounded-3xl bg-canvas p-4"
              onClick={() => setShowPhoto((s) => !s)}
              aria-label={showPhoto ? "Show cutout" : "Show original photo"}
            >
              <ItemImage
                item={showPhoto ? { ...item, cutout_url: null } : item}
                className="mx-auto aspect-square w-full max-w-sm"
              />
            </button>
            {item.cutout_url && (
              <p className="mt-1 text-center text-xs text-muted">
                Tap to see the {showPhoto ? "cutout" : "original photo"}
              </p>
            )}

            {!editing && (
              <>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {item.status !== "owned" && (
                    <span data-testid="status-badge" className="rounded-full bg-warn-soft px-3 py-1 text-warn">{item.status}</span>
                  )}
                  {item.is_reference && (
                    <span className="rounded-full bg-good-soft px-3 py-1 text-good">reference fit</span>
                  )}
                  {item.colors.map((c) => (
                    <span
                      key={c.name + c.hex}
                      className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1"
                    >
                      <span className="h-3 w-3 rounded-full border border-line" style={{ background: c.hex }} />
                      {c.name}
                    </span>
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {(
                    [
                      ["Category", item.category],
                      ["Brand", item.brand],
                      ["Size", item.size_label],
                      ["Fit", item.fit_verdict],
                      ["Material", item.material],
                      ["Pattern", item.pattern],
                      ["Formality", item.formality ? `${item.formality}/5` : null],
                      ["Warmth", item.warmth ? `${item.warmth}/5` : null],
                      ["Seasons", item.seasons.join(", ") || null],
                      ["Price", item.price != null ? `${item.price} ${item.currency ?? ""}` : null],
                      ["Acquired", item.acquired_date ? formatDate(item.acquired_date) : null],
                      ["Source", item.source],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-muted">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                {item.notes && <p className="mt-3 text-sm text-muted">{item.notes}</p>}

                <SectionTitle>Wear history</SectionTitle>
                <Card>
                  <p className="text-sm">
                    Worn <strong>{wear.length}</strong> time
                    {wear.length === 1 ? "" : "s"}
                    {wear[0] && <> · last {formatDate(wear[0].date)}</>}
                    {costPerWear && (
                      <>
                        {" "}
                        · {costPerWear.toFixed(2)} {item.currency ?? ""} per wear
                      </>
                    )}
                  </p>
                  {wear.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
                      {wear.slice(0, 30).map((w) => (
                        <li key={w.id} className="rounded-full bg-surface-2 px-2 py-0.5">
                          {formatDate(w.date)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.status === "owned" && (
                    <Button
                      className="mt-3 w-full"
                      onClick={() =>
                        run("wear", () =>
                          api("/api/wear", {
                            method: "POST",
                            json: { item_ids: [item.id], date: todayLocal() },
                          }),
                        )
                      }
                      disabled={!!busy}
                    >
                      {busy === "wear" ? <Spinner /> : "Wore it today"}
                    </Button>
                  )}
                </Card>

                {item.label_photo_urls.length > 0 && (
                  <>
                    <SectionTitle>Labels</SectionTitle>
                    <div className="flex gap-2">
                      {item.label_photo_urls.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="Label" className="h-24 w-24 rounded-xl object-cover" />
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-6 flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={!!busy}
                    onClick={() =>
                      run("archive", () =>
                        api(key, {
                          method: "PATCH",
                          json: {
                            status: item.status === "archived" ? "owned" : "archived",
                          },
                        }),
                      )
                    }
                  >
                    {item.status === "archived" ? "Unarchive" : "Archive"}
                  </Button>
                  <Button variant="danger" className="flex-1" disabled={!!busy} onClick={remove}>
                    Delete
                  </Button>
                </div>
              </>
            )}

            {editing && draft && (
              <div className="mt-4">
                <ItemForm value={draft} onChange={setDraft} />
                <div className="bottom-tabbar sticky mt-4 flex gap-2 bg-bg/95 py-2 backdrop-blur">
                  <Button className="flex-1" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-[2]" onClick={save} disabled={busy === "save"}>
                    {busy === "save" ? <Spinner /> : "Save changes"}
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
