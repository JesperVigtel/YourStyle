"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ItemImage } from "@/components/Collage";
import { Chip, ChipRow, ErrorNote, Page, PageHeader, Skeleton, inputClass } from "@/components/ui";
import { useItems } from "@/lib/client/hooks";
import { CATEGORIES, ITEM_STATUSES, SEASONS, type Category, type ItemStatus, type Season } from "@/lib/types";

export default function WardrobePage() {
  const { items, error } = useItems();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<ItemStatus>("owned");
  const [season, setSeason] = useState<Season | "">("");
  const [color, setColor] = useState("");

  const colors = useMemo(
    () => [...new Set((items ?? []).flatMap((i) => i.colors.map((c) => c.name.toLowerCase())))].sort(),
    [items],
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items ?? []) m[i.status] = (m[i.status] ?? 0) + 1;
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      if (i.status !== status) return false;
      if (category && i.category !== category) return false;
      if (season && !i.seasons.includes(season)) return false;
      if (color && !i.colors.some((c) => c.name.toLowerCase() === color)) return false;
      if (!needle) return true;
      const hay = [
        i.category,
        i.subcategory,
        i.brand,
        i.material,
        i.pattern,
        i.notes,
        i.size_label,
        ...i.colors.map((c) => c.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, category, status, season, color]);

  return (
    <>
      <PageHeader
        title="Wardrobe"
        action={
          <Link href="/wardrobe/batch" className="flex h-11 items-center text-sm font-medium text-accent">
            Batch add
          </Link>
        }
      />
      <Page>
        <input
          type="search"
          className={inputClass}
          placeholder="Search brand, colour, material…"
          aria-label="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-3">
          <ChipRow label="Category">
            <Chip selected={!category} onClick={() => setCategory(null)}>
              all
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} selected={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {c}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div className="mt-2">
          <ChipRow label="Status">
            {ITEM_STATUSES.map((s) => (
              <Chip key={s} selected={status === s} onClick={() => setStatus(s)}>
                {s}
                {counts[s] ? ` · ${counts[s]}` : ""}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            aria-label="Season"
            className={inputClass}
            value={season}
            onChange={(e) => setSeason(e.target.value as Season | "")}
          >
            <option value="">any season</option>
            {SEASONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Colour" className={inputClass} value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="">any colour</option>
            {colors.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error.message}</ErrorNote>
          </div>
        )}
        <p className="mt-4 text-xs text-muted" aria-live="polite">
          {items ? `${filtered.length} item${filtered.length === 1 ? "" : "s"}` : "Loading…"}
        </p>
        <ul className="mt-2 grid grid-cols-3 gap-2" aria-label="Items">
          {!items && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-[3/4]" />)}
          {filtered.map((i) => (
            <li key={i.id}>
              <Link href={`/wardrobe/${i.id}`} className="block rounded-2xl bg-canvas p-2" data-testid="item-tile">
                <ItemImage item={i} className="aspect-square w-full" />
                <p className="mt-1 truncate text-xs font-medium">{i.subcategory ?? i.category}</p>
                <p className="truncate text-[11px] text-muted">
                  {[i.brand, i.wear_count ? `worn ${i.wear_count}×` : "never worn"].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        {items && !filtered.length && (
          <p className="mt-8 text-center text-sm text-muted">
            {items.length ? "Nothing matches these filters." : "No items yet. Tap + to add your first garment."}
          </p>
        )}
      </Page>
      <Link
        href="/wardrobe/add"
        aria-label="Add item"
        className="bottom-fab fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl text-accent-ink shadow-lg"
      >
        +
      </Link>
    </>
  );
}
