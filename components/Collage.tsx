"use client";

import clsx from "clsx";
import type { Category } from "@/lib/types";

export type CollageItem = {
  id: string;
  category: Category;
  cutout_url: string | null;
  photo_url: string | null;
  subcategory?: string | null;
};

// Flat-lay slots as % of a square canvas: [left, top, width, height].
type Box = [number, number, number, number];
const SLOTS: Record<string, Box> = {
  outerwear: [2, 3, 50, 58],
  top: [44, 3, 52, 44],
  "top-solo": [24, 2, 52, 44],
  "one-piece": [26, 3, 48, 70],
  bottom: [30, 36, 42, 56],
  shoes: [62, 74, 34, 23],
  accessory: [4, 64, 28, 30],
  bag: [4, 64, 28, 30],
  other: [4, 64, 28, 30],
};

function slotFor(item: CollageItem, hasOuter: boolean): string {
  if (item.category === "top") return hasOuter ? "top" : "top-solo";
  return SLOTS[item.category] ? item.category : "other";
}

export function ItemImage({
  item,
  className,
}: {
  item: Pick<CollageItem, "cutout_url" | "photo_url" | "subcategory" | "category">;
  className?: string;
}) {
  const src = item.cutout_url ?? item.photo_url;
  const label = item.subcategory ?? item.category;
  if (!src) {
    return (
      <div className={clsx("flex items-center justify-center rounded-lg bg-surface-2 text-xs text-muted", className)}>
        {label}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth-protected API images, already resized client-side
    <img
      src={src}
      alt={label}
      loading="lazy"
      draggable={false}
      className={clsx("object-contain", !item.cutout_url && "rounded-lg", className)}
    />
  );
}

export function Collage({
  items,
  selectedId,
  onItemClick,
  highlightId,
  className,
}: {
  items: CollageItem[];
  selectedId?: string | null;
  onItemClick?: (id: string) => void;
  /** e.g. the new piece in shop mode */
  highlightId?: string;
  className?: string;
}) {
  const hasOuter = items.some((i) => i.category === "outerwear");
  const used = new Map<string, number>();
  // Draw back-to-front: outerwear first, shoes and accessories last.
  const order: Record<string, number> = {
    outerwear: 0,
    "one-piece": 1,
    bottom: 2,
    top: 3,
    "top-solo": 3,
    shoes: 4,
  };
  const placed = items
    .map((item) => {
      const slot = slotFor(item, hasOuter);
      const n = used.get(slot) ?? 0;
      used.set(slot, n + 1);
      const [l, t, w, h] = SLOTS[slot];
      return { item, slot, box: [l + n * 8, t + n * 6, w, h] as Box };
    })
    .sort((a, b) => (order[a.slot] ?? 5) - (order[b.slot] ?? 5));

  return (
    <div className={clsx("relative aspect-square w-full overflow-hidden rounded-2xl bg-canvas", className)}>
      {placed.map(({ item, box: [l, t, w, h] }) => {
        const style = {
          left: `${l}%`,
          top: `${t}%`,
          width: `${w}%`,
          height: `${h}%`,
        };
        const img = <ItemImage item={item} className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]" />;
        const ring = clsx(
          "absolute rounded-xl transition",
          selectedId === item.id && "ring-2 ring-accent ring-offset-2 ring-offset-canvas",
          highlightId === item.id && "ring-2 ring-good ring-offset-2 ring-offset-canvas",
        );
        return onItemClick ? (
          <button
            key={item.id}
            type="button"
            style={style}
            className={ring}
            onClick={() => onItemClick(item.id)}
            aria-label={`Select ${item.subcategory ?? item.category}`}
            aria-pressed={selectedId === item.id}
          >
            {img}
          </button>
        ) : (
          <div key={item.id} style={style} className={ring}>
            {img}
          </div>
        );
      })}
    </div>
  );
}
