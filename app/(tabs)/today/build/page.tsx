"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Collage, ItemImage } from "@/components/Collage";
import { Button, ErrorNote, Page, PageHeader, SectionTitle, Skeleton, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/date";
import { useItems } from "@/lib/client/hooks";
import { CATEGORIES } from "@/lib/types";

/** Manual outfit builder: tap items to compose an outfit, then save or log it as worn today. */
export default function BuildPage() {
  const { items } = useItems();
  const owned = useMemo(() => (items ?? []).filter((i) => i.status === "owned"), [items]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<"save" | "wear" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setDone(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const chosen = selected.map((id) => owned.find((i) => i.id === id)).filter((x) => !!x);

  const save = async (wear: boolean) => {
    setBusy(wear ? "wear" : "save");
    setError(null);
    try {
      await api("/api/outfits", {
        method: "POST",
        json: {
          item_ids: selected,
          origin: wear ? "logged" : "manual",
          wear_date: wear ? todayLocal() : null,
        },
      });
      setDone(wear ? "Logged as today's outfit." : "Outfit saved.");
      setSelected([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Build an outfit" back="/today" />
      <Page>
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-bg/95 px-4 pb-3 backdrop-blur">
          <div className="mx-auto w-1/2 min-w-40">
            {chosen.length ? (
              <Collage items={chosen} />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-line text-center text-sm text-muted">
                Tap items below
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => save(false)} disabled={selected.length < 2 || !!busy}>
              {busy === "save" ? <Spinner /> : "Save outfit"}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => save(true)}
              disabled={selected.length < 2 || !!busy}
            >
              {busy === "wear" ? <Spinner /> : "Wear today"}
            </Button>
          </div>
          {done && <p className="mt-2 text-center text-sm text-good">{done}</p>}
          {error && (
            <div className="mt-2">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>

        {!items && <Skeleton className="mt-4 h-40 w-full" />}
        {CATEGORIES.map((cat) => {
          const list = owned.filter((i) => i.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat}>
              <SectionTitle>{cat}</SectionTitle>
              <div className="grid grid-cols-4 gap-2">
                {list.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggle(i.id)}
                    aria-pressed={selected.includes(i.id)}
                    aria-label={`${i.colors[0]?.name ?? ""} ${i.subcategory ?? i.category}`}
                    className={clsx(
                      "aspect-square rounded-xl bg-canvas p-1.5",
                      selected.includes(i.id) && "ring-2 ring-accent",
                    )}
                  >
                    <ItemImage item={i} className="h-full w-full" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Page>
    </>
  );
}
